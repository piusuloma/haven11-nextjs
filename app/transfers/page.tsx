"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { NewTransferModal } from "@/components/NewTransferModal";
import { useAuth } from "@/lib/auth";
import { useStore, fmtQty, HUB_ID, type Transfer, type TransferStatus } from "@/lib/store";
import { ArrowRight, Plus, ClipboardList, Truck, PackageCheck, AlertTriangle, Receipt } from "lucide-react";

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
  const [viewing, setViewing] = useState<Transfer | null>(null);

  const me = user?.name ?? "You";
  const atHub = store.currentBranch === HUB_ID;
  // Approve / Reject is a *management* decision — owner or manager. Storekeepers
  // at the source physically issue the goods (`Issue & generate waybill`) but
  // don't approve. Everyone else just watches the status.
  const canApproveTransfers = user?.role === "owner" || user?.role === "manager";

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
                // Source-side actions (approve / reject / issue) are only
                // available when the viewer is currently in the source branch.
                // A branch never sees Approve / Reject on its own request.
                viewerIsSource={store.currentBranch === t.fromBranch}
                // Approve/Reject is further gated to management — a storekeeper
                // at the Strong Room can issue stock but not authorise the move.
                canApprove={canApproveTransfers}
                onApprove={() => { store.approveTransfer(t.id, me); toast.success(`${t.id} approved`); }}
                onReject={() => { store.rejectTransfer(t.id, me); toast.error(`${t.id} rejected`); }}
                onIssue={() => setIssuing(t)}
                onReceive={() => setReceiving(t)}
                onReceipt={() => setViewing(t)}
              />
            ))}
          </ul>
        )}
      </div>

      {creating && <NewTransferModal onClose={() => setCreating(false)} />}
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
      {viewing && <ReceiptModal transfer={viewing} onClose={() => setViewing(null)} />}
    </AppShell>
  );
}

// ── Transfer row ─────────────────────────────────────────────────────────────

function TransferRow({
  transfer, fromName, toName, viewerIsSource, canApprove, onApprove, onReject, onIssue, onReceive, onReceipt,
}: {
  transfer: Transfer;
  fromName: string;
  toName: string;
  /** True when the viewer is currently in the *source* branch (the Strong Room
   *  for branch requests). Approve / Reject / Issue are source-side actions. */
  viewerIsSource: boolean;
  /** Role gate: management-only (owner/manager). Source-branch context is necessary but not sufficient. */
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
  onIssue: () => void;
  onReceive: () => void;
  onReceipt: () => void;
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
        <div className="flex items-center gap-1.5">
          {t.status === "Requested" && (
            viewerIsSource && canApprove ? (
              <>
                <button onClick={onReject} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-surface">Reject</button>
                <button onClick={onApprove} className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Approve</button>
              </>
            ) : viewerIsSource ? (
              // At the source branch but not a manager — visible to the storekeeper.
              <span className="text-xs text-muted-foreground italic">Awaiting management approval</span>
            ) : (
              // At the destination — wait for the source to authorise.
              <span className="text-xs text-muted-foreground italic">Awaiting {fromName} approval</span>
            )
          )}
          {t.status === "Approved" && (
            viewerIsSource ? (
              <button onClick={onIssue} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                <Truck className="h-3.5 w-3.5" />Issue &amp; generate waybill
              </button>
            ) : (
              <span className="text-xs text-muted-foreground italic">Approved · {fromName} preparing</span>
            )
          )}
          {t.status === "Issued" && (
            viewerIsSource ? (
              <span className="text-xs text-muted-foreground italic">In transit · awaiting {toName} receipt</span>
            ) : (
              <button onClick={onReceive} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                <PackageCheck className="h-3.5 w-3.5" />{toName} receives
              </button>
            )
          )}
          {(t.status === "Issued" || t.status === "Received" || t.status === "Disputed") && (
            <button onClick={onReceipt} className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-surface">
              <Receipt className="h-3.5 w-3.5" />Receipt
            </button>
          )}
        </div>
      </div>
    </li>
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

// ── Strong Room issue receipt ────────────────────────────────────────────────

function ReceiptModal({ transfer, onClose }: { transfer: Transfer; onClose: () => void }) {
  const store = useStore();
  const lines = transfer.lines.map((l) => {
    const cost = store.inventory.find((i) => i.sku === l.sku)?.cost ?? 0;
    const qty = l.qtyIssued ?? l.qtyRequested;
    return { sku: l.sku, name: l.name, unit: l.unit, qty, cost, total: qty * cost };
  });
  const total = lines.reduce((s, l) => s + l.total, 0);
  const issuedDate = transfer.issuedAt ? new Date(transfer.issuedAt).toLocaleString() : "—";

  return (
    <Modal
      open
      onClose={onClose}
      title={`Receipt — ${transfer.id}`}
      description="Strong Room inter-branch issue receipt"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Close</ModalButton><ModalButton onClick={() => window.print()}>Print receipt</ModalButton></>}
    >
      <div className="space-y-3 text-sm">
        <div className="text-center border-b border-border pb-3">
          <p className="text-base font-bold">NativeID · Strong Room</p>
          <p className="text-xs text-muted-foreground">Inter-branch stock issue receipt</p>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Waybill</span>
          <span className="font-mono">{transfer.id}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Issued to</span>
          <span className="font-medium">{store.branchName(transfer.toBranch)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Date</span>
          <span>{issuedDate}</span>
        </div>
        <table className="w-full border-t border-border">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 font-medium text-right">Qty</th>
              <th className="py-2 font-medium text-right">Unit ₦</th>
              <th className="py-2 font-medium text-right">Total ₦</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.sku} className="border-t border-border">
                <td className="py-1.5">{l.name}</td>
                <td className="py-1.5 text-right tabular-nums">{fmtQty(l.qty)} {l.unit}</td>
                <td className="py-1.5 text-right tabular-nums">{l.cost.toLocaleString()}</td>
                <td className="py-1.5 text-right tabular-nums">{l.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between border-t-2 border-border pt-2 text-base font-bold">
          <span>Total at cost</span><span className="tabular-nums">₦{total.toLocaleString()}</span>
        </div>
        <p className="pt-1 text-center text-[11px] text-muted-foreground">
          Issued by {transfer.issuedBy ?? "—"} · billed to {store.branchName(transfer.toBranch)} at cost price.
        </p>
      </div>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
