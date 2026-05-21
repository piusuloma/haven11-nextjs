"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { useAuth } from "@/lib/auth";
import {
  useStore, type Customer, type CustomerTier,
  type ComplaintStatus, type Order, type OrderChannel,
} from "@/lib/store";
import { Star, Plus, Search, Gift, MessageSquareWarning, Smile, Cake } from "lucide-react";

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

  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [loggingFeedback, setLoggingFeedback] = useState(false);
  const [loggingComplaint, setLoggingComplaint] = useState(false);

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

  return (
    <AppShell title="Customers" subtitle="Golden-record CRM · loyalty, feedback & complaints">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Customers", v: String(store.customers.length) },
          { l: "VIPs", v: String(store.customers.filter((c) => c.tier === "VIP").length) },
          { l: "Open complaints", v: String(openComplaints.length), tone: openComplaints.length > 0 ? "text-destructive" : undefined },
          { l: "Branch mood", v: mood ? `${mood.toFixed(1)}★` : "—", tone: mood ? moodTone : undefined },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</p>
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
              <th className="font-medium px-5 py-2.5 text-right">Last seen</th>
              <th className="font-medium px-5 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No customers found.</td></tr>
            ) : customers.map((c) => {
              const st = stats(c);
              return (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{c.phone}</td>
                  <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tierClass[c.tier]}`}>{c.tier === "VIP" && <Star className="h-3 w-3" />}{c.tier}</span></td>
                  <td className="px-5 py-3 text-right tabular-nums">{st.visits}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">₦{st.ltv.toLocaleString()}</td>
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

      {/* Complaints + feedback */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
      </section>

      {/* Marketing & retention */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Gift className="h-4 w-4 text-muted-foreground" />Marketing &amp; retention</h2>
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

      {viewing && <CustomerModal customer={viewing} onClose={() => setViewing(null)} stats={stats(viewing)} />}
      {addingCustomer && <AddCustomerModal onClose={() => setAddingCustomer(false)} />}
      {loggingFeedback && <FeedbackModal onClose={() => setLoggingFeedback(false)} />}
      {loggingComplaint && <ComplaintModal by={user?.name ?? "Manager"} onClose={() => setLoggingComplaint(false)} />}
    </AppShell>
  );
}

// ── Customer 360 ─────────────────────────────────────────────────────────────

function CustomerModal({
  customer, stats, onClose,
}: {
  customer: Customer;
  stats: { visits: number; ltv: number; favorite: string; lastDays: number | null };
  onClose: () => void;
}) {
  const store = useStore();
  const c = store.customers.find((x) => x.id === customer.id) ?? customer;
  const fb = store.feedback.filter((f) => f.phone === c.phone);
  const tickets = store.complaints.filter((t) => t.phone === c.phone);
  const lastComplaint = tickets[0];

  return (
    <Modal open onClose={onClose} title={c.name} description={`${c.phone}${c.email ? ` · ${c.email}` : ""}`} size="lg">
      <div className="space-y-5">
        {/* Tier control */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">Tier</p>
          <div className="flex flex-wrap gap-2">
            {(["New", "Regular", "VIP", "Blacklisted"] as CustomerTier[]).map((t) => (
              <button
                key={t}
                onClick={() => { store.updateCustomer({ ...c, tier: t }); toast.success(`${c.name} → ${t}`); }}
                className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors ${c.tier === t ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-surface"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Box label="Visits" value={String(stats.visits)} />
          <Box label="Lifetime value" value={`₦${(stats.ltv / 1000).toFixed(0)}k`} />
          <Box label="Avg spend" value={`₦${stats.visits ? Math.round(stats.ltv / stats.visits).toLocaleString() : 0}`} />
          <Box label="Last seen" value={stats.lastDays == null ? "—" : `${stats.lastDays}d ago`} />
        </div>

        <div className="rounded-xl bg-surface/60 border border-border p-3 text-sm space-y-1">
          <p><span className="text-muted-foreground">Favourite:</span> <span className="font-medium">{stats.favorite}</span></p>
          {c.birthday && <p><span className="text-muted-foreground">Birthday:</span> <span className="font-medium">{c.birthday}</span></p>}
          {c.lastContactedAt != null && <p><span className="text-muted-foreground">Last contact:</span> <span className="font-medium">{c.lastContactKind ?? "Outreach"} · {timeAgo(c.lastContactedAt)}</span></p>}
          {c.note && <p><span className="text-muted-foreground">Note:</span> <span className="font-medium">{c.note}</span></p>}
          {lastComplaint && <p className="text-destructive">⚠ Last complaint: {lastComplaint.subject} ({lastComplaint.status})</p>}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Feedback history</p>
          {fb.length === 0 ? (
            <p className="text-sm text-muted-foreground">No feedback on record.</p>
          ) : (
            <ul className="space-y-1.5">
              {fb.map((f) => (
                <li key={f.id} className="text-sm flex justify-between border-b border-border last:border-0 py-1.5">
                  <span className="italic text-foreground/80">&ldquo;{f.comment}&rdquo;</span>
                  <span className={`shrink-0 ml-2 text-xs font-medium ${f.sentiment === "Positive" ? "text-primary" : f.sentiment === "Negative" ? "text-destructive" : "text-muted-foreground"}`}>{f.sentiment}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
