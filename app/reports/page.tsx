"use client";

import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { exportCsv } from "@/lib/export";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { Download, TrendingUp, Star, AlertTriangle, Sparkles, Mail } from "lucide-react";

type Quadrant = "Star" | "Plowhorse" | "Puzzle" | "Dog";

const QUADRANT: Record<Quadrant, { tint: string; chip: string; rec: string }> = {
  Star:      { tint: "border-primary/30 bg-primary/5",      chip: "bg-primary text-primary-foreground",       rec: "Keep consistent — protect quality and menu placement." },
  Plowhorse: { tint: "border-warning/40 bg-warning/10",     chip: "bg-warning/20 text-foreground",            rec: "Popular but thin margin — nudge the price up or trim recipe cost." },
  Puzzle:    { tint: "border-sky-300 bg-sky-50/60",         chip: "bg-sky-100 text-sky-700",                  rec: "Good margin, low pull — promote it or move it up the menu." },
  Dog:       { tint: "border-destructive/30 bg-destructive/5", chip: "bg-destructive/10 text-destructive",    rec: "Low margin and low volume — a candidate for removal." },
};

export default function Analytics() {
  const store = useStore();
  const { user } = useAuth();
  const branch = store.currentBranch;

  // Analytics count only paid (Closed) orders — held orders are not yet revenue.
  const orders = store.orders.filter((o) => o.branch === branch && !o.voided && o.status === "Closed");
  const revenue = orders.reduce((s, o) => s + o.total, 0);

  // ── Menu engineering ──
  const unitsByItem: Record<string, number> = {};
  for (const o of orders) for (const l of o.lines) unitsByItem[l.name] = (unitsByItem[l.name] ?? 0) + l.qty;
  const totalUnits = Object.values(unitsByItem).reduce((s, n) => s + n, 0);

  const items = store.menu.map((m) => {
    const units = unitsByItem[m.name] ?? 0;
    const cost = store.recipeCost(m.recipe);
    const margin = m.price > 0 ? ((m.price - cost) / m.price) * 100 : 0;
    return { name: m.name, emoji: m.emoji, units, margin, revenue: units * m.price, profit: units * (m.price - cost) };
  });
  const avgUnits = items.length ? items.reduce((s, i) => s + i.units, 0) / items.length : 0;
  const avgMargin = items.length ? items.reduce((s, i) => s + i.margin, 0) / items.length : 0;
  const quadrantOf = (i: { units: number; margin: number }): Quadrant => {
    const hiVol = i.units >= avgUnits;
    const hiMargin = i.margin >= avgMargin;
    return hiMargin && hiVol ? "Star" : !hiMargin && hiVol ? "Plowhorse" : hiMargin ? "Puzzle" : "Dog";
  };
  const classified = items.map((i) => ({ ...i, quadrant: quadrantOf(i) }));

  // ── COGS & KPIs ──
  let cogs = 0;
  for (const o of orders) for (const l of o.lines) {
    const m = store.menu.find((x) => x.name === l.name);
    if (m) cogs += store.recipeCost(m.recipe) * l.qty;
  }
  const grossMargin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
  const avgTicket = orders.length ? Math.round(revenue / orders.length) : 0;

  // ── Channel mix ──
  const channels = (["Dine-in", "Takeout", "Delivery"] as const).map((c) => ({
    name: c, value: orders.filter((o) => o.channel === c).reduce((s, o) => s + o.total, 0),
  }));

  // ── Peak hours ──
  const byHour = Array<number>(24).fill(0);
  for (const o of orders) byHour[new Date(o.at).getHours()]++;
  const peakMax = Math.max(...byHour, 1);

  // ── Stock leakage ──
  const varianceLoss = store.counts
    .filter((c) => c.branch === branch && c.varianceCost < 0)
    .reduce((s, c) => s + Math.abs(c.varianceCost), 0);
  const wasteCost = store.waste.filter((w) => w.branch === branch).reduce((s, w) => s + w.cost, 0);

  // ── Morning brief ──
  const topItem = [...classified].sort((a, b) => b.units - a.units)[0];
  const cashShortage = store.shifts
    .filter((s) => s.branch === branch && s.countedCash != null)
    .reduce((sum, s) => {
      const v = (s.countedCash ?? 0) - (s.openingFloat + store.shiftSales(s.id));
      return v < 0 ? sum + -v : sum;
    }, 0);
  const branchEmpIds = store.employees.filter((e) => e.branch === branch).map((e) => e.id);
  const lateMarks = store.attendance.filter((a) => branchEmpIds.includes(a.employeeId) && a.lateMinutes >= 15).length;
  const openComplaints = store.complaints.filter((c) => c.branch === branch && c.status !== "Resolved").length;

  function exportMenuEngineering() {
    exportCsv(
      `menu-engineering-${new Date().toISOString().slice(0, 10)}.csv`,
      classified.map((i) => ({
        Item: i.name, "Units sold": i.units, "Margin %": i.margin.toFixed(0),
        Revenue: i.revenue, Profit: Math.round(i.profit), Classification: i.quadrant,
      })),
    );
    toast.success("Menu engineering exported to CSV");
  }

  return (
    <AppShell title="Analytics" subtitle={`${store.branchName(branch)} · the 702 Intelligence Hub`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Performance</h2>
        <button onClick={exportMenuEngineering} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-surface">
          <Download className="h-3.5 w-3.5" />Export
        </button>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Revenue", v: `₦${revenue.toLocaleString()}`, hint: `${orders.length} orders` },
          { l: "Gross margin", v: `${grossMargin.toFixed(0)}%`, hint: `COGS ₦${Math.round(cogs).toLocaleString()}` },
          { l: "Avg ticket", v: `₦${avgTicket.toLocaleString()}`, hint: "per order" },
          { l: "Items sold", v: String(totalUnits), hint: "menu units" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k.l}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{k.v}</p>
            <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
          </div>
        ))}
      </section>

      {/* Menu engineering matrix */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />Menu engineering — profit vs popularity
        </h2>
        {totalUnits === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No sales yet — ring up orders to classify the menu.</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(["Star", "Puzzle", "Plowhorse", "Dog"] as Quadrant[]).map((qd) => {
              const cfg = QUADRANT[qd];
              const list = classified.filter((i) => i.quadrant === qd).sort((a, b) => b.units - a.units);
              return (
                <div key={qd} className={`rounded-xl border p-4 ${cfg.tint}`}>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.chip}`}>
                      {qd === "Star" && <Star className="h-3 w-3" />}{qd}
                    </span>
                    <span className="text-xs text-muted-foreground">{list.length} item{list.length !== 1 ? "s" : ""}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">{cfg.rec}</p>
                  <ul className="mt-2 space-y-1">
                    {list.length === 0 ? (
                      <li className="text-xs text-muted-foreground">—</li>
                    ) : list.map((i) => (
                      <li key={i.name} className="flex items-center justify-between text-sm">
                        <span>{i.emoji} {i.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{i.units} sold · {i.margin.toFixed(0)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Channel mix */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted-foreground" />Revenue by channel</h2>
          <div className="mt-4 space-y-3">
            {channels.map((c) => {
              const pct = revenue > 0 ? Math.round((c.value / revenue) * 100) : 0;
              return (
                <div key={c.name}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">₦{c.value.toLocaleString()} · {pct}%</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Peak hours */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Peak hours</h2>
          <p className="text-xs text-muted-foreground mt-0.5">When orders land — schedule staff to match</p>
          <div className="mt-4 flex items-end gap-0.5 h-28">
            {byHour.map((count, h) => (
              <div key={h} className="flex-1 flex flex-col items-center gap-1 justify-end h-full" title={`${h}:00 — ${count} order${count !== 1 ? "s" : ""}`}>
                <div
                  className="w-full rounded-sm bg-primary"
                  style={{ height: `${count > 0 ? 12 + (count / peakMax) * 88 : 3}%`, opacity: count > 0 ? 0.35 + 0.65 * (count / peakMax) : 0.12 }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
            <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock leakage */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-muted-foreground" />Stock leakage</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">Variance loss (counts)</span><span className="tabular-nums font-medium text-destructive">₦{varianceLoss.toLocaleString()}</span></div>
            <div className="flex justify-between border-b border-border pb-2"><span className="text-muted-foreground">Waste logged</span><span className="tabular-nums font-medium text-destructive">₦{wasteCost.toLocaleString()}</span></div>
            <div className="flex justify-between pt-1 font-semibold"><span>Total leakage</span><span className="tabular-nums text-destructive">₦{(varianceLoss + wasteCost).toLocaleString()}</span></div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {revenue > 0 ? `${(((varianceLoss + wasteCost) / revenue) * 100).toFixed(1)}% of revenue lost to shrinkage & waste.` : "No revenue recorded yet."}
          </p>
        </div>

        {/* Morning brief */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">702 Morning Brief</h2>
            <button onClick={() => toast.success("Morning brief emailed to the MD")} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-surface">
              <Mail className="h-3.5 w-3.5" />Email
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Auto-generated night-audit summary</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            <Brief label="Total sales" value={`₦${revenue.toLocaleString()}`} />
            <Brief label="Orders" value={String(orders.length)} />
            <Brief label="Top item" value={topItem && topItem.units > 0 ? `${topItem.name} (${topItem.units})` : "—"} />
            <Brief label="Cash shortage" value={`₦${cashShortage.toLocaleString()}`} bad={cashShortage > 0} />
            <Brief label="Staff lateness" value={`${lateMarks} mark${lateMarks !== 1 ? "s" : ""}`} bad={lateMarks > 0} />
            <Brief label="Open complaints" value={String(openComplaints)} bad={openComplaints > 0} />
          </ul>
        </div>
      </section>

      {/* Branch comparison — owner only */}
      {user?.role === "owner" && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Branch comparison — today</h2>
          <div className="mt-4 space-y-3">
            {(() => {
              const rows = store.branches
                .filter((b) => b.kind === "branch")
                .map((b) => ({ name: b.name, value: store.orders.filter((o) => o.branch === b.id && !o.voided && o.status === "Closed").reduce((s, o) => s + o.total, 0) }));
              const max = Math.max(...rows.map((r) => r.value), 1);
              return rows.map((r) => (
                <div key={r.name}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{r.name}</span>
                    <span className="tabular-nums text-muted-foreground">₦{r.value.toLocaleString()}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Brief({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <li className="flex justify-between border-b border-border last:border-0 pb-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium tabular-nums ${bad ? "text-destructive" : ""}`}>{value}</span>
    </li>
  );
}
