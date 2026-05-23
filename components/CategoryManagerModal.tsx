"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { Modal, ModalButton } from "@/components/Modal";

/**
 * Curate the inventory category vocabulary. Owner/manager only — the caller is
 * responsible for the role gate. Mirrors the Linear/Notion pattern: add, rename,
 * delete in one focused list. A category in use by any product cannot be
 * deleted; you must reassign those products first.
 */
export function CategoryManagerModal({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Count how many *distinct products* (by SKU) use each category, so the
  // operator sees the impact before they delete or rename.
  const counts = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const i of store.inventory) {
      const set = m.get(i.category) ?? new Set<string>();
      set.add(i.sku);
      m.set(i.category, set);
    }
    return Object.fromEntries(Array.from(m.entries()).map(([k, v]) => [k, v.size]));
  }, [store.inventory]);

  function addNew() {
    const res = store.addCategory(draft);
    if (!res.ok) { toast.error(res.error ?? "Couldn't add category"); return; }
    toast.success(`"${draft.trim()}" added`);
    setDraft("");
  }

  function startEdit(name: string) {
    setEditing(name);
    setEditValue(name);
  }

  function commitEdit() {
    if (!editing) return;
    const res = store.renameCategory(editing, editValue);
    if (!res.ok) { toast.error(res.error ?? "Couldn't rename"); return; }
    if (editing !== editValue.trim()) {
      toast.success(`Renamed to "${editValue.trim()}"`);
    }
    setEditing(null);
    setEditValue("");
  }

  function remove(name: string) {
    const res = store.removeCategory(name);
    if (!res.ok) { toast.error(res.error ?? "Couldn't delete"); return; }
    toast.success(`"${name}" deleted`);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Manage categories"
      description="Categories help search and group the product catalogue — used by Inventory and the stock-request picker."
      footer={<ModalButton onClick={onClose}>Done</ModalButton>}
    >
      <div className="space-y-4">
        {/* Add new */}
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNew(); } }}
            placeholder="New category name…"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={addNew}
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" />Add
          </button>
        </div>

        {/* List */}
        <ul className="max-h-[50vh] overflow-y-auto rounded-xl border border-border divide-y divide-border">
          {store.inventoryCategories.length === 0 ? (
            <li className="p-6 text-center text-sm text-muted-foreground">No categories yet — add one above.</li>
          ) : (
            store.inventoryCategories.map((c) => {
              const count = counts[c] ?? 0;
              const isEditing = editing === c;
              return (
                <li key={c} className="flex items-center gap-2 px-3 py-2">
                  {isEditing ? (
                    <>
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                          if (e.key === "Escape") { setEditing(null); setEditValue(""); }
                        }}
                        autoFocus
                        className="flex-1 rounded-md border border-primary bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button onClick={commitEdit} aria-label="Save" className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { setEditing(null); setEditValue(""); }} aria-label="Cancel" className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{c}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {count} product{count !== 1 ? "s" : ""}
                      </span>
                      <button
                        onClick={() => startEdit(c)}
                        aria-label={`Rename ${c}`}
                        className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(c)}
                        disabled={count > 0}
                        title={count > 0 ? "Reassign its products before deleting" : "Delete category"}
                        aria-label={`Delete ${c}`}
                        className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </li>
              );
            })
          )}
        </ul>

        <p className="text-[11px] text-muted-foreground">
          Renaming a category cascades to every product using it. Deletion is blocked while a category is in use — reassign the products to another category first.
        </p>
      </div>
    </Modal>
  );
}
