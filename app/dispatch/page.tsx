"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { useStore, type DeliveryJob, type DeliveryStatus, type Rider, type RiderType } from "@/lib/store";
import { Bike, MapPin, Phone, Plus, Banknote, Wrench, Truck, CheckCircle2 } from "lucide-react";

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
  const [assigning, setAssigning] = useState<DeliveryJob | null>(null);
  const [expensing, setExpensing] = useState<Rider | null>(null);
  const [addingRider, setAddingRider] = useState(false);

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

      {/* Active delivery jobs */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Active deliveries</h2>
        {active.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No deliveries on the board. They appear here when a delivery order is rung up in the POS.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {active.map((d) => (
              <article key={d.id} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">{d.customer}</p>
                    <p className="text-xs text-muted-foreground font-mono">#{d.orderId}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 ${statusClass[d.status]}`}>{d.status}</span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-start gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />{d.address}</p>
                  <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" />{d.phone}</p>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${d.cod ? "bg-warning/15 text-foreground" : "bg-surface text-primary"}`}>
                    {d.cod ? `COD ₦${d.codAmount.toLocaleString()}` : "Prepaid"}
                  </span>
                  <span className="text-muted-foreground">fee ₦{d.fee.toLocaleString()} · {timeAgo(d.createdAt)}</span>
                </div>
                {d.riderId && <p className="text-xs text-muted-foreground">Rider: <span className="font-medium text-foreground">{riderName(d.riderId)}</span></p>}

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

      {/* Fleet & riders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Fleet &amp; riders</h2>
          <button onClick={() => setAddingRider(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" />Add rider
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {riders.map((r) => {
            const mine = delivered.filter((d) => d.riderId === r.id);
            const held = codHeldBy(r.id, jobs);
            const feeRevenue = mine.reduce((s, d) => s + d.fee, 0);
            const net = feeRevenue - r.expenses;
            const isBike = r.type === "Internal bike";
            return (
              <article key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface text-primary">
                      {isBike ? <Bike className="h-4.5 w-4.5" /> : <Truck className="h-4.5 w-4.5" />}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.type}</p>
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${r.status === "On delivery" ? "bg-primary/10 text-primary" : r.status === "Off" ? "bg-muted text-muted-foreground" : "bg-surface text-primary"}`}>
                    {r.status}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Delivered" value={String(mine.length)} />
                  <Stat label="Fee revenue" value={`₦${(feeRevenue / 1000).toFixed(1)}k`} />
                  <Stat label={isBike ? "Net P&L" : "COD held"} value={isBike ? `₦${(net / 1000).toFixed(1)}k` : `₦${(held / 1000).toFixed(1)}k`} tone={isBike ? (net < 0 ? "text-destructive" : "text-primary") : held > 0 ? "text-destructive" : undefined} />
                </div>

                {held > 0 && (
                  <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-destructive">
                      Holding ₦{held.toLocaleString()} COD · cannot clock out until settled
                    </p>
                    <button onClick={() => { store.settleCOD(r.id); toast.success(`COD settled — ₦${held.toLocaleString()} from ${r.name}`); }} className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 shrink-0">
                      Settle
                    </button>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between gap-2">
                  {isBike ? (
                    <button onClick={() => setExpensing(r)} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                      <Wrench className="h-3.5 w-3.5" />Log fuel / repair expense
                    </button>
                  ) : <span />}
                  {r.status === "Available" && (
                    <button
                      onClick={() => { store.setRiderStatus(r.id, "Off"); toast.success(`${r.name} clocked out`); }}
                      className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-surface shrink-0"
                    >
                      Clock out
                    </button>
                  )}
                  {r.status === "Off" && (
                    <button
                      onClick={() => { store.setRiderStatus(r.id, "Available"); toast.success(`${r.name} clocked in`); }}
                      className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-surface shrink-0"
                    >
                      Clock in
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {assigning && <AssignModal job={assigning} riders={riders} onClose={() => setAssigning(null)} />}
      {expensing && <ExpenseModal rider={expensing} onClose={() => setExpensing(null)} />}
      {addingRider && <AddRiderModal onClose={() => setAddingRider(false)} />}
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface/60 border border-border p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm font-bold tabular-nums ${tone ?? ""}`}>{value}</p>
    </div>
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
  const [kind, setKind] = useState("Fuel");

  function save() {
    const amt = Number(amount) || 0;
    if (amt <= 0) { toast.error("Enter an amount"); return; }
    store.logFleetExpense(rider.id, amt);
    toast.success(`₦${amt.toLocaleString()} ${kind.toLowerCase()} logged against ${rider.name}`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Fleet expense — ${rider.name}`}
      description="Cuts into this bike's net profit"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={save}>Log expense</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
            {["Fuel", "Repair", "Maintenance", "Union ticket", "Other"].map((k) => <option key={k}>{k}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Amount ₦</span>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus className={inputCls} />
        </label>
      </div>
    </Modal>
  );
}

// ── Add rider ────────────────────────────────────────────────────────────────

function AddRiderModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [type, setType] = useState<RiderType>("Internal bike");

  function save() {
    if (!name.trim()) { toast.error("Enter a name"); return; }
    store.addRider({ name: name.trim(), type });
    toast.success(`${name.trim()} added to the fleet`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add rider / partner"
      description="An internal bike or a 3PL delivery partner"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={save}>Add to fleet</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bike 3 — Yusuf" autoFocus className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as RiderType)} className={inputCls}>
            <option>Internal bike</option>
            <option>3PL partner</option>
          </select>
        </label>
      </div>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
