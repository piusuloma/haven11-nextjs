"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";

function hhmm(ts?: number): string {
  return ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

function dateOf(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function dateLabel(iso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  return new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

export default function Cashier() {
  const store = useStore();
  const { user } = useAuth();
  const [dateFilter, setDateFilter] = useState("All");

  // Non-owners see only their own branch's shift ledger (Module 8 RBAC).
  const branchShifts = user?.role === "owner"
    ? store.shifts
    : store.shifts.filter((s) => s.branch === store.currentBranch);

  // Distinct shift dates, most recent first — drives the history drop-down.
  const dates = Array.from(new Set(branchShifts.map((s) => dateOf(s.openedAt)))).sort().reverse();

  const visible = dateFilter === "All"
    ? branchShifts
    : branchShifts.filter((s) => dateOf(s.openedAt) === dateFilter);

  const rows = visible.map((s) => {
    const sales = store.shiftSales(s.id);
    const expected = s.openingFloat + sales;
    const variance = s.countedCash == null ? null : s.countedCash - expected;
    return { ...s, sales, expected, variance };
  });

  const cashInTills = rows.reduce((sum, r) => sum + (r.countedCash ?? r.expected), 0);
  const totalVariance = rows.reduce((sum, r) => sum + (r.variance ?? 0), 0);
  const openCount = rows.filter((r) => r.status === "open").length;

  return (
    <AppShell title="Front of House on Shift" subtitle="Waiters & cashiers · float, sales and end-of-shift reconciliation">
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { l: "Cash in tills", v: `₦${cashInTills.toLocaleString()}` },
          { l: "Reconciled variance", v: `${totalVariance >= 0 ? "+" : ""}₦${totalVariance.toLocaleString()}`, tone: totalVariance < 0 ? "text-destructive" : "text-primary" },
          { l: "Open shifts", v: String(openCount) },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</p>
          </div>
        ))}
      </section>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 p-5 pb-3">
          <div>
            <h2 className="text-sm font-semibold">Shift reconciliation</h2>
            <p className="text-xs text-muted-foreground">
              Waiters &amp; cashiers open and close their own shifts — this is the live ledger and shift history.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <span className="font-medium text-muted-foreground">Date</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="All">All dates</option>
              {dates.map((d) => <option key={d} value={d}>{dateLabel(d)}</option>)}
            </select>
          </label>
        </header>
        {rows.length === 0 ? (
          <div className="m-5 rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">
            {dateFilter === "All" ? "No shifts opened for this branch yet." : "No shifts on the selected date."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-y border-border bg-surface/40">
                <th className="font-medium px-5 py-2.5">Staff</th>
                <th className="font-medium px-5 py-2.5">Date</th>
                <th className="font-medium px-5 py-2.5">Opened</th>
                <th className="font-medium px-5 py-2.5">Shift</th>
                <th className="font-medium px-5 py-2.5 text-right">Counted</th>
                <th className="font-medium px-5 py-2.5 text-right">Variance</th>
                <th className="font-medium px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                  <td className="px-5 py-3 font-medium">{r.staffName}</td>
                  <td className="px-5 py-3 text-muted-foreground">{dateLabel(dateOf(r.openedAt))}</td>
                  <td className="px-5 py-3 text-muted-foreground">{hhmm(r.openedAt)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{r.period ?? "—"}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">
                    {r.countedCash == null ? <span className="text-muted-foreground">—</span> : `₦${r.countedCash.toLocaleString()}`}
                  </td>
                  <td className={`px-5 py-3 text-right tabular-nums font-medium ${r.variance == null ? "text-muted-foreground" : r.variance === 0 ? "text-primary" : r.variance < 0 ? "text-destructive" : "text-foreground"}`}>
                    {r.variance == null ? "in progress" : `${r.variance > 0 ? "+" : ""}₦${r.variance.toLocaleString()}`}
                  </td>
                  <td className="px-5 py-3">
                    {r.status === "open" ? (
                      <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">OPEN</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">CLOSED</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
