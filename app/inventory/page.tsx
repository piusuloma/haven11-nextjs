"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { WasteModal } from "@/components/WasteModal";
import { ImportModal } from "@/components/ImportModal";
import { StockRequestModal } from "@/components/StockRequestModal";
import { exportCsv } from "@/lib/export";
import { field } from "@/lib/csv";
import { useAuth } from "@/lib/auth";
import {
  useStore, statusOf, fmtQty, daysUntil, LOCATION_NAME, HUB_ID,
  asCategory,
  type InventoryItem, type InventoryCategory, type Line, type StockLocation,
} from "@/lib/store";
import { CategoryManagerModal } from "@/components/CategoryManagerModal";
import { Search, Filter, Download, Upload, AlertTriangle, Plus, PackagePlus, ClipboardCheck, Trash2, ShieldAlert, CalendarClock, ArrowLeftRight, PackageCheck } from "lucide-react";

const LINES: Line[] = ["Kitchen", "Bar", "Juice Bar", "Lounge"];
const LOCATIONS: StockLocation[] = ["store", "kitchen", "bar", "juice-bar"];

const statusClass = {
  OK: "bg-surface text-primary",
  Low: "bg-warning/15 text-foreground",
  Out: "bg-destructive/10 text-destructive",
} as const;

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

