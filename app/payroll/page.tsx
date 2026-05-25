"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { exportCsv } from "@/lib/export";
import { useAuth } from "@/lib/auth";
import { useStore, type Payslip, type PayrollAdjustment } from "@/lib/store";
import { Play, FileText, Download, Printer, Plus, Trash2, TrendingUp, TrendingDown, Sparkles } from "lucide-react";

// ── Adjustment categories — picker UX, not a closed enum (operators can still
//    enter custom values, but these cover 90% of real cases). ────────────────
const ADDITION_CATEGORIES = [
  "Performance bonus",
  "Sales target",
  "Overtime",
  "Holiday bonus",
  "Commendation",
  "Allowance",
  "Refund / reimbursement",
  "Other",
];
const DEDUCTION_CATEGORIES = [
  "Lateness",
  "Cash shortage",
  "Damage",
  "Customer compensation",
  "Uniform / equipment",
  "Loan repayment",
  "Other",
];

export default function Payroll() {
  const store = useStore();
  const { user } = useAuth();
  const me = user?.name ?? "You";
  const [running, setRunning] = useState(false);
  const [viewing, setViewing] = useState<Payslip | null>(null);
  const [addingAdjustment, setAddingAdjustment] = useState<"addition" | "deduction" | null>(null);

  const branch = store.currentBranch;
  const runs = store.payrollRuns.filter((r) => r.branch === branch);
  const latest = runs[0];
  const activeEmps = store.employees.filter((e) => e.branch === branch && e.status === "Active");
  const monthlyGross = activeEmps.reduce((s, e) => s + e.baseSalary + e.transport + e.housing, 0);

  // Pending adjustments — anything not yet consumed by a run.
  const pendingAdjustments = useMemo(
    () => store.payrollAdjustments.filter((a) => a.branch === branch && !a.consumedByRunId),
    [store.payrollAdjustments, branch],
  );
  const pendingBonus = pendingAdjustments.filter((a) => a.kind === "addition").reduce((s, a) => s + a.amount, 0);
  const pendingDeduct = pendingAdjustments.filter((a) => a.kind === "deduction").reduce((s, a) => s + a.amount, 0);

  return (
    <AppShell title="Payroll" subtitle={`${store.branchName(branch)} · salaries, bonuses, deductions & payslips`}>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "On payroll", v: String(activeEmps.length) },
          { l: "Monthly gross", v: `₦${monthlyGross.toLocaleString()}` },
          { l: "Pending bonus / deductions", v: `+₦${(pendingBonus / 1000).toFixed(0)}k · −₦${(pendingDeduct / 1000).toFixed(0)}k`, hint: `${pendingAdjustments.length} item${pendingAdjustments.length === 1 ? "" : "s"} for next run` },
          { l: "Last run — net", v: latest ? `₦${latest.totalNet.toLocaleString()}` : "—" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{s.v}</p>
            {s.hint && <p className="mt-1 text-[11px] text-muted-foreground">{s.hint}</p>}
          </div>
        ))}
      </section>

      {/* Pre-payroll adjustments — bonuses + deductions with reasons, queued for the next run */}
      <section className="rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />Adjustments for the next payroll run
            </h2>
            <p className="text-xs text-muted-foreground">Bonuses & deductions — each with a reason. Folded into the next run automatically.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddingAdjustment("addition")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
            >
              <TrendingUp className="h-3.5 w-3.5" />Add bonus
            </button>
            <button
              onClick={() => setAddingAdjustment("deduction")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-semibold text-warning hover:bg-warning/15"
            >
              <TrendingDown className="h-3.5 w-3.5" />Add deduction
            </button>
          </div>
        </header>
        {pendingAdjustments.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No adjustments queued. Use <span className="font-medium text-foreground">Add bonus</span> or <span className="font-medium text-foreground">Add deduction</span> to flag something for the next payroll run.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {pendingAdjustments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${a.kind === "addition" ? "bg-primary/10 text-primary" : "bg-warning/15 text-warning"}`}>
                  {a.kind === "addition" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{a.employeeName}</span>
                    <span className="text-muted-foreground"> · {a.category}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    &ldquo;{a.reason}&rdquo; · added by {a.by}
                  </p>
                </div>
                <span className={`tabular-nums font-bold ${a.kind === "addition" ? "text-primary" : "text-warning"}`}>
                  {a.kind === "addition" ? "+" : "−"}₦{a.amount.toLocaleString()}
                </span>
                <button
                  onClick={() => {
                    const r = store.removePayrollAdjustment(a.id);
                    if (!r.ok) { toast.error(r.error ?? "Couldn't remove"); return; }
                    toast.success("Adjustment removed");
                  }}
                  aria-label="Remove adjustment"
                  className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{latest ? `Latest run · ${latest.period}` : "Payroll"}</h2>
        <div className="flex items-center gap-2">
          {latest && (
            <button
              onClick={() => {
                exportCsv(
                  `bank-schedule-${latest.period.replace(/\s+/g, "-").toLowerCase()}.csv`,
                  latest.payslips.map((ps) => ({
                    Employee: ps.name,
                    Role: ps.role,
                    Gross: ps.gross,
                    Bonuses: ps.totalAdditions,
                    Deductions: ps.totalDeductions,
                    "Net pay": ps.net,
                  })),
                );
                toast.success(`Bank schedule for ${latest.period} exported`);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-surface"
            >
              <Download className="h-3.5 w-3.5" />Export bank schedule
            </button>
          )}
          <button
            onClick={() => {
              if (activeEmps.length === 0) { toast.error("No active employees at this branch"); return; }
              setRunning(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Play className="h-3.5 w-3.5" />Run payroll
          </button>
        </div>
      </div>

      {!latest ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.25} />
          <p className="text-sm text-muted-foreground">
            No payroll run yet for {store.branchName(branch)}. Click <span className="font-medium text-foreground">Run payroll</span> to generate payslips.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border bg-surface/40">
                <th className="font-medium px-5 py-2.5">Employee</th>
                <th className="font-medium px-5 py-2.5">Role</th>
                <th className="font-medium px-5 py-2.5 text-right">Gross</th>
                <th className="font-medium px-5 py-2.5 text-right">Additions</th>
                <th className="font-medium px-5 py-2.5 text-right">Deductions</th>
                <th className="font-medium px-5 py-2.5 text-right">Net pay</th>
                <th className="font-medium px-5 py-2.5 text-right">Payslip</th>
              </tr>
            </thead>
            <tbody>
              {latest.payslips.map((ps) => (
                <tr key={ps.employeeId} className="border-b border-border last:border-0 hover:bg-surface/50">
                  <td className="px-5 py-3 font-medium">{ps.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{ps.role}</td>
                  <td className="px-5 py-3 text-right tabular-nums">₦{ps.gross.toLocaleString()}</td>
                  <td className={`px-5 py-3 text-right tabular-nums ${ps.totalAdditions > 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {ps.totalAdditions > 0 ? `+₦${ps.totalAdditions.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-destructive">−₦{ps.totalDeductions.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-bold">₦{ps.net.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => setViewing(ps)} className="text-xs font-medium text-primary hover:underline">View</button>
                  </td>
                </tr>
              ))}
              <tr className="bg-surface/40 font-semibold">
                <td className="px-5 py-3" colSpan={5}>Total net pay</td>
                <td className="px-5 py-3 text-right tabular-nums">₦{latest.totalNet.toLocaleString()}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {runs.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Run history</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {runs.slice(1).map((r) => (
              <li key={r.id} className="flex items-center justify-between border-b border-border last:border-0 py-2">
                <span>{r.period} · {r.payslips.length} payslips · by {r.ranBy}</span>
                <span className="tabular-nums font-medium">₦{r.totalNet.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {running && (
        <RunModal
          pendingCount={pendingAdjustments.length}
          onClose={() => setRunning(false)}
          onRun={(period) => {
            const run = store.runPayroll(period, me);
            toast.success(`Payroll run for ${period} · ${run.payslips.length} payslips · net ₦${run.totalNet.toLocaleString()}`);
            setRunning(false);
          }}
        />
      )}
      {addingAdjustment && (
        <AdjustmentModal
          kind={addingAdjustment}
          me={me}
          employees={activeEmps.map((e) => ({ id: e.id, name: e.name, role: e.role }))}
          onClose={() => setAddingAdjustment(null)}
        />
      )}
      {viewing && <PayslipModal slip={viewing} period={latest?.period ?? ""} onClose={() => setViewing(null)} />}
    </AppShell>
  );
}

// ── Run payroll ──────────────────────────────────────────────────────────────

function RunModal({ pendingCount, onClose, onRun }: { pendingCount: number; onClose: () => void; onRun: (period: string) => void }) {
  const thisMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const [period, setPeriod] = useState(thisMonth);

  return (
    <Modal
      open
      onClose={onClose}
      title="Run payroll"
      description="Generates payslips for all active employees at this branch"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={() => onRun(period.trim() || thisMonth)}>Run payroll</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Pay period</span>
          <input value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls} />
        </label>
        <div className="rounded-xl bg-surface/60 border border-border p-3 text-xs text-muted-foreground space-y-1">
          <p>Each payslip computes: gross (base + allowances) − statutory (PAYE 8% + Pension 8% of base + NHF 2.5% of base) plus itemised lines:</p>
          <ul className="list-disc list-inside ml-1">
            <li>Auto: ₦500 per late mark (≥15 min late) + cash shortages from shift reconciliation.</li>
            <li>Manual: {pendingCount} pending {pendingCount === 1 ? "adjustment" : "adjustments"} folded in (bonuses + deductions you queued).</li>
            <li>Welfare-advance instalments auto-deducted from anyone with a repaying advance.</li>
          </ul>
          <p className="pt-1">Every line carries a reason — the employee and auditor can see exactly why their pay changed.</p>
        </div>
      </div>
    </Modal>
  );
}

// ── Add a pre-payroll adjustment ─────────────────────────────────────────────

function AdjustmentModal({
  kind, me, employees, onClose,
}: {
  kind: "addition" | "deduction";
  me: string;
  employees: { id: string; name: string; role: string }[];
  onClose: () => void;
}) {
  const store = useStore();
  const cats = kind === "addition" ? ADDITION_CATEGORIES : DEDUCTION_CATEGORIES;
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [category, setCategory] = useState(cats[0]);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");

  function submit() {
    if (!employeeId) { toast.error("Pick an employee"); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    if (!reason.trim()) { toast.error("Reason is required — it shows on the payslip"); return; }
    const res = store.addPayrollAdjustment({ employeeId, kind, category, reason: reason.trim(), amount: amt, by: me });
    if (!res.ok) { toast.error(res.error ?? "Couldn't add"); return; }
    const emp = employees.find((e) => e.id === employeeId);
    toast.success(`${kind === "addition" ? "Bonus" : "Deduction"} of ₦${amt.toLocaleString()} queued for ${emp?.name}`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={kind === "addition" ? "Add bonus / addition" : "Add deduction"}
      description="Queued for the next payroll run · each line carries a reason on the payslip"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Queue {kind === "addition" ? "bonus" : "deduction"}</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Employee</span>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputCls}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.role}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {cats.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Amount ₦</span>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={inputCls} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Reason (required) — shows on the payslip</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={kind === "addition"
              ? "e.g. Hit November sales target (110% of plan)"
              : "e.g. Broken decanter on 18 May · ₦8,500 replacement"}
            rows={3}
            className={`${inputCls} resize-y`}
            autoFocus
          />
        </label>
      </div>
    </Modal>
  );
}

// ── Payslip ──────────────────────────────────────────────────────────────────

function PayslipModal({ slip, period, onClose }: { slip: Payslip; period: string; onClose: () => void }) {
  const statutory = slip.paye + slip.pension + slip.nhf;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Payslip — ${slip.name}`}
      description={`${slip.role} · ${period}`}
      size="lg"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>Close</ModalButton>
          <ModalButton onClick={() => window.print()}>
            <span className="inline-flex items-center gap-1.5"><Printer className="h-3.5 w-3.5" />Print payslip</span>
          </ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Earnings</p>
          <Row label="Basic salary" value={slip.base} />
          <Row label="Allowances (transport + housing)" value={slip.allowances} />
          <Row label="Gross pay" value={slip.gross} bold />
        </div>

        {/* Additions — each with a reason */}
        {slip.additions.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Additions & bonuses</p>
            {slip.additions.map((a) => (
              <RowWithReason key={a.id} label={a.category} reason={a.reason} value={a.amount} positive />
            ))}
            <Row label="Total additions" value={slip.totalAdditions} bold />
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Statutory deductions <span className="font-normal normal-case">— what the law takes</span></p>
          <Row label="Income tax (PAYE 8%)" value={-slip.paye} />
          <Row label="Pension contribution (8%)" value={-slip.pension} />
          <Row label="Housing fund (NHF 2.5%)" value={-slip.nhf} />
          <Row label="Total statutory" value={-statutory} bold />
        </div>

        {/* Itemised deductions — each with a reason */}
        {slip.deductions.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Other deductions</p>
            {slip.deductions.map((d) => (
              <RowWithReason key={d.id} label={d.category} reason={d.reason} value={-d.amount} />
            ))}
          </div>
        )}

        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
          <span className="text-sm font-semibold">Net pay</span>
          <span className="text-xl font-bold tabular-nums text-primary">₦{slip.net.toLocaleString()}</span>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between border-b border-border last:border-0 py-1.5 text-sm ${bold ? "font-semibold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${value < 0 ? "text-destructive" : ""}`}>
        {value < 0 ? "−" : ""}₦{Math.abs(value).toLocaleString()}
      </span>
    </div>
  );
}

function RowWithReason({ label, reason, value, positive }: { label: string; reason: string; value: number; positive?: boolean }) {
  return (
    <div className="border-b border-border last:border-0 py-2 text-sm">
      <div className="flex justify-between">
        <span className={positive ? "text-foreground" : ""}>{label}</span>
        <span className={`tabular-nums font-medium ${positive ? "text-primary" : "text-destructive"}`}>
          {positive ? "+" : "−"}₦{Math.abs(value).toLocaleString()}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground italic">&ldquo;{reason}&rdquo;</p>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
