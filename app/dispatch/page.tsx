"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { DateRangePicker, inRange, type DateRange } from "@/components/DateRangePicker";
import { useAuth } from "@/lib/auth";
import { useStore, type DeliveryJob, type DeliveryStatus, type Rider, type RiderType, type FleetTxn } from "@/lib/store";
import { Bike, MapPin, Phone, Plus, Banknote, Wrench, Truck, CheckCircle2, Fuel, ShieldAlert, TrendingUp, TrendingDown } from "lucide-react";

const statusClass: Record<DeliveryStatus, string> = {
  Preparing:         "bg-warning/15 text-foreground",
  "Ready for pickup":"bg-sky-100 text-sky-700",
  "Out for delivery":"bg-primary/10 text-primary",
  Delivered:         "bg-surface text-primary",
};

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

/** Money a rider has collected on COD and not yet remitted. */
function codHeldBy(riderId: string, deliveries: DeliveryJob[]): number {
  return deliveries
    .filter((d) => d.riderId === riderId && d.cod && d.status === "Delivered" && !d.codSettled)
    .reduce((s, d) => s + d.codAmount, 0);
}

export default function Dispatch() {
  const store = useStore();
  const { user } = useAuth();
  const [assigning, setAssigning] = useState<DeliveryJob | null>(null);
  const [expensing, setExpensing] = useState<Rider | null>(null);
  // Two focused entry points instead of one mode-switching modal.
  const [hiringInternal, setHiringInternal] = useState(false);
  const [adding3PL, setAdding3PL] = useState(false);
  const [viewing, setViewing] = useState<Rider | null>(null);
  // Fleet management — owner / manager / storekeeper. Cashiers and waiters
  // can assign + complete deliveries (their job) but cannot hire riders,
  // log fleet expenses, or settle COD with the rider.
  const canManageFleet = user?.role === "owner" || user?.role === "manager" || user?.role === "storekeeper";

  const branch = store.currentBranch;
  const jobs = store.deliveries.filter((d) => d.branch === branch);
  const riders = store.riders.filter((r) => r.branch === branch);
  const active = jobs.filter((d) => d.status !== "Delivered");
  const delivered = jobs.filter((d) => d.status === "Delivered");
  const codOutstanding = riders.reduce((s, r) => s + codHeldBy(r.id, jobs), 0);
  const riderName = (id?: string) => riders.find((r) => r.id === id)?.name ?? "—";

  return (
    <AppShell title="Dispatch & Fleet" subtitle={`${store.branchName(branch)} · delivery hand-off, COD & fleet`}>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "To dispatch", v: String(active.filter((d) => d.status !== "Out for delivery").length) },
          { l: "Out for delivery", v: String(active.filter((d) => d.status === "Out for delivery").length) },
          { l: "COD outstanding", v: `₦${codOutstanding.toLocaleString()}`, tone: codOutstanding > 0 ? "text-destructive" : "text-primary" },
          { l: "Delivered", v: String(delivered.length) },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</p>
          </div>
        ))}
      </section>

      {/* ── Active deliveries — the thing the operator scans for ───────────── */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Active deliveries</h2>
        {active.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No deliveries on the board. They appear here when a delivery order is rung up at the POS.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map((d) => (
              <article key={d.id} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2.5">
                {/* Header row — customer + status badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{d.customer}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{d.orderId}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${statusClass[d.status]}`}>{d.status}</span>
                </div>

                {/* Address — the primary content of the card */}
                <p className="flex items-start gap-1.5 text-xs leading-snug">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                  <span>{d.address}</span>
                </p>

                {/* Muted footer with everything else — phone, COD, fee, age, rider */}
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <p className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{d.phone}</span>
                    <span>{timeAgo(d.createdAt)}</span>
                  </p>
                  <p className="flex items-center justify-between gap-2">
                    <span className={d.cod ? "font-semibold text-warning" : ""}>{d.cod ? `COD ₦${d.codAmount.toLocaleString()}` : "Prepaid"}</span>
                    <span>Fee ₦{d.fee.toLocaleString()}</span>
                  </p>
                  {d.riderId && (
                    <p className="font-medium text-foreground">Rider: {riderName(d.riderId)}</p>
                  )}
                </div>

                {/* Primary action — the one button this card needs */}
                <div className="mt-auto pt-1">
                  {d.status === "Preparing" && (
                    <button onClick={() => { store.advanceDelivery(d.id); toast.success(`${d.id} ready for pickup`); }} className="w-full rounded-xl border border-border bg-card py-2 text-xs font-semibold hover:bg-surface">
                      Mark ready for pickup
                    </button>
                  )}
                  {d.status === "Ready for pickup" && (
                    <button onClick={() => setAssigning(d)} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                      <Bike className="h-3.5 w-3.5" />Hand to a rider
                    </button>
                  )}
                  {d.status === "Out for delivery" && (
                    <button onClick={() => { store.completeDelivery(d.id); toast.success(`${d.id} delivered`); }} className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                      <CheckCircle2 className="h-3.5 w-3.5" />Mark delivered
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* ── Riders — compact availability strip; details live in the modal ──── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h2 className="text-sm font-semibold">Riders</h2>
            <p className="text-[11px] text-muted-foreground">
              {riders.filter((r) => r.status === "Available").length} available · {riders.filter((r) => r.status === "On delivery").length} on delivery · {riders.filter((r) => r.status === "Off").length} off
              {codOutstanding > 0 && <span className="text-destructive font-medium"> · ₦{codOutstanding.toLocaleString()} COD held</span>}
            </p>
          </div>
          {canManageFleet && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHiringInternal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                title="Hire a rider on an internal bike (full record + bike P&L)"
              >
                <Bike className="h-3.5 w-3.5" />Hire rider
              </button>
              <button
                onClick={() => setAdding3PL(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-surface"
                title="Add a 3PL partner like Chowdeck or Glovo (contact-only)"
              >
                <Truck className="h-3.5 w-3.5" />3PL partner
              </button>
            </div>
          )}
        </div>

        {/* Compact rider rows — name + status dot + plate/phone + actions. P&L lives in the modal. */}
        <ul className="rounded-2xl border border-border bg-card divide-y divide-border">
          {riders.map((r) => {
            const held = codHeldBy(r.id, jobs);
            const todayCount = delivered.filter((d) => d.riderId === r.id).length;
            const isBike = r.type === "Internal bike";
            const dotCls = r.status === "Available" ? "bg-primary" : r.status === "On delivery" ? "bg-sky-500" : "bg-muted-foreground/40";
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-primary">
                  {isBike ? <Bike className="h-4.5 w-4.5" /> : <Truck className="h-4.5 w-4.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate flex items-center gap-2">
                    {r.name}
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotCls}`} aria-hidden />
                    <span className="text-[11px] font-normal text-muted-foreground">{r.status}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {isBike ? (
                      <>
                        <span className="font-mono">{r.bikePlate ?? "no plate"}</span>
                        {r.bikeMake && ` · ${r.bikeMake}`}
                      </>
                    ) : (
                      <span>{r.type} · {r.phone}</span>
                    )}
                    {todayCount > 0 && <span> · {todayCount} delivered</span>}
                  </p>
                </div>

                {/* COD-held compact warning */}
                {held > 0 && (
                  <div className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 shrink-0">
                    <span className="text-[11px] font-semibold text-destructive">₦{held.toLocaleString()} COD</span>
                    {canManageFleet && (
                      <button
                        onClick={() => { store.settleCOD(r.id); toast.success(`COD settled — ₦${held.toLocaleString()} from ${r.name}`); }}
                        className="rounded bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground hover:bg-destructive/90"
                      >
                        Settle
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5 shrink-0">
                  {r.status === "Available" && (
                    <button
                      onClick={() => { store.setRiderStatus(r.id, "Off"); toast.success(`${r.name} clocked out`); }}
                      className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-surface"
                    >
                      Clock out
                    </button>
                  )}
                  {r.status === "Off" && (
                    <button
                      onClick={() => { store.setRiderStatus(r.id, "Available"); toast.success(`${r.name} clocked in`); }}
                      className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium hover:bg-surface"
                    >
                      Clock in
                    </button>
                  )}
                  <button
                    onClick={() => setViewing(r)}
                    className="rounded-lg bg-foreground px-2.5 py-1 text-[11px] font-semibold text-background hover:bg-foreground/85"
                    title="Open the full rider file — bike P&L, delivery KPIs, ledger"
                  >
                    Open
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {assigning && <AssignModal job={assigning} riders={riders} onClose={() => setAssigning(null)} />}
      {expensing && <ExpenseModal rider={expensing} onClose={() => setExpensing(null)} />}
      {hiringInternal && <HireInternalRiderModal onClose={() => setHiringInternal(false)} />}
      {adding3PL && <Add3PLPartnerModal onClose={() => setAdding3PL(false)} />}
      {viewing && <RiderModal rider={viewing} canManageFleet={canManageFleet} onLogExpense={() => { setViewing(null); setExpensing(viewing); }} onClose={() => setViewing(null)} />}
    </AppShell>
  );
}

// ── Assign rider ─────────────────────────────────────────────────────────────

function AssignModal({ job, riders, onClose }: { job: DeliveryJob; riders: Rider[]; onClose: () => void }) {
  const store = useStore();
  const [riderId, setRiderId] = useState(riders.find((r) => r.status === "Available")?.id ?? riders[0]?.id ?? "");

  function assign() {
    if (!riderId) { toast.error("Pick a rider"); return; }
    store.assignDelivery(job.id, riderId);
    toast.success(`${job.id} handed to ${riders.find((r) => r.id === riderId)?.name}`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Hand off ${job.id}`}
      description={`${job.customer} · ${job.address}`}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={assign}>Assign &amp; dispatch</ModalButton></>}
    >
      <div className="space-y-3">
        {job.cod && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs font-medium flex items-center gap-2">
            <Banknote className="h-4 w-4 text-warning shrink-0" />
            Cash-on-delivery — the rider must collect ₦{job.codAmount.toLocaleString()} from the customer.
          </div>
        )}
        <p className="text-xs font-medium text-muted-foreground">Choose a rider or partner</p>
        <div className="space-y-2">
          {riders.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRiderId(r.id)}
              className={`flex w-full items-center justify-between rounded-xl border-2 p-3 text-left transition-colors ${riderId === r.id ? "border-primary bg-primary/5" : "border-border hover:bg-surface"}`}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {r.type === "Internal bike" ? <Bike className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                {r.name}
              </span>
              <span className={`text-xs ${r.status === "Available" ? "text-primary" : "text-muted-foreground"}`}>{r.status}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// ── Log fleet expense ────────────────────────────────────────────────────────

function ExpenseModal({ rider, onClose }: { rider: Rider; onClose: () => void }) {
  const store = useStore();
  const [amount, setAmount] = useState("");
  // Map UI labels to canonical FleetTxn kinds.
  const KINDS = [
    { label: "Fuel",            kind: "fuel" as const },
    { label: "Maintenance",     kind: "maintenance" as const },
    { label: "Repair",          kind: "maintenance" as const },
    { label: "Fine / ticket",   kind: "fine" as const },
    { label: "Other expense",   kind: "expense" as const },
  ];
  const [pick, setPick] = useState(KINDS[0]);
  const [note, setNote] = useState("");

  function save() {
    const amt = Number(amount) || 0;
    if (amt <= 0) { toast.error("Enter an amount"); return; }
    store.logFleetTxn({ riderId: rider.id, kind: pick.kind, amount: amt, note: note.trim() || pick.label, by: "You" });
    toast.success(`₦${amt.toLocaleString()} ${pick.label.toLowerCase()} logged against ${rider.name}`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Log expense — ${rider.name}`}
      description={`${rider.bikePlate ?? "Bike"} · cuts into the bike's net profit`}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={save}>Log expense</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <select
            value={pick.label}
            onChange={(e) => setPick(KINDS.find((k) => k.label === e.target.value) ?? KINDS[0])}
            className={inputCls}
          >
            {KINDS.map((k) => <option key={k.label}>{k.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Amount ₦</span>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Note (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Oil change at Total" className={inputCls} />
        </label>
      </div>
    </Modal>
  );
}

// ── Add rider — two focused, single-purpose flows ─────────────────────────────

/**
 * Hire an internal bike rider — full record: identity, next of kin (for road
 * incidents), licence, and the bike (plate / make / acquisition cost) which
 * seeds the bike P&L ledger. No mode switch.
 */
function HireInternalRiderModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [licence, setLicence] = useState("");
  const [nok, setNok] = useState("");
  const [nokPhone, setNokPhone] = useState("");
  const [hireDate, setHireDate] = useState(new Date().toISOString().slice(0, 10));
  const [bikeMake, setBikeMake] = useState("");
  const [bikePlate, setBikePlate] = useState("");
  const [bikeCost, setBikeCost] = useState("");

  function save() {
    if (!name.trim()) { toast.error("Enter the rider's name"); return; }
    if (!phone.trim()) { toast.error("Enter the rider's phone number"); return; }
    if (!bikePlate.trim()) { toast.error("Enter the bike's plate number"); return; }
    store.addRider({
      name: name.trim(), type: "Internal bike", phone: phone.trim(),
      nextOfKin: nok.trim() || undefined,
      nextOfKinPhone: nokPhone.trim() || undefined,
      riderLicence: licence.trim() || undefined,
      hireDate,
      bikeMake: bikeMake.trim() || undefined,
      bikePlate: bikePlate.trim() || undefined,
      bikeAcquisitionCost: Number(bikeCost) || undefined,
    });
    toast.success(`${name.trim()} hired · bike ${bikePlate.trim()} on the books`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Hire an internal rider"
      description="Captures their identity, bike, and next-of-kin. Acquisition cost seeds the bike P&L."
      size="lg"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={save}>Hire rider</ModalButton></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Yusuf Lawal" autoFocus className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 ..." inputMode="tel" className={inputCls} />
          </label>
        </div>

        <div className="border-t border-border pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Bike</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Plate number</span>
              <input value={bikePlate} onChange={(e) => setBikePlate(e.target.value.toUpperCase())} placeholder="LAG-123-XY" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Make / model</span>
              <input value={bikeMake} onChange={(e) => setBikeMake(e.target.value)} placeholder="Bajaj Boxer 150" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Acquisition cost ₦</span>
              <input type="number" value={bikeCost} onChange={(e) => setBikeCost(e.target.value)} placeholder="0" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Rider's licence</span>
              <input value={licence} onChange={(e) => setLicence(e.target.value)} placeholder="LAG-DL-…" className={inputCls} />
            </label>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Acquisition cost seeds the bike's P&amp;L — every delivery fee credits, every fuel / repair entry debits.
          </p>
        </div>

        <div className="border-t border-border pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Next of kin</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Name</span>
              <input value={nok} onChange={(e) => setNok(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Phone</span>
              <input value={nokPhone} onChange={(e) => setNokPhone(e.target.value)} placeholder="+234 ..." inputMode="tel" className={inputCls} />
            </label>
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Hire date</span>
          <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className={inputCls} />
        </label>
      </div>
    </Modal>
  );
}

/**
 * Add a 3PL delivery partner (Chowdeck, Glovo, etc.) — contact-only record,
 * no bike, no next of kin, no licence. Minimal form, one task.
 */
function Add3PLPartnerModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  function save() {
    if (!name.trim()) { toast.error("Enter the partner's name"); return; }
    if (!phone.trim()) { toast.error("Enter a contact phone"); return; }
    store.addRider({ name: name.trim(), type: "3PL partner", phone: phone.trim() });
    toast.success(`${name.trim()} added as 3PL partner`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add 3PL partner"
      description="A third-party delivery service like Chowdeck or Glovo — we just track who handled the order."
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={save}>Add partner</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Partner name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chowdeck" autoFocus className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Contact phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234 ..." inputMode="tel" className={inputCls} />
        </label>
      </div>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";

// ── Rider 360 modal ─────────────────────────────────────────────────────────

/**
 * Full rider file: identity + bike + P&L + performance. The P&L treats the
 * bike like an asset — acquisition cost on day one, every fuel / repair as an
 * outflow, every completed delivery's fee as an inflow. Performance metrics
 * (delivery count, on-time rate, avg duration) are computed from the delivery
 * job timeline.
 */
function RiderModal({ rider, canManageFleet, onLogExpense, onClose }: { rider: Rider; canManageFleet: boolean; onLogExpense: () => void; onClose: () => void }) {
  const store = useStore();
  const r = store.riders.find((x) => x.id === rider.id) ?? rider;
  const isBike = r.type === "Internal bike";

  // Default window for the P&L view: last 30 days (matches the staff perf default).
  const [range, setRange] = useState<DateRange>({
    start: new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });
  // Acquisition costs are always counted (lifetime), regardless of date range —
  // a 2024 bike purchase is still a real cost on today's P&L.
  const ledger = useMemo(
    () => store.fleetLedger.filter((t) => t.riderId === r.id),
    [store.fleetLedger, r.id],
  );
  const inWindow = useMemo(
    () => ledger.filter((t) => t.kind === "purchase" || inRange(t.at, range)),
    [ledger, range],
  );

  const inflow = inWindow.filter((t) => t.kind === "delivery-fee" || t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const outflow = inWindow.filter((t) => t.kind === "purchase" || t.kind === "fuel" || t.kind === "maintenance" || t.kind === "fine" || t.kind === "expense").reduce((s, t) => s + t.amount, 0);
  const net = inflow - outflow;

  // Performance — derived from deliveries assigned to this rider in the window.
  const deliveriesAll = store.deliveries.filter((d) => d.riderId === r.id);
  const deliveriesInWindow = deliveriesAll.filter((d) => inRange(d.createdAt, { start: range.start, end: range.end }));
  const delivered = deliveriesInWindow.filter((d) => d.status === "Delivered");
  // Average minutes from assignment to delivered.
  const avgMinutes = delivered.length
    ? Math.round(delivered.reduce((s, d) => s + (((d.deliveredAt ?? 0) - (d.assignedAt ?? d.createdAt)) / 60_000), 0) / delivered.length)
    : 0;
  // "On time" — heuristic: any delivery completed within 45 minutes of assignment.
  const onTime = delivered.filter((d) => ((d.deliveredAt ?? 0) - (d.assignedAt ?? d.createdAt)) <= 45 * 60_000).length;
  const onTimeRate = delivered.length ? Math.round((onTime / delivered.length) * 100) : 0;

  // Most recent ledger entries (lifetime, newest first) for the activity log.
  const recent = ledger.slice().sort((a, b) => b.at - a.at).slice(0, 12);

  return (
    <Modal
      open
      onClose={onClose}
      title={r.name}
      description={`${r.type}${r.bikePlate ? ` · ${r.bikePlate}` : ""}${r.bikeMake ? ` · ${r.bikeMake}` : ""}`}
      size="xl"
      headerExtra={isBike && <DateRangePicker value={range} onChange={setRange} />}
    >
      <div className="space-y-5">
        {/* Identity card */}
        <div className="rounded-2xl border border-border bg-surface/40 p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Field label="Phone" value={r.phone} />
          <Field label="Hire date" value={r.hireDate ?? "—"} />
          {isBike && (
            <>
              <Field label="Bike plate" value={r.bikePlate ?? "—"} mono />
              <Field label="Make / model" value={r.bikeMake ?? "—"} />
              <Field label="Rider's licence" value={r.riderLicence ?? "—"} mono />
              <Field label="Next of kin" value={r.nextOfKin ? `${r.nextOfKin}${r.nextOfKinPhone ? ` · ${r.nextOfKinPhone}` : ""}` : "—"} />
            </>
          )}
        </div>

        {/* P&L — internal bikes only (3PL partners don't have a bike to track) */}
        {isBike && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PnLCard icon={TrendingUp} label="Money in" amount={inflow} tone="primary" hint={`${inWindow.filter((t) => t.kind === "delivery-fee").length} delivery fees`} />
            <PnLCard icon={TrendingDown} label="Money out" amount={outflow} tone="warning" hint="Bike + fuel + repairs" />
            <PnLCard icon={net >= 0 ? TrendingUp : TrendingDown} label="Profit" amount={net} tone={net >= 0 ? "primary" : "destructive"} hint={range.start ? `${range.start} → ${range.end}` : "All time"} primary />
          </div>
        )}

        {/* Performance — delivery KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label="Deliveries" value={String(delivered.length)} hint={deliveriesInWindow.length > delivered.length ? `${deliveriesInWindow.length - delivered.length} in progress` : "in window"} />
          <StatTile label="On-time rate" value={delivered.length ? `${onTimeRate}%` : "—"} tone={onTimeRate < 80 && delivered.length > 0 ? "warning" : "primary"} />
          <StatTile label="Avg duration" value={delivered.length ? `${avgMinutes}m` : "—"} />
          <StatTile label="Status" value={r.status} tone={r.status === "Off" ? "muted" : "primary"} />
        </div>

        {/* Bike P&L actions — only managers / owners / storekeepers log fleet money */}
        {isBike && canManageFleet && (
          <div className="flex flex-wrap gap-2">
            <button onClick={onLogExpense} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              <Wrench className="h-3.5 w-3.5" />Log fuel / repair
            </button>
          </div>
        )}

        {/* Recent fleet-ledger entries */}
        {isBike && ledger.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Bike ledger — latest activity</p>
            <ul className="divide-y divide-border rounded-xl border border-border max-h-64 overflow-y-auto">
              {recent.map((t) => <FleetLedgerRow key={t.id} txn={t} />)}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PnLCard({ icon: Icon, label, amount, tone, hint, primary }: { icon: React.ComponentType<{ className?: string }>; label: string; amount: number; tone: "primary" | "warning" | "destructive"; hint?: string; primary?: boolean }) {
  const toneCls =
    tone === "primary" ? "text-primary border-primary/30 bg-primary/5"
    : tone === "warning" ? "text-warning border-warning/30 bg-warning/10"
    : "text-destructive border-destructive/30 bg-destructive/5";
  return (
    <div className={`rounded-2xl border-2 p-4 ${toneCls} ${primary ? "" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
          <Icon className="h-3.5 w-3.5" />{label}
        </span>
      </div>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${primary ? "text-3xl" : ""}`}>
        {amount < 0 ? "−" : ""}₦{Math.abs(amount).toLocaleString()}
      </p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "primary" | "warning" | "muted" }) {
  const cls = tone === "warning" ? "text-warning" : tone === "muted" ? "text-muted-foreground" : "";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-bold tabular-nums ${cls}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}

function FleetLedgerRow({ txn }: { txn: FleetTxn }) {
  const isInflow = txn.kind === "delivery-fee" || txn.kind === "income";
  const Icon =
    txn.kind === "fuel" ? Fuel
    : txn.kind === "maintenance" ? Wrench
    : txn.kind === "fine" ? ShieldAlert
    : txn.kind === "purchase" ? Bike
    : txn.kind === "delivery-fee" ? Truck
    : Banknote;
  const label =
    txn.kind === "delivery-fee" ? "Delivery fee"
    : txn.kind === "purchase" ? "Bike purchased"
    : txn.kind === "fuel" ? "Fuel"
    : txn.kind === "maintenance" ? "Maintenance / repair"
    : txn.kind === "fine" ? "Fine"
    : txn.kind === "income" ? "Income"
    : "Expense";
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${isInflow ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{label}{txn.note ? <span className="text-muted-foreground"> · {txn.note}</span> : null}</p>
        <p className="text-[11px] text-muted-foreground">
          {new Date(txn.at).toLocaleDateString()} · {txn.loggedBy}
        </p>
      </div>
      <span className={`tabular-nums font-semibold ${isInflow ? "text-primary" : "text-destructive"}`}>
        {isInflow ? "+" : "−"}₦{txn.amount.toLocaleString()}
      </span>
    </li>
  );
}