export default function Inventory() {
  const store = useStore();
  const { user } = useAuth();
  const [loc, setLoc] = useState<StockLocation>("store");
  const [query, setQuery] = useState("");
  const [lineFilter, setLineFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [wasteOpen, setWasteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const canManageCategories = user?.role === "owner" || user?.role === "manager";

  const isHub = store.currentBranch === HUB_ID;
  const locTabs: StockLocation[] = isHub ? ["store"] : LOCATIONS;
  const activeLoc: StockLocation = locTabs.includes(loc) ? loc : "store";

  // Inventory is per-branch and per-location.
  const branchInv = useMemo(
    () => store.inventory.filter((i) => i.branch === store.currentBranch && i.location === activeLoc),
    [store.inventory, store.currentBranch, activeLoc],
  );
  const branchCounts = store.counts.filter((c) => c.branch === store.currentBranch && c.location === activeLoc);
  const branchWaste = store.waste.filter((w) => w.branch === store.currentBranch && w.location === activeLoc);
  const branchBatches = store.batches
    .filter((b) => b.branch === store.currentBranch)
    .slice()
    .sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry));
  const branchRequests = store.stockRequests.filter((r) => r.branch === store.currentBranch);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return branchInv.filter((s) => {
      // Free-text search matches name, SKU, *or* category — typing "spice"
      // surfaces Suya Spice; typing "protein" surfaces all proteins.
      const matchesQuery = !q
        || s.name.toLowerCase().includes(q)
        || s.sku.toLowerCase().includes(q)
        || s.category.toLowerCase().includes(q);
      const matchesLine = lineFilter === "All" || s.line === lineFilter;
      const matchesStatus = statusFilter === "All" || statusOf(s) === statusFilter;
      const matchesCategory = categoryFilter === "All" || s.category === categoryFilter;
      return matchesQuery && matchesLine && matchesStatus && matchesCategory;
    });
  }, [branchInv, query, lineFilter, statusFilter, categoryFilter]);

  const lowCount = branchInv.filter((s) => statusOf(s) === "Low").length;
  const outCount = branchInv.filter((s) => statusOf(s) === "Out").length;
  const stockValue = branchInv.reduce((sum, s) => sum + s.onHand * s.cost, 0);
  const activeFilters =
    (lineFilter !== "All" ? 1 : 0)
    + (statusFilter !== "All" ? 1 : 0)
    + (categoryFilter !== "All" ? 1 : 0);
  // Only show categories that actually appear in this location, plus "All".
  const presentCategories = useMemo(() => {
    const set = new Set<string>(branchInv.map((i) => i.category));
    return ["All", ...store.inventoryCategories.filter((c) => set.has(c))];
  }, [branchInv, store.inventoryCategories]);

  function handleExport() {
    exportCsv(
      `inventory-${activeLoc}-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((s) => ({
        SKU: s.sku, Item: s.name, Category: s.category, Location: LOCATION_NAME[s.location], Line: s.line,
        "On hand": fmtQty(s.onHand), Unit: s.unit, Reorder: s.reorder, "Unit cost": s.cost,
        "Stock value": Math.round(s.onHand * s.cost), Status: statusOf(s),
      })),
    );
    toast.success(`Exported ${filtered.length} items to CSV`);
  }

  return (
    <AppShell title="Inventory" subtitle={`${store.branchName(store.currentBranch)} · ${LOCATION_NAME[activeLoc]}`}>
      {/* Location tabs — Main Store + Kitchen / Bar / Juice Bar sub-stores */}
      {locTabs.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {locTabs.map((l) => (
            <button
              key={l}
              onClick={() => { setLoc(l); setStatusFilter("All"); }}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${activeLoc === l ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground/70 hover:bg-surface"}`}
            >
              {LOCATION_NAME[l]}
            </button>
          ))}
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Total SKUs", v: String(branchInv.length) },
          { l: "Low stock", v: String(lowCount), tone: "text-warning", onClick: () => setStatusFilter("Low") },
          { l: "Out of stock", v: String(outCount), tone: "text-destructive", onClick: () => setStatusFilter("Out") },
          { l: "Stock value", v: `₦${(stockValue / 1_000_000).toFixed(2)}M` },
        ].map((s) => (
          <div
            key={s.l}
            onClick={s.onClick}
            className={`rounded-xl border border-border bg-card p-5 ${s.onClick ? "cursor-pointer hover:bg-surface transition-colors" : ""}`}
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</p>
          </div>
        ))}
      </section>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 w-64">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search SKU or item…"
              className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setFilterOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-surface">
                <Filter className="h-3.5 w-3.5" />Filter
                {activeFilters > 0 && <span className="grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{activeFilters}</span>}
              </button>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border bg-card shadow-xl z-20 p-3 space-y-3">
                    <FilterGroup label="Category" value={categoryFilter} options={presentCategories} onChange={setCategoryFilter} />
                    <FilterGroup label="Line" value={lineFilter} options={["All", ...LINES]} onChange={setLineFilter} />
                    <FilterGroup label="Status" value={statusFilter} options={["All", "OK", "Low", "Out"]} onChange={setStatusFilter} />
                    {activeFilters > 0 && (
                      <button onClick={() => { setLineFilter("All"); setStatusFilter("All"); setCategoryFilter("All"); }} className="w-full rounded-md border border-border py-1.5 text-xs font-medium hover:bg-surface">
                        Clear filters
                      </button>
                    )}
                    {canManageCategories && (
                      <button
                        onClick={() => { setManageCategoriesOpen(true); setFilterOpen(false); }}
                        className="block w-full pt-1 text-left text-[11px] font-medium text-primary hover:underline"
                      >
                        Manage categories →
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setWasteOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-surface">
              <Trash2 className="h-3.5 w-3.5" />Waste
            </button>
            <button onClick={handleExport} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-surface">
              <Download className="h-3.5 w-3.5" />Export
            </button>
            <button onClick={() => setImportOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-surface">
              <Upload className="h-3.5 w-3.5" />Import
            </button>
            {activeLoc === "store" ? (
              <button onClick={() => setNewOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                <Plus className="h-3.5 w-3.5" />New product
              </button>
            ) : (
              <span className="text-[11px] italic text-muted-foreground">
                Stocked from the Main Store · products are defined there
              </span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border bg-surface/40">
                <th className="font-medium px-5 py-2.5">SKU</th>
                <th className="font-medium px-5 py-2.5">Item</th>
                <th className="font-medium px-5 py-2.5">Line</th>
                <th className="font-medium px-5 py-2.5 text-right">On hand</th>
                <th className="font-medium px-5 py-2.5 text-right">Reorder</th>
                <th className="font-medium px-5 py-2.5">Status</th>
                <th className="font-medium px-5 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No items in {LOCATION_NAME[activeLoc]} match your search</td></tr>
              ) : filtered.map((r) => {
                const status = statusOf(r);
                return (
                  <tr key={`${r.location}:${r.sku}`} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{r.sku}</td>
                    <td className="px-5 py-3">
                      <span className="font-medium">{r.name}</span>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter(r.category)}
                        className="ml-2 inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-foreground/70 hover:bg-primary/10 hover:text-primary"
                        title={`Filter by ${r.category}`}
                      >
                        {r.category}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{r.line}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span>{fmtQty(r.onHand)} {r.unit}</span>
                      {r.altUnit && r.altOnHand != null && (
                        <span className="block text-[11px] font-normal text-muted-foreground">≈ {fmtQty(r.altOnHand)} {r.altUnit}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">{fmtQty(r.reorder)} {r.unit}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[status]}`}>
                        {status !== "OK" && <AlertTriangle className="h-3 w-3" />}{status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setAdjusting(r)} className="text-xs font-medium text-primary hover:underline">Adjust</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Internal stock requests — Main Store issues stock into Kitchen / Bar / Juice Bar */}
      {!isHub && (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />Internal stock requests
            </h2>
            {activeLoc !== "store" && (
              <button onClick={() => setRequestOpen(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                <PackagePlus className="h-3.5 w-3.5" />Request {LOCATION_NAME[activeLoc]} stock
              </button>
            )}
          </div>
          {branchRequests.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No internal requests yet. The Kitchen, Bar &amp; Juice Bar request stock from the Main Store here.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {branchRequests.slice(0, 8).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium">
                      <span className="font-mono text-xs text-muted-foreground">{r.id}</span> · Main Store → {LOCATION_NAME[r.toLocation]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.lines.length} item{r.lines.length !== 1 ? "s" : ""} · {r.requestedBy} · {timeAgo(r.requestedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.status === "Requested" ? "bg-warning/15 text-foreground" : "bg-surface text-primary"}`}>{r.status}</span>
                    {r.status === "Requested" && (
                      <button
                        onClick={() => { store.issueStockRequest(r.id, user?.name ?? "Unknown"); toast.success(`${r.id} issued to ${LOCATION_NAME[r.toLocation]}`); }}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        <PackageCheck className="h-3.5 w-3.5" />Issue from Main Store
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Variance & waste log — the audit trail of losses, attributed to staff */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowActivity((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-surface"
        >
          {showActivity ? "Hide activity log" : "Show activity log"}
        </button>
      </div>

      {showActivity && (
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />Stock-count variance
          </h2>
          {branchCounts.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No counts yet for {LOCATION_NAME[activeLoc]}. Use <span className="font-medium text-foreground">Adjust → Stock count</span>.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {branchCounts.slice(0, 6).map((c) => (
                <li key={c.id} className={`rounded-lg border p-3 text-sm ${c.overPour ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.name}</span>
                    <span className={`tabular-nums font-bold ${c.variance < 0 ? "text-destructive" : c.variance > 0 ? "text-foreground" : "text-primary"}`}>
                      {c.variance > 0 ? "+" : ""}{fmtQty(c.variance)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.overPour && <span className="font-semibold text-destructive">Over-pour · </span>}
                    {c.variance !== 0 && `₦${Math.abs(c.varianceCost).toLocaleString()} ${c.variance < 0 ? "loss" : "gain"} · `}
                    {c.staffName} · {timeAgo(c.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-muted-foreground" />Waste log
          </h2>
          {branchWaste.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No waste recorded for {LOCATION_NAME[activeLoc]} yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {branchWaste.slice(0, 6).map((w) => (
                <li key={w.id} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                  {w.photoDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.photoDataUrl} alt={w.photoName ?? "Waste photo"} className="h-12 w-12 shrink-0 rounded-md object-cover" />
                  ) : w.photoName ? (
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-surface text-muted-foreground text-lg" title={w.photoName}>📎</span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{fmtQty(w.qty)} {w.unit} {w.name}</span>
                      <span className="tabular-nums font-bold text-destructive shrink-0">₦{w.cost.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{w.reason} · {w.staffName} · {timeAgo(w.at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      )}

      {/* Batch & expiry — oldest stock first (FIFO) */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />Batch &amp; expiry · use oldest stock first
        </h2>
        {branchBatches.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No tracked batches. Capture a batch &amp; expiry date when receiving a purchase order.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {branchBatches.map((b) => {
              const d = daysUntil(b.expiry);
              const cls = d <= 7
                ? "border-destructive/30 bg-destructive/5"
                : d <= 14
                  ? "border-warning/40 bg-warning/10"
                  : "border-border";
              const label = d < 0 ? `${-d}d overdue` : d === 0 ? "expires today" : `expires in ${d}d`;
              return (
                <div key={b.id} className={`rounded-lg border p-3 text-sm ${cls}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{fmtQty(b.qty)} {b.unit}</span>
                  </div>
                  <p className={`text-xs mt-0.5 ${d <= 7 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {b.expiry} · {label}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <NewSkuModal open={newOpen} onClose={() => setNewOpen(false)} location={activeLoc} />
      <WasteModal open={wasteOpen} onClose={() => setWasteOpen(false)} location={activeLoc} />
      {requestOpen && activeLoc !== "store" && (
        <StockRequestModal toLocation={activeLoc} onClose={() => setRequestOpen(false)} />
      )}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={`Bulk import — ${LOCATION_NAME[activeLoc]}`}
        description="Upload or paste a CSV — existing SKUs are updated, new ones added"
        templateName="inventory-template.csv"
        sample={{ SKU: "BAR-099", Item: "Tonic Water", Category: "Mixers", Line: "Bar", "On hand": 24, Unit: "btl", Reorder: 12, "Unit cost": 650 }}
        onImport={(rows) => {
          const items: InventoryItem[] = [];
          rows.forEach((r, idx) => {
            const name = field(r, "Item", "Name");
            if (!name) return;
            const lineRaw = field(r, "Line");
            const line: Line = lineRaw === "Bar" || lineRaw === "Lounge" || lineRaw === "Juice Bar" ? lineRaw : "Kitchen";
            const prefix = line === "Bar" ? "BAR" : line === "Lounge" ? "LNG" : line === "Juice Bar" ? "JUC" : "KIT";
            items.push({
              sku: field(r, "SKU") || `${prefix}-${String(store.inventory.length + idx + 1).padStart(3, "0")}`,
              branch: store.currentBranch,
              location: activeLoc,
              name,
              line,
              category: asCategory(field(r, "Category"), store.inventoryCategories),
              onHand: Number(field(r, "On hand", "OnHand", "Quantity")) || 0,
              reorder: Number(field(r, "Reorder", "Reorder level")) || 0,
              unit: field(r, "Unit") || "pcs",
              cost: Number(field(r, "Unit cost", "Cost")) || 0,
            });
          });
          if (items.length === 0) return { added: 0, error: "No valid rows — check the column headers" };
          store.importInventory(items);
          return { added: items.length };
        }}
      />
      {adjusting && <AdjustModal item={adjusting} onClose={() => setAdjusting(null)} />}
      {manageCategoriesOpen && <CategoryManagerModal onClose={() => setManageCategoriesOpen(false)} />}
    </AppShell>
  );
}

function FilterGroup({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`rounded-md px-2 py-1 text-xs font-medium ${value === o ? "bg-primary text-primary-foreground" : "bg-surface text-foreground/70 hover:text-foreground"}`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── New SKU ──────────────────────────────────────────────────────────────────

function NewSkuModal({ open, onClose, location }: { open: boolean; onClose: () => void; location: StockLocation }) {
  const store = useStore();
  const { user } = useAuth();
  const canManageCategories = user?.role === "owner" || user?.role === "manager";
  const [name, setName] = useState("");
  const [line, setLine] = useState<Line>("Kitchen");
  const [category, setCategory] = useState<InventoryCategory>(store.inventoryCategories[0] ?? "Other");
  const [onHand, setOnHand] = useState("");
  const [reorder, setReorder] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [altUnit, setAltUnit] = useState("");
  const [cost, setCost] = useState("");
  const [manageOpen, setManageOpen] = useState(false);

  // No-duplicates safeguard: a product is identified by name across the whole
  // catalogue (every branch + sub-store reuses the same definition).
  const trimmed = name.trim();
  const duplicate = trimmed
    ? store.inventory.find((i) => i.name.toLowerCase() === trimmed.toLowerCase())
    : undefined;

  function submit() {
    if (!trimmed) { toast.error("Enter an item name"); return; }
    if (duplicate) {
      toast.error(`"${duplicate.name}" already exists — adjust its stock instead of creating a new product`);
      return;
    }
    const prefix = line === "Bar" ? "BAR" : line === "Lounge" ? "LNG" : line === "Juice Bar" ? "JUC" : "KIT";
    const item: InventoryItem = {
      sku: `${prefix}-${String(store.inventory.length + 1).padStart(3, "0")}`,
      branch: store.currentBranch,
      location,
      name: trimmed, line, category,
      onHand: Number(onHand) || 0, reorder: Number(reorder) || 0,
      unit, cost: Number(cost) || 0,
      ...(altUnit ? { altUnit, altOnHand: 0 } : {}),
    };
    store.addInventoryItem(item);
    toast.success(`${item.name} added to ${store.branchName(store.currentBranch)} · ${LOCATION_NAME[location]}`);
    setName(""); setOnHand(""); setReorder(""); setCost(""); setUnit("pcs"); setAltUnit(""); setLine("Kitchen");
    setCategory(store.inventoryCategories[0] ?? "Other");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New product"
      description="Defined once in the Main Store catalogue — Kitchen, Bar & Juice Bar reuse the same record"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={submit} disabled={!!duplicate || !trimmed}>Add product</ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Item name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tomato Paste 400g" className={inputCls} /></Field>
        {duplicate && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">&quot;{duplicate.name}&quot; is already in the catalogue</p>
              <p className="mt-0.5 text-muted-foreground">
                Tracked as <span className="font-mono">{duplicate.sku}</span> in {LOCATION_NAME[duplicate.location]} ·
                use <span className="font-medium text-foreground">Adjust → Receive stock</span> to add more, or request it into a sub-store.
              </p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Category</span>
              {canManageCategories && (
                <button
                  type="button"
                  onClick={() => setManageOpen(true)}
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Manage…
                </button>
              )}
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as InventoryCategory)}
              className={`${inputCls} mt-1`}
            >
              {store.inventoryCategories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <Field label="Line">
            <select value={line} onChange={(e) => setLine(e.target.value as Line)} className={inputCls}>
              {LINES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Primary unit (used in recipes)">
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
            {["pcs", "kg", "L", "btl", "bunch", "cans", "bag"].map((u) => <option key={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Also count in (optional — e.g. yam in kg + pcs)">
          <select value={altUnit} onChange={(e) => setAltUnit(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {["pcs", "kg", "L", "btl", "bunch", "cans", "bag"].filter((u) => u !== unit).map((u) => <option key={u}>{u}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="On hand"><input type="number" value={onHand} onChange={(e) => setOnHand(e.target.value)} placeholder="0" className={inputCls} /></Field>
          <Field label="Reorder at"><input type="number" value={reorder} onChange={(e) => setReorder(e.target.value)} placeholder="0" className={inputCls} /></Field>
          <Field label="Unit cost ₦"><input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" className={inputCls} /></Field>
        </div>
      </div>
      {manageOpen && <CategoryManagerModal onClose={() => setManageOpen(false)} />}
    </Modal>
  );
}

// ── Adjust stock ─────────────────────────────────────────────────────────────

function AdjustModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const store = useStore();
  const { user } = useAuth();
  const [mode, setMode] = useState<"receive" | "count">("receive");
  const [amount, setAmount] = useState("");
  const [altAmount, setAltAmount] = useState("");

  const amt = Number(amount) || 0;
  const projected = mode === "receive" ? item.onHand + amt : amt;
  const variance = +(projected - item.onHand).toFixed(4);
  const barShift = store.barShift();
  const isBarStore = item.location === "bar";
  const willAttributeTo = isBarStore && barShift ? barShift.staffName : user?.name ?? "you";

  function save() {
    if (mode === "receive") {
      if (amt <= 0) { toast.error("Enter a quantity to receive"); return; }
      const altAmt = item.altUnit && Number(altAmount) > 0 ? Number(altAmount) : undefined;
      store.receiveStock(item.sku, item.location, amt, altAmt);
      const altText = altAmt ? ` (${fmtQty(altAmt)} ${item.altUnit})` : "";
      toast.success(`Received ${fmtQty(amt)} ${item.unit}${altText} ${item.name}`);
    } else {
      const by = isBarStore && barShift
        ? { name: barShift.staffName, shiftId: barShift.id }
        : { name: user?.name ?? "Unknown" };
      const result = store.recordStockCount(item.sku, item.location, amt, by);
      if (result.overPour) {
        toast.warning(`Over-pour flagged to ${result.staffName} · ${fmtQty(result.variance)} ${item.unit} (₦${Math.abs(result.varianceCost).toLocaleString()})`);
      } else if (result.variance === 0) {
        toast.success(`${item.name} counted · no variance`);
      } else {
        toast.warning(`${item.name} variance ${fmtQty(result.variance)} ${item.unit} logged`);
      }
    }
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={item.name}
      description={`${item.sku} · ${LOCATION_NAME[item.location]} · ${fmtQty(item.onHand)} ${item.unit} on hand`}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={save}>Save adjustment</ModalButton></>}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <button onClick={() => setMode("receive")} className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${mode === "receive" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-surface"}`}>
            <PackagePlus className="h-4 w-4" /> Receive stock
          </button>
          <button onClick={() => setMode("count")} className={`flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${mode === "count" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-surface"}`}>
            <ClipboardCheck className="h-4 w-4" /> Stock count
          </button>
        </div>

        <Field label={mode === "receive" ? `Quantity received (${item.unit})` : `Counted quantity (${item.unit})`}>
          <input type="number" inputMode="decimal" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus className={inputCls} />
        </Field>

        {mode === "receive" && item.altUnit && (
          <Field label={`Also count in ${item.altUnit} (optional)`}>
            <input type="number" inputMode="decimal" step="any" value={altAmount} onChange={(e) => setAltAmount(e.target.value)} placeholder={item.altOnHand != null ? `currently ≈ ${fmtQty(item.altOnHand)} ${item.altUnit}` : "0"} className={inputCls} />
          </Field>
        )}

        <div className="rounded-xl bg-surface/60 border border-border p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Current</span><span className="tabular-nums font-medium">{fmtQty(item.onHand)} {item.unit}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">After adjustment</span><span className="tabular-nums font-medium">{fmtQty(Math.max(0, projected))} {item.unit}</span></div>
          <div className="flex justify-between border-t border-border pt-2">
            <span className="text-muted-foreground">Variance</span>
            <span className={`tabular-nums font-bold ${variance < 0 ? "text-destructive" : variance > 0 ? "text-primary" : ""}`}>
              {variance > 0 ? "+" : ""}{fmtQty(variance)} {item.unit}
            </span>
          </div>
        </div>
        {mode === "count" && (
          <p className="text-xs text-muted-foreground">
            Variance will be attributed to <span className="font-semibold text-foreground">{willAttributeTo}</span>
            {isBarStore && barShift && " (bartender on shift)"}.
            {isBarStore && variance < 0 && <span className="text-destructive"> A shortfall is flagged as over-pour.</span>}
          </p>
        )}
      </div>
    </Modal>
  );
}

// ── Shared ───────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
