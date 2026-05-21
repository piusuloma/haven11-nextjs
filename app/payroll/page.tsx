"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { exportCsv } from "@/lib/export";
import { useAuth } from "@/lib/auth";
import { useStore, type Payslip } from "@/lib/store";
import { Play, FileText, Download, Printer } from "lucide-react";

export default function Payroll() {
  const store = useStore();
  const { user } = useAuth();
  const [running, setRunning] = useState(false);
  const [viewing, setViewing] = useState<Payslip | null>(null);

  const branch = store.currentBranch;
  const runs = store.payrollRuns.filter((r) => r.branch === branch);
  const latest = runs[0];
  const activeEmps = store.employees.filter((e) => e.branch === branch && e.status === "Active");
  const monthlyGross = activeEmps.reduce((s, e) => s + e.baseSalary + e.transport + e.housing, 0);

  return (
    <AppShell title="Payroll" subtitle={`${store.branchName(branch)} · salaries, statutory deductions & payslips`}>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "On payroll", v: String(activeEmps.length) },
          { l: "Monthly gross", v: `₦${monthlyGross.toLocaleString()}` },
          { l: "Last run — net", v: latest ? `₦${latest.totalNet.toLocaleString()}` : "—" },
          { l: "Payroll runs", v: String(runs.length) },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{s.v}</p>
          </div>
        ))}
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
                    Deductions: ps.gross - ps.net,
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
                <th className="font-medium px-5 py-2.5 text-right">Statutory</th>
                <th className="font-medium px-5 py-2.5 text-right">Other deductions</th>
                <th className="font-medium px-5 py-2.5 text-right">Net pay</th>
                <th className="font-medium px-5 py-2.5 text-right">Payslip</th>
              </tr>
            </thead>
            <tbody>
              {latest.payslips.map((ps) => {
                const statutory = ps.paye + ps.pension + ps.nhf;
                const other = ps.latenessDeduction + ps.shortageDeduction;
                return (
                  <tr key={ps.employeeId} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-5 py-3 font-medium">{ps.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{ps.role}</td>
                    <td className="px-5 py-3 text-right tabular-nums">₦{ps.gross.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">₦{statutory.toLocaleString()}</td>
                    <td className={`px-5 py-3 text-right tabular-nums ${other > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {other > 0 ? `₦${other.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-bold">₦{ps.net.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setViewing(ps)} className="text-xs font-medium text-primary hover:underline">View</button>
                    </td>
                  </tr>
                );
              })}
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
          onClose={() => setRunning(false)}
          onRun={(period) => {
            const run = store.runPayroll(period, user?.name ?? "Accountant");
            toast.success(`Payroll run for ${period} · ${run.payslips.length} payslips`);
            setRunning(false);
          }}
        />
      )}
      {viewing && <PayslipModal slip={viewing} period={latest?.period ?? ""} onClose={() => setViewing(null)} />}
    </AppShell>
  );
}

// ── Run payroll ──────────────────────────────────────────────────────────────

function RunModal({ onClose, onRun }: { onClose: () => void; onRun: (period: string) => void }) {
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
          <p>Each payslip computes: gross (base + allowances) − PAYE (8%) − Pension (8% of base) − NHF (2.5% of base).</p>
          <p>Plus lateness deductions (₦500 per late mark) and cash shortages carried from shift reconciliation.</p>
        </div>
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
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Statutory deductions</p>
          <Row label="PAYE tax" value={-slip.paye} />
          <Row label="Pension (8%)" value={-slip.pension} />
          <Row label="NHF (2.5%)" value={-slip.nhf} />
          <Row label="Total statutory" value={-statutory} bold />
        </div>
        {(slip.latenessDeduction > 0 || slip.shortageDeduction > 0) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Other deductions</p>
            {slip.latenessDeduction > 0 && <Row label="Lateness" value={-slip.latenessDeduction} />}
            {slip.shortageDeduction > 0 && <Row label="Cash shortage (from shifts)" value={-slip.shortageDeduction} />}
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

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
