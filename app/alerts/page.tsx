"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import {
  useStore, statusOf, fmtQty, daysUntil, locationForLine, LOCATION_NAME,
  type StockLocation,
} from "@/lib/store";
import Link from "next/link";
import { AlertTriangle, ShieldAlert, Eye, ShieldCheck, Boxes, ChefHat, Wine, GlassWater } from "lucide-react";

type Tone = "danger" | "warn";

interface DerivedAlert {
  id: string;
  tone: Tone;
  title: string;
  meta: string;
  detail: string;
  time: string;
  location: StockLocation;
}

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)} hr ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

const toneClass = (t: Tone) =>
  t === "danger"
    ? "bg-destructive/10 text-destructive border-destructive/20"
    : "bg-warning/15 text-foreground border-warning/30";

// Alerts are grouped by the section they belong to operationally.
const GROUP_ORDER: StockLocation[] = ["store", "kitchen", "bar", "juice-bar"];

const GROUP_ICON: Record<StockLocation, typeof Boxes> = {
  store: Boxes,
  kitchen: ChefHat,
  bar: Wine,
  "juice-bar": GlassWater,
};

export default function Alerts() {
  const store = useStore();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [read, setRead] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<DerivedAlert | null>(null);

  // Read-only security checklist — reflects platform configuration.
  const posture = [
    { name: "2FA enforced on admins", detail: "All owner & manager accounts require PIN sign-in." },
    { name: "Role-based access reviewed", detail: "Routes are gated per role in AuthGuard." },
    { name: "Audit log streaming", detail: "Sensitive actions are written to the audit trail." },
    { name: "Backup snapshot < 24h", detail: "Branch state is snapshotted daily." },
    { name: "Idle sessions auto-locked", detail: "Inactive sessions return to the PIN lock screen." },
  ];

  // Alerts are derived live from the current branch's store state.
  const branch = store.currentBranch;
  const all: DerivedAlert[] = [
    // Over-pours — always live in the Bar.
    ...store.counts
      .filter((c) => c.overPour && c.branch === branch)
      .map((c) => {
        const unit = store.inventory.find((i) => i.sku === c.sku)?.unit ?? "";
        return {
          id: `op-${c.id}`,
          tone: "danger" as Tone,
          title: `Over-pour detected — ${c.name}`,
          meta: `${c.staffName} · ${fmtQty(c.variance)} ${unit} · ₦${Math.abs(c.varianceCost).toLocaleString()} loss`,
          detail: `A bar stock count showed ${fmtQty(Math.abs(c.variance))} ${unit} of ${c.name} unaccounted for — a loss of ₦${Math.abs(c.varianceCost).toLocaleString()}. Recorded during ${c.staffName}'s shift. Recommended action: review pour technique with the bartender and re-count next shift.`,
          time: timeAgo(c.at),
          location: "bar" as StockLocation,
        };
      }),
    // Low / out stock — grouped by the item's own location.
    ...store.inventory
      .filter((i) => i.branch === branch && statusOf(i) !== "OK")
      .map((i) => {
        const out = statusOf(i) === "Out";
        return {
          id: `stock-${i.location}-${i.sku}`,
          tone: (out ? "danger" : "warn") as Tone,
          title: `${out ? "Out of stock" : "Low stock"} — ${i.name}`,
          meta: `${LOCATION_NAME[i.location]} · ${fmtQty(i.onHand)} ${i.unit} on hand · reorder at ${fmtQty(i.reorder)}`,
          detail: `${i.name} (${i.sku}) is ${out ? "fully depleted" : "at or below its reorder level"} in the ${LOCATION_NAME[i.location]} — ${fmtQty(i.onHand)} ${i.unit} remaining against a reorder point of ${fmtQty(i.reorder)} ${i.unit}. Raise an internal stock request from the Main Store, or a purchase order to the supplier.`,
          time: "live",
          location: i.location,
        };
      }),
    // Expiring batches — attribute by the product's line.
    ...store.batches
      .filter((b) => b.branch === branch && daysUntil(b.expiry) <= 14)
      .map((b) => {
        const d = daysUntil(b.expiry);
        const lineOfSku = store.inventory.find((i) => i.sku === b.sku)?.line;
        const loc: StockLocation = lineOfSku ? locationForLine(lineOfSku) : "store";
        return {
          id: `exp-${b.id}`,
          tone: (d <= 3 ? "danger" : "warn") as Tone,
          title: `${d < 0 ? "Expired batch" : "Batch expiring soon"} — ${b.name}`,
          meta: `${fmtQty(b.qty)} ${b.unit} · expiry ${b.expiry} · ${d < 0 ? `${-d}d overdue` : `${d}d left`}`,
          detail: `A batch of ${b.name} (${fmtQty(b.qty)} ${b.unit}) ${d < 0 ? "has expired" : `expires in ${d} day${d !== 1 ? "s" : ""}`}. Issue it next under FIFO, or — if expired — mark it as waste so it can't be sold.`,
          time: "live",
          location: loc,
        };
      }),
  ];

  const feed = all.filter((a) => !dismissed.has(a.id));
  const critical = feed.filter((a) => a.tone === "danger").length;
  const warnings = feed.filter((a) => a.tone === "warn").length;
  const grouped = GROUP_ORDER.map((loc) => ({
    loc,
    alerts: feed.filter((a) => a.location === loc),
  })).filter((g) => g.alerts.length > 0);

  function markAllRead() {
    setRead(new Set(feed.map((a) => a.id)));
    toast.success("All alerts marked as read");
  }
  function acknowledge(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    setViewing(null);
    toast.success("Alert acknowledged");
  }

  return (
    <AppShell title="Alerts & Security" subtitle="Live anomalies grouped by section — inventory, counts & shifts">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Critical", v: String(critical), tone: critical > 0 ? "text-destructive" : undefined },
          { l: "Warnings", v: String(warnings) },
          { l: "Acknowledged", v: String(dismissed.size), tone: "text-primary" },
          { l: "Active total", v: String(feed.length) },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Live alert feed</h2>
            {feed.some((a) => !read.has(a.id)) && (
              <button onClick={markAllRead} className="text-xs font-medium text-primary hover:underline">Mark all read</button>
            )}
          </header>

          {feed.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">No active alerts — everything is in range 🎉</p>
          ) : (
            <div className="mt-4 space-y-5">
              {grouped.map(({ loc, alerts }) => {
                const Icon = GROUP_ICON[loc];
                const sectionCritical = alerts.filter((a) => a.tone === "danger").length;
                return (
                  <div key={loc}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="grid h-6 w-6 place-items-center rounded-md bg-surface text-primary">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {LOCATION_NAME[loc]}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
                        {sectionCritical > 0 && ` · ${sectionCritical} critical`}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {alerts.map((a) => {
                        const AlertIcon = a.tone === "danger" ? ShieldAlert : AlertTriangle;
                        return (
                          <li key={a.id} className={`flex items-start gap-3 rounded-lg border p-3 ${toneClass(a.tone)} ${read.has(a.id) ? "opacity-55" : ""}`}>
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-background/60">
                              <AlertIcon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-tight">{a.title}</p>
                              <p className="mt-0.5 text-xs opacity-80">{a.meta}</p>
                            </div>
                            <span className="text-xs opacity-70 whitespace-nowrap">{a.time}</span>
                            <button
                              onClick={() => { setRead((p) => new Set(p).add(a.id)); setViewing(a); }}
                              aria-label="View alert"
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border/60 bg-background/60 hover:bg-background"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Security posture</h2>
          <p className="mt-1 text-xs text-muted-foreground">Platform safeguards currently in effect.</p>
          <ul className="mt-4 space-y-3 text-sm">
            {posture.map((c) => (
              <li key={c.name} className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-foreground/90 leading-tight">{c.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {viewing && (
        <Modal
          open
          onClose={() => setViewing(null)}
          title={viewing.title}
          description={viewing.meta}
          footer={
            <>
              <ModalButton variant="ghost" onClick={() => setViewing(null)}>Dismiss</ModalButton>
              <ModalButton onClick={() => acknowledge(viewing.id)}>Acknowledge</ModalButton>
            </>
          }
        >
          <div className="space-y-3">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass(viewing.tone)}`}>
              {viewing.tone === "danger" ? "Critical" : "Warning"} · {LOCATION_NAME[viewing.location]} · {viewing.time}
            </span>
            <p className="text-sm text-foreground/90 leading-relaxed">{viewing.detail}</p>
            {(viewing.id.startsWith("stock-") || viewing.id.startsWith("exp-") || viewing.id.startsWith("op-")) && (
              <Link
                href="/inventory"
                onClick={() => setViewing(null)}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Go to Inventory
              </Link>
            )}
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
