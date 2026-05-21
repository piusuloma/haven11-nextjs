"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { useAuth } from "@/lib/auth";
import { useStore, fmtQty, HUB_ID, type Transfer, type TransferStatus } from "@/lib/store";
import { ArrowRight, Plus, Trash2, ClipboardList, Truck, PackageCheck, AlertTriangle } from "lucide-react";

const statusClass: Record<TransferStatus, string> = {
  Requested: "bg-warning/15 text-foreground",
  Approved:  "bg-sky-100 text-sky-700",
  Issued:    "bg-primary/10 text-primary",
  Received:  "bg-surface text-primary",
  Disputed:  "bg-destructive/10 text-destructive",
  Rejected:  "bg-muted text-muted-foreground",
};

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default function Transfers() {
  const store = useStore();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [issuing, setIssuing] = useState<Transfer | null>(null);
  const [receiving, setReceiving] = useState<Transfer | null>(null);

  const me = user?.name ?? "You";
  const atHub = store.currentBranch === HUB_ID;

  // Non-owners only see transfers involving their own branch (Module 8 RBAC).
  const visibleTransfers = user?.role === "owner"
    ? store.transfers
    : store.transfers.filter((t) => t.toBranch === store.currentBranch || t.fromBranch === store.currentBranch);

  const counts = {
    requested: visibleTransfers.filter((t) => t.status === "Requested").length,
    approved:  visibleTransfers.filter((t) => t.status === "Approved").length,
    issued:    visibleTransfers.filter((t) => t.status === "Issued").length,
    disputed:  visibleTransfers.filter((t) => t.status === "Disputed").length,
  };

  return (
    <AppShell title="Stock Transfers" subtitle="Strong Room → branch · hub-and-spoke supply chain">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Awaiting approval", v: counts.requested, I: ClipboardList },
          { l: "Approved", v: counts.approved, I: PackageCheck },
          { l: "In transit", v: counts.issued, I: Truck },
          { l: "Disputed", v: counts.disputed, I: AlertTriangle },
        ].map((s) => {
          const I = s.I;
          return (
            <div key={s.l} className="rounded-xl border border-border bg-card p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">{s.v}</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-surface text-primary"><I className="h-5 w-5" /></span>
            </div>
          );
        })}
      </section>

      <div className="rounded-xl border border-border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold">Transfer waybills</h2>
            <p className="text-xs text-muted-foreground">
              Branches request stock from the Strong Room — every move leaves an audit trail
            </p>
          </div>
          <button
            onClick={() => {
              if (atHub) { toast.info("Switch to a branch to raise a stock request"); return; }
              setCreating(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />New request
          </button>
        </header>

        {visibleTransfers.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">No transfers yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {visibleTransfers.map((t) => (
              <TransferRow
                key={t.id}
                transfer={t}
                fromName={store.branchName(t.fromBranch)}
                toName={store.branchName(t.toBranch)}
                onApprove={() => { store.approveTransfer(t.id, me); toast.success(`${t.id} approved`); }}
                onReject={() => { store.rejectTransfer(t.id, me); toast.error(`${t.id} rejected`); }}
                onIssue={() => setIssuing(t)}
                onReceive={() => setReceiving(t)}
              />
            ))}
          </ul>
        )}
      </div>

      {creating && (
        <NewTransferModal
          onClose={() => setCreating(false)}
          onSubmit={(lines, reason) => {
            const tr = store.requestTransfer({ toBranch: store.currentBranch, lines, reason, by: me });
            toast.success(`${tr.id} requested from the Strong Room`);
            setCreating(false);
          }}
        />
      )}
      {issuing && (
        <IssueModal
          transfer={issuing}
          toName={store.branchName(issuing.toBranch)}
          onClose={() => setIssuing(null)}
          onConfirm={(issued) => {
            store.issueTransfer(issuing.id, issued, me);
            toast.success(`${issuing.id} issued · waybill generated`);
            setIssuing(null);
          }}
        />
      )}
      {receiving && (
        <ReceiveModal
          transfer={receiving}
          toName={store.branchName(receiving.toBranch)}
          onClose={() => setReceiving(null)}
          onConfirm={(received) => {
            store.receiveTransfer(receiving.id, received, me);
            const short = receiving.lines.some((l) => {
              const got = received.find((r) => r.sku === l.sku)?.qty ?? 0;
              return l.qtyIssued != null && got < l.qtyIssued;
            });
            if (short) toast.warning(`${receiving.id} received with a shortfall — flagged as disputed`);
            else toast.success(`${receiving.id} received in full`);
            setReceiving(null);
          }}
        />
      )}
    </AppShell>
  );
}

