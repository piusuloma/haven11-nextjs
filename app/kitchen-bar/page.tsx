"use client";

import { Clock, ChefHat, Wine, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useStore, type Ticket, type TicketStation, type TicketStatus } from "@/lib/store";

const badge: Record<TicketStatus, string> = {
  New: "bg-sky-100 text-sky-700",
  Preparing: "bg-orange-100 text-orange-700",
  Ready: "bg-primary text-primary-foreground",
};

function ageMins(ts: number) {
  return Math.max(0, Math.round((Date.now() - ts) / 60000));
}

export default function KitchenBar() {
  const store = useStore();
  const cols: { key: TicketStation; icon: typeof ChefHat }[] = [
    { key: "Kitchen", icon: ChefHat },
    { key: "Bar", icon: Wine },
  ];

  return (
    <AppShell title="Kitchen & Bar Display" subtitle="Live tickets from the POS · bump as orders progress">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {cols.map((c) => {
          const Icon = c.icon;
          const list = store.tickets.filter((t) => t.station === c.key && t.branch === store.currentBranch);
          return (
            <section key={c.key} className="rounded-xl border border-border bg-card">
              <header className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground"><Icon className="h-4 w-4" /></span>
                  <h2 className="text-sm font-semibold">{c.key} line</h2>
                </div>
                <span className="text-xs text-muted-foreground">{list.length} active</span>
              </header>
              {list.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">No tickets — ring an order through the POS</p>
              ) : (
                <ul className="p-4 space-y-3">
                  {list.map((t) => (
                    <TicketRow
                      key={t.id}
                      ticket={t}
                      onBump={() => store.advanceTicket(t.id)}
                      onReady={() => store.markTicketReady(t.id)}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}

function TicketRow({ ticket, onBump, onReady }: { ticket: Ticket; onBump: () => void; onReady: () => void }) {
  const mins = ageMins(ticket.createdAt);
  const late = mins >= 10;
  const isReady = ticket.status === "Ready";

  return (
    <li className="rounded-lg border border-border bg-background p-3 hover:border-primary/40 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold tabular-nums">#{ticket.orderId}</p>
          <p className="text-xs text-muted-foreground">{ticket.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${late ? "bg-destructive/10 text-destructive" : "bg-surface text-surface-foreground"}`}>
            <Clock className="h-3 w-3" />{mins}m
          </span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${badge[ticket.status]}`}>
            {ticket.status}
          </span>
        </div>
      </div>
      <ul className="mt-2 text-sm space-y-0.5">
        {ticket.items.map((it, i) => (
          <li key={i} className="text-foreground/90">
            • {it.qty}× {it.name}
            {it.detail && <span className="text-destructive"> ({it.detail})</span>}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button onClick={onBump} className="flex-1 rounded-md border border-border bg-card py-1.5 text-xs font-medium hover:bg-surface">
          {isReady ? "Serve & clear" : "Bump →"}
        </button>
        {!isReady && (
          <button onClick={onReady} className="flex-1 inline-flex items-center justify-center gap-1 rounded-md bg-primary py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            <CheckCircle2 className="h-3.5 w-3.5" />Mark ready
          </button>
        )}
      </div>
    </li>
  );
}
