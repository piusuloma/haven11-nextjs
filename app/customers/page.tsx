"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { useAuth } from "@/lib/auth";
import {
  useStore, friendlyReminderLabel, agingBucket,
  type Customer, type CustomerTier,
  type ComplaintStatus, type Order, type OrderChannel,
  type CustomerInvoice, type CustomerLedgerEntry, type ReminderKind,
} from "@/lib/store";
import {
  Star, Plus, Search, Gift, MessageSquareWarning, Smile, Cake,
  Wallet, Receipt, FileText, Send, Printer, AlertCircle, CreditCard, Coins,
  Settings, Pencil,
} from "lucide-react";
import { DateRangePicker, inRange, type DateRange } from "@/components/DateRangePicker";

const tierClass: Record<CustomerTier, string> = {
  VIP: "bg-foreground text-background",
  Regular: "bg-surface text-surface-foreground",
  New: "bg-sky-100 text-sky-700",
  Blacklisted: "bg-destructive/10 text-destructive",
};

const complaintClass: Record<ComplaintStatus, string> = {
  Open: "bg-warning/15 text-foreground",
  "In progress": "bg-sky-100 text-sky-700",
  Resolved: "bg-surface text-primary",
};

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

function topItem(orders: Order[]): string | undefined {
  const count: Record<string, number> = {};
  for (const o of orders) for (const l of o.lines) count[l.name] = (count[l.name] ?? 0) + l.qty;
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
}

