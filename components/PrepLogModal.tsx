"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, X, Pencil, Check, ChefHat } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore, fmtQty, LOCATION_NAME, type StockLocation } from "@/lib/store";
import { Modal, ModalButton } from "@/components/Modal";

const MAX_INLINE_PHOTO_BYTES = 1024 * 1024; // 1 MB

/**
 * Method B prep conversion. The cook logs the *prepped* (usable) weight after
 * finishing prep; the ROS reads the ingredient's standard yield %, derives the
 * raw consumed and the trim waste, and books the loss — no maths on the floor.
 *
 * Only prep-tracked ingredients (those with a yield profile) appear in the
 * picker. Owners / managers can tune the standard yield inline.
 */
export function PrepLogModal({ onClose, location = "kitchen" }: { onClose: () => void; location?: StockLocation }) {
  const store = useStore();
  const { user } = useAuth();
  const canTuneYield = user?.role === "owner" || user?.role === "manager";

  // Prep-tracked stock in this sub-store of the current branch.
  const items = store.inventory.filter(
    (i) =>
      i.branch === store.currentBranch &&
      i.location === location &&
      store.prepProfiles.some((p) => p.sku === i.sku),
  );

  const [sku, setSku] = useState(items[0]?.sku ?? "");
  const [prepped, setPrepped] = useState("");
  const [rawPulled, setRawPulled] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [editingYield, setEditingYield] = useState(false);
  const [yieldDraft, setYieldDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const item = items.find((i) => i.sku === sku) ?? items[0];
  const profile = item ? store.prepProfiles.find((p) => p.sku === item.sku) : undefined;
  const yieldPct = profile?.yieldPct ?? 0;
  const shelfLifeDays = profile?.shelfLifeDays ?? 0;
  const useBy = new Date(Date.now() + shelfLifeDays * 24 * 60 * 60 * 1000)
    .toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  // Live Method-B maths. If the cook enters the raw they pulled, the trim is the
  // ACTUAL difference (exact); otherwise it's derived from the standard yield.
  const preppedQty = Number(prepped) || 0;
  const rawPulledQty = Number(rawPulled) || 0;
  const measured = rawPulledQty > 0;
  const raw = measured
    ? rawPulledQty
    : yieldPct > 0 ? +(preppedQty / (yieldPct / 100)).toFixed(2) : 0;
  const waste = +(raw - preppedQty).toFixed(2);
  const actualYield = raw > 0 ? Math.round((preppedQty / raw) * 100) : 0;
  const cost = item ? Math.round(waste * item.cost) : 0;
  const tooMuch = item ? raw > item.onHand + 1e-4 : false;
  // Entered a raw weight smaller than the usable output — impossible.
  const rawTooSmall = measured && preppedQty > 0 && rawPulledQty < preppedQty - 1e-4;

  function handlePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPhotoName(file.name);
    if (file.size > MAX_INLINE_PHOTO_BYTES) {
      setPhotoDataUrl("");
      toast.info("Photo saved as record · too large to keep inline preview");
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

  function saveYield() {
    const pct = Number(yieldDraft);
    if (!item || !pct || pct < 1 || pct > 100) { toast.error("Yield must be between 1 and 100"); return; }
    store.setPrepYield(item.sku, pct);
    setEditingYield(false);
    toast.success(`${item.name} standard yield set to ${Math.round(pct)}%`);
  }

  function submit() {
    if (!item) { toast.error("Pick an item"); return; }
    const shift = user ? store.activeShift(user.id) : undefined;
    const res = store.recordPrep({
      sku: item.sku,
      location: item.location,
      preppedQty,
      rawQty: measured ? rawPulledQty : undefined,
      staffName: user?.name ?? "Unknown",
      shiftId: shift?.id,
      photoName: photoName || undefined,
      photoDataUrl: photoDataUrl || undefined,
    });
    if (!res.ok) { toast.error(res.error ?? "Couldn't log prep"); return; }
    toast.success(
      res.measured
        ? `Prep logged · exact ${res.actualYieldPct}% yield · ${fmtQty(res.waste ?? 0)} ${item.unit} trim (₦${(res.cost ?? 0).toLocaleString()})`
        : `Prep logged (estimated) · ${fmtQty(res.raw ?? 0)} ${item.unit} raw → ${fmtQty(preppedQty)} usable · ${fmtQty(res.waste ?? 0)} ${item.unit} trim`,
    );
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-primary" />Log prep
        </span>
      }
      description={`${LOCATION_NAME[location]} · enter the finished usable weight — the ROS works out the trim loss`}
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={submit} disabled={!item || preppedQty <= 0 || tooMuch || rawTooSmall}>Log prep</ModalButton>
        </>
      }
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No prep-tracked stock in {LOCATION_NAME[location]}. Items need a standard yield profile to use prep conversion.
        </p>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Ingredient</span>
            <select
              value={sku}
              onChange={(e) => { setSku(e.target.value); setEditingYield(false); }}
              className={inputCls}
            >
              {items.map((i) => (
                <option key={i.sku} value={i.sku}>
                  {i.name} — {fmtQty(i.onHand)} {i.unit} on hand
                </option>
              ))}
            </select>
          </label>

          {/* Standard yield — read-only for cooks, tunable for owner/manager. */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface/40 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Standard yield</span>
            {editingYield ? (
              <span className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={yieldDraft}
                  onChange={(e) => setYieldDraft(e.target.value)}
                  className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm text-right outline-none focus:border-primary"
                  autoFocus
                />
                <span className="text-sm">%</span>
                <button onClick={saveYield} aria-label="Save yield" className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                  <Check className="h-4 w-4" />
                </button>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-sm font-bold tabular-nums">{yieldPct}%</span>
                {canTuneYield && (
                  <button
                    onClick={() => { setYieldDraft(String(yieldPct)); setEditingYield(true); }}
                    aria-label="Adjust standard yield"
                    className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            )}
          </div>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Prepped (usable) weight {item ? `(${item.unit})` : ""}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={prepped}
              onChange={(e) => setPrepped(e.target.value)}
              placeholder="e.g. 8.5"
              autoFocus
              className={inputCls}
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Weigh the clean, prepped product — not the raw pull.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              Raw pulled {item ? `(${item.unit})` : ""} · <span className="text-primary">optional</span>
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={rawPulled}
              onChange={(e) => setRawPulled(e.target.value)}
              placeholder="leave blank to use the standard yield"
              className={inputCls}
            />
            <span className={`mt-1 block text-[11px] ${measured ? "text-primary" : "text-muted-foreground"}`}>
              {measured
                ? `Exact mode — recording the actual ${actualYield}% yield, zero variance.`
                : "Enter the raw weight to record the exact yield and remove variance."}
            </span>
          </label>

          {/* Photo capture / upload */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Trim photo (optional)</p>
            {photoDataUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoDataUrl} alt="Prep trim" className="h-20 w-20 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{photoName}</p>
                  <p className="text-[11px] text-muted-foreground">Attached to this prep record</p>
                </div>
                <button type="button" onClick={clearPhoto} aria-label="Remove photo" className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10">
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
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
          </div>

          {/* Live conversion preview */}
          <div className="rounded-xl border border-border bg-surface/60 p-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">The ROS will record</p>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${measured ? "bg-primary/10 text-primary" : "bg-warning/15 text-foreground"}`}>
                {measured ? "exact" : "estimated"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{measured ? "Raw pulled" : "Raw consumed (derived)"}</span>
              <span className="font-medium tabular-nums">{fmtQty(raw)} {item?.unit}</span>
            </div>
            {measured && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Actual yield vs standard</span>
                <span className={`font-medium tabular-nums ${actualYield < yieldPct ? "text-destructive" : "text-primary"}`}>
                  {actualYield}% vs {yieldPct}%
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Usable kept in stock</span>
              <span className="font-medium tabular-nums">{fmtQty(preppedQty)} {item?.unit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prepped lot · use by</span>
              <span className="font-medium">{shelfLifeDays > 0 ? `${useBy} (${shelfLifeDays}d)` : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trim / yield loss</span>
              <span className="font-bold tabular-nums text-destructive">{fmtQty(waste)} {item?.unit}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5">
              <span className="text-muted-foreground">Cost of loss</span>
              <span className="font-bold tabular-nums text-destructive">₦{cost.toLocaleString()}</span>
            </div>
          </div>

          {rawTooSmall && (
            <p className="text-xs font-medium text-destructive">
              Raw pulled can&apos;t be less than the prepped weight.
            </p>
          )}
          {tooMuch && (
            <p className="text-xs font-medium text-destructive">
              That needs {fmtQty(raw)} {item?.unit} raw but only {fmtQty(item?.onHand ?? 0)} {item?.unit} is in the kitchen.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
