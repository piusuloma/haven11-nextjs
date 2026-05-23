"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore, fmtQty, LOCATION_NAME, type StockLocation } from "@/lib/store";
import { Modal, ModalButton } from "@/components/Modal";

const REASONS = [
  "Prep trim / peel",
  "Spoilage",
  "Burnt food",
  "Returned by customer",
  "Broken bottle / breakage",
  "Over-pouring",
  "Measurement error",
  "Other",
];

// Photos larger than this aren't kept inline (metadata only).
const MAX_INLINE_PHOTO_BYTES = 1024 * 1024; // 1 MB

/**
 * Records a waste entry against a specific stock location — deducts the item,
 * captures an optional photo (peels, broken bottle, etc.) and attributes the
 * loss to the current user and their open shift (if any).
 */
export function WasteModal({ open, onClose, location = "store" }: { open: boolean; onClose: () => void; location?: StockLocation }) {
  const store = useStore();
  const { user } = useAuth();
  const items = store.inventory.filter(
    (i) => i.branch === store.currentBranch && i.location === location,
  );

  const [sku, setSku] = useState(items[0]?.sku ?? "");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [photoName, setPhotoName] = useState<string>("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const item = items.find((i) => i.sku === sku) ?? items[0];
  const amount = Number(qty) || 0;
  const cost = item ? Math.round(amount * item.cost) : 0;

  function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoName(file.name);
    if (file.size > MAX_INLINE_PHOTO_BYTES) {
      // Keep the filename on record but skip the data URL to stay within local storage.
      setPhotoDataUrl("");
      toast.info(`Photo saved as record · file too large to keep inline preview`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.onerror = () => toast.error("Couldn't read the photo");
    reader.readAsDataURL(file);
  }

  function clearPhoto() {
    setPhotoName("");
    setPhotoDataUrl("");
  }

  function submit() {
    if (!item) { toast.error("Pick an item"); return; }
    if (amount <= 0) { toast.error("Enter a quantity"); return; }
    const shift = user ? store.activeShift(user.id) : undefined;
    store.recordWaste({
      sku: item.sku,
      location: item.location,
      qty: amount,
      reason,
      staffName: user?.name ?? "Unknown",
      shiftId: shift?.id,
      photoName: photoName || undefined,
      photoDataUrl: photoDataUrl || undefined,
    });
    toast.success(`Waste logged · ${fmtQty(amount)} ${item.unit} ${item.name} (₦${cost.toLocaleString()})`);
    setQty("");
    clearPhoto();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Record waste"
      description={`${LOCATION_NAME[location]} · weighed, photographed and logged against your shift`}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Log waste</ModalButton></>}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stock in {LOCATION_NAME[location]} to record waste against.</p>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Item</span>
            <select value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls}>
              {items.map((i) => (
                <option key={i.sku} value={i.sku}>
                  {i.name} — {fmtQty(i.onHand)} {i.unit}
                  {i.altUnit && i.altOnHand != null ? ` (≈ ${fmtQty(i.altOnHand)} ${i.altUnit})` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                Quantity wasted {item ? `(${item.unit})` : ""}
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0"
                autoFocus
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Reason</span>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
          </div>

          {/* Photo capture / upload */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Photo (optional)</p>
            {photoDataUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoDataUrl} alt="Waste" className="h-20 w-20 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{photoName}</p>
                  <p className="text-[11px] text-muted-foreground">Attached to this waste record</p>
                </div>
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : photoName ? (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                <Camera className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate">{photoName}</span>
                <button type="button" onClick={clearPhoto} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface/40 py-3 text-sm font-medium text-muted-foreground hover:bg-surface"
              >
                <Camera className="h-4 w-4" />Take or upload photo
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhoto}
            />
          </div>

          <div className="rounded-xl bg-surface/60 border border-border p-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Cost of waste</span>
            <span className="font-bold tabular-nums text-destructive">₦{cost.toLocaleString()}</span>
          </div>
        </div>
      )}
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
