"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { STAFF_ROSTER } from "@/lib/auth";
import { Modal, ModalButton } from "@/components/Modal";

/** Returns the manager/owner whose PIN matches, or undefined. */
export function managerByPin(pin: string) {
  return STAFF_ROSTER.find(
    (s) => (s.role === "manager" || s.role === "owner") && s.pin === pin,
  );
}

/**
 * A manager-PIN gate for sensitive actions (void, large discount).
 * Calls onApprove with the approving manager's name and the entered reason.
 */
export function ManagerApprovalModal({
  title,
  description,
  reasonLabel,
  confirmLabel = "Authorise",
  ownerOnly = false,
  onClose,
  onApprove,
}: {
  title: string;
  description?: string;
  reasonLabel?: string;
  confirmLabel?: string;
  ownerOnly?: boolean;
  onClose: () => void;
  onApprove: (managerName: string, reason: string) => void;
}) {
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  function submit() {
    if (reasonLabel && !reason.trim()) { setError("A reason is required"); return; }
    const mgr = managerByPin(pin);
    if (!mgr || (ownerOnly && mgr.role !== "owner")) {
      setError(ownerOnly ? "This action requires an owner PIN" : "Not a valid manager PIN");
      setPin("");
      return;
    }
    onApprove(mgr.name, reason.trim());
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={submit}>{confirmLabel}</ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl bg-surface/60 border border-border p-3 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
          {ownerOnly
            ? "An owner PIN is required to authorise this action."
            : "A manager or owner PIN is required to authorise this action."}
        </div>

        {reasonLabel && (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">{reasonLabel}</span>
            <input
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(""); }}
              placeholder="Reason…"
              className={inputCls}
            />
          </label>
        )}

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Manager PIN</span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
            autoFocus
            placeholder="••••"
            className={`${inputCls} text-center text-lg tracking-[0.5em]`}
          />
        </label>

        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        <p className="text-[11px] text-muted-foreground">Dev PINs — Manager (Tunde) 1111 · Owner (Seun) 0000</p>
      </div>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
