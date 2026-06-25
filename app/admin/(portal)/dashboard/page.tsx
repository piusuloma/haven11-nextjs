"use client";

import Link from "next/link";
import {
  Building2, ShoppingBag, DollarSign, Users, Bell,
  TrendingUp, ArrowUpRight, ExternalLink, RefreshCw,
} from "lucide-react";
import {
  TENANTS, ACTIVITY_EVENTS, PLATFORM_ALERTS,
  getPlatformKPIs, fmtNaira, fmtRelativeTime,
  STATUS_META, PLAN_LABELS,
} from "@/lib/adminData";

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  trend?: string;
  href?: string;
}

function KpiCard({ label, value, sub, icon, trend, href }: KpiCardProps) {
  const inner = (
    <div className="bg-card rounded-2xl border border-border p-5 flex items-start gap-4 hover:shadow-sm transition-shadow">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5 leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        {trend && (
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp className="h-3 w-3 text-success" />
            <span className="text-[11px] text-success font-medium">{trend}</span>
          </div>
        )}
      </div>
      {href && <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

// ── Badges ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: keyof typeof STATUS_META }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${m.color}`}>
      {m.label}
    </span>
  );
}

function PlanBadge({ plan }: { plan: keyof typeof PLAN_LABELS }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border text-primary border-primary/30 bg-primary/8">
      {PLAN_LABELS[plan]}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const kpis = getPlatformKPIs();
  const openAlerts     = PLATFORM_ALERTS.filter((a) => a.status === "open");
  const criticalAlerts = openAlerts.filter((a) => a.severity === "critical").length;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Today · Wed 25 Jun 2026 — real-time snapshot</p>
        </div>
        <button className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 bg-card hover:bg-surface transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KpiCard
          label="Active Tenants"
          value={kpis.activeTenants}
          sub={`${TENANTS.length} total registered`}
          icon={<Building2 className="h-5 w-5 text-primary" />}
          trend="+2 this week"
          href="/admin/tenants"
        />
        <KpiCard
          label="Total Branches"
          value={kpis.totalBranches}
          sub="across all tenants"
          icon={<Building2 className="h-5 w-5 text-primary" />}
        />
        <KpiCard
          label="Orders Today"
          value={kpis.ordersToday.toLocaleString()}
          sub="platform-wide POS"
          icon={<ShoppingBag className="h-5 w-5 text-primary" />}
          trend="+12% vs yesterday"
        />
        <KpiCard
          label="Revenue Today"
          value={fmtNaira(kpis.revenueToday)}
          sub="sum of all tenant POS"
          icon={<DollarSign className="h-5 w-5 text-primary" />}
          trend="+8% vs yesterday"
        />
        <KpiCard
          label="Active Sessions"
          value={kpis.activeSessions}
          sub="staff logged in right now"
          icon={<Users className="h-5 w-5 text-primary" />}
        />
        <KpiCard
          label="Open Alerts"
          value={kpis.openAlerts}
          sub={criticalAlerts > 0 ? `${criticalAlerts} critical` : "none critical"}
          icon={<Bell className="h-5 w-5 text-primary" />}
          href="/admin/alerts"
        />
      </div>

      {/* Critical alert banner */}
      {criticalAlerts > 0 && (
        <div className="flex items-center justify-between gap-4 bg-destructive/8 border border-destructive/25 rounded-xl px-5 py-3.5">
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive font-medium">
              {criticalAlerts} critical alert{criticalAlerts > 1 ? "s" : ""} require immediate attention
            </p>
          </div>
          <Link href="/admin/alerts" className="shrink-0 text-sm font-semibold text-destructive hover:opacity-80 flex items-center gap-1">
            View alerts <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Main two-column */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Tenant Health Table — 2/3 */}
        <div className="xl:col-span-2 bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="font-semibold text-foreground">Tenant Health</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{TENANTS.length} registered clients</p>
            </div>
            <Link href="/admin/tenants" className="text-xs font-medium text-primary hover:opacity-80 flex items-center gap-1">
              View all <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Restaurant</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Plan</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Branches</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Orders 7d</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Active</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {TENANTS.map((t) => (
                  <tr key={t.id} className="hover:bg-surface/60 transition-colors group">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-primary text-xs font-bold">
                          {t.logoInitials}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.city}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><PlanBadge plan={t.plan} /></td>
                    <td className="px-4 py-3.5 text-right text-foreground font-medium tabular-nums">{t.branchCount}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      <span className={t.ordersLast7d === 0 ? "text-muted-foreground" : "text-foreground font-medium"}>
                        {t.ordersLast7d.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs whitespace-nowrap">{fmtRelativeTime(t.lastActive)}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/admin/tenants/${t.id}`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:opacity-70"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed — 1/3 */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div>
              <h2 className="font-semibold text-foreground">Platform Activity</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Latest events across all tenants</p>
            </div>
            <Link href="/admin/activity" className="text-xs font-medium text-primary hover:opacity-80 flex items-center gap-1">
              Full log <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {ACTIVITY_EVENTS.map((ev) => (
              <div key={ev.id} className="px-5 py-3 hover:bg-surface/60 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface text-primary text-[10px] font-bold mt-0.5">
                    {ev.actor.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground leading-snug">
                      <span className="font-medium">{ev.actor}</span>{" "}
                      <span className="text-muted-foreground">{ev.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {ev.tenantName} · {ev.branchName}
                    </p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5">{fmtRelativeTime(ev.timestamp)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Open Alerts snapshot */}
      {openAlerts.length > 0 && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Open Alerts</h2>
            <Link href="/admin/alerts" className="text-xs font-medium text-primary hover:opacity-80 flex items-center gap-1">
              Manage <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {openAlerts.slice(0, 4).map((alert) => {
              const dot = alert.severity === "critical" ? "bg-destructive" : alert.severity === "warning" ? "bg-warning" : "bg-primary/40";
              const textColor = alert.severity === "critical" ? "text-destructive bg-destructive/8 border-destructive/25" : alert.severity === "warning" ? "text-warning bg-warning/8 border-warning/25" : "text-primary bg-primary/8 border-primary/20";
              return (
                <div key={alert.id} className="flex items-start gap-4 px-6 py-3.5 hover:bg-surface/50 transition-colors">
                  <div className={`mt-2 h-2 w-2 rounded-full shrink-0 ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{alert.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {alert.tenantName}{alert.branchName ? ` · ${alert.branchName}` : ""} · {fmtRelativeTime(alert.createdAt)}
                    </p>
                  </div>
                  <span className={`text-[11px] font-medium capitalize px-2 py-0.5 rounded-full border shrink-0 ${textColor}`}>
                    {alert.severity}
                  </span>
                </div>
              );
            })}
          </div>
          {openAlerts.length > 4 && (
            <div className="px-6 py-3 border-t border-border bg-surface">
              <Link href="/admin/alerts" className="text-xs text-primary hover:opacity-80 font-medium">
                + {openAlerts.length - 4} more open alerts
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
