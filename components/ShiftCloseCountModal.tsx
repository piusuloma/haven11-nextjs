"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, AlertTriangle, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore, fmtQty, LOCATION_NAME, type StockLocation } from "@/lib/store";
import { Modal, ModalButton } from "@/components/Modal";

/**
 * Industry-standard end-of-shift inventory count — every Kitchen / Bar /
 * Juice Bar closes by physically counting their high-value stock and feeding
 * the numbers in here. The system computes variance against expected on-hand
 * and surfaces any over-pour / shrinkage automatically.
 *
 * Toast, Lightspeed, MarketMan and every modern restaurant POS has this
 * exact flow. We surface the *high-value* items first (anything that's been
 * touched today or carries a category like Spirits / Protein) — operator can
 * tick *Show everything* to expand to the full station.
 */
export function ShiftCloseCountModal({
  location, onClose,
}: {
  location: StockLocation;
  onClose: () => void;
}) {
  const store = useStore();
  const { user } = useAuth();
  const me = user?.name ?? "You";

  // Items at this station for the current branch.
  const items = useMemo(
    () => store.inventory
      .filter((i) => i.branch === store.currentBranch && i.location === location)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [store.inventory, store.currentBranch, location],
  );

  // High-value = Spirits / Protein / anything with cost ≥ ₦2,000 per unit.
  // Standard short-list — the bartender/chef counts these first; everything
  // else is a "show all" expansion.
  const HIGH_VALUE_CATS = new Set(["Spirits", "Wine", "Protein", "Beer"]);
  const highValue = useMemo(
    () => items.filter((i) => HIGH_VALUE_CATS.has(i.category) || i.cost >= 2000),
    [items],
  );

  const [showAll, setShowAll] = useState(highValue.length === 0);
  const visible = showAll ? items : highValue;

  // counts[sku] → input string
  const [counts, setCounts] = useState<Record<string, string>>({});

  function setCount(sku: string, v: string) {
    setCounts((p) => ({ ...p, [sku]: v }));
  }

  // Compute live variance preview for the operator.
  const preview = useMemo(() => {
    const rows = Object.entries(counts)
      .filter(([, v]) => v !== "")
      .map(([sku, v]) => {
        const item = items.find((i) => i.sku === sku);
        if (!item) return null;
        const counted = Number(v) || 0;
        const variance = +(counted - item.onHand).toFixed(4);
        return { item, counted, variance, varianceCost: Math.abs(variance) * item.cost };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    const shorts = rows.filter((r) => r.variance < 0);
    const overs = rows.filter((r) => r.variance > 0);
    const totalShortageCost = shorts.reduce((s, r) => s + r.varianceCost, 0);
    return { rows, shorts, overs, totalShortageCost };
  }, [counts, items]);

  function submit() {
    const entries = Object.entries(counts).filter(([, v]) => v !== "");
    if (entries.length === 0) {
      toast.error("Count at least one item before closing");
      return;
    }
    // Each count → store.recordStockCount which handles variance + over-pour flag.
    const barShift = location === "bar" ? store.barShift() : undefined;
    for (const [sku, v] of entries) {
      const item = items.find((i) => i.sku === sku);
      if (!item) continue;
      const counted = Number(v);
      if (Number.isNaN(counted)) continue;
      const by = barShift && location === "bar"
        ? { name: barShift.staffName, shiftId: barShift.id }
        : { name: me };
      store.recordStockCount(item.sku, item.location, counted, by);
    }
    toast.success(
      preview.totalShortageCost > 0
        ? `Count saved · ${preview.shorts.length} shortfall${preview.shorts.length === 1 ? "" : "s"} flagged (₦${preview.totalShortageCost.toLocaleString()})`
        : `Count saved · ${entries.length} items reconciled · no variance`,
    );
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Closing count — ${LOCATION_NAME[location]}`}
      description="Count what's on the shelf right now. The system compares it to expected stock."
      size="xl"
      footer={
        <>
          <span className="mr-auto text-xs text-muted-foreground">
            {preview.rows.length} of {visible.length} counted
            {preview.totalShortageCost > 0 && (
              <span className="ml-2 text-destructive font-semibold">· ₦{preview.totalShortageCost.toLocaleString()} shortfall</span>
            )}
          </span>
          <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={submit}>Save count</ModalButton>
        </>
      }
    >
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No stock at {LOCATION_NAME[location]} yet.
          </p>
        ) : (
          <>
            {/* Toggle: short list (high-value only) vs full list */}
            {highValue.length > 0 && highValue.length < items.length && (
              <button
                type="button"
                onClick={() => setShowAll((s) => !s)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                {showAll ? "Show only high-value items" : `Show everything (${items.length})`}
                <ChevronRight className="h-3 w-3" />
              </button>
            )}

            {/* The count list. Each row: name + on-hand expected + count input + variance hint. */}
            <ul className="rounded-xl border border-border divide-y divide-border max-h-[60vh] overflow-y-auto">
              {visible.map((item) => {
                const raw = counts[item.sku];
                const counted = raw !== undefined && raw !== "" ? Number(raw) : null;
                const variance = counted != null ? +(counted - item.onHand).toFixed(4) : null;
                return (
                  <li key={item.sku} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        System says {fmtQty(item.onHand)} {item.unit}
                        {item.category && ` · ${item.category}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={raw ?? ""}
                        onChange={(e) => setCount(item.sku, e.target.value)}
                        placeholder="Count"
                        className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-[11px] text-muted-foreground w-10">{item.unit}</span>
                    </div>
                    {/* Variance preview chip — only when count entered */}
                    {variance != null && variance !== 0 && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 ${variance < 0 ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-foreground"}`}>
                        {variance < 0 && <AlertTriangle className="h-3 w-3" />}
                        {variance > 0 ? "+" : ""}{fmtQty(variance)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <p className="text-[11px] text-muted-foreground">
              <ClipboardCheck className="inline h-3 w-3 mr-1" />
              Shortfalls flag as over-pours / shrinkage and surface in <span className="font-medium text-foreground">Alerts</span>.
              Counts beyond expected stock are recorded too — could be uncounted receipts.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
