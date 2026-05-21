"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { useStore, type Vendor, type PurchaseOrder } from "@/lib/store";
import { Plus, Phone, Mail, Receipt, Truck } from "lucide-react";

const TERMS = ["COD", "Net 7", "Net 15", "Net 30"];

/** What we still owe a vendor — unpaid POs that have been received. */
function owedTo(vendorId: string, pos: PurchaseOrder[]): number {
  return pos
    .filter((p) => p.vendorId === vendorId && !p.paid && p.status !== "Ordered")
    .reduce((s, p) => s + p.total, 0);
}

export default function Vendors() {
  const store = useStore();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Vendor | null>(null);

  const payable = store.purchaseOrders
    .filter((p) => !p.paid && p.status !== "Ordered")
    .reduce((s, p) => s + p.total, 0);
  const openPOs = store.purchaseOrders.filter((p) => p.status !== "Received").length;

  return (
    <AppShell title="Vendors" subtitle="Supplier database, terms & accounts payable">
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { l: "Vendors", v: String(store.vendors.length) },
          { l: "Outstanding payables", v: `₦${payable.toLocaleString()}`, tone: payable > 0 ? "text-destructive" : "text-primary" },
          { l: "Open purchase orders", v: String(openPOs) },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</p>
          </div>
        ))}
      </section>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold">Supplier database</h2>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />New vendor
          </button>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border bg-surface/40">
              <th className="font-medium px-5 py-2.5">Vendor</th>
              <th className="font-medium px-5 py-2.5">Category</th>
              <th className="font-medium px-5 py-2.5">Terms</th>
              <th className="font-medium px-5 py-2.5">Contact</th>
              <th className="font-medium px-5 py-2.5 text-right">Owed</th>
              <th className="font-medium px-5 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {store.vendors.map((v) => {
              const owed = owedTo(v.id, store.purchaseOrders);
              return (
                <tr key={v.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                  <td className="px-5 py-3 font-medium">{v.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{v.category}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-surface-foreground">{v.terms}</span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{v.contact} · {v.phone}</td>
                  <td className={`px-5 py-3 text-right tabular-nums font-medium ${owed > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {owed > 0 ? `₦${owed.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => setViewing(v)} className="text-xs font-medium text-primary hover:underline">View</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {creating && <NewVendorModal onClose={() => setCreating(false)} />}
      {viewing && <VendorModal vendor={viewing} onClose={() => setViewing(null)} />}
    </AppShell>
  );
}

// ── Vendor detail ────────────────────────────────────────────────────────────

function VendorModal({ vendor, onClose }: { vendor: Vendor; onClose: () => void }) {
  const store = useStore();
  const pos = store.purchaseOrders.filter((p) => p.vendorId === vendor.id);
  const totalSpent = pos.reduce((s, p) => s + p.total, 0);
  const owed = owedTo(vendor.id, store.purchaseOrders);

  return (
    <Modal open onClose={onClose} title={vendor.name} description={`${vendor.category} · ${vendor.terms} terms`} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info icon={<Phone className="h-4 w-4" />} label="Contact" value={`${vendor.contact} · ${vendor.phone}`} />
          <Info icon={<Mail className="h-4 w-4" />} label="Email" value={vendor.email} />
          <Info icon={<Receipt className="h-4 w-4" />} label="TIN" value={vendor.tin} />
          <Info icon={<Truck className="h-4 w-4" />} label="Payment terms" value={vendor.terms} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface/60 border border-border p-3 text-center">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Lifetime spend</p>
            <p className="mt-1 text-lg font-bold tabular-nums">₦{totalSpent.toLocaleString()}</p>
          </div>
          <div className={`rounded-xl border p-3 text-center ${owed > 0 ? "bg-destructive/5 border-destructive/20" : "bg-surface/60 border-border"}`}>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Outstanding</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${owed > 0 ? "text-destructive" : ""}`}>₦{owed.toLocaleString()}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Purchase history</p>
          {pos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No purchase orders yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {pos.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="py-2 font-mono text-xs">{p.id}</td>
                    <td className="py-2 text-muted-foreground">{p.status}{p.paid ? " · paid" : ""}</td>
                    <td className="py-2 text-right tabular-nums font-medium">₦{p.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

// ── New vendor ───────────────────────────────────────────────────────────────

function NewVendorModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [tin, setTin] = useState("");
  const [terms, setTerms] = useState("Net 15");
  const [category, setCategory] = useState("Dry goods");

  function submit() {
    if (!name.trim()) { toast.error("Enter a vendor name"); return; }
    store.addVendor({ name: name.trim(), contact: contact.trim(), phone: phone.trim(), email: email.trim(), tin: tin.trim(), terms, category });
    toast.success(`${name.trim()} added to vendors`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New vendor"
      description="Add a supplier to the database"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Add vendor</ModalButton></>}
    >
      <div className="space-y-4">
        <Field label="Vendor name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunrise Foods Ltd" className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact person"><input value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls} /></Field>
          <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
          <Field label="TIN"><input value={tin} onChange={(e) => setTin(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment terms">
            <select value={terms} onChange={(e) => setTerms(e.target.value)} className={inputCls}>
              {TERMS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {["Dry goods", "Protein", "Produce", "Beverage", "Packaging", "Services"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
