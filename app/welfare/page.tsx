"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { useAuth } from "@/lib/auth";
import {
  useStore, type WelfareRequest, type WelfareCategory, type WelfareStatus,
} from "@/lib/store";
import {
  Plus, HeartHandshake, Stethoscope, GraduationCap, Cake, Gift, AlertCircle,
  Banknote, CheckCircle2, X, RefreshCcw,
} from "lucide-react";

const CATEGORIES: { kind: WelfareCategory; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { kind: "Medical",                icon: Stethoscope,   hint: "Hospital bill, medication, ambulance" },
  { kind: "Bereavement",            icon: HeartHandshake, hint: "Funeral support, leave with pay" },
  { kind: "Family emergency",       icon: AlertCircle,   hint: "Sudden need outside the routine" },
  { kind: "Education",              icon: GraduationCap, hint: "School fees, training, certification" },
  { kind: "Wedding",                icon: Cake,          hint: "Marriage support" },
  { kind: "Loan / salary advance",  icon: Banknote,      hint: "Recoverable advance — deducted monthly from payroll" },
  { kind: "Gift / commendation",    icon: Gift,          hint: "Token, recognition, anniversary gift" },
  { kind: "Other",                  icon: HeartHandshake, hint: "Anything else worth recording" },
];

const STATUS_CLASS: Record<WelfareStatus, string> = {
  Pending:   "bg-warning/15 text-foreground",
  Approved:  "bg-sky-100 text-sky-700",
  Disbursed: "bg-primary/10 text-primary",
  Repaying:  "bg-violet-100 text-violet-700",
  Closed:    "bg-surface text-primary",
  Rejected:  "bg-muted text-muted-foreground",
};

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

/**
 * Staff Welfare — distinct from petty cash and from payroll. Captures the
 * informal-but-frequent reality of restaurant ops: a cashier's mother is sick,
 * a chef needs a salary advance, an anniversary gift to a long-server. Every
 * entry has a category, an amount, a written reason, and a clear lifecycle
 * (Pending → Approved → Disbursed → Closed / Repaying → Closed). Recoverable
 * advances feed into the payroll deductions automatically.
 */
export default function Welfare() {
  const store = useStore();
  const { user } = useAuth();
  const me = user?.name ?? "You";
  const canApprove = user?.role === "owner" || user?.role === "manager" || user?.role === "hr";
  const canDisburse = user?.role === "owner" || user?.role === "accountant" || user?.role === "manager";

  const branch = store.currentBranch;
  const [requesting, setRequesting] = useState(false);
  const [rejecting, setRejecting] = useState<WelfareRequest | null>(null);

  const all = useMemo(
    () => store.welfare.filter((w) => w.branch === branch).slice().sort((a, b) => b.requestedAt - a.requestedAt),
    [store.welfare, branch],
  );
  const pending = all.filter((w) => w.status === "Pending");
  const approved = all.filter((w) => w.status === "Approved");
  const live = all.filter((w) => w.status === "Disbursed" || w.status === "Repaying");
  const closed = all.filter((w) => w.status === "Closed" || w.status === "Rejected");

  // Headline KPIs.
  const ytdDisbursed = all
    .filter((w) => w.status !== "Rejected" && w.status !== "Pending" && new Date(w.disbursedAt ?? w.requestedAt).getFullYear() === new Date().getFullYear())
    .reduce((s, w) => s + w.amount, 0);
  const advancesOutstanding = all
    .filter((w) => w.status === "Repaying")
    .reduce((s, w) => s + (w.amount - w.amountRepaid), 0);

  return (
    <AppShell title="Staff welfare" subtitle={`${store.branchName(branch)} · support, advances & care for the team`}>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Pending requests", v: String(pending.length), tone: pending.length > 0 ? "text-warning" : undefined },
          { l: "Live (disbursed)", v: String(live.length) },
          { l: "Advances outstanding", v: `₦${(advancesOutstanding / 1000).toFixed(0)}k`, hint: "Recovered monthly via payroll" },
          { l: "Year-to-date paid", v: `₦${(ytdDisbursed / 1000).toFixed(0)}k`, hint: `${all.length} request${all.length === 1 ? "" : "s"} on record` },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</p>
            {s.hint && <p className="mt-1 text-[11px] text-muted-foreground">{s.hint}</p>}
          </div>
        ))}
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Requests</h2>
        <button
          onClick={() => setRequesting(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />New request
        </button>
      </div>

      {/* Pending — needs an approval decision */}
      {pending.length > 0 && (
        <Section title="Pending approval" tone="warning">
          {pending.map((w) => (
            <RequestCard
              key={w.id}
              welfare={w}
              showApprove={canApprove}
              onApprove={() => {
                const r = store.approveWelfare(w.id, me);
                if (!r.ok) { toast.error(r.error ?? ""); return; }
                toast.success(`${w.id} approved — pass to accountant for disbursement`);
              }}
              onReject={() => setRejecting(w)}
            />
          ))}
        </Section>
      )}

      {/* Approved — awaiting disbursement (accountant action) */}
      {approved.length > 0 && (
        <Section title="Approved · awaiting disbursement">
          {approved.map((w) => (
            <RequestCard
              key={w.id}
              welfare={w}
              showDisburse={canDisburse}
              onDisburse={() => {
                const r = store.disburseWelfare(w.id, me);
                if (!r.ok) { toast.error(r.error ?? ""); return; }
                toast.success(`₦${w.amount.toLocaleString()} disbursed to ${w.employeeName}`);
              }}
            />
          ))}
        </Section>
      )}

      {/* Disbursed / Repaying — live records */}
      {live.length > 0 && (
        <Section title="Live · disbursed">
          {live.map((w) => (
            <RequestCard
              key={w.id}
              welfare={w}
              showClose={!w.repayable && canApprove}
              onClose={() => {
                const r = store.closeWelfare(w.id, me);
                if (!r.ok) { toast.error(r.error ?? ""); return; }
                toast.success(`${w.id} closed`);
              }}
            />
          ))}
        </Section>
      )}

      {/* History */}
      {closed.length > 0 && (
        <Section title="History" muted>
          {closed.map((w) => <RequestCard key={w.id} welfare={w} />)}
        </Section>
      )}

      {all.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <HeartHandshake className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.25} />
          <p className="text-sm text-muted-foreground">
            No welfare requests yet. Click <span className="font-medium text-foreground">New request</span> to support a staff member.
          </p>
        </div>
      )}

      {requesting && <NewRequestModal me={me} onClose={() => setRequesting(false)} />}
      {rejecting && (
        <RejectModal
          welfare={rejecting}
          me={me}
          onClose={() => setRejecting(null)}
        />
      )}
    </AppShell>
  );
}

