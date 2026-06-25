"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Users, Clock, Check, MapPin } from "lucide-react";
import { useStore, type Reservation } from "@/lib/store";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Public, no-login booking page — our own way to collect reservations online.
 * A guest picks a branch, time and party size; the request lands in the staff
 * Bookings inbox as an "Online" reservation awaiting confirmation. Share this
 * page's link / a QR code on the website, Instagram bio, Google profile, etc.
 */
export default function BookPage() {
  const store = useStore();
  const branches = store.branches.filter((b) => b.kind === "branch");

  const [branch, setBranch] = useState(branches[0]?.id ?? "");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("19:00");
  const [party, setParty] = useState("2");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [requests, setRequests] = useState("");
  const [confirmed, setConfirmed] = useState<Reservation | null>(null);

  function submit() {
    if (!branch) { toast.error("Pick a location"); return; }
    if (!name.trim()) { toast.error("Enter your name"); return; }
    if (!phone.trim()) { toast.error("Enter a phone number so we can confirm"); return; }
    const size = Number(party) || 0;
    if (size <= 0) { toast.error("How many guests?"); return; }
    const at = new Date(`${date}T${time || "19:00"}`).getTime();
    if (Number.isNaN(at)) { toast.error("Pick a valid date and time"); return; }

    const res = store.submitBooking({
      branch,
      customerName: name.trim(),
      phone: phone.trim(),
      partySize: size,
      at,
      specialRequests: requests.trim() || undefined,
    });
    setConfirmed(res);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground text-xl font-bold">N</span>
          <h1 className="mt-3 text-xl font-bold tracking-tight">Reserve a table</h1>
          <p className="text-sm text-muted-foreground">NativeID · book in a few taps</p>
        </div>

        {confirmed ? (
          <ConfirmationCard
            res={confirmed}
            branchName={store.branchName(confirmed.branch)}
            onAgain={() => { setConfirmed(null); setName(""); setPhone(""); setRequests(""); }}
          />
        ) : (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Location</span>
              <select value={branch} onChange={(e) => setBranch(e.target.value)} className={inputCls}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><CalendarCheck className="h-3 w-3" />Date</span>
                <input type="date" min={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Time</span>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Guests</span>
              <select value={party} onChange={(e) => setParty(e.target.value)} className={inputCls}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n} {n === 1 ? "guest" : "guests"}</option>
                ))}
              </select>
            </label>

            <div className="h-px bg-border" />

            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Your name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+234…" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Special requests (optional)</span>
              <input value={requests} onChange={(e) => setRequests(e.target.value)} placeholder="Window seat, birthday, dietary needs…" className={inputCls} />
            </label>

            <button
              onClick={submit}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Request booking
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              We&apos;ll text you to confirm. No payment needed to request.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmationCard({ res, branchName, onAgain }: { res: Reservation; branchName: string; onAgain: () => void }) {
  const when = new Date(res.at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="rounded-3xl border-2 border-primary/30 bg-primary/5 p-6 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-6 w-6" />
      </span>
      <h2 className="mt-3 text-lg font-bold">Request received</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Thanks {res.customerName.split(" ")[0]} — the team will confirm by text shortly.
      </p>

      <dl className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm text-left space-y-2">
        <Row label="Confirmation" value={<span className="font-mono font-semibold">{res.ref}</span>} />
        <Row label="Location" value={branchName} />
        <Row label="When" value={when} />
        <Row label="Party" value={`${res.partySize} ${res.partySize === 1 ? "guest" : "guests"}`} />
        {res.specialRequests && <Row label="Requests" value={res.specialRequests} />}
      </dl>

      <button onClick={onAgain} className="mt-4 text-sm font-semibold text-primary hover:underline">
        Make another booking
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
