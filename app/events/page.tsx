"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import {
  useStore, type RestaurantEvent, type EventStatus, type EventCost,
} from "@/lib/store";
import { Calendar, Users, MapPin, Plus, CalendarRange } from "lucide-react";

const statusClass: Record<EventStatus, string> = {
  Live: "bg-primary text-primary-foreground",
  Confirmed: "bg-surface text-primary",
  "Deposit pending": "bg-warning/15 text-foreground",
  Completed: "bg-surface/60 text-muted-foreground",
};

const PACKAGES = ["Premium", "Cocktail", "Buffet", "À la carte", "Custom"] as const;

// The label shown on the status-advance button for each non-terminal state.
const nextLabel: Partial<Record<EventStatus, string>> = {
  "Deposit pending": "Mark as Confirmed",
  Confirmed: "Mark as Live",
  Live: "Mark as Completed",
};

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";

export default function Events() {
  const store = useStore();
  const branch = store.currentBranch;

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const events = store.events.filter((e) => e.branch === branch);

  const pipeline = events.reduce((s, e) => s + e.value, 0);
  const avgGuests = events.length
    ? Math.round(events.reduce((s, e) => s + e.guests, 0) / events.length)
    : 0;
  const liveCount = events.filter((e) => e.status === "Live").length;

  return (
    <AppShell title="Events" subtitle="Bookings, packages and BEOs">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Live now", v: String(liveCount) },
          { l: "Bookings", v: String(events.length) },
          { l: "Pipeline value", v: `₦${(pipeline / 1_000_000).toFixed(1)}M` },
          { l: "Avg guest count", v: String(avgGuests) },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{s.v}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
          <h2 className="text-sm font-semibold">Event bookings · {store.branchName(branch)}</h2>
          <button
            onClick={() => setBooking(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />New booking
          </button>
        </header>

        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface text-primary">
              <CalendarRange className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">No events booked for this branch</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Capture a banquet, party or corporate booking to get started.
              </p>
            </div>
            <button
              onClick={() => setBooking(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />Create the first booking
            </button>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {events.map((e) => (
              <article key={e.id} className="rounded-xl border border-border bg-background p-5 flex flex-wrap items-center gap-5">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{e.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                    <span>{e.date}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{e.venue}</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{e.guests} guests</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{e.package}</p>
                  <p className="text-sm font-semibold tabular-nums">₦{e.value.toLocaleString()}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass[e.status]}`}>{e.status}</span>
                <button
                  onClick={() => setViewingId(e.id)}
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-surface"
                >
                  Open BEO
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {viewingId && <BeoModal eventId={viewingId} onClose={() => setViewingId(null)} />}
      {booking && <NewBookingModal onClose={() => setBooking(false)} />}
    </AppShell>
  );
}

// ── BEO modal ────────────────────────────────────────────────────────────────

function BeoModal({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const store = useStore();
  // Read the live event so deposit/balance/status update after store mutations.
  const event = store.events.find((e) => e.id === eventId);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [payment, setPayment] = useState("");

  if (!event) return null;

  const totalCost = event.costs.reduce((s, c) => s + c.amount, 0);
  const profit = event.value - totalCost;
  const margin = event.value > 0 ? Math.round((profit / event.value) * 100) : 0;
  const balanceDue = event.value - event.deposit;
  const perGuest = event.guests > 0 ? Math.round(event.value / event.guests) : 0;
  const advanceLabel = nextLabel[event.status];

  function recordPayment() {
    const amount = Number(payment);
    if (!amount || amount <= 0) { toast.error("Enter a payment amount"); return; }
    if (amount > balanceDue) { toast.error("Amount exceeds the balance due"); return; }
    store.recordEventDeposit(event!.id, amount);
    toast.success(`₦${amount.toLocaleString()} payment recorded`);
    setPayment("");
    setRecordingPayment(false);
  }

  function advance() {
    const label = nextLabel[event!.status];
    store.advanceEventStatus(event!.id);
    toast.success(label ? `Event ${label.replace("Mark as ", "").toLowerCase()}` : "Event status updated");
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`BEO — ${event.name}`}
      description={`${event.date} · ${event.venue} · ${event.package} package`}
      size="lg"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>Close</ModalButton>
          {advanceLabel && (
            <ModalButton variant="ghost" onClick={advance}>{advanceLabel}</ModalButton>
          )}
          <ModalButton onClick={() => window.print()}>Print BEO</ModalButton>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Guests" value={String(event.guests)} />
          <Stat label="Revenue" value={`₦${(event.value / 1_000_000).toFixed(2)}M`} />
          <Stat label="Per guest" value={`₦${perGuest.toLocaleString()}`} />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Cost breakdown</p>
          <table className="w-full text-sm">
            <tbody>
              {event.costs.map((c, i) => (
                <tr key={`${c.label}-${i}`} className="border-b border-border last:border-0">
                  <td className="py-2 text-muted-foreground">{c.label}</td>
                  <td className="py-2 text-right tabular-nums">₦{c.amount.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2">Total cost</td>
                <td className="py-2 text-right tabular-nums">₦{totalCost.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={`rounded-xl border p-4 ${profit >= 0 ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20"}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Event P&amp;L</span>
            <span className={`text-xl font-bold tabular-nums ${profit >= 0 ? "text-primary" : "text-destructive"}`}>
              {profit >= 0 ? "" : "−"}₦{Math.abs(profit).toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Revenue ₦{event.value.toLocaleString()} − costs ₦{totalCost.toLocaleString()} · {margin}% margin
          </p>
        </div>

        <div className="rounded-xl bg-surface/60 border border-border p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Deposit paid</span><span className="tabular-nums">₦{event.deposit.toLocaleString()}</span></div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold">
            <span>Balance due</span>
            <span className={`tabular-nums ${balanceDue > 0 ? "" : "text-primary"}`}>₦{balanceDue.toLocaleString()}</span>
          </div>
          {balanceDue > 0 && (
            recordingPayment ? (
              <div className="flex items-center gap-2 border-t border-border pt-3">
                <input
                  autoFocus
                  type="number"
                  inputMode="numeric"
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                  placeholder="Amount paid"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={recordPayment}
                  className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Save
                </button>
                <button
                  onClick={() => { setRecordingPayment(false); setPayment(""); }}
                  className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-surface"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setRecordingPayment(true)}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-surface"
              >
                Record payment
              </button>
            )
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── New booking modal ────────────────────────────────────────────────────────

interface CostDraft { label: string; amount: string }

function NewBookingModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [guests, setGuests] = useState("");
  const [pkg, setPkg] = useState<string>(PACKAGES[0]);
  const [value, setValue] = useState("");
  const [deposit, setDeposit] = useState("");
  const [costs, setCosts] = useState<CostDraft[]>([{ label: "", amount: "" }]);

  function setCost(i: number, patch: Partial<CostDraft>) {
    setCosts((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function submit() {
    if (!name.trim()) { toast.error("Enter an event name"); return; }
    if (!date.trim()) { toast.error("Enter a schedule label"); return; }
    if (!venue.trim()) { toast.error("Enter a venue"); return; }
    const guestN = Number(guests);
    if (!guestN || guestN <= 0) { toast.error("Enter a guest count"); return; }
    const valueN = Number(value);
    if (!valueN || valueN <= 0) { toast.error("Enter a contract value"); return; }
    const depositN = Number(deposit) || 0;
    if (depositN < 0) { toast.error("Deposit cannot be negative"); return; }
    if (depositN > valueN) { toast.error("Deposit exceeds the contract value"); return; }

    const cleanCosts: EventCost[] = costs
      .filter((c) => c.label.trim() && Number(c.amount) > 0)
      .map((c) => ({ label: c.label.trim(), amount: Number(c.amount) }));
    if (cleanCosts.length === 0) { toast.error("Add at least one cost line"); return; }

    store.addEvent({
      name: name.trim(), date: date.trim(), venue: venue.trim(),
      guests: guestN, package: pkg, value: valueN, deposit: depositN, costs: cleanCosts,
    });
    toast.success(`${name.trim()} booked`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New booking"
      description="Capture an event contract for the current branch"
      size="lg"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={submit}>Create booking</ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Event name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Adeyemi × Okoro Wedding" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Schedule label">
            <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="Sat 24 May · 19:00" className={inputCls} />
          </Field>
          <Field label="Venue">
            <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Garden Hall" className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Guests">
            <input value={guests} onChange={(e) => setGuests(e.target.value)} type="number" inputMode="numeric" className={inputCls} />
          </Field>
          <Field label="Package">
            <select value={pkg} onChange={(e) => setPkg(e.target.value)} className={inputCls}>
              {PACKAGES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contract value (₦)">
            <input value={value} onChange={(e) => setValue(e.target.value)} type="number" inputMode="numeric" className={inputCls} />
          </Field>
          <Field label="Deposit paid (₦)">
            <input value={deposit} onChange={(e) => setDeposit(e.target.value)} type="number" inputMode="numeric" placeholder="0" className={inputCls} />
          </Field>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground">Cost lines (1–4)</span>
            {costs.length < 4 && (
              <button
                type="button"
                onClick={() => setCosts((p) => [...p, { label: "", amount: "" }])}
                className="text-xs font-medium text-primary hover:underline"
              >
                + Add line
              </button>
            )}
          </div>
          <div className="space-y-2">
            {costs.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={c.label}
                  onChange={(e) => setCost(i, { label: e.target.value })}
                  placeholder="Cost label"
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <input
                  value={c.amount}
                  onChange={(e) => setCost(i, { amount: e.target.value })}
                  type="number"
                  inputMode="numeric"
                  placeholder="₦ amount"
                  className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
                {costs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setCosts((p) => p.filter((_, idx) => idx !== i))}
                    aria-label="Remove cost line"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-surface"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Shared ───────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface/60 border border-border p-3 text-center">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
