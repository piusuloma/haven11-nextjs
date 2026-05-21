"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { ImportModal } from "@/components/ImportModal";
import { field } from "@/lib/csv";
import { useStore, fmtQty, type MenuItem, type MenuStatus, type RecipeLine } from "@/lib/store";
import { ChefHat, Pencil, Plus, Upload, Trash2 } from "lucide-react";

const CATEGORIES = ["Starters", "Mains", "Grill", "Sides", "Drinks", "Cocktails"];

const statusClass: Record<MenuStatus, string> = {
  Available: "bg-surface text-primary",
  "Sold out": "bg-destructive/10 text-destructive",
  "Coming soon": "bg-warning/15 text-foreground",
};

export default function Menu() {
  const store = useStore();
  const [catFilter, setCatFilter] = useState("All");
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [viewing, setViewing] = useState<MenuItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const cats = ["All", ...Array.from(new Set(store.menu.map((m) => m.category)))];
  const shown = catFilter === "All" ? store.menu : store.menu.filter((d) => d.category === catFilter);

  return (
    <AppShell title="Menu & Recipes" subtitle="Recipes link each dish to inventory — costs update live">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 overflow-x-auto">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${catFilter === c ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground/70 hover:bg-surface"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-surface"
          >
            <Upload className="h-3.5 w-3.5" />Import
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />New menu item
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {shown.map((d) => {
          const cost = store.recipeCost(d.recipe);
          const margin = d.price > 0 ? Math.round(((d.price - cost) / d.price) * 100) : 0;
          return (
            <article key={d.id} className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{d.category}</p>
                  <h3 className="mt-1 text-base font-semibold">{d.emoji} {d.name}</h3>
                  <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass[d.status]}`}>{d.status}</span>
                </div>
                <button onClick={() => setEditing(d)} aria-label={`Edit ${d.name}`} className="grid h-8 w-8 place-items-center rounded-md border border-border hover:bg-surface">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div><dt className="text-muted-foreground">Price</dt><dd className="mt-1 font-semibold tabular-nums">₦{d.price.toLocaleString()}</dd></div>
                <div><dt className="text-muted-foreground">Cost</dt><dd className="mt-1 font-semibold tabular-nums">₦{Math.round(cost).toLocaleString()}</dd></div>
                <div><dt className="text-muted-foreground">Margin</dt><dd className={`mt-1 font-semibold tabular-nums ${margin < 15 ? "text-destructive" : "text-primary"}`}>{margin}%</dd></div>
              </dl>
              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <ChefHat className="h-3.5 w-3.5" />{d.recipe.length} ingredient{d.recipe.length !== 1 ? "s" : ""}
                </span>
                <button onClick={() => setViewing(d)} className="font-medium text-primary hover:underline">View recipe →</button>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                <div className={`h-full ${margin < 15 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.max(0, Math.min(100, margin))}%` }} />
              </div>
            </article>
          );
        })}
      </section>

      {viewing && <RecipeModal item={viewing} onClose={() => setViewing(null)} />}
      {editing && <EditModal item={editing} onClose={() => setEditing(null)} />}
      <NewModal open={creating} onClose={() => setCreating(false)} />
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Bulk import menu items"
        description="Upload or paste a CSV — items match by name; link recipes afterwards via Edit"
        templateName="menu-template.csv"
        sample={{ Name: "Fried Rice", Category: "Mains", Price: 4000, Emoji: "🍛", Status: "Available" }}
        onImport={(rows) => {
          const items: MenuItem[] = [];
          rows.forEach((r, idx) => {
            const name = field(r, "Name", "Item");
            if (!name) return;
            const st = field(r, "Status");
            const status: MenuStatus = st === "Sold out" || st === "Coming soon" ? st : "Available";
            items.push({
              id: `m-${Date.now().toString(36)}-${idx}`,
              name,
              category: field(r, "Category") || "Mains",
              price: Number(field(r, "Price")) || 0,
              emoji: field(r, "Emoji", "Icon") || "🍽️",
              status,
              recipe: [],
            });
          });
          if (items.length === 0) return { added: 0, error: "No valid rows — check the column headers" };
          store.importMenu(items);
          return { added: items.length };
        }}
      />
    </AppShell>
  );
}

// ── Recipe viewer ────────────────────────────────────────────────────────────

function RecipeModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const store = useStore();
  const lines = item.recipe.map((r) => {
    const inv = store.inventory.find((i) => i.sku === r.sku);
    return {
      name: inv?.name ?? r.sku,
      qty: `${fmtQty(r.qty)} ${inv?.unit ?? ""}`,
      cost: inv ? Math.round(inv.cost * r.qty) : 0,
    };
  });
  const cost = store.recipeCost(item.recipe);
  const margin = item.price > 0 ? Math.round(((item.price - cost) / item.price) * 100) : 0;

  return (
    <Modal open onClose={onClose} title={`${item.name} — recipe`} description={`${item.category} · serves 1 · links to inventory`} size="lg">
      <div className="space-y-4">
        {lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recipe linked. This item won&apos;t deduct inventory when sold.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="font-medium py-2">Ingredient (inventory SKU)</th>
                <th className="font-medium py-2">Per serving</th>
                <th className="font-medium py-2 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.name} className="border-b border-border last:border-0">
                  <td className="py-2.5 font-medium">{l.name}</td>
                  <td className="py-2.5 text-muted-foreground">{l.qty}</td>
                  <td className="py-2.5 text-right tabular-nums">₦{l.cost.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="grid grid-cols-3 gap-3">
          <Box label="Recipe cost" value={`₦${Math.round(cost).toLocaleString()}`} />
          <Box label="Selling price" value={`₦${item.price.toLocaleString()}`} />
          <Box label="Margin" value={`${margin}%`} tone={margin < 15 ? "text-destructive" : "text-primary"} highlight />
        </div>
        <p className="text-xs text-muted-foreground">
          Every sale of this item deducts these quantities from inventory in real time.
        </p>
      </div>
    </Modal>
  );
}

// ── Edit ─────────────────────────────────────────────────────────────────────

interface EditLine { sku: string; qty: string }

function EditModal({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(String(item.price));
  const [status, setStatus] = useState<MenuStatus>(item.status);
  const [recipe, setRecipe] = useState<EditLine[]>(
    item.recipe.map((l) => ({ sku: l.sku, qty: String(l.qty) })),
  );

  const recipeLines: RecipeLine[] = recipe.map((l) => ({ sku: l.sku, qty: Number(l.qty) || 0 }));
  const cost = store.recipeCost(recipeLines);
  const p = Number(price) || 0;
  const margin = p > 0 ? Math.round(((p - cost) / p) * 100) : 0;

  function setLine(idx: number, patch: Partial<EditLine>) {
    setRecipe((r) => r.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    const firstSku = store.products[0]?.sku;
    if (!firstSku) { toast.error("No inventory items to link"); return; }
    setRecipe((r) => [...r, { sku: firstSku, qty: "" }]);
  }

  function save() {
    if (!name.trim()) { toast.error("Name cannot be empty"); return; }
    store.updateMenuItem({
      ...item,
      name: name.trim(),
      price: p,
      status,
      recipe: recipeLines.filter((l) => l.qty > 0),
    });
    toast.success(`${name.trim()} updated`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Edit ${item.name}`}
      description="Build the recipe — sales deduct these from inventory"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={save}>Save changes</ModalButton></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Item name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label="Selling price ₦"><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="Availability">
          <select value={status} onChange={(e) => setStatus(e.target.value as MenuStatus)} className={inputCls}>
            <option>Available</option><option>Sold out</option><option>Coming soon</option>
          </select>
        </Field>

        {/* Recipe builder */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recipe — linked inventory</p>
            <button onClick={addLine} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <Plus className="h-3 w-3" />Add ingredient
            </button>
          </div>
          {recipe.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              No ingredients linked — this item won&apos;t deduct stock when sold.
            </p>
          ) : (
            <div className="space-y-1.5">
              {recipe.map((line, idx) => {
                const inv = store.inventory.find((i) => i.sku === line.sku);
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <select value={line.sku} onChange={(e) => setLine(idx, { sku: e.target.value })} className={`${inputCls} flex-1`}>
                      {store.products.map((i) => <option key={i.sku} value={i.sku}>{i.name}</option>)}
                    </select>
                    <input
                      type="number"
                      value={line.qty}
                      onChange={(e) => setLine(idx, { qty: e.target.value })}
                      placeholder="qty"
                      className={`${inputCls} w-24`}
                    />
                    <span className="w-10 text-xs text-muted-foreground">{inv?.unit}</span>
                    <button
                      onClick={() => setRecipe((r) => r.filter((_, i) => i !== idx))}
                      aria-label="Remove ingredient"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-surface/60 border border-border p-3 flex justify-between text-sm">
          <span className="text-muted-foreground">Recipe cost ₦{Math.round(cost).toLocaleString()} → margin</span>
          <span className={`font-bold ${margin < 15 ? "text-destructive" : "text-primary"}`}>{margin}%</span>
        </div>
      </div>
    </Modal>
  );
}

// ── New ──────────────────────────────────────────────────────────────────────

function NewModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[1]);
  const [price, setPrice] = useState("");
  const [emoji, setEmoji] = useState("🍽️");

  function submit() {
    if (!name.trim()) { toast.error("Enter an item name"); return; }
    store.addMenuItem({
      id: `m-${Date.now().toString(36)}`,
      name: name.trim(),
      category,
      price: Number(price) || 0,
      emoji: emoji || "🍽️",
      status: "Available",
      recipe: [],
    });
    toast.success(`${name.trim()} added — appears in POS instantly`);
    setName(""); setPrice(""); setEmoji("🍽️"); setCategory(CATEGORIES[1]);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New menu item"
      description="It becomes orderable in the POS right away"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Add item</ModalButton></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[4rem_1fr] gap-3">
          <Field label="Icon"><input value={emoji} onChange={(e) => setEmoji(e.target.value)} className={`${inputCls} text-center`} /></Field>
          <Field label="Item name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fried Rice" className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Selling price ₦"><input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className={inputCls} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">
          You can link inventory ingredients to this item&apos;s recipe afterwards so sales deduct stock.
        </p>
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

function Box({ label, value, tone, highlight }: { label: string; value: string; tone?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${highlight ? "bg-primary/5 border-primary/20" : "bg-surface/60 border-border"}`}>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
