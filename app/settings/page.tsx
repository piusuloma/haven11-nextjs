"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { useAuth } from "@/lib/auth";
import { useStore, type TableRec } from "@/lib/store";
import { Plus, Pencil, Trash2, Layout, Building2, Tag, Users } from "lucide-react";

/**
 * Settings — the admin / onboarding surface. Today: **Tables** floor-plan
 * management. Designed to absorb additional setup sections (Categories,
 * Branches, Roles, Tax & VAT, Receipts) without growing nav clutter.
 *
 * Owner / Manager only.
 */
export default function Settings() {
  const { user } = useAuth();
  const canManage = user?.role === "owner" || user?.role === "manager";

  return (
    <AppShell title="Settings" subtitle="Floor plan, catalogue & onboarding for this branch">
      {!canManage ? (
        <p className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Settings is restricted to the owner and branch managers.
        </p>
      ) : (
        <div className="space-y-6">
          <TableManagement />

          {/* Quick links to other admin surfaces that already exist */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />Where to manage other things
            </h2>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <ShortcutLink href="/inventory" icon={Tag} title="Product categories" hint="Inventory → Filter → Manage categories" />
              <ShortcutLink href="/staff" icon={Users} title="Staff & roles" hint="Onboard, schedule, off-board" />
              <ShortcutLink href="/menu" icon={Layout} title="Menu items & recipes" hint="Items, recipes, pricing" />
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Branches, tax / VAT, receipt printer settings and full role definitions live in the onboarding flow — see PRD §26.
            </p>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function ShortcutLink({ href, icon: Icon, title, hint }: { href: string; icon: React.ComponentType<{ className?: string }>; title: string; hint: string }) {
  return (
    <a href={href} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-surface">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-surface text-primary"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </a>
  );
}

// ── Tables ───────────────────────────────────────────────────────────────────

function TableManagement() {
  const store = useStore();
  const [editing, setEditing] = useState<TableRec | null>(null);
  const [adding, setAdding] = useState(false);

  // Group tables by zone — matches how staff think about the floor plan.
  const grouped = useMemo(() => {
    const m = new Map<string, TableRec[]>();
    for (const t of store.tables) {
      const arr = m.get(t.zone) ?? [];
      arr.push(t);
      m.set(t.zone, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [store.tables]);

  const totalSeats = store.tables.reduce((s, t) => s + t.seats, 0);

  function remove(t: TableRec) {
    const res = store.removeTable(t.id);
    if (!res.ok) { toast.error(res.error ?? "Couldn't remove table"); return; }
    toast.success(`${t.label} removed`);
  }

  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Layout className="h-4 w-4 text-muted-foreground" />Floor plan — tables
          </h2>
          <p className="text-xs text-muted-foreground">
            {store.tables.length} tables · {totalSeats} seats · grouped by zone
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" />Add table
        </button>
      </header>

      {store.tables.length === 0 ? (
        <p className="p-10 text-center text-sm text-muted-foreground">No tables yet — add your first one.</p>
      ) : (
        <div className="p-5 space-y-5">
          {grouped.map(([zone, rows]) => (
            <div key={zone}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {zone} · {rows.length} table{rows.length === 1 ? "" : "s"} · {rows.reduce((s, t) => s + t.seats, 0)} seats
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {rows.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                    <div className="min-w-0">
                      <p className="font-medium">{t.label}</p>
                      <p className="text-[11px] text-muted-foreground">{t.seats} seats · {t.status}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditing(t)}
                        className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-surface hover:text-foreground"
                        aria-label={`Rename ${t.label}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => remove(t)}
                        disabled={t.status !== "available"}
                        title={t.status !== "available" ? `Can't remove a ${t.status} table` : "Remove table"}
                        className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                        aria-label={`Remove ${t.label}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {adding && <TableFormModal mode="add" onClose={() => setAdding(false)} />}
      {editing && <TableFormModal mode="edit" table={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function TableFormModal({ mode, table, onClose }: { mode: "add" | "edit"; table?: TableRec; onClose: () => void }) {
  const store = useStore();
  const [label, setLabel] = useState(table?.label ?? "");
  const [zone, setZone] = useState(table?.zone ?? "Indoor");
  const [seats, setSeats] = useState(String(table?.seats ?? 4));

  // Suggest existing zones to keep the floor plan consistent.
  const zones = useMemo(() => Array.from(new Set(store.tables.map((t) => t.zone))).sort(), [store.tables]);

  function submit() {
    if (mode === "add") {
      const res = store.addTable({ label, zone, seats: Number(seats) });
      if (!res.ok) { toast.error(res.error ?? "Couldn't add table"); return; }
      toast.success(`${res.table?.label} added to ${zone}`);
    } else if (table) {
      const res = store.updateTable(table.id, { label, zone, seats: Number(seats) });
      if (!res.ok) { toast.error(res.error ?? "Couldn't update"); return; }
      toast.success(`${label} updated`);
    }
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === "add" ? "Add table" : `Edit ${table?.label}`}
      description={mode === "add" ? "A spot on the floor plan — used by Front of House" : "Renames cascade through the floor plan; existing orders stay linked"}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>{mode === "add" ? "Add table" : "Save"}</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Table 12 · Bar 1 · Booth A" autoFocus className={inputCls} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Zone</span>
            <input
              list="zones"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              placeholder="Indoor / Terrace / Bar"
              className={inputCls}
            />
            <datalist id="zones">
              {zones.map((z) => <option key={z} value={z} />)}
            </datalist>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Seats</span>
            <input type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} className={inputCls} />
          </label>
        </div>
      </div>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