export default function Customers() {
  const store = useStore();
  const { user } = useAuth();
  const branch = store.currentBranch;
  const me = user?.name ?? "You";
  const canManageAccounts = user?.role === "owner" || user?.role === "manager" || user?.role === "accountant";

  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [loggingFeedback, setLoggingFeedback] = useState(false);
  const [loggingComplaint, setLoggingComplaint] = useState(false);
  const [openInvoice, setOpenInvoice] = useState<CustomerInvoice | null>(null);

  // 360-view stats for a customer, unified across all branches.
  function stats(c: Customer) {
    const orders = store.orders.filter((o) => !o.voided && o.customer?.phone === c.phone);
    const visits = (c.seedVisits ?? 0) + orders.length;
    const ltv = (c.seedSpend ?? 0) + orders.reduce((s, o) => s + o.total, 0);
    const favorite = topItem(orders) ?? c.seedFavorite ?? "—";
    const lastDays = orders.length
      ? Math.floor((Date.now() - Math.max(...orders.map((o) => o.at))) / 86400000)
      : c.seedLastDays ?? null;
    return { visits, ltv, favorite, lastDays };
  }

  const q = query.trim().toLowerCase();
  const customers = q
    ? store.customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q))
    : store.customers;

  const branchFeedback = store.feedback.filter((f) => f.branch === branch);
  const branchComplaints = store.complaints.filter((c) => c.branch === branch);
  const openComplaints = branchComplaints.filter((c) => c.status !== "Resolved");
  const mood = branchFeedback.length
    ? branchFeedback.reduce((s, f) => s + (f.food + f.service + f.ambience) / 3, 0) / branchFeedback.length
    : 0;
  const moodTone = mood >= 4 ? "text-primary" : mood >= 3 ? "text-warning" : "text-destructive";

  const thisMonth = new Date().toISOString().slice(5, 7);
  const birthdays = store.customers.filter((c) => c.birthday?.slice(0, 2) === thisMonth);
  const winBack = store.customers.filter((c) => { const d = stats(c).lastDays; return d != null && d > 30; });

  // Accounts receivable — customers with outstanding credit balances and/or
  // unpaid invoices. Aging is computed off the oldest open invoice's due date.
  const outstandingAR = store.customers.reduce((s, c) => s + c.credit, 0);
  const totalOnWallets = store.customers.reduce((s, c) => s + c.wallet, 0);
  const arCustomers = useMemo(
    () => store.customers
      .filter((c) => c.credit > 0)
      .map((c) => {
        const invs = store.customerInvoices.filter((i) => i.customerId === c.id && i.status !== "Paid" && i.status !== "Void");
        const oldestDue = invs.length ? invs.map((i) => i.dueDate).sort()[0] : null;
        const daysOverdue = oldestDue ? Math.floor((Date.now() - new Date(oldestDue).getTime()) / 86400_000) : 0;
        return { customer: c, openInvoices: invs.length, oldestDue, daysOverdue, bucket: agingBucket(daysOverdue) };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue),
    [store.customers, store.customerInvoices],
  );
  const agingTotals = arCustomers.reduce((acc, r) => {
    acc[r.bucket] = (acc[r.bucket] ?? 0) + r.customer.credit;
    return acc;
  }, {} as Record<string, number>);

  return (
    <AppShell title="Customers" subtitle="Golden-record CRM · loyalty, feedback & complaints">
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { l: "Customers", v: String(store.customers.length) },
          { l: "VIPs", v: String(store.customers.filter((c) => c.tier === "VIP").length) },
          { l: "Open complaints", v: String(openComplaints.length), tone: openComplaints.length > 0 ? "text-destructive" : undefined },
          { l: "On customer wallets", v: `₦${(totalOnWallets / 1000).toFixed(0)}k`, hint: "Prepaid balance held for customers" },
          { l: "Outstanding A/R", v: `₦${(outstandingAR / 1000).toFixed(0)}k`, tone: outstandingAR > 0 ? "text-destructive" : undefined, hint: `${arCustomers.length} customer${arCustomers.length === 1 ? "" : "s"} on credit` },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</p>
            {s.hint && <p className="mt-1 text-[11px] text-muted-foreground">{s.hint}</p>}
          </div>
        ))}
      </section>

      {/* Golden-record database */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
          <h2 className="text-sm font-semibold">Customer database</h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 w-52">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or phone…" className="bg-transparent text-sm outline-none w-full" />
            </div>
            <button onClick={() => setAddingCustomer(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              <Plus className="h-3.5 w-3.5" />New customer
            </button>
          </div>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border bg-surface/40">
              <th className="font-medium px-5 py-2.5">Customer</th>
              <th className="font-medium px-5 py-2.5">Phone</th>
              <th className="font-medium px-5 py-2.5">Tier</th>
              <th className="font-medium px-5 py-2.5 text-right">Visits</th>
              <th className="font-medium px-5 py-2.5 text-right">Lifetime value</th>
              <th className="font-medium px-5 py-2.5 text-right">Account</th>
              <th className="font-medium px-5 py-2.5 text-right">Last seen</th>
              <th className="font-medium px-5 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">No customers found.</td></tr>
            ) : customers.map((c) => {
              const st = stats(c);
              return (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{c.phone}</td>
                  <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tierClass[c.tier]}`}>{c.tier === "VIP" && <Star className="h-3 w-3" />}{c.tier}</span></td>
                  <td className="px-5 py-3 text-right tabular-nums">{st.visits}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">₦{st.ltv.toLocaleString()}</td>
                  <td className="px-5 py-3 text-right">
                    <AccountChips wallet={c.wallet} credit={c.credit} creditLimit={c.creditLimit} />
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground">{st.lastDays == null ? "—" : st.lastDays === 0 ? "today" : `${st.lastDays}d ago`}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => setViewing(c)} className="text-xs font-medium text-primary hover:underline">View 360°</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Accounts receivable — customers with outstanding credit balances */}
      <section className="rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />Accounts receivable
            </h2>
            <p className="text-xs text-muted-foreground">House-account customers — issue statements & chase reminders</p>
          </div>
          {(["Current", "1-30", "31-60", "61-90", "90+"] as const).map((b) => (
            <div key={b} className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{b}{b !== "Current" && " days"}</p>
              <p className={`text-sm font-semibold tabular-nums ${b === "90+" && (agingTotals[b] ?? 0) > 0 ? "text-destructive" : b === "61-90" && (agingTotals[b] ?? 0) > 0 ? "text-warning" : ""}`}>
                ₦{((agingTotals[b] ?? 0) / 1000).toFixed(0)}k
              </p>
            </div>
          ))}
        </header>
        {arCustomers.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No outstanding balances — every house tab is paid up. 🎉</p>
        ) : (
          <ul className="divide-y divide-border">
            {arCustomers.map(({ customer: c, openInvoices, oldestDue, daysOverdue, bucket }) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-surface/40">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{c.name}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      bucket === "90+" ? "bg-destructive/10 text-destructive"
                      : bucket === "61-90" ? "bg-warning/15 text-foreground"
                      : bucket === "Current" ? "bg-surface text-primary"
                      : "bg-muted text-muted-foreground"
                    }`}>{bucket}{bucket !== "Current" && " days"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {openInvoices > 0
                      ? `${openInvoices} open statement${openInvoices === 1 ? "" : "s"} · oldest due ${oldestDue}${daysOverdue > 0 ? ` · ${daysOverdue}d overdue` : ""}`
                      : "No statement issued yet"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`tabular-nums font-bold ${c.credit > c.creditLimit * 0.8 ? "text-destructive" : ""}`}>₦{c.credit.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">of ₦{c.creditLimit.toLocaleString()} limit</p>
                  </div>
                  <button onClick={() => setViewing(c)} className="text-xs font-medium text-primary hover:underline">Open account</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Complaints + feedback — collapsed by default so the page lands clean.
          Each customer's complaints & feedback are also visible inside their 360. */}
      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex items-center justify-between gap-2 px-5 py-3.5 cursor-pointer select-none hover:bg-surface/40">
          <span className="text-sm font-semibold inline-flex items-center gap-2">
            <MessageSquareWarning className="h-4 w-4 text-muted-foreground" />
            Complaints &amp; feedback
            {openComplaints.length > 0 && (
              <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-semibold">
                {openComplaints.length} open
              </span>
            )}
            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">
              {branchFeedback.length} feedback
            </span>
          </span>
          <span className="text-[11px] text-muted-foreground group-open:hidden">Show →</span>
          <span className="text-[11px] text-muted-foreground hidden group-open:inline">Hide</span>
        </summary>
        <div className="p-5 pt-2 grid grid-cols-1 lg:grid-cols-2 gap-4 [&>div]:rounded-xl [&>div]:border [&>div]:border-border [&>div]:bg-card [&>div]:p-5">
        <div className="rounded-xl border border-border bg-card p-5">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2"><MessageSquareWarning className="h-4 w-4 text-muted-foreground" />Complaint tickets</h2>
            <button onClick={() => setLoggingComplaint(true)} className="text-xs font-medium text-primary hover:underline">Log complaint</button>
          </header>
          {branchComplaints.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No complaints logged for this branch.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {branchComplaints.map((t) => {
                const escalated = t.status === "Open" && Date.now() - t.raisedAt > 24 * 3600_000;
                return (
                  <li key={t.id} className={`rounded-lg border p-3 ${escalated ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{t.subject}</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${complaintClass[t.status]}`}>{t.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.customerName} · {t.id} · {timeAgo(t.raisedAt)}{escalated && <span className="text-destructive font-medium"> · escalated to MD (24h+)</span>}</p>
                    <p className="text-xs text-foreground/80 mt-1">{t.detail}</p>
                    {t.status !== "Resolved" && (
                      <div className="mt-2 flex justify-end gap-1.5">
                        {t.status === "Open" && (
                          <button onClick={() => store.setComplaintStatus(t.id, "In progress")} className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface">Start handling</button>
                        )}
                        <button onClick={() => { store.setComplaintStatus(t.id, "Resolved"); toast.success(`${t.id} resolved`); }} className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Mark resolved</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Smile className="h-4 w-4 text-muted-foreground" />Feedback &amp; mood</h2>
            <button onClick={() => setLoggingFeedback(true)} className="text-xs font-medium text-primary hover:underline">Log feedback</button>
          </header>
          <div className={`mt-3 rounded-xl border p-3 flex items-center justify-between ${mood >= 4 ? "border-primary/20 bg-primary/5" : mood >= 3 ? "border-warning/30 bg-warning/10" : "border-destructive/20 bg-destructive/5"}`}>
            <span className="text-sm font-medium">Branch mood meter</span>
            <span className={`text-lg font-bold ${moodTone}`}>{mood ? `${mood.toFixed(1)} / 5` : "no data"}</span>
          </div>
          {branchFeedback.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No feedback yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {branchFeedback.slice(0, 5).map((f) => (
                <li key={f.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{f.customerName}</span>
                    <span className={`text-xs font-semibold ${f.sentiment === "Positive" ? "text-primary" : f.sentiment === "Negative" ? "text-destructive" : "text-muted-foreground"}`}>{f.sentiment}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Food {f.food}★ · Service {f.service}★ · Ambience {f.ambience}★ · {timeAgo(f.at)}</p>
                  <p className="text-xs text-foreground/80 mt-1 italic">&ldquo;{f.comment}&rdquo;</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>
      </details>

      {/* Marketing & retention — also collapsed; manager opens when running a campaign */}
      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex items-center justify-between gap-2 px-5 py-3.5 cursor-pointer select-none hover:bg-surface/40">
          <span className="text-sm font-semibold inline-flex items-center gap-2">
            <Gift className="h-4 w-4 text-muted-foreground" />
            Marketing &amp; retention
            {winBack.length > 0 && (
              <span className="rounded-full bg-warning/15 text-foreground px-2 py-0.5 text-[10px] font-semibold">
                {winBack.length} lapsed
              </span>
            )}
            {birthdays.length > 0 && (
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                {birthdays.length} birthday{birthdays.length === 1 ? "" : "s"}
              </span>
            )}
          </span>
          <span className="text-[11px] text-muted-foreground group-open:hidden">Show →</span>
          <span className="text-[11px] text-muted-foreground hidden group-open:inline">Hide</span>
        </summary>
        <div className="px-5 pb-5 pt-1">
        <h2 className="sr-only">Marketing &amp; retention</h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Win-back — not seen in 30+ days</p>
            {winBack.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lapsed customers.</p>
            ) : (
              <ul className="space-y-1.5">
                {winBack.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      {c.name} <span className="text-muted-foreground text-xs">· {stats(c).lastDays}d ago</span>
                      {c.lastContactedAt != null && (
                        <span className="block text-[11px] text-muted-foreground">{c.lastContactKind ?? "Offer"} sent {timeAgo(c.lastContactedAt)}</span>
                      )}
                    </span>
                    {c.lastContactedAt != null ? (
                      <button disabled className="shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-muted-foreground cursor-default">Contacted</button>
                    ) : (
                      <button
                        onClick={() => { store.contactCustomer(c.id, "Win-back offer"); toast.success(`"We miss you" offer sent to ${c.name}`); }}
                        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-surface"
                      >
                        Send win-back
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><Cake className="h-3.5 w-3.5" />Birthdays this month</p>
            {birthdays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No birthdays this month.</p>
            ) : (
              <ul className="space-y-1.5">
                {birthdays.map((c) => (
                  <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      {c.name} <span className="text-muted-foreground text-xs">· {c.birthday}</span>
                      {c.lastContactedAt != null && (
                        <span className="block text-[11px] text-muted-foreground">{c.lastContactKind ?? "Treat"} sent {timeAgo(c.lastContactedAt)}</span>
                      )}
                    </span>
                    {c.lastContactedAt != null ? (
                      <button disabled className="shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-muted-foreground cursor-default">Contacted</button>
                    ) : (
                      <button
                        onClick={() => { store.contactCustomer(c.id, "Birthday treat"); toast.success(`Birthday treat sent to ${c.name} 🎂`); }}
                        className="shrink-0 rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-surface"
                      >
                        Send treat
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        </div>
      </details>

      {viewing && (
        <CustomerModal
          customer={viewing}
          onClose={() => setViewing(null)}
          stats={stats(viewing)}
          canManageAccounts={canManageAccounts}
          me={me}
          onOpenInvoice={setOpenInvoice}
        />
      )}
      {openInvoice && <InvoiceModal invoice={openInvoice} onClose={() => setOpenInvoice(null)} me={me} />}
      {addingCustomer && <AddCustomerModal onClose={() => setAddingCustomer(false)} />}
      {loggingFeedback && <FeedbackModal onClose={() => setLoggingFeedback(false)} />}
      {loggingComplaint && <ComplaintModal by={user?.name ?? "Manager"} onClose={() => setLoggingComplaint(false)} />}
    </AppShell>
  );
}

// ── Account chips (table cell + AR list) ─────────────────────────────────────

function AccountChips({ wallet, credit, creditLimit }: { wallet: number; credit: number; creditLimit: number }) {
  const hasWallet = wallet > 0;
  const hasCredit = credit > 0;
  const hasLimit = creditLimit > 0;
  if (!hasWallet && !hasCredit && !hasLimit) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      {hasWallet && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          <Wallet className="h-3 w-3" />₦{wallet.toLocaleString()}
        </span>
      )}
      {hasCredit && (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${credit > creditLimit * 0.8 ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-foreground"}`}>
          <CreditCard className="h-3 w-3" />₦{credit.toLocaleString()}
        </span>
      )}
      {!hasCredit && hasLimit && (
        <span className="text-[10px] text-muted-foreground">House: ₦{creditLimit.toLocaleString()} limit</span>
      )}
    </div>
  );
}

// ── Customer 360 ─────────────────────────────────────────────────────────────

/**
 * Single-screen customer view, designed for non-technical staff. Front-loads
 * the two questions every cashier actually asks: *"What did they have last
 * time?"* and *"Do they have money on file / owe us anything?"*. Advanced
 * settings (credit limit, manual charges, write-offs) live behind a gear icon
 * so the default view stays clean.
 */
function CustomerModal({
  customer, stats, onClose, canManageAccounts, me, onOpenInvoice,
}: {
  customer: Customer;
  stats: { visits: number; ltv: number; favorite: string; lastDays: number | null };
  onClose: () => void;
  canManageAccounts: boolean;
  me: string;
  onOpenInvoice: (invoice: CustomerInvoice) => void;
}) {
  const store = useStore();
  const c = store.customers.find((x) => x.id === customer.id) ?? customer;
  const fb = store.feedback.filter((f) => f.phone === c.phone);
  const tickets = store.complaints.filter((t) => t.phone === c.phone);
  const lastComplaint = tickets[0];
  const orderHistory = useMemo(
    () => store.orders
      .filter((o) => !o.voided && o.customer?.phone === c.phone)
      .sort((a, b) => b.at - a.at),
    [store.orders, c.phone],
  );
  const lastOrder = orderHistory[0];
  const openInvoices = store.customerInvoices.filter(
    (i) => i.customerId === c.id && i.status !== "Paid" && i.status !== "Void",
  );

  const hasWallet = c.wallet > 0;
  const hasCredit = c.credit > 0 || c.creditLimit > 0;

  const [topUpOpen, setTopUpOpen] = useState(false);
  // Two focused entry points instead of one wallet/credit mode switcher.
  const [walletChargeOpen, setWalletChargeOpen] = useState(false);
  const [houseChargeOpen, setHouseChargeOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [statementOpen, setStatementOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const [accountHistoryOpen, setAccountHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {c.name}
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tierClass[c.tier]}`}>
            {c.tier === "VIP" && <Star className="h-3 w-3" />}{c.tier}
          </span>
        </span>
      }
      description={`${c.phone}${c.email ? ` · ${c.email}` : ""}`}
      size="lg"
      headerExtra={canManageAccounts && (
        <button
          type="button"
          onClick={() => setSettingsOpen((o) => !o)}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-surface"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    >
      <div className="space-y-4">
        {/* Last order — answers "what did they have last time?" up front */}
        {lastOrder ? (
          <div className="rounded-2xl border border-border bg-surface/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last order · {timeAgo(lastOrder.at)}</p>
                <p className="mt-1 text-base font-semibold tabular-nums">₦{lastOrder.total.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">
                  {lastOrder.channel}{lastOrder.table && lastOrder.channel === "Dine-in" ? ` · ${lastOrder.table}` : ""} · paid via {lastOrder.method}
                </p>
              </div>
              <button
                onClick={() => setOrderHistoryOpen(true)}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-surface"
              >
                See all {orderHistory.length} orders →
              </button>
            </div>
            <p className="mt-2 text-sm text-foreground/80 line-clamp-1">
              {lastOrder.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">No orders yet — first-time customer.</p>
          </div>
        )}

        {/* ONE balance summary card — plain language, only what matters now */}
        {hasWallet || hasCredit ? (
          <div className="space-y-2">
            {hasWallet && (
              <WalletCard customer={c} canManage={canManageAccounts} onTopUp={() => setTopUpOpen(true)} />
            )}
            {hasCredit && (
              <CreditCard_ customer={c} canManage={canManageAccounts}
                openInvoices={openInvoices.length}
                onRecordPayment={() => setPaymentOpen(true)}
                onGenerate={() => setStatementOpen(true)}
                onSetLimit={() => setLimitOpen(true)}
                onOpenInvoice={(inv) => onOpenInvoice(inv)}
                latestOpenInvoice={openInvoices.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]} />
            )}
          </div>
        ) : canManageAccounts && (
          <div className="rounded-2xl border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">No money on file. Want to set up an account?</p>
            <div className="mt-2 flex justify-center gap-2">
              <button onClick={() => setTopUpOpen(true)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                Take a deposit
              </button>
              <button onClick={() => setLimitOpen(true)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-surface">
                Open a house tab
              </button>
            </div>
          </div>
        )}

        {/* Stats — one line, no boxes */}
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{stats.visits}</span> visit{stats.visits === 1 ? "" : "s"}
          {" · "}
          <span className="font-semibold text-foreground">₦{(stats.ltv / 1000).toFixed(0)}k</span> lifetime
          {stats.favorite !== "—" && <> · loves <span className="font-semibold text-foreground">{stats.favorite}</span></>}
          {stats.lastDays != null && <> · last seen {stats.lastDays === 0 ? "today" : `${stats.lastDays}d ago`}</>}
        </p>

        {/* Notes & flags */}
        {(c.note || c.birthday || lastComplaint) && (
          <div className="rounded-xl bg-surface/60 border border-border p-3 text-xs space-y-1">
            {c.note && <p>📝 {c.note}</p>}
            {c.birthday && <p><Cake className="inline h-3 w-3 mr-1 text-muted-foreground" />Birthday {c.birthday}</p>}
            {lastComplaint && <p className="text-destructive">⚠ Last complaint: {lastComplaint.subject} ({lastComplaint.status})</p>}
          </div>
        )}

        {/* Big buttons — the two histories */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setOrderHistoryOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold hover:bg-surface"
          >
            <Receipt className="h-4 w-4 text-muted-foreground" />Order history
            <span className="rounded-full bg-surface px-1.5 text-[10px] tabular-nums">{orderHistory.length}</span>
          </button>
          {(hasWallet || hasCredit) && (
            <button
              onClick={() => setAccountHistoryOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-semibold hover:bg-surface"
            >
              <Wallet className="h-4 w-4 text-muted-foreground" />Account history
            </button>
          )}
        </div>

        {/* Activity recap — feedback only */}
        {fb.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent feedback</p>
            <ul className="space-y-1">
              {fb.slice(0, 3).map((f) => (
                <li key={f.id} className="text-xs flex justify-between gap-3 border-b border-border last:border-0 py-1.5">
                  <span className="italic text-foreground/80 truncate">&ldquo;{f.comment}&rdquo;</span>
                  <span className={`shrink-0 text-[10px] font-medium ${f.sentiment === "Positive" ? "text-primary" : f.sentiment === "Negative" ? "text-destructive" : "text-muted-foreground"}`}>{f.sentiment}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {topUpOpen && <TopUpModal customer={c} me={me} onClose={() => setTopUpOpen(false)} />}
      {walletChargeOpen && <ChargeWalletModal customer={c} me={me} onClose={() => setWalletChargeOpen(false)} />}
      {houseChargeOpen && <PostHouseChargeModal customer={c} me={me} onClose={() => setHouseChargeOpen(false)} />}
      {paymentOpen && <RecordPaymentModal customer={c} me={me} onClose={() => setPaymentOpen(false)} />}
      {statementOpen && <GenerateStatementModal customer={c} me={me} onClose={() => setStatementOpen(false)} onGenerated={onOpenInvoice} />}
      {limitOpen && <CreditLimitModal customer={c} me={me} onClose={() => setLimitOpen(false)} />}
      {orderHistoryOpen && <OrderHistoryModal customer={c} orders={orderHistory} onClose={() => setOrderHistoryOpen(false)} />}
      {accountHistoryOpen && <AccountHistoryModal customer={c} onClose={() => setAccountHistoryOpen(false)} onOpenInvoice={onOpenInvoice} />}
      {settingsOpen && <AccountSettingsMenu customer={c} canManage={canManageAccounts}
        onChargeWallet={() => { setSettingsOpen(false); setWalletChargeOpen(true); }}
        onPostHouseCharge={() => { setSettingsOpen(false); setHouseChargeOpen(true); }}
        onSetLimit={() => { setSettingsOpen(false); setLimitOpen(true); }}
        onChangeTier={() => setSettingsOpen(false)}
        onClose={() => setSettingsOpen(false)}
      />}
    </Modal>
  );
}

function invoiceStatusClass(s: string): string {
  switch (s) {
    case "Paid":           return "bg-surface text-primary";
    case "Partially Paid": return "bg-sky-100 text-sky-700";
    case "Sent":           return "bg-warning/15 text-foreground";
    case "Overdue":        return "bg-destructive/10 text-destructive";
    case "Draft":          return "bg-muted text-muted-foreground";
    case "Void":           return "bg-muted text-muted-foreground line-through";
    default:               return "bg-muted text-muted-foreground";
  }
}

function LedgerRow({ entry }: { entry: CustomerLedgerEntry }) {
  const isDebit = entry.kind === "wallet-spend" || entry.kind === "credit-charge";
  const Icon =
    entry.kind === "wallet-topup" ? Coins
    : entry.kind === "wallet-spend" ? Wallet
    : entry.kind === "credit-charge" ? CreditCard
    : entry.kind === "credit-payment" ? Coins
    : Receipt;
  const label =
    entry.kind === "wallet-topup" ? "Wallet top-up"
    : entry.kind === "wallet-spend" ? "Wallet spend"
    : entry.kind === "wallet-refund" ? "Wallet refund"
    : entry.kind === "credit-charge" ? "House charge"
    : entry.kind === "credit-payment" ? "Payment received"
    : "Write-off";
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${isDebit ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{label}</p>
        <p className="text-[11px] text-muted-foreground truncate">{entry.note ?? "—"} · {entry.staffName} · {timeAgo(entry.at)}</p>
      </div>
      <span className={`tabular-nums font-semibold ${isDebit ? "text-destructive" : "text-primary"}`}>
        {isDebit ? "−" : "+"}₦{entry.amount.toLocaleString()}
      </span>
    </li>
  );
}

// ── Top-up wallet ────────────────────────────────────────────────────────────

function TopUpModal({ customer, me, onClose }: { customer: Customer; me: string; onClose: () => void }) {
  const store = useStore();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [note, setNote] = useState("");

  function submit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a top-up amount"); return; }
    const res = store.topUpCustomerWallet({ customerId: customer.id, amount: amt, method, note: note.trim() || undefined, by: me });
    if (!res.ok) { toast.error(res.error ?? "Couldn't top up"); return; }
    toast.success(`₦${amt.toLocaleString()} added to ${customer.name}'s wallet`);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Top up wallet" description={`${customer.name} · current balance ₦${customer.wallet.toLocaleString()}`}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Add to wallet</ModalButton></>}>
      <div className="space-y-4">
        <Field label="Amount (₦)"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus className={inputCls} /></Field>
        <Field label="Method">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
            {["Cash", "Card", "Transfer"].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Note (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reference / receipt #" className={inputCls} /></Field>
      </div>
    </Modal>
  );
}

// ── Post charge (manual, simulating a POS sale) ──────────────────────────────

/**
 * Single-task: charge against the customer's prepaid wallet. Used when the POS
 * isn't yet linked to this customer (the manual entry path). No mode switch —
 * the caller decides upfront whether it's a wallet spend or a house charge,
 * and the right modal opens.
 */
function ChargeWalletModal({ customer, me, onClose }: { customer: Customer; me: string; onClose: () => void }) {
  const store = useStore();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    const res = store.spendCustomerWallet({ customerId: customer.id, amount: amt, note: note.trim() || undefined, by: me });
    if (!res.ok) { toast.error(res.error ?? ""); return; }
    toast.success(`₦${amt.toLocaleString()} drawn from ${customer.name}'s wallet`);
    onClose();
  }

  return (
    <Modal open onClose={onClose}
      title="Charge wallet"
      description={`${customer.name} · ₦${customer.wallet.toLocaleString()} on file`}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Charge wallet</ModalButton></>}
    >
      <div className="space-y-4">
        <Field label="Amount (₦)"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus className={inputCls} /></Field>
        <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Dinner · party of 4" className={inputCls} /></Field>
        <p className="text-[11px] text-muted-foreground">
          Wallet balance after this charge: <span className="font-semibold tabular-nums text-foreground">₦{Math.max(0, customer.wallet - (Number(amount) || 0)).toLocaleString()}</span>
        </p>
      </div>
    </Modal>
  );
}

/**
 * Single-task: post a charge to the customer's house account (credit). Blocked
 * when the customer has no credit limit (the gear-icon flow surfaces an
 * "Open a house tab" entry point for that case).
 */
function PostHouseChargeModal({ customer, me, onClose }: { customer: Customer; me: string; onClose: () => void }) {
  const store = useStore();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  function submit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    const res = store.chargeCustomerAccount({ customerId: customer.id, amount: amt, note: note.trim() || undefined, by: me });
    if (!res.ok) { toast.error(res.error ?? ""); return; }
    toast.success(`₦${amt.toLocaleString()} posted to ${customer.name}'s house account`);
    onClose();
  }

  const remainingCredit = customer.creditLimit - customer.credit;

  return (
    <Modal open onClose={onClose}
      title="Post house charge"
      description={`${customer.name} · ₦${remainingCredit.toLocaleString()} of ₦${customer.creditLimit.toLocaleString()} credit available`}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Post charge</ModalButton></>}
    >
      <div className="space-y-4">
        <Field label="Amount (₦)"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus className={inputCls} /></Field>
        <Field label="Note"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Dinner · party of 4" className={inputCls} /></Field>
        <p className="text-[11px] text-muted-foreground">
          They&apos;ll owe ₦{(customer.credit + (Number(amount) || 0)).toLocaleString()} after this — settled on the next statement.
        </p>
      </div>
    </Modal>
  );
}

// ── Record payment against house account ─────────────────────────────────────

function RecordPaymentModal({ customer, me, onClose }: { customer: Customer; me: string; onClose: () => void }) {
  const store = useStore();
  const openInvoices = store.customerInvoices
    .filter((i) => i.customerId === customer.id && i.status !== "Paid" && i.status !== "Void")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const [amount, setAmount] = useState(String(customer.credit));
  const [method, setMethod] = useState("Transfer");
  const [invoiceId, setInvoiceId] = useState<string>(openInvoices[0]?.id ?? "");
  const [note, setNote] = useState("");

  function submit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a payment amount"); return; }
    const res = store.recordCustomerPayment({ customerId: customer.id, amount: amt, method, invoiceId: invoiceId || undefined, note: note.trim() || undefined, by: me });
    if (!res.ok) { toast.error(res.error ?? "Couldn't record payment"); return; }
    toast.success(`₦${amt.toLocaleString()} applied to ${customer.name}'s house account`);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Record payment" description={`${customer.name} · owes ₦${customer.credit.toLocaleString()}`}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Record payment</ModalButton></>}>
      <div className="space-y-4">
        <Field label="Amount (₦)"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Method">
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
              {["Transfer", "Cash", "Card", "Cheque"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Apply to statement">
            <select value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className={inputCls}>
              <option value="">— oldest open —</option>
              {openInvoices.map((i) => (
                <option key={i.id} value={i.id}>{i.id} · ₦{(i.subtotal - i.paid).toLocaleString()}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Reference (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bank ref / cheque #" className={inputCls} /></Field>
        <p className="text-[11px] text-muted-foreground">
          Payment is applied to the chosen statement first; any excess reduces the house-account balance against the oldest open statement.
        </p>
      </div>
    </Modal>
  );
}

// ── Generate statement (sweep unbilled charges in a period) ──────────────────

function GenerateStatementModal({ customer, me, onClose, onGenerated }: { customer: Customer; me: string; onClose: () => void; onGenerated: (inv: CustomerInvoice) => void }) {
  const store = useStore();
  // Default to last calendar month.
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastOfLastMonth = new Date(firstOfThisMonth.getTime() - 86400_000);
  const [periodStart, setPeriodStart] = useState(firstOfLastMonth.toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(lastOfLastMonth.toISOString().slice(0, 10));
  const [terms, setTerms] = useState<"net-7" | "net-14" | "net-30">("net-14");

  // Preview of charges that would be included.
  const billedIds = new Set(
    store.customerInvoices
      .filter((i) => i.customerId === customer.id && i.status !== "Void")
      .flatMap((i) => i.lines.map((l) => l.ledgerId)),
  );
  const startMs = new Date(periodStart).getTime();
  const endMs = new Date(periodEnd).getTime() + 86400_000 - 1;
  const candidates = store.customerLedger.filter((e) =>
    e.customerId === customer.id
    && e.kind === "credit-charge"
    && e.at >= startMs && e.at <= endMs
    && !billedIds.has(e.id),
  );
  const subtotal = candidates.reduce((s, e) => s + e.amount, 0);

  function submit() {
    const days = terms === "net-7" ? 7 : terms === "net-14" ? 14 : 30;
    const dueDate = new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
    const res = store.generateCustomerInvoice({ customerId: customer.id, periodStart, periodEnd, dueDate, by: me });
    if (!res.ok || !res.invoiceId) { toast.error(res.error ?? "Couldn't generate"); return; }
    toast.success(`${res.invoiceId} created · ₦${subtotal.toLocaleString()} due ${dueDate}`);
    const inv = store.customerInvoices.find((i) => i.id === res.invoiceId) ?? {
      id: res.invoiceId, customerId: customer.id, customerName: customer.name, branch: store.currentBranch,
      periodStart, periodEnd, issueDate: new Date().toISOString().slice(0, 10), dueDate, status: "Draft" as const,
      lines: [], subtotal, paid: 0, reminders: [], createdBy: me, createdAt: Date.now(),
    };
    onClose();
    onGenerated(inv);
  }

  return (
    <Modal open onClose={onClose} title="Generate statement" description={`${customer.name} · sweeps unbilled house charges into one PDF-ready invoice`}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Generate</ModalButton></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Period start"><input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className={inputCls} /></Field>
          <Field label="Period end"><input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="Payment terms">
          <div className="flex gap-2">
            {(["net-7", "net-14", "net-30"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTerms(t)}
                className={`flex-1 rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors ${terms === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-surface"}`}
              >
                {t.replace("-", " ")}
              </button>
            ))}
          </div>
        </Field>
        <div className="rounded-xl bg-surface/60 border border-border p-3 text-sm">
          <p className="flex justify-between"><span className="text-muted-foreground">Charges to include</span><span className="tabular-nums font-semibold">{candidates.length}</span></p>
          <p className="flex justify-between mt-1"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums font-bold">₦{subtotal.toLocaleString()}</span></p>
          {candidates.length === 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />No unbilled charges in this period — nothing to sweep.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Credit limit ─────────────────────────────────────────────────────────────

function CreditLimitModal({ customer, me, onClose }: { customer: Customer; me: string; onClose: () => void }) {
  const store = useStore();
  const [limit, setLimit] = useState(String(customer.creditLimit));

  function submit() {
    const n = Math.max(0, Number(limit) || 0);
    if (n < customer.credit) {
      toast.error(`Limit can't be below current owed (₦${customer.credit.toLocaleString()})`);
      return;
    }
    store.setCustomerCreditLimit(customer.id, n, me);
    toast.success(n === 0 ? "House account disabled" : `Credit limit set to ₦${n.toLocaleString()}`);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="House account limit" description={`${customer.name} · ${customer.creditLimit === 0 ? "house charges disabled" : "current limit ₦" + customer.creditLimit.toLocaleString()}`}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Save limit</ModalButton></>}>
      <div className="space-y-3">
        <Field label="Credit limit (₦)"><input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} autoFocus className={inputCls} /></Field>
        <p className="text-[11px] text-muted-foreground">
          Set to <span className="font-mono">0</span> to disable house charges for this customer. The credit limit caps how much can be owed at any time; the cashier sees a block at POS when a new charge would exceed it.
        </p>
      </div>
    </Modal>
  );
}

// ── Invoice viewer + reminders ──────────────────────────────────────────────

function InvoiceModal({ invoice: initial, onClose, me }: { invoice: CustomerInvoice; onClose: () => void; me: string }) {
  const store = useStore();
  // Always read the *current* invoice from state so live status/reminders update.
  const inv = store.customerInvoices.find((i) => i.id === initial.id) ?? initial;
  const printRef = useRef<HTMLDivElement>(null);
  const overdueDays = Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86400_000);

  function sendReminder(kind: ReminderKind) {
    const res = store.sendInvoiceReminder(inv.id, kind, "Email", me);
    if (!res.ok) { toast.error(res.error ?? "Couldn't send reminder"); return; }
    toast.success(`${friendlyReminderLabel(kind)} reminder sent to ${inv.customerName}`);
  }

  function printStatement() {
    // Open the print dialog with just the statement section; browsers handle "Save as PDF".
    const node = printRef.current;
    if (!node) return;
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) { toast.error("Pop-up blocked — allow pop-ups to print"); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${inv.id}</title>
      <style>
        body{font:11pt/1.45 system-ui,-apple-system,Segoe UI,sans-serif;color:#1a1f2e;padding:32px;margin:0;}
        h1{font-size:22pt;margin:0 0 4pt;color:#1f7a4d;}
        .muted{color:#555f73;font-size:10pt;}
        table{border-collapse:collapse;width:100%;margin-top:16pt;font-size:10pt;}
        th,td{border-bottom:1px solid #d8dde7;padding:6pt 4pt;text-align:left;}
        th{background:#f5f7fb;font-weight:600;}
        .right{text-align:right;}
        .total{font-size:14pt;font-weight:700;color:#1a1f2e;}
        .pill{display:inline-block;border:1px solid #d8dde7;border-radius:999px;padding:2pt 8pt;font-size:9pt;color:#555f73;}
      </style></head><body>${node.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  }

  const sentKinds = new Set(inv.reminders.map((r) => r.kind));
  const reminderPresets: { kind: ReminderKind; label: string }[] = [
    { kind: "pre-due",    label: "3 days before due" },
    { kind: "on-due",     label: "On due date" },
    { kind: "overdue-7",  label: "7 days overdue" },
    { kind: "overdue-14", label: "14 days overdue" },
    { kind: "overdue-30", label: "Final notice (30 days)" },
  ];

  return (
    <Modal open onClose={onClose} title={inv.id} description={`${inv.customerName} · ${inv.status}`} size="xl"
      footer={
        <>
          <button onClick={printStatement} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-surface">
            <Printer className="h-3.5 w-3.5" />Print / save PDF
          </button>
          <ModalButton variant="ghost" onClick={onClose}>Close</ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        {inv.status === "Overdue" && overdueDays > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">{overdueDays} days overdue</p>
              <p className="text-muted-foreground">Send a reminder below or record a payment when received.</p>
            </div>
          </div>
        )}

        {/* Printable statement body */}
        <div ref={printRef} className="rounded-xl border border-border bg-card p-5 text-sm">
          <div className="flex items-start justify-between border-b border-border pb-3">
            <div>
              <h1>Statement</h1>
              <p className="muted">{inv.id} · issued {inv.issueDate}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold">NativeID ROS</p>
              <p className="muted">{store.branchName(inv.branch)}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div>
              <p className="muted text-[10px] uppercase tracking-wider">Bill to</p>
              <p className="font-medium">{inv.customerName}</p>
            </div>
            <div className="text-right">
              <p className="muted text-[10px] uppercase tracking-wider">Period</p>
              <p>{inv.periodStart} → {inv.periodEnd}</p>
              <p className="muted">Due {inv.dueDate}</p>
            </div>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Description</th><th className="right">Amount</th></tr></thead>
            <tbody>
              {inv.lines.map((l) => (
                <tr key={l.ledgerId}>
                  <td>{l.date}</td>
                  <td>{l.description}{l.orderId && <span className="muted"> · {l.orderId}</span>}</td>
                  <td className="right tabular-nums">₦{l.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={2} className="right muted">Subtotal</td><td className="right tabular-nums">₦{inv.subtotal.toLocaleString()}</td></tr>
              {inv.paid > 0 && <tr><td colSpan={2} className="right muted">Paid</td><td className="right tabular-nums">−₦{inv.paid.toLocaleString()}</td></tr>}
              <tr><td colSpan={2} className="right total">Balance due</td><td className="right tabular-nums total">₦{(inv.subtotal - inv.paid).toLocaleString()}</td></tr>
            </tfoot>
          </table>
        </div>

        {/* Reminder cadence */}
        {inv.status !== "Paid" && inv.status !== "Void" && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Send reminder</p>
            <div className="flex flex-wrap gap-1.5">
              {reminderPresets.map((p) => {
                const sent = sentKinds.has(p.kind);
                return (
                  <button
                    key={p.kind}
                    onClick={() => sendReminder(p.kind)}
                    className={`inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium ${sent ? "bg-surface text-muted-foreground" : "bg-card hover:bg-surface"}`}
                    title={sent ? "Already sent — click to send again" : "Send this reminder"}
                  >
                    <Send className="h-3 w-3" />{p.label}{sent && <span className="text-primary">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Reminder log */}
        {inv.reminders.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Reminder history</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {inv.reminders.map((r, i) => (
                <li key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span>{friendlyReminderLabel(r.kind)}</span>
                  <span className="text-muted-foreground">{r.channel} · {r.sentBy} · {timeAgo(r.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Add customer ─────────────────────────────────────────────────────────────

function AddCustomerModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");

  function submit() {
    if (!name.trim()) { toast.error("Enter a name"); return; }
    if (!phone.trim()) { toast.error("Phone number is the customer key"); return; }
    if (store.customers.some((c) => c.phone === phone.trim())) { toast.error("A customer with that phone already exists"); return; }
    store.addCustomer({ name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, birthday: birthday || undefined });
    toast.success(`${name.trim()} added`);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="New customer" description="Phone number is the golden-record key"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Add customer</ModalButton></>}>
      <div className="space-y-4">
        <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
        <Field label="Phone number"><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+234 ..." className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email (optional)"><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
          <Field label="Birthday MM-DD"><input value={birthday} onChange={(e) => setBirthday(e.target.value)} placeholder="05-28" className={inputCls} /></Field>
        </div>
      </div>
    </Modal>
  );
}

// ── Log feedback ─────────────────────────────────────────────────────────────

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<OrderChannel>("Dine-in");
  const [food, setFood] = useState(5);
  const [service, setService] = useState(5);
  const [ambience, setAmbience] = useState(5);
  const [comment, setComment] = useState("");

  function submit() {
    if (!name.trim()) { toast.error("Enter the customer's name"); return; }
    store.recordFeedback({ customerName: name.trim(), phone: phone.trim() || undefined, channel, food, service, ambience, comment: comment.trim() });
    const avg = (food + service + ambience) / 3;
    if (avg <= 2) toast.warning("Low rating — a complaint ticket was auto-raised (red flag)");
    else toast.success("Feedback recorded");
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Log customer feedback" description="A low rating auto-flags a complaint"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Save feedback</ModalButton></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Customer name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label="Phone (optional)"><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputCls} /></Field>
        </div>
        <Field label="Channel">
          <select value={channel} onChange={(e) => setChannel(e.target.value as OrderChannel)} className={inputCls}>
            <option>Dine-in</option><option>Takeout</option><option>Delivery</option>
          </select>
        </Field>
        {([["Food", food, setFood], ["Service", service, setService], ["Ambience", ambience, setAmbience]] as const).map(([label, val, set]) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => set(n)} aria-label={`${label} ${n}`}>
                  <Star className={`h-5 w-5 ${n <= val ? "fill-warning text-warning" : "text-border"}`} />
                </button>
              ))}
            </div>
          </div>
        ))}
        <Field label="Comment"><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="What did they say?" className={`${inputCls} resize-y`} /></Field>
      </div>
    </Modal>
  );
}

// ── Log complaint ────────────────────────────────────────────────────────────

function ComplaintModal({ by, onClose }: { by: string; onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [detail, setDetail] = useState("");
  const [severity, setSeverity] = useState<"Low" | "High">("Low");

  function submit() {
    if (!name.trim() || !subject.trim()) { toast.error("Customer and subject are required"); return; }
    store.addComplaint({ customerName: name.trim(), phone: phone.trim() || undefined, subject: subject.trim(), detail: detail.trim(), severity, by });
    toast.success("Complaint ticket opened");
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Log a complaint" description="Opens a tracked ticket"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Open ticket</ModalButton></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Customer name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label="Phone (optional)"><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputCls} /></Field>
        </div>
        <Field label="Subject"><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Cold food" className={inputCls} /></Field>
        <Field label="Detail"><textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} className={`${inputCls} resize-y`} /></Field>
        <Field label="Severity">
          <select value={severity} onChange={(e) => setSeverity(e.target.value as "Low" | "High")} className={inputCls}>
            <option>Low</option><option>High</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

// ── Shared ───────────────────────────────────────────────────────────────────

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface/60 border border-border p-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

// ── Balance cards (used in customer 360) ────────────────────────────────────

function WalletCard({ customer, canManage, onTopUp }: { customer: Customer; canManage: boolean; onTopUp: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5" />Has money on file
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-primary">₦{customer.wallet.toLocaleString()}</p>
        <p className="text-[11px] text-muted-foreground">Customer prepaid — spends draw it down.</p>
      </div>
      {canManage && (
        <button onClick={onTopUp} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Top up
        </button>
      )}
    </div>
  );
}

function CreditCard_({
  customer, canManage, openInvoices, onRecordPayment, onGenerate, onSetLimit, onOpenInvoice, latestOpenInvoice,
}: {
  customer: Customer;
  canManage: boolean;
  openInvoices: number;
  onRecordPayment: () => void;
  onGenerate: () => void;
  onSetLimit: () => void;
  onOpenInvoice: (inv: CustomerInvoice) => void;
  latestOpenInvoice?: CustomerInvoice;
}) {
  const owesMoney = customer.credit > 0;
  // Heuristic-free decision: if they owe money, the primary action is "Record payment".
  // If they have an open statement and owe money, secondary action is to view the
  // statement (one click → one screen → one task). If they owe but no statement
  // exists yet, secondary action is to issue one.
  return (
    <div className={`rounded-2xl border-2 p-4 ${owesMoney && customer.credit > customer.creditLimit * 0.8 ? "border-destructive/30 bg-destructive/5" : owesMoney ? "border-warning/30 bg-warning/5" : "border-border bg-surface/30"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />
            {owesMoney ? "Owes you" : "House tab open"}
          </p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${owesMoney && customer.credit > customer.creditLimit * 0.8 ? "text-destructive" : ""}`}>
            ₦{customer.credit.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            ₦{Math.max(0, customer.creditLimit - customer.credit).toLocaleString()} of ₦{customer.creditLimit.toLocaleString()} limit available
          </p>
        </div>
        {canManage && (
          <div className="flex flex-col items-end gap-1">
            {owesMoney ? (
              <button onClick={onRecordPayment} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                Record payment
              </button>
            ) : (
              <button onClick={onSetLimit} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-surface">
                Change limit
              </button>
            )}
          </div>
        )}
      </div>
      {/* Quiet inline info — one line, not a separate card */}
      {owesMoney && latestOpenInvoice && (
        <button
          onClick={() => onOpenInvoice(latestOpenInvoice)}
          className="mt-3 flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs hover:bg-surface text-left"
        >
          <span className="font-mono">{latestOpenInvoice.id}</span>
          <span className="text-muted-foreground">{openInvoices > 1 ? `+${openInvoices - 1} more · ` : ""}due {latestOpenInvoice.dueDate} →</span>
        </button>
      )}
      {owesMoney && !latestOpenInvoice && canManage && (
        <button
          onClick={onGenerate}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground hover:bg-surface"
        >
          <FileText className="h-3.5 w-3.5" />No statement yet — issue one
        </button>
      )}
    </div>
  );
}

// ── Settings menu (gear popover) ────────────────────────────────────────────

function AccountSettingsMenu({
  customer, canManage, onChargeWallet, onPostHouseCharge, onSetLimit, onChangeTier, onClose,
}: {
  customer: Customer;
  canManage: boolean;
  onChargeWallet: () => void;
  onPostHouseCharge: () => void;
  onSetLimit: () => void;
  onChangeTier: () => void;
  onClose: () => void;
}) {
  const store = useStore();
  const canWallet = customer.wallet > 0;
  const canHouse = customer.creditLimit > 0;
  return (
    <Modal open onClose={onClose} title="Account settings" description={customer.name} size="sm">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground mb-1">Tier</p>
        <div className="flex flex-wrap gap-1.5">
          {(["New", "Regular", "VIP", "Blacklisted"] as CustomerTier[]).map((t) => (
            <button
              key={t}
              onClick={() => { store.updateCustomer({ ...customer, tier: t }); toast.success(`${customer.name} → ${t}`); onChangeTier(); }}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${customer.tier === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-surface"}`}
            >
              {t}
            </button>
          ))}
        </div>
        {canManage && (
          <div className="pt-3 border-t border-border space-y-1">
            <button onClick={onSetLimit} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface">
              <CreditCard className="h-4 w-4 text-muted-foreground" />Set credit limit
              <span className="ml-auto text-xs text-muted-foreground">₦{customer.creditLimit.toLocaleString()}</span>
            </button>
            {/* Two focused manual-charge entries — one per account type. No mode-switch
                inside the modal, you pick from the gear menu. */}
            {canWallet && (
              <button onClick={onChargeWallet} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface">
                <Wallet className="h-4 w-4 text-muted-foreground" />Charge wallet
                <span className="ml-auto text-[10px] text-muted-foreground">₦{customer.wallet.toLocaleString()} on file</span>
              </button>
            )}
            {canHouse && (
              <button onClick={onPostHouseCharge} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-surface">
                <Pencil className="h-4 w-4 text-muted-foreground" />Post house charge
                <span className="ml-auto text-[10px] text-muted-foreground">₦{(customer.creditLimit - customer.credit).toLocaleString()} credit left</span>
              </button>
            )}
            {!canWallet && !canHouse && (
              <p className="px-2 py-2 text-[11px] text-muted-foreground italic">
                No wallet or house account yet — set a credit limit or take a deposit first.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Order history (date-range filtered) ─────────────────────────────────────

function OrderHistoryModal({ customer, orders, onClose }: { customer: Customer; orders: Order[]; onClose: () => void }) {
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const filtered = useMemo(() => orders.filter((o) => inRange(o.at, range)), [orders, range]);
  const total = filtered.reduce((s, o) => s + o.total, 0);

  return (
    <Modal
      open
      onClose={onClose}
      title="Order history"
      description={`${customer.name} · ${filtered.length} order${filtered.length === 1 ? "" : "s"} · ₦${total.toLocaleString()} total`}
      size="lg"
      headerExtra={<DateRangePicker value={range} onChange={setRange} />}
    >
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No orders in this period.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border max-h-[60vh] overflow-y-auto">
          {filtered.map((o) => (
            <li key={o.id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold">{new Date(o.at).toLocaleDateString()}</span>
                    <span className="text-muted-foreground"> · {o.channel}{o.table && o.channel === "Dine-in" ? ` · ${o.table}` : ""}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/70 line-clamp-1">
                    {o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="tabular-nums font-bold">₦{o.total.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{o.method}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

// ── Account history (wallet + credit ledger, date-range filtered) ──────────

function AccountHistoryModal({ customer, onClose, onOpenInvoice }: { customer: Customer; onClose: () => void; onOpenInvoice: (inv: CustomerInvoice) => void }) {
  const store = useStore();
  const [range, setRange] = useState<DateRange>({ start: null, end: null });
  const ledger = useMemo(
    () => store.customerLedger
      .filter((l) => l.customerId === customer.id && inRange(l.at, range))
      .sort((a, b) => b.at - a.at),
    [store.customerLedger, customer.id, range],
  );
  const invoices = store.customerInvoices.filter((i) => i.customerId === customer.id);

  return (
    <Modal
      open
      onClose={onClose}
      title="Account history"
      description={`${customer.name} · ${ledger.length} transaction${ledger.length === 1 ? "" : "s"}`}
      size="lg"
      headerExtra={<DateRangePicker value={range} onChange={setRange} />}
    >
      <div className="space-y-5">
        {invoices.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Statements</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-surface/40">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold">{inv.id}</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${invoiceStatusClass(inv.status)}`}>{inv.status}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{inv.periodStart} → {inv.periodEnd}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="tabular-nums font-semibold">₦{(inv.subtotal - inv.paid).toLocaleString()}</span>
                    <button onClick={() => onOpenInvoice(inv)} className="text-xs font-medium text-primary hover:underline">Open</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Transactions</p>
          {ledger.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No transactions in this period.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border max-h-[50vh] overflow-y-auto">
              {ledger.map((e) => <LedgerRow key={e.id} entry={e} />)}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