function Section({ title, children, tone, muted }: { title: string; children: React.ReactNode; tone?: "warning"; muted?: boolean }) {
  return (
    <section className={`rounded-xl border bg-card ${tone === "warning" ? "border-warning/30" : "border-border"} ${muted ? "opacity-80" : ""}`}>
      <header className="px-4 py-2.5 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </header>
      <ul className="divide-y divide-border">{children}</ul>
    </section>
  );
}

function RequestCard({
  welfare: w, showApprove, showDisburse, showClose, onApprove, onReject, onDisburse, onClose,
}: {
  welfare: WelfareRequest;
  showApprove?: boolean;
  showDisburse?: boolean;
  showClose?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onDisburse?: () => void;
  onClose?: () => void;
}) {
  const cat = CATEGORIES.find((c) => c.kind === w.category);
  const Icon = cat?.icon ?? HeartHandshake;
  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-primary">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{w.employeeName}</p>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{w.category}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[w.status]}`}>{w.status}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{w.id}</span>
            </div>
            <p className="mt-1 text-sm text-foreground/85 italic">&ldquo;{w.reason}&rdquo;</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Requested by {w.requestedBy} · {timeAgo(w.requestedAt)}
              {w.approvedAt && ` · Approved by ${w.approvedBy} · ${timeAgo(w.approvedAt)}`}
              {w.disbursedAt && ` · Disbursed by ${w.disbursedBy} · ${timeAgo(w.disbursedAt)}`}
              {w.rejectionReason && ` · Rejected: ${w.rejectionReason}`}
            </p>
            {w.repayable && w.status === "Repaying" && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><RefreshCcw className="h-3 w-3" />Repaying via payroll — ₦{w.amountRepaid.toLocaleString()} of ₦{w.amount.toLocaleString()}</span>
                  <span>{Math.round((w.amountRepaid / w.amount) * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, (w.amountRepaid / w.amount) * 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="tabular-nums font-bold text-lg">₦{w.amount.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">
              {w.repayable ? `Advance · ${w.repaymentMonths} months` : "Company support"}
            </p>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            {showApprove && onApprove && (
              <button onClick={onApprove} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                <CheckCircle2 className="h-3 w-3" />Approve
              </button>
            )}
            {showApprove && onReject && (
              <button onClick={onReject} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-surface">Reject</button>
            )}
            {showDisburse && onDisburse && (
              <button onClick={onDisburse} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                <Banknote className="h-3 w-3" />Disburse
              </button>
            )}
            {showClose && onClose && (
              <button onClick={onClose} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-surface">Mark closed</button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

// ── New welfare request ──────────────────────────────────────────────────────

function NewRequestModal({ me, onClose }: { me: string; onClose: () => void }) {
  const store = useStore();
  const employees = store.employees.filter((e) => e.branch === store.currentBranch && e.status === "Active");
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [category, setCategory] = useState<WelfareCategory>("Medical");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [repayable, setRepayable] = useState(false);
  const [months, setMonths] = useState("3");

  // Salary advances are repayable by default — flip when the operator chooses.
  function changeCategory(c: WelfareCategory) {
    setCategory(c);
    setRepayable(c === "Loan / salary advance");
  }

  function submit() {
    const amt = Number(amount);
    if (!employeeId) { toast.error("Pick an employee"); return; }
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    if (!reason.trim()) { toast.error("Reason is required"); return; }
    const res = store.requestWelfare({
      employeeId, category, amount: amt, reason: reason.trim(),
      repayable, repaymentMonths: repayable ? Number(months) || 1 : undefined,
      by: me,
    });
    if (!res.ok) { toast.error(res.error ?? ""); return; }
    const emp = employees.find((e) => e.id === employeeId);
    toast.success(`Request raised for ${emp?.name} · ₦${amt.toLocaleString()}`);
    onClose();
  }

  const cat = CATEGORIES.find((c) => c.kind === category);

  return (
    <Modal
      open
      onClose={onClose}
      title="New welfare request"
      description="Captures the support — approval and disbursement happen on the cards above"
      size="lg"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Submit request</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Employee</span>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputCls}>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.role}</option>)}
          </select>
        </label>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Category</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              const active = category === c.kind;
              return (
                <button
                  key={c.kind}
                  type="button"
                  onClick={() => changeCategory(c.kind)}
                  className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors ${active ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-surface"}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-semibold">{c.kind}</span>
                </button>
              );
            })}
          </div>
          {cat && <p className="mt-1.5 text-[11px] text-muted-foreground">{cat.hint}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Amount ₦</span>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={inputCls} />
          </label>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground pb-2">
              <input type="checkbox" checked={repayable} onChange={(e) => setRepayable(e.target.checked)} className="h-3.5 w-3.5" />
              Pay it back from salary?
            </label>
          </div>
        </div>

        {repayable && (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Repayment plan</span>
            <select value={months} onChange={(e) => setMonths(e.target.value)} className={inputCls}>
              {[1, 2, 3, 4, 6, 9, 12].map((m) => (
                <option key={m} value={m}>{m} month{m === 1 ? "" : "s"} · ₦{amount ? Math.round(Number(amount) / m).toLocaleString() : "—"} / month</option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Each instalment is auto-deducted on the next payroll run with a labelled line: <span className="font-mono">Welfare advance · Instalment N of M</span>.
            </p>
          </label>
        )}

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Reason (required)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={category === "Medical" ? "e.g. Hospital bill for daughter — receipt attached"
              : category === "Loan / salary advance" ? "e.g. Rent due before payday · split over 3 months"
              : "Why this support is being given"}
            rows={3}
            className={`${inputCls} resize-y`}
          />
        </label>
      </div>
    </Modal>
  );
}

// ── Reject ───────────────────────────────────────────────────────────────────

function RejectModal({ welfare, me, onClose }: { welfare: WelfareRequest; me: string; onClose: () => void }) {
  const store = useStore();
  const [reason, setReason] = useState("");

  function submit() {
    if (!reason.trim()) { toast.error("Please give a reason"); return; }
    const r = store.rejectWelfare(welfare.id, reason.trim(), me);
    if (!r.ok) { toast.error(r.error ?? ""); return; }
    toast.error(`${welfare.id} rejected`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Reject welfare request"
      description={`${welfare.employeeName} · ${welfare.category} · ₦${welfare.amount.toLocaleString()}`}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Confirm rejection</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Reason for rejection</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this isn't being approved"
            rows={3}
            autoFocus
            className={`${inputCls} resize-y`}
          />
        </label>
        <p className="text-[11px] text-muted-foreground">
          <X className="inline h-3 w-3" /> The rejection reason is logged on the request and audit trail — visible to the employee.
        </p>
      </div>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
