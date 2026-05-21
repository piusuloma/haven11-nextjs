"use client";

import { useRouter } from "next/navigation";
import { Circle, AlertTriangle, ShieldAlert, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useStore, statusOf, fmtQty, type Line } from "@/lib/store";

const channelTint: Record<string, string> = {
  "Dine-in": "bg-primary",
  Takeout: "bg-amber-500",
  Delivery: "bg-sky-500",
};

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

export default function Dashboard() {
  const router = useRouter();
  const store = useStore();

  const branch = store.currentBranch;
  const orders = store.orders.filter((o) => !o.voided && o.branch === branch);
  const salesToday = orders.reduce((s, o) => s + o.total, 0);
  const covers = orders.reduce((s, o) => s + (o.guests ?? 0), 0);

  // Revenue by channel
  const channels = ["Dine-in", "Takeout", "Delivery"] as const;
  const byChannel = channels.map((c) => ({
    name: c,
    value: orders.filter((o) => o.channel === c).reduce((s, o) => s + o.total, 0),
  }));

  // Inventory health per line
  const lines: Line[] = ["Kitchen", "Bar", "Lounge"];
  const health = lines
    .map((line) => {
      const items = store.inventory.filter((i) => i.line === line && i.branch === branch);
      return {
        name: line,
        ok: items.filter((i) => statusOf(i) === "OK").length,
        low: items.filter((i) => statusOf(i) === "Low").length,
        out: items.filter((i) => statusOf(i) === "Out").length,
        total: items.length,
      };
    })
    .filter((h) => h.total > 0);

  const lowStock = store.inventory.filter((i) => i.branch === branch && statusOf(i) !== "OK");
  const overPours = store.counts.filter((c) => c.overPour && c.branch === branch);
  const openTickets = store.tickets.filter((t) => t.branch === branch).length;

  // Derived live-alert feed
  const alerts = [
    ...overPours.slice(0, 2).map((c) => ({
      tone: "danger" as const,
      title: `Over-pour — ${c.name}`,
      meta: `${c.staffName} · ₦${Math.abs(c.varianceCost).toLocaleString()} loss`,
    })),
    ...lowStock.slice(0, 4).map((i) => ({
      tone: statusOf(i) === "Out" ? ("danger" as const) : ("warn" as const),
      title: `${statusOf(i) === "Out" ? "Out of stock" : "Low stock"} — ${i.name}`,
      meta: `${i.line} · ${fmtQty(i.onHand)} ${i.unit} on hand`,
    })),
  ];

  const kpis = [
    { label: "Sales today", value: `₦${salesToday.toLocaleString()}`, hint: `${orders.length} orders` },
    { label: "Covers seated", value: String(covers), hint: "dine-in guests" },
    { label: "Open tickets", value: String(openTickets), hint: "kitchen + bar" },
    { label: "Stock alerts", value: String(lowStock.length), hint: "low / out", tone: lowStock.length > 0 ? "text-warning" : undefined },
  ];

  return (
    <AppShell title="Operations overview" subtitle={`${store.branchName(branch)} · live across POS, kitchen, bar & inventory`}>
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${k.tone ?? ""}`}>{k.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue by channel */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Revenue by channel</h2>
            <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-xs font-medium text-surface-foreground">
              <TrendingUp className="h-3.5 w-3.5" />₦{salesToday.toLocaleString()} total
            </span>
          </div>
          {salesToday === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              No sales yet — ring an order through the <button onClick={() => router.push("/pos")} className="font-medium text-primary hover:underline">POS</button>.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {byChannel.map((l) => {
                const share = Math.round((l.value / salesToday) * 100);
                return (
                  <div key={l.name}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{l.name}</span>
                      <span className="tabular-nums text-muted-foreground">₦{l.value.toLocaleString()} · {share}%</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface">
                      <div className={`h-full rounded-full ${channelTint[l.name]}`} style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Live alerts */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Live alerts</h2>
            <button onClick={() => router.push("/alerts")} className="text-xs font-medium text-primary hover:underline">View all</button>
          </div>
          {alerts.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Nothing needs attention — all clear.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {alerts.map((a, i) => (
                <li key={i}>
                  <button
                    onClick={() => router.push("/alerts")}
                    className="flex w-full items-start gap-3 rounded-lg border border-border/60 p-3 text-left hover:bg-surface/60 transition-colors"
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${a.tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-foreground"}`}>
                      {a.tone === "danger" ? <ShieldAlert className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium leading-tight">{a.title}</span>
                      <span className="block mt-0.5 text-xs text-muted-foreground">{a.meta}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent orders */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between p-5 pb-3">
            <div>
              <h2 className="text-sm font-semibold">Recent orders</h2>
              <p className="text-xs text-muted-foreground">Live feed across dine-in, takeout & delivery</p>
            </div>
            <button onClick={() => router.push("/reports")} className="text-xs font-medium text-primary hover:underline">Reports</button>
          </div>
          {orders.length === 0 ? (
            <p className="px-5 pb-8 pt-4 text-center text-sm text-muted-foreground">No orders rung up yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-y border-border bg-surface/40">
                    <th className="font-medium px-5 py-2.5">Order</th>
                    <th className="font-medium px-5 py-2.5">Channel</th>
                    <th className="font-medium px-5 py-2.5">Items</th>
                    <th className="font-medium px-5 py-2.5">Total</th>
                    <th className="font-medium px-5 py-2.5 text-right">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 6).map((o) => (
                    <tr key={o.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                      <td className="px-5 py-3 font-medium tabular-nums">#{o.id}</td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {o.channel === "Dine-in" ? o.table : `${o.channel} · ${o.customer?.name ?? ""}`}
                      </td>
                      <td className="px-5 py-3 tabular-nums">{o.lines.reduce((s, l) => s + l.qty, 0)}</td>
                      <td className="px-5 py-3 tabular-nums font-medium">₦{o.total.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">{timeAgo(o.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Inventory health */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Inventory health</h2>
            <button onClick={() => router.push("/inventory")} className="text-xs font-medium text-primary hover:underline">Open</button>
          </div>
          <div className="mt-5 space-y-5">
            {health.map((row) => (
              <div key={row.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{row.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{row.total} SKUs</span>
                </div>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface">
                  <div className="bg-primary" style={{ width: `${(row.ok / row.total) * 100}%` }} />
                  <div className="bg-warning" style={{ width: `${(row.low / row.total) * 100}%` }} />
                  <div className="bg-destructive" style={{ width: `${(row.out / row.total) * 100}%` }} />
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Circle className="h-1.5 w-1.5 fill-primary text-primary" />OK {row.ok}</span>
                  <span className="inline-flex items-center gap-1"><Circle className="h-1.5 w-1.5 fill-warning text-warning" />Low {row.low}</span>
                  <span className="inline-flex items-center gap-1"><Circle className="h-1.5 w-1.5 fill-destructive text-destructive" />Out {row.out}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
