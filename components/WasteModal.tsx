"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useStore, fmtQty, type Line } from "@/lib/store";
import { Modal, ModalButton } from "@/components/Modal";

const REASONS = [
  "Spoilage",
  "Burnt food",
  "Returned by customer",
  "Broken bottle / breakage",
  "Over-pouring",
  "Measurement error",
  "Other",
];

/**
 * Records a waste entry — deducts the item from inventory and attributes the
 * loss to the current user and their open shift (if any).
 */
export function WasteModal({ open, onClose, line }: { open: boolean; onClose: () => void; line?: Line }) {
  const store = useStore();
  const { user } = useAuth();
  const items = store.inventory.filter(
    (i) => i.branch === store.currentBranch && (!line || i.line === line),
  );

  const [sku, setSku] = useState(items[0]?.sku ?? "");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState(REASONS[0]);

  if (!open) return null;

  const item = store.inventory.find((i) => i.sku === sku);
  const amount = Number(qty) || 0;
  const cost = item ? Math.round(amount * item.cost) : 0;

  function submit() {
    if (!item) { toast.error("Pick an item"); return; }
    if (amount <= 0) { toast.error("Enter a quantity"); return; }
    const shift = user ? store.activeShift(user.id) : undefined;
    store.recordWaste({
      sku: item.sku,
      qty: amount,
      reason,
      staffName: user?.name ?? "Unknown",
      shiftId: shift?.id,
    });
    toast.success(`Waste logged · ${fmtQty(amount)} ${item.unit} ${item.name} (₦${cost.toLocaleString()})`);
    setQty("");
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record waste"
      description="Logged against your shift and deducted from stock"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Log waste</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Item</span>
          <select value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls}>
            {items.map((i) => (
              <option key={i.sku} value={i.sku}>{i.name} — {fmtQty(i.onHand)} {i.unit} on hand</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Quantity wasted {item ? `(${item.unit})` : ""}</span>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" autoFocus className={inputCls} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Reason</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
        </div>
        <div className="rounded-xl bg-surface/60 border border-border p-3 flex justify-between text-sm">
          <span className="text-muted-foreground">Cost of waste</span>
          <span className="font-bold tabular-nums text-destructive">₦{cost.toLocaleString()}</span>
        </div>
      </div>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