// ── Transfer row ─────────────────────────────────────────────────────────────

function TransferRow({
  transfer, fromName, toName, onApprove, onReject, onIssue, onReceive,
}: {
  transfer: Transfer;
  fromName: string;
  toName: string;
  onApprove: () => void;
  onReject: () => void;
  onIssue: () => void;
  onReceive: () => void;
}) {
  const t = transfer;
  return (
    <li className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-semibold">{t.id}</span>
          <span className="inline-flex items-center gap-1.5 text-sm">
            {fromName} <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /> {toName}
          </span>
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[t.status]}`}>{t.status}</span>
        </div>
        <span className="text-xs text-muted-foreground">{t.requestedBy} · {timeAgo(t.requestedAt)}</span>
      </div>

      <ul className="text-sm space-y-0.5">
        {t.lines.map((l) => (
          <li key={l.sku} className="flex items-center gap-2 text-foreground/90">
            <span className="font-medium">{l.name}</span>
            <span className="text-muted-foreground">
              · req {fmtQty(l.qtyRequested)} {l.unit}
              {l.qtyIssued != null && ` · issued ${fmtQty(l.qtyIssued)}`}
              {l.qtyReceived != null && ` · received ${fmtQty(l.qtyReceived)}`}
              {l.qtyIssued != null && l.qtyReceived != null && l.qtyReceived < l.qtyIssued && (
                <span className="text-destructive font-medium"> · {fmtQty(l.qtyIssued - l.qtyReceived)} {l.unit} short</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {t.reason && `Reason: ${t.reason}`}
          {t.valueAtCost != null && ` · waybill value ₦${t.valueAtCost.toLocaleString()} (at cost)`}
          {t.status === "Disputed" && " · goods-in-transit loss flagged to Super Admin"}
        </p>
        <div className="flex gap-1.5">
          {t.status === "Requested" && (
            <>
              <button onClick={onReject} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-surface">Reject</button>
              <button onClick={onApprove} className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Approve</button>
            </>
          )}
          {t.status === "Approved" && (
            <button onClick={onIssue} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              <Truck className="h-3.5 w-3.5" />Issue &amp; generate waybill
            </button>
          )}
          {t.status === "Issued" && (
            <button onClick={onReceive} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              <PackageCheck className="h-3.5 w-3.5" />{toName} receives
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

// ── New request modal ────────────────────────────────────────────────────────

function NewTransferModal({
  onClose, onSubmit,
}: {
  onClose: () => void;
  onSubmit: (lines: { sku: string; qty: number }[], reason: string) => void;
}) {
  const store = useStore();
  const [reason, setReason] = useState("Low stock");
  const [rows, setRows] = useState<{ sku: string; qty: string }[]>([
    { sku: store.products[0]?.sku ?? "", qty: "" },
  ]);

  function update(i: number, key: "sku" | "qty", val: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  }

  function submit() {
    const valid = rows
      .filter((r) => r.sku && Number(r.qty) > 0)
      .map((r) => ({ sku: r.sku, qty: Number(r.qty) }));
    if (valid.length === 0) { toast.error("Add at least one item with a quantity"); return; }
    onSubmit(valid, reason.trim() || "Restock");
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Request stock from the Strong Room"
      description={`Destination: ${store.branchName(store.currentBranch)}`}
      size="lg"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Submit request</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Reason</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
            {["Low stock", "Event prep", "Spoilage replacement", "Emergency"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Items requested</p>
          <div className="space-y-2">
            {rows.map((r, i) => {
              const prod = store.products.find((p) => p.sku === r.sku);
              return (
                <div key={i} className="flex gap-2">
                  <select value={r.sku} onChange={(e) => update(i, "sku", e.target.value)} className={`${inputCls} flex-1`}>
                    {store.products.map((p) => <option key={p.sku} value={p.sku}>{p.name}</option>)}
                  </select>
                  <input value={r.qty} onChange={(e) => update(i, "qty", e.target.value)} type="number" placeholder="Qty" className={`${inputCls} w-24`} />
                  <span className="grid w-12 shrink-0 place-items-center text-xs text-muted-foreground">{prod?.unit}</span>
                  {rows.length > 1 && (
                    <button onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setRows((prev) => [...prev, { sku: store.products[0]?.sku ?? "", qty: "" }])}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />Add another item
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Issue modal ──────────────────────────────────────────────────────────────

function IssueModal({
  transfer, toName, onClose, onConfirm,
}: {
  transfer: Transfer;
  toName: string;
  onClose: () => void;
  onConfirm: (issued: { sku: string; qty: number }[]) => void;
}) {
  const store = useStore();
  const [qtys, setQtys] = useState<Record<string, string>>(
    Object.fromEntries(transfer.lines.map((l) => [l.sku, String(l.qtyRequested)])),
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Issue ${transfer.id} → ${toName}`}
      description="Confirm what the Strong Room is dispatching — this deducts hub stock"
      size="lg"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={() => onConfirm(transfer.lines.map((l) => ({ sku: l.sku, qty: Number(qtys[l.sku]) || 0 })))}>
            Issue &amp; generate waybill
          </ModalButton>
        </>
      }
    >
      <div className="space-y-2">
        {transfer.lines.map((l) => {
          const hub = store.inventory.find((i) => i.sku === l.sku && i.branch === HUB_ID);
          const issue = Number(qtys[l.sku]) || 0;
          const short = hub != null && issue > hub.onHand;
          return (
            <div key={l.sku} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{l.name}</p>
                <p className="text-xs text-muted-foreground">
                  Requested {fmtQty(l.qtyRequested)} {l.unit} · Strong Room has {fmtQty(hub?.onHand ?? 0)} {l.unit}
                </p>
              </div>
              <input
                type="number"
                value={qtys[l.sku] ?? ""}
                onChange={(e) => setQtys((p) => ({ ...p, [l.sku]: e.target.value }))}
                className={`${inputCls} w-24 ${short ? "border-destructive" : ""}`}
              />
              <span className="w-10 text-xs text-muted-foreground">{l.unit}</span>
            </div>
          );
        })}
        <p className="text-[11px] text-muted-foreground pt-1">
          The Strong Room is billed against {toName} at cost price (inter-branch billing).
        </p>
      </div>
    </Modal>
  );
}

