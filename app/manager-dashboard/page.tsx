"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useStore, statusOf, fmtQty } from "@/lib/store";
import {
  ShoppingCart, ClipboardCheck, AlertTriangle, ShieldAlert, Boxes,
  ArrowLeftRight, Wallet, ArrowRight,
} from "lucide-react";

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

export default function ManagerDashboard() {
  const store = useStore();
  const branch = store.currentBranch;

  const orders = store.orders.filter((o) => o.branch === branch && !o.voided);
  const salesToday = orders.reduce((s, o) => s + o.total, 0);
  const openTickets = store.tickets.filter((t) => t.branch === branch).length;
  const lowStock = store.inventory.filter((i) => i.branch === branch && statusOf(i) !== "OK");
  const overPours = store.counts.filter((c) => c.overPour && c.branch === branch);

  const pendingTransfers = store.transfers.filter((t) => t.status === "Requested");
  const pendingExpenses = store.expenses.filter((e) => e.branch === branch && e.status === "Pending");
  const approvals = pendingTransfers.length + pendingExpenses.length;

  return (
    <AppShell title="Dashboard" subtitle={`${store.branchName(branch)} · branch operations`}>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Sales today", v: `₦${salesToday.toLocaleString()}`, hint: `${orders.length} orders` },
          { l: "Open tickets", v: String(openTickets), hint: "kitchen + bar" },
          { l: "Pending approvals", v: String(approvals), hint: "transfers + expenses", tone: approvals > 0 ? "text-warning" : undefined },
          { l: "Stock alerts", v: String(lowStock.length), hint: "low / out", tone: lowStock.length > 0 ? "text-warning" : undefined },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${k.tone ?? ""}`}>{k.v}</p>
            <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending approvals */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />Needs your decision
          </h2>
          {approvals === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nothing waiting on you — all clear.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {pendingTransfers.map((t) => (
                <li key={t.id}>
                  <Link href="/transfers" className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm hover:bg-surface/60 transition-colors">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface text-primary"><ArrowLeftRight className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">Transfer {t.id}</span>
                      <span className="block text-xs text-muted-foreground">{store.branchName(t.toBranch)} · {t.lines.length} items · approve</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
              {pendingExpenses.map((e) => (
                <li key={e.id}>
                  <Link href="/expenses" className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm hover:bg-surface/60 transition-colors">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-surface text-primary"><Wallet className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">Expense {e.id} · ₦{e.amount.toLocaleString()}</span>
                      <span className="block text-xs text-muted-foreground">{e.category} · {e.requestedBy}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Live alerts */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Live alerts</h2>
            <Link href="/alerts" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </header>
          {overPours.length === 0 && lowStock.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nothing needs attention.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {overPours.slice(0, 2).map((c) => (
                <li key={c.id} className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive"><ShieldAlert className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Over-pour — {c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.staffName} · ₦{Math.abs(c.varianceCost).toLocaleString()} loss</p>
                  </div>
                </li>
              ))}
              {lowStock.slice(0, 4).map((i) => (
                <li key={i.sku} className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-background/60 text-foreground"><AlertTriangle className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{statusOf(i) === "Out" ? "Out of stock" : "Low stock"} — {i.name}</p>
                    <p className="text-xs text-muted-foreground">{fmtQty(i.onHand)} {i.unit} on hand</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Recent orders */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Recent orders</h2>
          <Link href="/reports" className="text-xs font-medium text-primary hover:underline">Reports</Link>
        </div>
        {orders.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">No orders rung up yet today.</p>
        ) : (
          <ul className="divide-y divide-border">
            {orders.slice(0, 6).map((o) => (
              <li key={o.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium tabular-nums">
                    #{o.id} <span className="text-muted-foreground font-normal">· {o.channel === "Dine-in" ? o.table : `${o.channel} · ${o.customer?.name ?? ""}`}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{o.lines.reduce((s, l) => s + l.qty, 0)} items · {o.staffName} · {timeAgo(o.at)}</p>
                </div>
                <p className="text-sm font-bold tabular-nums">₦{o.total.toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/pos", label: "Take an order", Icon: ShoppingCart },
          { href: "/transfers", label: "Stock transfers", Icon: ArrowLeftRight },
          { href: "/inventory", label: "Inventory", Icon: Boxes },
          { href: "/expenses", label: "Expenses", Icon: Wallet },
        ].map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 hover:border-primary/30 hover:bg-surface transition-colors">
            <Icon className="h-6 w-6 text-primary" strokeWidth={1.75} />
            <span className="text-sm font-semibold">{label}</span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
