"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { useAuth } from "@/lib/auth";
import { useStore, fmtQty, HUB_ID, type Transfer, type TransferStatus } from "@/lib/store";
import { ArrowRight, Plus, ClipboardList, Truck, PackageCheck, AlertTriangle, Receipt, Search, X, CheckSquare, Square } from "lucide-react";

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
      {viewing && <ReceiptModal transfer={viewing} onClose={() => setViewing(null)} />}
    </AppShell>
  );
}

// ── Transfer row ─────────────────────────────────────────────────────────────

function TransferRow({
  transfer, fromName, toName, viewerIsSource, onApprove, onReject, onIssue, onReceive, onReceipt,
}: {
  transfer: Transfer;
  fromName: string;
  toName: string;
  /** True when the viewer is currently in the *source* branch (the Strong Room
   *  for branch requests). Approve / Reject / Issue are source-side actions. */
  viewerIsSource: boolean;
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
            viewerIsSource ? (
              <>
                <button onClick={onReject} className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-surface">Reject</button>
                <button onClick={onApprove} className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90">Approve</button>
              </>
            ) : (
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

// ── New request modal ────────────────────────────────────────────────────────

/**
 * Mirror of `StockRequestModal` (sub-store flow) for the branch → Strong Room
 * flow. A checklist picker rather than a "+ add row" loop, because operators
 * routinely request 30–50 items at once. Live availability at the Strong Room
 * is shown beside each item so the requester knows what's actually in stock.
 */
function NewTransferModal({
  onClose, onSubmit,
}: {
  onClose: () => void;
  onSubmit: (lines: { sku: string; qty: number }[], reason: string) => void;
}) {
  const store = useStore();
  const [reason, setReason] = useState("Low stock");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  // sku → quantity string. Presence in the map = ticked.
  const [picked, setPicked] = useState<Record<string, string>>({});

  // Source-of-truth for what can be requested: the Strong Room's Main Store.
  const hubItems = useMemo(
    () => store.inventory.filter((i) => i.branch === HUB_ID && i.location === "store"),
    [store.inventory],
  );

  // Only show categories that have at least one item in the hub.
  const presentCategories = useMemo(() => {
    const set = new Set<string>(hubItems.map((i) => i.category));
    return ["All", ...store.inventoryCategories.filter((c) => set.has(c))];
  }, [hubItems, store.inventoryCategories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return hubItems.filter((i) => {
      const matchesQ = !q
        || i.name.toLowerCase().includes(q)
        || i.sku.toLowerCase().includes(q)
        || i.category.toLowerCase().includes(q);
      const matchesCat = category === "All" || i.category === category;
      return matchesQ && matchesCat;
    });
  }, [hubItems, query, category]);

  // Group the filtered list by category so a 50-row pick stays scannable.
  const grouped = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const it of filtered) {
      const arr = m.get(it.category) ?? [];
      arr.push(it);
      m.set(it.category, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  function toggle(sku: string) {
    setPicked((prev) => {
      if (sku in prev) {
        const next = { ...prev };
        delete next[sku];
        return next;
      }
      return { ...prev, [sku]: "" };
    });
  }
  function setQty(sku: string, qty: string) {
    setPicked((prev) => ({ ...prev, [sku]: qty }));
  }
  function tickAllVisible() {
    setPicked((prev) => {
      const next = { ...prev };
      for (const it of filtered) if (!(it.sku in next)) next[it.sku] = "";
      return next;
    });
  }
  function clearAll() { setPicked({}); }

  const pickedCount = Object.keys(picked).length;
  const readyCount = Object.values(picked).filter((q) => Number(q) > 0).length;
  const totalQty = Object.values(picked).reduce((s, q) => s + (Number(q) || 0), 0);
  const allVisibleTicked = filtered.length > 0 && filtered.every((i) => i.sku in picked);

  function submit() {
    const lines = Object.entries(picked)
      .filter(([, q]) => Number(q) > 0)
      .map(([sku, q]) => ({ sku, qty: Number(q) }));
    if (lines.length === 0) {
      toast.error(pickedCount > 0 ? "Enter a quantity for the ticked items" : "Tick at least one item");
      return;
    }
    onSubmit(lines, reason.trim() || "Restock");
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Request stock from the Strong Room"
      description={`Destination: ${store.branchName(store.currentBranch)} · tick, enter qty, send one request`}
      size="xl"
      footer={
        <>
          <span className="mr-auto text-xs text-muted-foreground tabular-nums">
            {pickedCount === 0 ? "No items selected" : `${readyCount}/${pickedCount} ready · ${fmtQty(totalQty)} total units`}
          </span>
          <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={submit}>Submit request</ModalButton>
        </>
      }
    >
      {hubItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">The Strong Room has no stock to request.</p>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Reason</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
              {["Low stock", "Event prep", "Spoilage replacement", "Emergency"].map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>

          {/* Search + bulk actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, SKU or category…"
                className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={allVisibleTicked ? clearAll : tickAllVisible}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-surface"
            >
              {allVisibleTicked ? <CheckSquare className="h-3.5 w-3.5 text-primary" /> : <Square className="h-3.5 w-3.5" />}
              {allVisibleTicked ? "Untick all" : "Tick all visible"}
            </button>
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5">
            {presentCategories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${category === c ? "bg-primary text-primary-foreground" : "bg-surface text-foreground/70 hover:text-foreground"}`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Item list, grouped by category */}
          <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-border">
            {filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No items match your search.</p>
            ) : (
              grouped.map(([cat, rows]) => (
                <div key={cat}>
                  <div className="sticky top-0 z-10 flex items-center justify-between bg-surface/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                    <span>{cat}</span>
                    <span className="tabular-nums">{rows.length}</span>
                  </div>
                  <ul>
                    {rows.map((it) => {
                      const ticked = it.sku in picked;
                      return (
                        <li
                          key={it.sku}
                          className={`flex items-center gap-3 border-b border-border px-3 py-2 last:border-0 ${ticked ? "bg-primary/5" : "hover:bg-surface/40"}`}
                        >
                          <button
                            type="button"
                            onClick={() => toggle(it.sku)}
                            aria-label={ticked ? `Untick ${it.name}` : `Tick ${it.name}`}
                            className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${ticked ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                          >
                            {ticked && <CheckSquare className="h-3.5 w-3.5" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{it.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              <span className="font-mono">{it.sku}</span> · Strong Room has {fmtQty(it.onHand)} {it.unit}
                              {it.altUnit && it.altOnHand != null ? ` (≈ ${fmtQty(it.altOnHand)} ${it.altUnit})` : ""}
                            </p>
                          </div>
                          {ticked && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                inputMode="decimal"
                                step="any"
                                value={picked[it.sku]}
                                onChange={(e) => setQty(it.sku, e.target.value)}
                                placeholder="Qty"
                                className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                autoFocus
                              />
                              <span className="w-10 text-xs text-muted-foreground">{it.unit}</span>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      )}
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