// ── Receive modal ────────────────────────────────────────────────────────────

function ReceiveModal({
  transfer, toName, onClose, onConfirm,
}: {
  transfer: Transfer;
  toName: string;
  onClose: () => void;
  onConfirm: (received: { sku: string; qty: number }[]) => void;
}) {
  const [qtys, setQtys] = useState<Record<string, string>>(
    Object.fromEntries(transfer.lines.map((l) => [l.sku, String(l.qtyIssued ?? l.qtyRequested)])),
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`${toName} receives ${transfer.id}`}
      description="Count what physically arrived — any shortfall is flagged as a transit loss"
      size="lg"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={() => onConfirm(transfer.lines.map((l) => ({ sku: l.sku, qty: Number(qtys[l.sku]) || 0 })))}>
            Confirm receipt
          </ModalButton>
        </>
      }
    >
      <div className="space-y-2">
        {transfer.lines.map((l) => {
          const issued = l.qtyIssued ?? l.qtyRequested;
          const got = Number(qtys[l.sku]) || 0;
          const diff = got - issued;
          return (
            <div key={l.sku} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{l.name}</p>
                <p className="text-xs text-muted-foreground">Issued {fmtQty(issued)} {l.unit} on the waybill</p>
              </div>
              <input
                type="number"
                value={qtys[l.sku] ?? ""}
                onChange={(e) => setQtys((p) => ({ ...p, [l.sku]: e.target.value }))}
                className={`${inputCls} w-24 ${diff < 0 ? "border-destructive" : ""}`}
              />
              <span className={`w-16 text-right text-xs font-semibold tabular-nums ${diff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {diff < 0 ? `${fmtQty(diff)} ${l.unit}` : "OK"}
              </span>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
