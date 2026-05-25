"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { useAuth } from "@/lib/auth";
import { useStore, fmtQty, priceForQty, HUB_ID, type PurchaseOrder, type POStatus } from "@/lib/store";
import { Plus, Trash2, PackageCheck, TrendingUp, Eye, EyeOff, Sparkles } from "lucide-react";

const statusClass: Record<POStatus, string> = {
  "Pending Approval": "bg-warning/15 text-foreground",
  Ordered: "bg-sky-100 text-sky-700",
  "Partially Received": "bg-violet-100 text-violet-700",
  Received: "bg-surface text-primary",
  Rejected: "bg-muted text-muted-foreground",
};

function daysSince(ts: number): number {
  return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
}

export default function PurchaseOrders() {
  const store = useStore();
  const { user } = useAuth();
  const me = user?.name ?? "You";
  const isFinance = user?.role === "owner" || user?.role === "manager" || user?.role === "accountant";
  // Branch purchase orders are approved by management.
  const canApprove = user?.role === "owner" || user?.role === "manager";
  const [creating, setCreating] = useState(false);
  const [receiving, setReceiving] = useState<PurchaseOrder | null>(null);

  const vendorName = (id: string) => store.vendors.find((v) => v.id === id)?.name ?? "Vendor";

  const open = store.purchaseOrders.filter((p) => p.status !== "Received" && p.status !== "Rejected").length;
  const payables = store.purchaseOrders.filter((p) => !p.paid && (p.status === "Partially Received" || p.status === "Received"));
  const apTotal = payables.reduce((s, p) => s + p.total, 0);

  return (
    <AppShell title="Procurement" subtitle="Order inventory into the Strong Room · receiving & accounts payable">
      <section className={`grid grid-cols-2 gap-4 ${isFinance ? "lg:grid-cols-4" : "lg:grid-cols-2"}`}>
        {[
          { l: "Open POs", v: String(open) },
          { l: "Awaiting delivery", v: String(store.purchaseOrders.filter((p) => p.status === "Ordered").length) },
          ...(isFinance ? [
            { l: "Unpaid invoices", v: String(payables.length) },
            { l: "Accounts payable", v: `₦${apTotal.toLocaleString()}`, tone: apTotal > 0 ? "text-destructive" : "text-primary" },
          ] : []),
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</p>
          </div>
        ))}
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Purchase orders</h2>
        <button
          onClick={() => {
            if (store.vendors.length === 0) { toast.error("Add a vendor first"); return; }
            setCreating(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />New purchase order
        </button>
      </div>

      <section className="space-y-3">
        {store.purchaseOrders.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
            No purchase orders yet.
          </div>
        ) : (
          store.purchaseOrders.map((po) => (
            <article key={po.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold">{po.id}</span>
                  <span className="text-sm">{vendorName(po.vendorId)}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[po.status]}`}>{po.status}</span>
                  {po.paid && <span className="inline-flex rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-primary">Paid</span>}
                </div>
                <span className="text-xs text-muted-foreground">Expected {po.expectedDate}</span>
              </div>

              <table className="mt-3 w-full text-sm">
                <tbody>
                  {po.lines.map((l) => (
                    <tr key={l.sku} className="border-b border-border last:border-0">
                      <td className="py-1.5 font-medium">{l.name}</td>
                      <td className="py-1.5 text-muted-foreground tabular-nums">
                        {fmtQty(l.qtyReceived)} / {fmtQty(l.qtyOrdered)} {l.unit} received
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-muted-foreground">@ ₦{l.unitCost.toLocaleString()}</td>
                      <td className="py-1.5 text-right tabular-nums font-medium">₦{(l.qtyOrdered * l.unitCost).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Total ₦{po.total.toLocaleString()}</p>
                <div className="flex gap-1.5">
                  {po.status === "Pending Approval" && (canApprove ? (
                    <>
                      <button onClick={() => { store.rejectPO(po.id, me); toast.error(`${po.id} rejected`); }} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-surface">Reject</button>
                      <button onClick={() => { store.approvePO(po.id, me); toast.success(`${po.id} approved — sent to vendor`); }} className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Approve</button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Awaiting management approval</span>
                  ))}
                  {(po.status === "Ordered" || po.status === "Partially Received") && (
                    <button onClick={() => setReceiving(po)} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                      <PackageCheck className="h-3.5 w-3.5" />Receive goods
                    </button>
                  )}
                  {(po.status === "Partially Received" || po.status === "Received") && !po.paid && (
                    <button onClick={() => { store.markPOPaid(po.id); toast.success(`${po.id} marked paid`); }} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-surface">
                      Mark paid
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      {/* A/P aging + price-change variance — finance analytics */}
      {isFinance && (
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Accounts payable — aging</h2>
          {payables.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No outstanding payables. 🎉</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {payables.map((p) => {
                const age = daysSince(p.receivedAt ?? p.createdAt);
                return (
                  <li key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                    <div>
                      <p className="font-medium">{vendorName(p.vendorId)}</p>
                      <p className="text-xs text-muted-foreground">{p.id} · {age} day{age !== 1 ? "s" : ""} old</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`tabular-nums font-bold ${age > 30 ? "text-destructive" : ""}`}>₦{p.total.toLocaleString()}</span>
                      <button onClick={() => { store.markPOPaid(p.id); toast.success(`${p.id} marked paid`); }} className="rounded-md border border-border px-2 py-1 text-xs font-medium hover:bg-surface">
                        Mark paid
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />Supplier price changes
          </h2>
          {store.priceChanges.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No price changes logged. Variances appear here when received costs differ.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {store.priceChanges.slice(0, 6).map((c) => {
                const up = c.newCost > c.oldCost;
                return (
                  <li key={c.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{c.name}</span>
                      <span className={`tabular-nums font-bold ${up ? "text-destructive" : "text-primary"}`}>
                        ₦{c.oldCost.toLocaleString()} → ₦{c.newCost.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {up ? "▲" : "▼"} {Math.abs(Math.round(((c.newCost - c.oldCost) / c.oldCost) * 100))}% · {c.vendorName}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
      )}

      {creating && <NewPOModal onClose={() => setCreating(false)} />}
      {receiving && <ReceiveModal po={receiving} onClose={() => setReceiving(null)} />}
    </AppShell>
  );
}

// ── New PO ───────────────────────────────────────────────────────────────────

function NewPOModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [vendorId, setVendorId] = useState(store.vendors[0]?.id ?? "");
  // Destination is always the branch you're currently viewing — branches cannot
  // raise POs that deliver to other branches. To order for another branch, the
  // user switches branches via the header switcher first.
  const branch = store.currentBranch;
  const branchName = store.branchName(branch);
  const isHub = branch === HUB_ID;
  const [expectedDate, setExpectedDate] = useState("");
  const [rows, setRows] = useState<{ sku: string; qty: string; cost: string }[]>([
    { sku: store.products[0]?.sku ?? "", qty: "", cost: "" },
  ]);

  function update(i: number, key: "sku" | "qty" | "cost", val: string) {
    setRows((prev) => prev.map((r, idx) => {
      if (idx !== i) return r;
      const next = { ...r, [key]: val };
      const sku = key === "sku" ? val : next.sku;
      const qty = key === "qty"
        ? Number(val) || 0
        : Number(next.qty) || 0;
      // Vendor-tier autofill: if there's a price tier for this vendor-SKU pair
      // at the entered quantity, snap the cost to the tier (industry standard:
      // bulk buyers pay the tier price automatically). Manual edits to the
      // cost field still win (user might be negotiating a one-off price).
      if (key === "sku" || key === "qty") {
        const tier = priceForQty(store.vendorPricing, vendorId, sku, qty);
        if (tier.unitCost != null) {
          // Only auto-set when the cost field is empty OR matches the previously-active tier.
          if (key === "sku") {
            next.cost = String(tier.unitCost);
          } else if (key === "qty") {
            // On qty change, always snap to the new tier (the operator can override after).
            next.cost = String(tier.unitCost);
          }
        } else if (key === "sku" && !r.cost) {
          // Fall back to catalogue cost when there's no tiered price on file.
          const prod = store.products.find((p) => p.sku === sku);
          if (prod) next.cost = String(prod.cost);
        }
      }
      return next;
    }));
  }

  const total = rows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.cost) || 0), 0);

  // Compute total savings vs the lowest-tier-1 price for visibility.
  const savings = rows.reduce((s, r) => {
    const qty = Number(r.qty) || 0;
    const cost = Number(r.cost) || 0;
    if (qty === 0 || cost === 0) return s;
    const tier = priceForQty(store.vendorPricing, vendorId, r.sku, qty);
    if (!tier.activeTier) return s;
    // Compare against tier-1 (smallest minQty).
    const pricing = store.vendorPricing.find((p) => p.vendorId === vendorId && p.sku === r.sku);
    if (!pricing || pricing.tiers.length < 2) return s;
    const baseUnit = pricing.tiers.reduce((min, t) => t.minQty < min.minQty ? t : min, pricing.tiers[0]).unitCost;
    return s + Math.max(0, (baseUnit - cost)) * qty;
  }, 0);

  function submit() {
    if (!vendorId) { toast.error("Pick a vendor"); return; }
    const lines = rows
      .filter((r) => r.sku && Number(r.qty) > 0)
      .map((r) => ({ sku: r.sku, qtyOrdered: Number(r.qty), unitCost: Number(r.cost) || 0 }));
    if (lines.length === 0) { toast.error("Add at least one line item"); return; }
    const po = store.createPO({ vendorId, branch, expectedDate: expectedDate || "TBC", lines });
    toast.success(`${po.id} raised — awaiting management approval`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New purchase order"
      description="Routed for management approval before it goes to the vendor"
      size="lg"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Raise PO</ModalButton></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Vendor</span>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputCls}>
              {store.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <div className="block">
            <span className="text-xs font-medium text-muted-foreground">Deliver to</span>
            <div className={`${inputCls} flex items-center justify-between bg-surface/60 text-foreground`}>
              <span className="font-medium">{branchName}</span>
              <span className="text-[11px] text-muted-foreground">{isHub ? "Strong Room" : "branch"}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              POs deliver to the branch you&apos;re viewing. Switch branches to order for another.
            </p>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Expected delivery</span>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={inputCls} />
          </label>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Line items</p>
          <div className="space-y-2">
            {rows.map((r, i) => {
              const qty = Number(r.qty) || 0;
              // Active tier + next tier for this row — drives the hint below.
              const tier = qty > 0 ? priceForQty(store.vendorPricing, vendorId, r.sku, qty) : null;
              return (
                <div key={i} className="space-y-1">
                  <div className="flex gap-2">
                    <select value={r.sku} onChange={(e) => update(i, "sku", e.target.value)} className={`${inputCls} flex-1`}>
                      {store.products.map((p) => <option key={p.sku} value={p.sku}>{p.name}</option>)}
                    </select>
                    <input value={r.qty} onChange={(e) => update(i, "qty", e.target.value)} type="number" placeholder="Qty" className={`${inputCls} w-20`} />
                    <input value={r.cost} onChange={(e) => update(i, "cost", e.target.value)} type="number" placeholder="₦ cost" className={`${inputCls} w-28`} />
                    {rows.length > 1 && (
                      <button onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {/* Bulk-pricing hint — "Add N more to drop to ₦X/unit" */}
                  {tier?.nextTier && qty > 0 && tier.activeTier && (
                    <p className="ml-1 inline-flex items-center gap-1 text-[11px] text-warning">
                      <Sparkles className="h-3 w-3" />
                      Add <span className="font-semibold">{tier.nextTier.minQty - qty}</span> more to drop to <span className="font-semibold tabular-nums">₦{tier.nextTier.unitCost.toLocaleString()}/unit</span>
                      <span className="text-muted-foreground">· save ₦{((tier.activeTier.unitCost - tier.nextTier.unitCost) * tier.nextTier.minQty).toLocaleString()} at that tier</span>
                    </p>
                  )}
                  {tier?.activeTier && !tier.nextTier && qty > 0 && tier.unitCost != null && (
                    <p className="ml-1 inline-flex items-center gap-1 text-[11px] text-primary">
                      <Sparkles className="h-3 w-3" />Best price tier · ₦{tier.activeTier.unitCost.toLocaleString()}/unit
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={() => setRows((prev) => [...prev, { sku: store.products[0]?.sku ?? "", qty: "", cost: "" }])} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            <Plus className="h-3.5 w-3.5" />Add line item
          </button>
        </div>

        <div className="rounded-xl bg-surface/60 border border-border p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">PO total</span>
            <span className="font-bold tabular-nums">₦{total.toLocaleString()}</span>
          </div>
          {savings > 0 && (
            <div className="flex justify-between text-[11px] text-primary">
              <span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" />Bulk-buy savings on this order</span>
              <span className="font-semibold tabular-nums">−₦{savings.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Receive goods ────────────────────────────────────────────────────────────

function ReceiveModal({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const store = useStore();
  const [blind, setBlind] = useState(false);
  const [rows, setRows] = useState<Record<string, { qty: string; cost: string; expiry: string }>>(
    Object.fromEntries(po.lines.map((l) => [l.sku, {
      qty: String(Math.max(0, l.qtyOrdered - l.qtyReceived)),
      cost: String(l.unitCost),
      expiry: "",
    }])),
  );

  function setField(sku: string, key: "qty" | "cost" | "expiry", val: string) {
    setRows((p) => ({ ...p, [sku]: { ...p[sku], [key]: val } }));
  }

  function confirm() {
    const received = po.lines
      .map((l) => ({
        sku: l.sku,
        qtyReceived: Number(rows[l.sku]?.qty) || 0,
        unitCost: Number(rows[l.sku]?.cost) || l.unitCost,
        expiry: rows[l.sku]?.expiry || undefined,
      }))
      .filter((r) => r.qtyReceived > 0);
    if (received.length === 0) { toast.error("Enter at least one received quantity"); return; }
    store.receivePO(po.id, received, "Storekeeper");
    const priced = received.filter((r) => {
      const line = po.lines.find((l) => l.sku === r.sku);
      return line && r.unitCost !== line.unitCost;
    }).length;
    toast.success(`${po.id} received${priced > 0 ? ` · ${priced} price change${priced !== 1 ? "s" : ""} logged` : ""}`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Receive ${po.id}`}
      description="Count what physically arrived at the Strong Room"
      size="lg"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={confirm}>Confirm receipt</ModalButton></>}
    >
      <div className="space-y-3">
        <button
          onClick={() => setBlind((b) => !b)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${blind ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-surface"}`}
        >
          {blind ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          Blind receiving {blind ? "on" : "off"}
        </button>
        <p className="text-xs text-muted-foreground">
          {blind
            ? "Ordered quantities are hidden — the storekeeper must count honestly."
            : "Ordered quantities are shown for reference."}
        </p>

        <div className="space-y-2 pt-1">
          {po.lines.map((l) => (
            <div key={l.sku} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{l.name}</p>
                {!blind && (
                  <p className="text-xs text-muted-foreground">
                    Ordered {fmtQty(l.qtyOrdered)} {l.unit}
                    {l.qtyReceived > 0 && ` · ${fmtQty(l.qtyReceived)} already in`}
                  </p>
                )}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Received ({l.unit})</span>
                  <input type="number" value={rows[l.sku]?.qty ?? ""} onChange={(e) => setField(l.sku, "qty", e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Unit cost ₦</span>
                  <input type="number" value={rows[l.sku]?.cost ?? ""} onChange={(e) => setField(l.sku, "cost", e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Expiry (optional)</span>
                  <input type="date" value={rows[l.sku]?.expiry ?? ""} onChange={(e) => setField(l.sku, "expiry", e.target.value)} className={inputCls} />
                </label>
              </div>
              {Number(rows[l.sku]?.cost) > 0 && Number(rows[l.sku]?.cost) !== l.unitCost && (
                <p className="mt-1.5 text-xs text-warning font-medium">
                  Price change vs PO — variance will be logged and the cost rolled forward.
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
