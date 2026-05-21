"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useStore, statusOf, fmtQty, daysUntil, HUB_ID } from "@/lib/store";
import { ArrowLeftRight, ScrollText, Boxes, CalendarClock, ArrowRight } from "lucide-react";

export default function StoreHome() {
  const store = useStore();
  const branch = store.currentBranch;

  const lowStock = store.inventory.filter((i) => i.branch === branch && statusOf(i) !== "OK");
  const toIssue = store.transfers.filter((t) => t.status === "Approved");
  const incoming = store.transfers.filter((t) => t.status === "Issued" && t.toBranch === branch);
  const openPOs = store.purchaseOrders.filter((p) => p.status !== "Received");
  const expiring = store.batches.filter((b) => b.branch === branch && daysUntil(b.expiry) <= 14);

  const taskCount = lowStock.length + toIssue.length + incoming.length + openPOs.length + expiring.length;

  return (
    <AppShell title="Store" subtitle={`${store.branchName(branch)} · inventory & supply chain`}>
      <p className="text-sm text-muted-foreground">
        {taskCount === 0
          ? "Nothing needs you today — all stock tasks are clear."
          : `${taskCount} ${taskCount === 1 ? "task needs" : "tasks need"} you today.`}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low stock */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Boxes className="h-4 w-4 text-muted-foreground" />Stock running low</h2>
            <Link href="/inventory" className="text-xs font-medium text-primary hover:underline">Open inventory</Link>
          </header>
          {lowStock.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Everything is above its reorder level. 🎉</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {lowStock.slice(0, 6).map((i) => (
                <li key={i.sku} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium">{i.name}</p>
                    <p className="text-xs text-muted-foreground">{i.line} · reorder at {fmtQty(i.reorder)} {i.unit}</p>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${statusOf(i) === "Out" ? "text-destructive" : "text-warning"}`}>
                    {fmtQty(i.onHand)} {i.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Transfers */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 text-muted-foreground" />Transfers to action</h2>
            <Link href="/transfers" className="text-xs font-medium text-primary hover:underline">Open transfers</Link>
          </header>
          {toIssue.length + incoming.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No transfers waiting on the store.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {toIssue.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium">{t.id} · ready to issue</p>
                    <p className="text-xs text-muted-foreground">{store.branchName(HUB_ID)} → {store.branchName(t.toBranch)} · {t.lines.length} items</p>
                  </div>
                  <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">Approved</span>
                </li>
              ))}
              {incoming.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium">{t.id} · incoming — receive</p>
                    <p className="text-xs text-muted-foreground">from {store.branchName(t.fromBranch)} · {t.lines.length} items</p>
                  </div>
                  <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">In transit</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Purchase orders */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2"><ScrollText className="h-4 w-4 text-muted-foreground" />Purchase orders to receive</h2>
            <Link href="/purchase-orders" className="text-xs font-medium text-primary hover:underline">Open POs</Link>
          </header>
          {openPOs.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No purchase orders awaiting delivery.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {openPOs.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium font-mono">{p.id}</p>
                    <p className="text-xs text-muted-foreground">{p.lines.length} lines · expected {p.expectedDate}</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">₦{p.total.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Expiry */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2"><CalendarClock className="h-4 w-4 text-muted-foreground" />Batches expiring soon</h2>
            <Link href="/inventory" className="text-xs font-medium text-primary hover:underline">Batch register</Link>
          </header>
          {expiring.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No batches near expiry.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {expiring.map((b) => {
                const d = daysUntil(b.expiry);
                return (
                  <li key={b.id} className={`flex items-center justify-between rounded-lg border p-3 text-sm ${d <= 7 ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{fmtQty(b.qty)} {b.unit} · {b.expiry}</p>
                    </div>
                    <span className={`text-xs font-semibold ${d <= 7 ? "text-destructive" : "text-muted-foreground"}`}>
                      {d < 0 ? `${-d}d overdue` : `${d}d left`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Link
        href="/transfers"
        className="flex items-center justify-between rounded-2xl bg-primary p-5 text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <div>
          <p className="text-base font-bold">Raise a stock transfer</p>
          <p className="text-sm text-primary-foreground/70">Request inventory from the Strong Room</p>
        </div>
        <ArrowRight className="h-5 w-5" />
      </Link>
    </AppShell>
  );
}
