"use client";

import { useState } from "react";
import { Clock, CheckCircle2, ChefHat, PackagePlus, Trash2, ClipboardCheck, Ban } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StockRequestModal } from "@/components/StockRequestModal";
import { WasteModal } from "@/components/WasteModal";
import { ShiftCloseCountModal } from "@/components/ShiftCloseCountModal";
import { RejectTicketModal } from "@/components/RejectTicketModal";
import { useStore, type Ticket, type TicketStatus } from "@/lib/store";

const statusCfg: Record<TicketStatus, { bg: string; border: string; badge: string; label: string }> = {
  New:       { bg: "bg-sky-50",    border: "border-sky-300",    badge: "bg-sky-100 text-sky-700",       label: "New order" },
  Preparing: { bg: "bg-orange-50", border: "border-orange-300", badge: "bg-orange-100 text-orange-700", label: "Cooking" },
  Ready:     { bg: "bg-primary/5", border: "border-primary/40", badge: "bg-primary/10 text-primary",    label: "Ready" },
  Rejected:  { bg: "bg-destructive/5", border: "border-destructive/40", badge: "bg-destructive/10 text-destructive", label: "Rejected" },
};

const nextAction: Record<TicketStatus, string> = {
  New: "Start cooking",
  Preparing: "Mark ready",
  Ready: "Serve & clear",
  Rejected: "Rejected",
};

function ageMins(ts: number) {
  return Math.max(0, Math.round((Date.now() - ts) / 60000));
}

export default function KitchenHome() {
  const store = useStore();
  const [reqOpen, setReqOpen] = useState(false);
  const [wasteOpen, setWasteOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const [rejecting, setRejecting] = useState<Ticket | null>(null);
  // Rejected tickets leave the kitchen queue — they're now the cashier's to resolve.
  const tickets = store.tickets.filter(
    (t) => t.station === "Kitchen" && t.branch === store.currentBranch && t.status !== "Rejected",
  );

  const counts = {
    new:       tickets.filter((t) => t.status === "New").length,
    preparing: tickets.filter((t) => t.status === "Preparing").length,
    ready:     tickets.filter((t) => t.status === "Ready").length,
  };

  return (
    <AppShell title="Kitchen" subtitle="Live order queue — tickets arrive from the POS">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Order queue</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setReqOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-surface"
          >
            <PackagePlus className="h-3.5 w-3.5" />Request stock
          </button>
          <button
            onClick={() => setWasteOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-surface"
          >
            <Trash2 className="h-3.5 w-3.5" />Record waste
          </button>
          <button
            onClick={() => setCountOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background hover:bg-foreground/85"
            title="End-of-shift count — count the high-value stock before clocking out"
          >
            <ClipboardCheck className="h-3.5 w-3.5" />Closing count
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Waiting",  count: counts.new,       color: "text-sky-600",    dot: "bg-sky-400" },
          { label: "Cooking",  count: counts.preparing, color: "text-orange-600", dot: "bg-orange-400" },
          { label: "Ready",    count: counts.ready,     color: "text-primary",    dot: "bg-primary" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
              <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
            </div>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <ChefHat className="h-14 w-14 text-muted-foreground/30" strokeWidth={1.25} />
          <p className="text-lg font-semibold text-muted-foreground">All caught up!</p>
          <p className="text-sm text-muted-foreground">New POS orders with food will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tickets.map((t) => (
            <KitchenTicket
              key={t.id}
              ticket={t}
              onAdvance={() => store.advanceTicket(t.id)}
              onReject={() => setRejecting(t)}
            />
          ))}
        </div>
      )}

      {reqOpen && <StockRequestModal toLocation="kitchen" onClose={() => setReqOpen(false)} />}
      <WasteModal open={wasteOpen} onClose={() => setWasteOpen(false)} location="kitchen" />
      {countOpen && <ShiftCloseCountModal location="kitchen" onClose={() => setCountOpen(false)} />}
      {rejecting && <RejectTicketModal ticket={rejecting} onClose={() => setRejecting(null)} />}
    </AppShell>
  );
}

function KitchenTicket({ ticket, onAdvance, onReject }: { ticket: Ticket; onAdvance: () => void; onReject: () => void }) {
  const cfg = statusCfg[ticket.status];
  const mins = ageMins(ticket.createdAt);
  const urgent = mins >= 12;

  return (
    <div className={`rounded-2xl border-2 p-5 flex flex-col gap-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-bold leading-tight">{ticket.label}</p>
          <p className="text-xs text-muted-foreground mt-1 font-mono">#{ticket.orderId}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cfg.badge}`}>{cfg.label}</span>
      </div>

      <ul className="space-y-2">
        {ticket.items.map((item, i) => (
          <li key={i} className="text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-base w-6 shrink-0 tabular-nums">{item.qty}×</span>
              <span className="font-medium">{item.name}</span>
            </div>
            {item.detail && <p className="ml-8 text-xs font-medium text-destructive">↳ {item.detail}</p>}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-black/5">
        <span className={`flex items-center gap-1.5 text-xs font-medium ${urgent ? "text-destructive" : "text-muted-foreground"}`}>
          <Clock className="h-3.5 w-3.5" />{mins}m{urgent ? " · overdue" : ""}
        </span>
        <div className="flex items-center gap-2">
          {/* Can't make it — reject before cooking starts (hidden once plated/ready). */}
          {ticket.status !== "Ready" && (
            <button
              type="button"
              onClick={onReject}
              title="Can't make this order — send it back to the cashier"
              className="inline-flex items-center gap-1 rounded-xl border border-destructive/30 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors active:scale-95"
            >
              <Ban className="h-4 w-4" />Can&apos;t make
            </button>
          )}
          <button
            type="button"
            onClick={onAdvance}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all active:scale-95 ${
              ticket.status === "Ready"
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-foreground text-background hover:bg-foreground/80"
            }`}
          >
            {ticket.status === "Ready" && <CheckCircle2 className="inline h-4 w-4 mr-1.5 -mt-0.5" />}
            {nextAction[ticket.status]}
          </button>
        </div>
      </div>
    </div>
  );
}
