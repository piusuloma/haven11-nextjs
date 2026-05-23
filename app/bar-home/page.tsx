"use client";

import { useState } from "react";
import { Clock, CheckCircle2, Wine, Trash2, PackagePlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ShiftBanner } from "@/components/ShiftBanner";
import { WasteModal } from "@/components/WasteModal";
import { StockRequestModal } from "@/components/StockRequestModal";
import { useStore, type Ticket, type TicketStatus } from "@/lib/store";

const statusCfg: Record<TicketStatus, { bg: string; border: string; badge: string; label: string }> = {
  New:       { bg: "bg-sky-50",    border: "border-sky-300",    badge: "bg-sky-100 text-sky-700",       label: "Waiting" },
  Preparing: { bg: "bg-orange-50", border: "border-orange-300", badge: "bg-orange-100 text-orange-700", label: "Making" },
  Ready:     { bg: "bg-primary/5", border: "border-primary/40", badge: "bg-primary/10 text-primary",    label: "Ready" },
};

const nextAction: Record<TicketStatus, string> = {
  New: "Start making",
  Preparing: "Mark ready",
  Ready: "Hand off",
};

function ageMins(ts: number) {
  return Math.max(0, Math.round((Date.now() - ts) / 60000));
}

export default function BarHome() {
  const store = useStore();
  const [wasteOpen, setWasteOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const tickets = store.tickets.filter((t) => t.station === "Bar" && t.branch === store.currentBranch);

  const counts = {
    waiting: tickets.filter((t) => t.status === "New").length,
    making:  tickets.filter((t) => t.status === "Preparing").length,
    ready:   tickets.filter((t) => t.status === "Ready").length,
  };

  return (
    <AppShell title="Bar" subtitle="Drink tickets — arrive from the POS">
      <ShiftBanner />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Drink queue</h2>
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
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Waiting", count: counts.waiting, color: "text-sky-600",    dot: "bg-sky-400" },
          { label: "Making",  count: counts.making,  color: "text-orange-600", dot: "bg-orange-400" },
          { label: "Ready",   count: counts.ready,   color: "text-primary",    dot: "bg-primary" },
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
          <Wine className="h-14 w-14 text-muted-foreground/30" strokeWidth={1.25} />
          <p className="text-lg font-semibold text-muted-foreground">Bar queue is clear</p>
          <p className="text-sm text-muted-foreground">New POS orders with drinks will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tickets.map((t) => <BarTicket key={t.id} ticket={t} onAdvance={() => store.advanceTicket(t.id)} />)}
        </div>
      )}

      <WasteModal open={wasteOpen} onClose={() => setWasteOpen(false)} location="bar" />
      {reqOpen && <StockRequestModal toLocation="bar" onClose={() => setReqOpen(false)} />}
    </AppShell>
  );
}

function BarTicket({ ticket, onAdvance }: { ticket: Ticket; onAdvance: () => void }) {
  const cfg = statusCfg[ticket.status];
  const mins = ageMins(ticket.createdAt);
  const urgent = mins >= 8;

  return (
    <div className={`rounded-2xl border-2 p-5 flex flex-col gap-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold leading-tight">{ticket.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">#{ticket.orderId}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${cfg.badge}`}>{cfg.label}</span>
      </div>

      <ul className="space-y-2">
        {ticket.items.map((d, i) => (
          <li key={i} className="text-sm">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base w-6 shrink-0 tabular-nums">{d.qty}×</span>
              <span className="font-medium">{d.name}</span>
            </div>
            {d.detail && <p className="ml-8 text-xs font-medium text-destructive">↳ {d.detail}</p>}
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-black/5">
        <span className={`flex items-center gap-1.5 text-xs font-medium ${urgent ? "text-destructive" : "text-muted-foreground"}`}>
          <Clock className="h-3.5 w-3.5" />{mins}m{urgent ? " · slow" : ""}
        </span>
        <button
          type="button"
          onClick={onAdvance}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition-all active:scale-95 ${
            ticket.status === "Ready"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-foreground text-background hover:bg-foreground/80"
          }`}
        >
          {ticket.status === "Ready" && <CheckCircle2 className="inline h-4 w-4 mr-1 -mt-0.5" />}
          {nextAction[ticket.status]}
        </button>
      </div>
    </div>
  );
}
