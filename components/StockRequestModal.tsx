"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, X, CheckSquare, Square } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  useStore, fmtQty, LOCATION_NAME,
  type StockLocation,
} from "@/lib/store";
import { Modal, ModalButton } from "@/components/Modal";

/**
 * Raise an internal stock request — the Kitchen / Bar / Juice Bar asking the
 * branch Main Store to issue goods into their own sub-store.
 *
 * UX: a checklist picker rather than a "+ add row" loop. Operators routinely
 * request 30–50 items at once, so the modal shows the full Main Store as a
 * single scrollable list with a search box, category chips, and per-row
 * checkboxes that reveal a qty input when ticked.
 */
export function StockRequestModal({ toLocation, onClose }: { toLocation: StockLocation; onClose: () => void }) {
  const store = useStore();
  const { user } = useAuth();
  const storeItems = store.inventory.filter(
    (i) => i.branch === store.currentBranch && i.location === "store",
  );

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  // sku → quantity string. Presence in the map = ticked.
  const [picked, setPicked] = useState<Record<string, string>>({});

  // Only show categories that have at least one item in the Main Store.
  const presentCategories = useMemo(() => {
    const set = new Set<string>(storeItems.map((i) => i.category));
    return ["All", ...store.inventoryCategories.filter((c) => set.has(c))];
  }, [storeItems, store.inventoryCategories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return storeItems.filter((i) => {
      const matchesQ = !q
        || i.name.toLowerCase().includes(q)
        || i.sku.toLowerCase().includes(q)
        || i.category.toLowerCase().includes(q);
      const matchesCat = category === "All" || i.category === category;
      return matchesQ && matchesCat;
    });
  }, [storeItems, query, category]);

  // Group the filtered list by category so 50-row picks stay scannable.
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
  function clearAll() {
    setPicked({});
  }

  const pickedCount = Object.keys(picked).length;
  const readyCount = Object.values(picked).filter((q) => Number(q) > 0).length;
  const totalQty = Object.entries(picked)
    .reduce((s, [, q]) => s + (Number(q) || 0), 0);
  const allVisibleTicked = filtered.length > 0 && filtered.every((i) => i.sku in picked);

  function submit() {
    const lines = Object.entries(picked)
      .filter(([, q]) => Number(q) > 0)
      .map(([sku, q]) => ({ sku, qty: Number(q) }));
    if (lines.length === 0) {
      toast.error(pickedCount > 0 ? "Enter a quantity for the ticked items" : "Tick at least one item");
      return;
    }
    const req = store.requestStock({ toLocation, lines, by: user?.name ?? "Unknown" });
    toast.success(`${req.id} · ${lines.length} item${lines.length !== 1 ? "s" : ""} requested from the Main Store`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Request stock — ${LOCATION_NAME[toLocation]}`}
      description="Tick the items you need, enter the quantity, send one request"
      size="xl"
      footer={
        <>
          <span className="mr-auto text-xs text-muted-foreground tabular-nums">
            {pickedCount === 0 ? "No items selected" : `${readyCount}/${pickedCount} ready · ${fmtQty(totalQty)} total units`}
          </span>
          <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={submit}>Send request</ModalButton>
        </>
      }
    >
      {storeItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">The Main Store has no stock to request.</p>
      ) : (
        <div className="space-y-3">
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
                              <span className="font-mono">{it.sku}</span> · on hand {fmtQty(it.onHand)} {it.unit}
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
