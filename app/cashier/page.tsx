"use client";

import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";

function hhmm(ts?: number): string {
  return ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

export default function Cashier() {
  const store = useStore();
  const { user } = useAuth();

  // Non-owners see only their own branch's shift ledger (Module 8 RBAC).
  const branchShifts = user?.role === "owner"
    ? store.shifts
    : store.shifts.filter((s) => s.branch === store.currentBranch);

  const rows = branchShifts.map((s) => {
    const sales = store.shiftSales(s.id);
    const expected = s.openingFloat + sales;
    const variance = s.countedCash == null ? null : s.countedCash - expected;
    return { ...s, sales, expected, variance };
  });

  const cashInTills = rows.reduce((sum, r) => sum + (r.countedCash ?? r.expected), 0);
  const todayVariance = rows.reduce((sum, r) => sum + (r.variance ?? 0), 0);
  const openCount = rows.filter((r) => r.status === "open").length;

  return (
    <AppShell title="Cashier & Shifts" subtitle="Float, sales and end-of-shift reconciliation">
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { l: "Cash in tills", v: `₦${cashInTills.toLocaleString()}` },
          { l: "Reconciled variance", v: `${todayVariance >= 0 ? "+" : ""}₦${todayVariance.toLocaleString()}`, tone: todayVariance < 0 ? "text-destructive" : "text-primary" },
          { l: "Open shifts", v: String(openCount) },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</p>
          </div>
        ))}
      </section>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <header className="p-5 pb-3">
          <h2 className="text-sm font-semibold">Shift reconciliation</h2>
          <p className="text-xs text-muted-foreground">
            Staff open and close their own shifts from their home screen — this is the live ledger.
          </p>
        </header>
        {rows.length === 0 ? (
          <div className="m-5 rounded-xl border border-border p-10 text-center text-sm text-muted-foreground">
            No shifts opened for this branch today.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-y border-border bg-surface/40">
                <th className="font-medium px-5 py-2.5">Cashier</th>
                <th className="font-medium px-5 py-2.5">Opened</th>
                <th className="font-medium px-5 py-2.5 text-right">Counted</th>
                <th className="font-medium px-5 py-2.5 text-right">Variance</th>
                <th className="font-medium px-5 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                  <td className="px-5 py-3 font-medium">{r.staffName}</td>
                  <td className="px-5 py-3 text-muted-foreground">{hhmm(r.openedAt)}</td>
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
