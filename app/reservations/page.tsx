"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheck, Plus, Users, Check, X, UtensilsCrossed, Phone, Footprints, Globe, ExternalLink,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { useStore, type Reservation, type ReservationSource, type ReservationStatus } from "@/lib/store";

const sourceBadge: Record<ReservationSource, { cls: string; Icon: typeof Phone }> = {
  Online:    { cls: "bg-violet-100 text-violet-700", Icon: Globe },
  Phone:     { cls: "bg-sky-100 text-sky-700",       Icon: Phone },
  "Walk-in": { cls: "bg-surface text-foreground",    Icon: Footprints },
};

const statusBadge: Record<ReservationStatus, string> = {
  Requested:  "bg-warning/15 text-foreground",
  Confirmed:  "bg-sky-100 text-sky-700",
  Seated:     "bg-primary text-primary-foreground",
  Completed:  "bg-surface text-primary",
  "No-show":  "bg-destructive/10 text-destructive",
  Cancelled:  "bg-muted text-muted-foreground",
};

// Bookings still on the floor team's plate today, soonest first.
const ACTIVE: ReservationStatus[] = ["Requested", "Confirmed", "Seated"];

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Reservations() {
  const store = useStore();
  const branch = store.currentBranch;

  const todays = store.reservations
    .filter((r) => r.branch === branch)
    .sort((a, b) => a.at - b.at);
  const active = todays.filter((r) => ACTIVE.includes(r.status));

  const covers = active.reduce((s, r) => s + r.partySize, 0);
  const needsConfirm = todays.filter((r) => r.status === "Requested").length;
  const online = todays.filter((r) => r.source === "Online" && ACTIVE.includes(r.status)).length;

  const [creating, setCreating] = useState(false);

  return (
    <AppShell title="Bookings" subtitle={`${store.branchName(branch)} · reservations across every channel`}>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Covers booked", v: String(covers), hint: `${active.length} live bookings` },
          { l: "Awaiting confirmation", v: String(needsConfirm), tone: needsConfirm > 0 ? "text-warning" : undefined, hint: "new requests" },
          { l: "Online bookings", v: String(online), hint: "from the booking page" },
          { l: "Seated now", v: String(todays.filter((r) => r.status === "Seated").length), hint: "from a booking" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${k.tone ?? ""}`}>{k.v}</p>
            <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Today&apos;s book</h2>
        <div className="flex gap-2">
          <Link
            href="/book"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-surface"
            title="Open the guest-facing booking page (share this link / QR with diners)"
          >
            <ExternalLink className="h-3.5 w-3.5" />Booking page
          </Link>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />New booking
          </button>
        </div>
      </div>

      <section className="space-y-3">
        {active.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No live bookings yet. Share the <span className="font-medium text-foreground">Booking page</span> with guests, or add one with <span className="font-medium text-foreground">New booking</span>.
          </div>
        ) : (
          active.map((r) => <BookingRow key={r.id} res={r} />)
        )}
      </section>

      {/* Closed-out bookings for the day (seated-elsewhere / cancelled / no-show) */}
      {todays.some((r) => !ACTIVE.includes(r.status)) && (
        <section>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Closed out</h2>
          <ul className="space-y-1.5">
            {todays.filter((r) => !ACTIVE.includes(r.status)).map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm opacity-70">
                <span className="tabular-nums text-muted-foreground">{fmtTime(r.at)}</span>
                <span className="font-medium">{r.customerName}</span>
                <span className="text-muted-foreground">· party of {r.partySize}</span>
                <span className={`ml-auto inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[r.status]}`}>{r.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {creating && <NewBookingModal onClose={() => setCreating(false)} />}
    </AppShell>
  );
}

function BookingRow({ res }: { res: Reservation }) {
  const store = useStore();
  const router = useRouter();
  const src = sourceBadge[res.source];
  const SrcIcon = src.Icon;
  const table = res.tableId ? store.tables.find((t) => t.id === res.tableId) : undefined;

  // Tables a host can allocate: free ones, plus the one already held for this booking.
  const assignable = store.tables.filter((t) => t.status === "available" || t.id === res.tableId);

  function seat() {
    const r = store.seatReservation(res.id);
    if (!r.ok) { toast.error(r.error ?? "Couldn't seat"); return; }
    toast.success(`${res.customerName} seated at ${table?.label}`);
    router.push(`/pos?table=${res.tableId}`);
  }

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="text-center">
            <p className="text-lg font-bold tabular-nums leading-none">{fmtTime(res.at)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{res.durationMins}m</p>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">{res.customerName}</p>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${src.cls}`}>
                <SrcIcon className="h-3 w-3" />{res.source}
              </span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadge[res.status]}`}>{res.status}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />party of {res.partySize}</span>
              <span>{res.phone}</span>
              {res.ref && <span className="font-mono">{res.ref}</span>}
              {res.depositAmount ? <span className="text-primary font-medium">₦{res.depositAmount.toLocaleString()} deposit</span> : null}
            </p>
            {res.specialRequests && (
              <p className="mt-1 text-xs text-foreground/80 italic">“{res.specialRequests}”</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {res.status === "Requested" && (
            <button onClick={() => { store.confirmReservation(res.id); toast.success(`${res.customerName} confirmed`); }} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              <Check className="h-3.5 w-3.5" />Confirm
            </button>
          )}

          {res.status !== "Seated" && (
            <select
              value={res.tableId ?? ""}
              onChange={(e) => {
                if (!e.target.value) return;
                const r = store.assignReservationTable(res.id, e.target.value);
                if (!r.ok) toast.error(r.error ?? "Couldn't assign");
                else toast.success("Table assigned");
              }}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
            >
              <option value="">Assign table…</option>
              {assignable.map((t) => (
                <option key={t.id} value={t.id}>{t.label} · {t.seats} seats</option>
              ))}
            </select>
          )}

          {res.status === "Seated" ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2.5 py-1.5 text-xs font-medium text-primary">
              <UtensilsCrossed className="h-3.5 w-3.5" />Seated at {table?.label}
            </span>
          ) : (
            <button
              onClick={seat}
              disabled={!res.tableId}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
              title={res.tableId ? "Seat the guest and open their tab" : "Assign a table first"}
            >
              <UtensilsCrossed className="h-3.5 w-3.5" />Seat &amp; open tab
            </button>
          )}

          {res.status !== "Seated" && (
            <>
              <button onClick={() => { store.markReservationNoShow(res.id); toast(`${res.customerName} marked no-show`); }} className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-surface">No-show</button>
              <button onClick={() => { store.cancelReservation(res.id); toast(`${res.customerName} cancelled`); }} aria-label="Cancel booking" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

// ── New booking (host-taken: phone / walk-in / website) ───────────────────────

function NewBookingModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState("2");
  const [time, setTime] = useState("");
  const [source, setSource] = useState<ReservationSource>("Phone");
  const [requests, setRequests] = useState("");

  function submit() {
    if (!name.trim()) { toast.error("Enter the guest's name"); return; }
    const size = Number(party) || 0;
    if (size <= 0) { toast.error("Party size must be at least 1"); return; }
    // Time is HH:MM today; default to an hour out if left blank.
    let at = Date.now() + 60 * 60 * 1000;
    if (time) {
      const [h, m] = time.split(":").map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      at = d.getTime();
    }
    const created = store.addReservation({
      customerName: name.trim(),
      phone: phone.trim(),
      partySize: size,
      at,
      source,
      specialRequests: requests.trim() || undefined,
    });
    toast.success(`${created.customerName} booked for ${fmtTime(created.at)}`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={<span className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-primary" />New booking</span>}
      description="Take a reservation by phone or walk-in (online bookings arrive via the booking page)"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Add booking</ModalButton></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Guest name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Tola Bankole" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234…" className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Party size</span>
            <input type="number" min={1} value={party} onChange={(e) => setParty(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Time (today)</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Channel</span>
            <select value={source} onChange={(e) => setSource(e.target.value as ReservationSource)} className={inputCls}>
              <option value="Phone">Phone</option>
              <option value="Walk-in">Walk-in</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Special requests (optional)</span>
          <input value={requests} onChange={(e) => setRequests(e.target.value)} placeholder="e.g. high chair, window seat" className={inputCls} />
        </label>
      </div>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
