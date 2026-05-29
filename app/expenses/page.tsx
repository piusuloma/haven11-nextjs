"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { useAuth } from "@/lib/auth";
import { useStore, type ExpenseRequest, type ExpenseStatus } from "@/lib/store";
import { Plus, Wallet as WalletIcon, Receipt, AlertTriangle, CheckCircle2 } from "lucide-react";

const CATEGORIES = [
  "Diesel / Fuel", "Utilities", "Repairs & Maintenance", "Cleaning",
  "Staff Welfare", "Transport", "Supplies", "Other",
];

/** Monthly petty-cash budget per category. */
const BUDGETS: Record<string, number> = {
  "Diesel / Fuel": 600000, "Utilities": 300000, "Repairs & Maintenance": 200000,
  "Cleaning": 100000, "Staff Welfare": 150000, "Transport": 120000, "Supplies": 250000, "Other": 100000,
};

const statusClass: Record<ExpenseStatus, string> = {
  Pending:    "bg-warning/15 text-foreground",
  Approved:   "bg-sky-100 text-sky-700",
  Disbursed:  "bg-primary/10 text-primary",
  Reconciled: "bg-surface text-primary",
  Rejected:   "bg-muted text-muted-foreground",
};

/** Cash committed against a branch+category this period. */
function spentOn(expenses: ExpenseRequest[], branch: string, category: string): number {
  return expenses
    .filter((e) => e.branch === branch && e.category === category && (e.status === "Disbursed" || e.status === "Reconciled"))
    .reduce((s, e) => s + (e.actualSpent ?? e.amount), 0);
}

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default function Expenses() {
  const store = useStore();
  const { user } = useAuth();
  const me = user?.name ?? "You";
  // Three separate authorities — collapsed into the wrong "anyone in the page"
  // before. Cashiers can request; only the cash custodian (Accountant / Owner)
  // approves, disburses, or tops up the float. Reconciliation falls to the
  // original requester (who has the receipt) or the cash custodian.
  const canApprove   = user?.role === "accountant" || user?.role === "owner";
  const canDisburse  = user?.role === "accountant" || user?.role === "owner";
  const canTopUpFloat = user?.role === "accountant" || user?.role === "owner";
  // Cashiers run the till, not petty cash — they can't raise requisitions.
  // Requests come from branch operations (manager / storekeeper) and management.
  const canRequest   = user?.role !== "cashier";

  const [creating, setCreating] = useState(false);
  const [reconciling, setReconciling] = useState<ExpenseRequest | null>(null);
  const [toppingUp, setToppingUp] = useState(false);

  const branch = store.currentBranch;
  const wallet = store.walletOf(branch);
  const branchExpenses = store.expenses.filter((e) => e.branch === branch);
  const myOpen = branchExpenses.find((e) => e.requestedBy === me && e.status === "Disbursed");

  const pending = branchExpenses.filter((e) => e.status === "Pending");
  const awaiting = branchExpenses.filter((e) => e.status === "Disbursed");
  const spentPeriod = branchExpenses
    .filter((e) => e.status === "Disbursed" || e.status === "Reconciled")
    .reduce((s, e) => s + (e.actualSpent ?? e.amount), 0);

  function disburse(e: ExpenseRequest) {
    if (wallet && wallet.balance < e.amount) {
      toast.error("Insufficient wallet float — request a top-up first");
      return;
    }
    store.disburseExpense(e.id, me);
    toast.success(`₦${e.amount.toLocaleString()} disbursed to ${e.requestedBy}`);
  }

  return (
    <AppShell title="Expenses & Petty Cash" subtitle={`${store.branchName(branch)} · Petty cash requests & reconciliation`}>
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { l: "Pending approval", v: String(pending.length) },
          { l: "Awaiting reconciliation", v: String(awaiting.length), tone: awaiting.length > 0 ? "text-warning" : undefined },
          { l: "Spent this period", v: `₦${spentPeriod.toLocaleString()}` },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</p>
          </div>
        ))}
      </section>

      {/* Branch wallet */}
      {wallet && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><WalletIcon className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-semibold">{store.branchName(branch)} petty-cash wallet</p>
                <p className="text-xs text-muted-foreground">Imprest float ₦{wallet.float.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-2xl font-bold tabular-nums">₦{wallet.balance.toLocaleString()}</p>
              {canTopUpFloat && (
                <button
                  onClick={() => setToppingUp(true)}
                  className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-surface"
                >
                  Top up float
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className={`h-full rounded-full ${wallet.balance < wallet.float * 0.2 ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${Math.min(100, (wallet.balance / wallet.float) * 100)}%` }}
            />
          </div>
          {wallet.balance < wallet.float * 0.2 && (
            <p className="mt-2 text-xs text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />Wallet running low — request a reimbursement from Head Office.
            </p>
          )}
        </div>
      )}

      {/* Requests */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Petty-cash requisitions</h2>
        {canRequest && (
          <button
            onClick={() => {
              if (myOpen) { toast.error(`Settle ${myOpen.id} before raising a new request`); return; }
              setCreating(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />New request
          </button>
        )}
      </div>

      {myOpen && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          You have an open requisition ({myOpen.id}) — reconcile it before requesting more cash.
        </div>
      )}

      <section className="space-y-3">
        {branchExpenses.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No requisitions for this branch yet.
          </div>
        ) : (
          branchExpenses.map((e) => {
            return (
              <article key={e.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold">{e.id}</span>
                    <span className="text-sm">{e.category}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[e.status]}`}>{e.status}</span>
                  </div>
                  <span className="text-lg font-bold tabular-nums">₦{e.amount.toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {e.requestedBy} · {timeAgo(e.requestedAt)} · approval: Accountant
                  {e.approvedBy && ` · approved by ${e.approvedBy}`}
                </p>

                {e.status === "Reconciled" && (
                  <p className="mt-2 text-xs text-primary">
                    Spent ₦{(e.actualSpent ?? 0).toLocaleString()} · ₦{(e.changeReturned ?? 0).toLocaleString()} change returned · receipt: {e.receipt}
                  </p>
                )}

                <div className="mt-3 flex justify-end gap-1.5">
                  {e.status === "Pending" && (canApprove ? (
                    <>
                      <button onClick={() => { store.rejectExpense(e.id, me); toast.error(`${e.id} rejected`); }} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-surface">Reject</button>
                      <button onClick={() => { store.approveExpense(e.id, me); toast.success(`${e.id} approved by ${me}`); }} className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Approve</button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Awaiting Accountant approval</span>
                  ))}
                  {e.status === "Approved" && (canDisburse ? (
                    <button onClick={() => disburse(e)} className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Disburse cash</button>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Awaiting Accountant disbursement</span>
                  ))}
                  {/* Reconciliation falls to the original requester (who has the receipt)
                      or the cash custodian. No-one else needs this button. */}
                  {e.status === "Disbursed" && (e.requestedBy === me || canDisburse) && (
                    <button onClick={() => setReconciling(e)} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                      <Receipt className="h-3.5 w-3.5" />Reconcile &amp; return change
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* Leakage report — spend vs budget by category (owner/manager analytics) */}
      {(user?.role === "owner" || user?.role === "manager" || user?.role === "accountant") && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Expense leakage — spend vs budget</h2>
          <div className="mt-4 space-y-3">
            {CATEGORIES.map((cat) => {
              const spent = spentOn(store.expenses, branch, cat);
              const budget = BUDGETS[cat];
              const pct = Math.min(100, (spent / budget) * 100);
              const over = spent > budget;
              if (spent === 0) return null;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{cat}</span>
                    <span className={`tabular-nums ${over ? "text-destructive" : "text-muted-foreground"}`}>
                      ₦{spent.toLocaleString()} / ₦{budget.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface">
                    <div className={`h-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {CATEGORIES.every((c) => spentOn(store.expenses, branch, c) === 0) && (
              <p className="text-sm text-muted-foreground">No spend recorded for this branch yet.</p>
            )}
          </div>
        </div>
      )}

      {creating && <NewExpenseModal me={me} onClose={() => setCreating(false)} />}
      {reconciling && <ReconcileModal expense={reconciling} me={me} onClose={() => setReconciling(null)} />}
      {toppingUp && wallet && <TopUpModal branch={branch} me={me} balance={wallet.balance} float={wallet.float} onClose={() => setToppingUp(false)} />}
    </AppShell>
  );
}

// ── New request ──────────────────────────────────────────────────────────────

function NewExpenseModal({ me, onClose }: { me: string; onClose: () => void }) {
  const store = useStore();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const amt = Number(amount) || 0;
  const spent = spentOn(store.expenses, store.currentBranch, category);
  const budget = BUDGETS[category];
  const remaining = budget - spent;
  const overBudget = amt > remaining;

  function submit() {
    if (amt <= 0) { toast.error("Enter an amount"); return; }
    if (!description.trim()) { toast.error("Add a description"); return; }
    const created = store.requestExpense({ category, amount: amt, description: description.trim(), by: me });
    toast.success(`${created.id} submitted — routed to the Accountant`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New petty-cash request"
      description="Routed to the Accountant for approval"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Submit request</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Amount ₦</span>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Description / purpose</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. 50 litres diesel for generator" className={inputCls} />
        </label>

        <div className="rounded-xl bg-surface/60 border border-border p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{category} budget left</span>
            <span className={`tabular-nums font-medium ${overBudget ? "text-destructive" : ""}`}>₦{remaining.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Approver</span>
            <span className="font-medium">Accountant</span>
          </div>
        </div>
        {overBudget && amt > 0 && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />This request exceeds the remaining {category} budget — the approver will be warned.
          </p>
        )}
      </div>
    </Modal>
  );
}

// ── Reconcile / change loop ──────────────────────────────────────────────────

function ReconcileModal({ expense, me, onClose }: { expense: ExpenseRequest; me: string; onClose: () => void }) {
  const store = useStore();
  const [actual, setActual] = useState("");
  const [hasReceipt, setHasReceipt] = useState(false);
  const [waiver, setWaiver] = useState(false);

  const spent = Number(actual) || 0;
  const change = Math.max(0, expense.amount - spent);

  function confirm() {
    if (spent <= 0) { toast.error("Enter the amount actually spent"); return; }
    if (spent > expense.amount) { toast.error("Spend cannot exceed the disbursed amount"); return; }
    if (!hasReceipt && !waiver) { toast.error("Attach a receipt — or record a manager waiver"); return; }
    store.reconcileExpense(expense.id, {
      actualSpent: spent,
      receipt: hasReceipt ? "Receipt confirmed on file" : "Manager waiver — no receipt",
    }, me);
    toast.success(change > 0 ? `Reconciled · ₦${change.toLocaleString()} change returned to wallet` : "Reconciled · no change");
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reconcile ${expense.id}`}
      description={`₦${expense.amount.toLocaleString()} disbursed for ${expense.category}`}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={confirm}>Close requisition</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Amount actually spent ₦</span>
          <input type="number" value={actual} onChange={(e) => setActual(e.target.value)} placeholder="0" autoFocus className={inputCls} />
        </label>

        <div className="rounded-xl bg-surface/60 border border-border p-3 flex justify-between text-sm">
          <span className="text-muted-foreground">Change to return to wallet</span>
          <span className="font-bold tabular-nums text-primary">₦{change.toLocaleString()}</span>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => { setHasReceipt((v) => !v); if (!hasReceipt) setWaiver(false); }}
            className={`flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-colors ${hasReceipt ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-surface"}`}
          >
            {hasReceipt ? <CheckCircle2 className="h-4 w-4" /> : <Receipt className="h-4 w-4" />}
            {hasReceipt ? "Receipt confirmed on file" : "Confirm receipt is on file"}
          </button>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={waiver} onChange={(e) => { setWaiver(e.target.checked); if (e.target.checked) setHasReceipt(false); }} />
            No receipt available — record a manager waiver
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Reconciling returns the change and closes your open requisition.
        </p>
      </div>
    </Modal>
  );
}

// ── Top-up ───────────────────────────────────────────────────────────────────

function TopUpModal({ branch, me, balance, float, onClose }: { branch: string; me: string; balance: number; float: number; onClose: () => void }) {
  const store = useStore();
  const [amount, setAmount] = useState(String(Math.max(0, float - balance)));

  function confirm() {
    const amt = Number(amount) || 0;
    if (amt <= 0) { toast.error("Enter a top-up amount"); return; }
    store.topUpWallet(branch, amt, me);
    toast.success(`Wallet topped up by ₦${amt.toLocaleString()}`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Request wallet top-up"
      description={`Reimbursement from Head Office · float ₦${float.toLocaleString()}`}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={confirm}>Top up wallet</ModalButton></>}
    >
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">Top-up amount ₦</span>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus className={inputCls} />
      </label>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
