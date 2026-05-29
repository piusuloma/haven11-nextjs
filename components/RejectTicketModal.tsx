"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Ban, AlertTriangle } from "lucide-react";
import { Modal, ModalButton } from "@/components/Modal";
import { useAuth } from "@/lib/auth";
import { useStore, type Ticket } from "@/lib/store";

/** Quick reasons a line cook / bartender reaches for most often. */
const REASONS = [
  "Out of stock — ingredient unavailable",
  "86'd — item sold out for the day",
  "Equipment down (grill / fryer / blender)",
  "Item off the menu / not served here",
  "Kitchen closing / past last orders",
];

/**
 * Lets the Kitchen or Bar reject a ticket they cannot fulfil. Captures a reason
 * (preset or free-text), returns the ticket's reserved stock, logs an audit
 * entry, and flags the order for the cashier to refund / substitute / void.
 */
export function RejectTicketModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const { user } = useAuth();
  const store = useStore();
  const [preset, setPreset] = useState<string>("");
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");

  const reason = preset === "__custom" ? custom.trim() : preset;

  function submit() {
    if (!reason) {
      setError("Pick or type a reason so the cashier knows why");
      return;
    }
    store.rejectTicket(ticket.id, reason, user?.name ?? "Kitchen");
    toast.error(`#${ticket.orderId} rejected — sent back to the cashier`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Ban className="h-4 w-4 text-destructive" />
          Reject #{ticket.orderId}
        </span>
      }
      description={`${ticket.station} · ${ticket.label} · ${ticket.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}`}
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
          <ModalButton variant="danger" onClick={submit}>Reject ticket</ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          This drops the ticket off the board and alerts the cashier to refund, substitute, or void the order. Use it only when the order genuinely can&apos;t be made.
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Reason</p>
          <div className="space-y-1.5">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setPreset(r); setError(""); }}
                className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                  preset === r ? "border-destructive bg-destructive/10 font-medium" : "border-border hover:bg-surface"
                }`}
              >
                {r}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setPreset("__custom"); setError(""); }}
              className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                preset === "__custom" ? "border-destructive bg-destructive/10 font-medium" : "border-border hover:bg-surface"
              }`}
            >
              Other reason…
            </button>
          </div>
        </div>

        {preset === "__custom" && (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Describe the reason</span>
            <textarea
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setError(""); }}
              rows={2}
              autoFocus
              placeholder="e.g. Tilapia delivery delayed — none in the kitchen"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </label>
        )}

        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      </div>
    </Modal>
  );
}
