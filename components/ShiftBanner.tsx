"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Clock, Play, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore, fmtQty, type ShiftRole } from "@/lib/store";
import { Modal, ModalButton } from "@/components/Modal";

function elapsed(from: number): string {
  const mins = Math.max(0, Math.round((Date.now() - from) / 60000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}

function hhmm(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Clock-in / clock-out banner. Render at the top of a role's home page. */
export function ShiftBanner() {
  const { user } = useAuth();
  const store = useStore();
  const [startOpen, setStartOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  if (!store.hydrated || !user) return null;

  const role: ShiftRole = user.role === "bartender" ? "bartender" : "cashier";
  const shift = store.activeShift(user.id);

  if (!shift) {
    return (
      <>
        <div className="rounded-2xl border-2 border-dashed border-border bg-card p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface text-primary">
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">You are not clocked in</p>
              <p className="text-xs text-muted-foreground">Start a shift to take orders and track your drawer</p>
            </div>
          </div>
          <button
            onClick={() => setStartOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Play className="h-4 w-4" />Start shift
          </button>
        </div>
        {startOpen && (
          <StartShiftModal
            onClose={() => setStartOpen(false)}
            onConfirm={(float, period) => {
              store.openShift({ id: user.id, name: user.name }, role, float, period);
              setStartOpen(false);
              toast.success(`${period} started · float ₦${float.toLocaleString()}`);
            }}
          />
        )}
      </>
    );
  }

  const sales = store.shiftSales(shift.id);
  const orders = store.orders.filter((o) => o.shiftId === shift.id).length;
  const wasteCount = store.waste.filter((w) => w.shiftId === shift.id).length;

  return (
    <>
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Clock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">On shift · {elapsed(shift.openedAt)}</p>
            <p className="text-xs text-muted-foreground">
              Since {hhmm(shift.openedAt)} · {orders} orders · ₦{sales.toLocaleString()} sales
              {wasteCount > 0 && ` · ${wasteCount} waste logged`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setCloseOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-surface"
        >
          <Wallet className="h-4 w-4" />Close shift
        </button>
      </div>
      {closeOpen && <CloseShiftModal shiftId={shift.id} onClose={() => setCloseOpen(false)} />}
    </>
  );
}

// ── Start shift ──────────────────────────────────────────────────────────────

/** A branch can run one shift a day or several — staff pick the period on clock-in. */
const SHIFT_PERIODS = ["Full day", "1st shift", "2nd shift", "3rd shift"];

function StartShiftModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (float: number, period: string) => void }) {
  const [float, setFloat] = useState("50000");
  const [period, setPeriod] = useState(SHIFT_PERIODS[0]);
  const fieldCls = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-1 focus:ring-primary";
  return (
    <Modal
      open
      onClose={onClose}
      title="Start shift"
      description="Pick your shift period and count the cash in your drawer"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={() => onConfirm(Number(float) || 0, period)}>Clock in</ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Shift period</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={fieldCls}>
            {SHIFT_PERIODS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Use &ldquo;Full day&rdquo; for a single-shift branch, or 1st / 2nd / 3rd for multiple shifts.
          </span>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Opening cash float ₦</span>
          <input
            type="number"
            value={float}
            onChange={(e) => setFloat(e.target.value)}
            autoFocus
            className={fieldCls}
          />
        </label>
      </div>
    </Modal>
  );
}

// ── Close shift + reconcile ──────────────────────────────────────────────────

function CloseShiftModal({ shiftId, onClose }: { shiftId: string; onClose: () => void }) {
  const store = useStore();
  const shift = store.shifts.find((s) => s.id === shiftId)!;
  const sales = store.shiftSales(shiftId);
  const expectedCash = shift.openingFloat + sales;

  const [counted, setCounted] = useState("");
  // Bartenders count their bar stock at close — this is where over-pour surfaces.
  const barItems = shift.role === "bartender"
    ? store.inventory.filter((i) => i.location === "bar" && i.branch === store.currentBranch)
    : [];
  const [barCounts, setBarCounts] = useState<Record<string, string>>({});

  const cashVariance = (Number(counted) || 0) - expectedCash;
  const hasCash = counted.trim() !== "";

  function confirm() {
    // Record any bar stock counts the bartender entered — attributed to this shift.
    let overPours = 0;
    let lossCost = 0;
    for (const item of barItems) {
      const raw = barCounts[item.sku];
      if (raw == null || raw.trim() === "") continue;
      const result = store.recordStockCount(item.sku, "bar", Number(raw) || 0, {
        name: shift.staffName,
        shiftId,
      });
      if (result.overPour) { overPours++; lossCost += Math.abs(result.varianceCost); }
    }
    store.closeShift(shiftId, Number(counted) || 0);
    onClose();

    if (overPours > 0) {
      toast.warning(`Shift closed · ${overPours} over-pour flagged to ${shift.staffName} (₦${lossCost.toLocaleString()} loss)`);
    } else if (cashVariance === 0) {
      toast.success(`Shift closed · drawer balanced`);
    } else {
      toast.warning(`Shift closed · ₦${cashVariance.toLocaleString()} ${cashVariance < 0 ? "short" : "over"}`);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Close shift — ${shift.staffName}`}
      description="Reconcile your drawer to end the shift"
      size={shift.role === "bartender" ? "lg" : "md"}
      footer={
        <>
          <ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton>
          <ModalButton onClick={confirm} disabled={!hasCash}>Confirm & close</ModalButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-surface/60 border border-border p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Opening float</span><span className="tabular-nums">₦{shift.openingFloat.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Sales this shift</span><span className="tabular-nums">+ ₦{sales.toLocaleString()}</span></div>
          <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Expected in drawer</span><span className="tabular-nums">₦{expectedCash.toLocaleString()}</span></div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Cash counted in drawer ₦</span>
          <input
            type="number"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="0"
            autoFocus
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </label>

        {hasCash && (
          <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${cashVariance === 0 ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20"}`}>
            <span className="text-sm font-medium">Cash {cashVariance === 0 ? "balanced" : cashVariance < 0 ? "short" : "over"}</span>
            <span className={`text-lg font-bold tabular-nums ${cashVariance === 0 ? "text-primary" : "text-destructive"}`}>
              {cashVariance > 0 ? "+" : ""}₦{cashVariance.toLocaleString()}
            </span>
          </div>
        )}

        {barItems.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Bar stock count <span className="font-normal normal-case">— count what's physically left; gaps below system are flagged as over-pour</span>
            </p>
            <div className="space-y-1.5">
              {barItems.map((item) => {
                const raw = barCounts[item.sku] ?? "";
                const v = raw.trim() === "" ? null : (Number(raw) || 0) - item.onHand;
                return (
                  <div key={item.sku} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground w-24 text-right">system {fmtQty(item.onHand)} {item.unit}</span>
                    <input
                      type="number"
                      value={raw}
                      onChange={(e) => setBarCounts((p) => ({ ...p, [item.sku]: e.target.value }))}
                      placeholder="count"
                      className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary"
                    />
                    <span className={`w-16 text-right text-xs font-semibold tabular-nums ${v == null ? "text-muted-foreground" : v < 0 ? "text-destructive" : "text-primary"}`}>
                      {v == null ? "—" : `${v > 0 ? "+" : ""}${fmtQty(v)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
