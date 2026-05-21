"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart, Banknote, CreditCard, Smartphone, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ShiftBanner } from "@/components/ShiftBanner";
import { ManagerApprovalModal } from "@/components/ManagerApprovalModal";
import { useAuth } from "@/lib/auth";
import { useStore, type TableStatus, type Order } from "@/lib/store";

// ── Floor plan config ────────────────────────────────────────────────────────

const ZONES = ["Indoor", "Terrace", "Bar"] as const;

const STATUS_CONFIG: Record<TableStatus, { card: string; dot: string }> = {
  available: { card: "border-emerald-200 bg-emerald-50/40", dot: "bg-emerald-500" },
  occupied:  { card: "border-amber-200 bg-amber-50/50",    dot: "bg-amber-500" },
  reserved:  { card: "border-blue-200 bg-blue-50/40",      dot: "bg-blue-500" },
};

const methodBadge: Record<string, string> = {
  Card: "bg-sky-100 text-sky-700",
  Cash: "bg-emerald-100 text-emerald-700",
  Transfer: "bg-purple-100 text-purple-700",
};

const channelBadge: Record<string, string> = {
  "Dine-in": "bg-surface text-surface-foreground",
  Takeout: "bg-amber-100 text-amber-700",
  Delivery: "bg-primary/10 text-primary",
};

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)} hr ago`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function CashierHome() {
  const router = useRouter();
  const { user } = useAuth();
  const store = useStore();
  const [voiding, setVoiding] = useState<Order | null>(null);

  const shift = user ? store.activeShift(user.id) : undefined;
  const shiftOrders = shift ? store.orders.filter((o) => o.shiftId === shift.id && !o.voided) : [];
  const byMethod = (m: string) => shiftOrders.filter((o) => o.method === m).reduce((s, o) => s + o.total, 0);

  const availCount    = store.tables.filter((t) => t.status === "available").length;
  const occupiedCount = store.tables.filter((t) => t.status === "occupied").length;
  const reservedCount = store.tables.filter((t) => t.status === "reserved").length;
  const totalCovers   = store.tables.filter((t) => t.status === "occupied").reduce((s, t) => s + (t.guests ?? 0), 0);

  return (
    <AppShell title="My Shift" subtitle={user?.name}>
      <ShiftBanner />

      {/* New order CTA */}
      <button
        type="button"
        onClick={() => router.push("/pos")}
        className="w-full rounded-3xl bg-primary p-8 flex flex-col sm:flex-row items-center justify-between gap-4 hover:bg-primary/90 transition-colors group text-primary-foreground"
      >
        <div className="text-left">
          <p className="text-xl font-bold">New Order</p>
          <p className="text-sm text-primary-foreground/70 mt-0.5">Select a table and start taking orders</p>
        </div>
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary-foreground/15 group-hover:bg-primary-foreground/20 transition-colors shrink-0">
          <ShoppingCart className="h-8 w-8" strokeWidth={1.5} />
        </div>
      </button>

      {/* Shift KPIs — computed from orders rung on this shift */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Cash",     value: `₦${byMethod("Cash").toLocaleString()}`,     Icon: Banknote,    color: "text-emerald-600" },
          { label: "Card",     value: `₦${byMethod("Card").toLocaleString()}`,     Icon: CreditCard,  color: "text-sky-600" },
          { label: "Transfer", value: `₦${byMethod("Transfer").toLocaleString()}`, Icon: Smartphone,  color: "text-purple-600" },
          { label: "Orders",   value: String(shiftOrders.length),                  Icon: ShoppingCart, color: "text-primary" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-border bg-card p-5">
            <k.Icon className={`h-5 w-5 mb-3 ${k.color}`} strokeWidth={1.75} />
            <p className="text-xl font-bold tabular-nums">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Floor plan */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Floor plan</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{totalCovers} covers seated across {occupiedCount} tables</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{availCount} free</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />{occupiedCount} occupied</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" />{reservedCount} reserved</span>
          </div>
        </header>
        <div className="p-6 space-y-6">
          {ZONES.map((zone) => (
            <div key={zone}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{zone}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {store.tables.filter((t) => t.zone === zone).map((table) => {
                  const cfg = STATUS_CONFIG[table.status];
                  return (
                    <div key={table.id} className={`rounded-xl border-2 p-3.5 ${cfg.card}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold">{table.label}</p>
                        <span className={`h-2 w-2 rounded-full ${cfg.dot} shrink-0`} />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Users className="h-3 w-3 shrink-0" /><span>{table.seats} seats</span>
                      </div>
                      {table.status === "occupied" && (
                        <div className="mt-1.5 pt-1.5 border-t border-amber-200">
                          <p className="text-xs text-muted-foreground">{table.guests ?? 0} of {table.seats} seated</p>
                          {table.orderTotal != null && (
                            <p className="text-xs font-bold tabular-nums mt-0.5">₦{table.orderTotal.toLocaleString()}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              store.freeTable(table.id);
                              toast.success(`${table.label} cleared`);
                            }}
                            className="mt-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-surface transition-colors"
                          >
                            Clear table
                          </button>
                        </div>
                      )}
                      {table.status === "reserved" && (
                        <p className="mt-1.5 pt-1.5 border-t border-blue-200 text-xs text-muted-foreground leading-snug">{table.reservation}</p>
                      )}
                      {table.status === "available" && (
                        <button type="button" onClick={() => router.push(`/pos?table=${table.id}`)} className="mt-1.5 text-xs font-semibold text-primary hover:underline">
                          Seat guests →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent orders — real orders from the store */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">Recent orders</h2>
        </div>
        {store.orders.filter((o) => o.branch === store.currentBranch).length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">
            No orders yet — tap <span className="font-medium text-foreground">New Order</span> to ring one up.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {store.orders.filter((o) => o.branch === store.currentBranch).slice(0, 8).map((o) => (
              <li key={o.id} className={`flex items-center gap-4 px-6 py-4 ${o.voided ? "opacity-55" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold tabular-nums">#{o.id}</p>
                    {o.voided && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Voided</span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${channelBadge[o.channel] ?? "bg-surface text-surface-foreground"}`}>
                      {o.channel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {o.channel === "Dine-in" ? o.table : o.customer?.name}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${methodBadge[o.method] ?? "bg-surface text-surface-foreground"}`}>
                      {o.method}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {o.voided
                      ? `Voided by ${o.voidedBy} · ${o.voidReason}`
                      : `${o.lines.reduce((s, l) => s + l.qty, 0)} items · ${o.staffName}${o.customer?.phone ? ` · ${o.customer.phone}` : ""} · ${timeAgo(o.at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className={`text-base font-bold tabular-nums ${o.voided ? "line-through text-muted-foreground" : ""}`}>₦{o.total.toLocaleString()}</p>
                  {!o.voided && (
                    <button
                      onClick={() => setVoiding(o)}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      Void
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {voiding && (
        <ManagerApprovalModal
          title={`Void order #${voiding.id}`}
          description={`₦${voiding.total.toLocaleString()} · ${voiding.channel} · stock will be returned to inventory`}
          reasonLabel="Void reason"
          confirmLabel="Void order"
          onClose={() => setVoiding(null)}
          onApprove={(manager, reason) => {
            store.voidOrder(voiding.id, reason, manager);
            toast.success(`Order #${voiding.id} voided · approved by ${manager}`);
            setVoiding(null);
          }}
        />
      )}
    </AppShell>
  );
}
