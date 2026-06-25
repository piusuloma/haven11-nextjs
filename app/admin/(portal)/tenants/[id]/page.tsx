"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Users, ShoppingBag, Bell } from "lucide-react";
import {
  TENANTS, PLATFORM_ALERTS, ACTIVITY_EVENTS,
  fmtNaira, fmtRelativeTime, STATUS_META, PLAN_LABELS,
  ALERT_SEVERITY_META,
} from "@/lib/adminData";

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tenant = TENANTS.find((t) => t.id === id);

  if (!tenant) {
    return (
      <div className="p-8">
        <Link href="/admin/tenants" className="flex items-center gap-2 text-sm text-indigo-600 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to tenants
        </Link>
        <p className="text-slate-500">Tenant not found.</p>
      </div>
    );
  }

  const sm      = STATUS_META[tenant.status];
  const alerts  = PLATFORM_ALERTS.filter((a) => a.tenantId === id);
  const events  = ACTIVITY_EVENTS.filter((e) => e.tenantId === id);

  const planColors: Record<string, string> = {
    starter: "text-slate-600 bg-slate-100 border-slate-200",
    growth:  "text-indigo-700 bg-indigo-50 border-indigo-200",
    scale:   "text-violet-700 bg-violet-50 border-violet-200",
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto space-y-6">
      {/* Back */}
      <Link href="/admin/tenants" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to tenants
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700 text-lg font-bold">
          {tenant.logoInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">{tenant.name}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${planColors[tenant.plan]}`}>
              {PLAN_LABELS[tenant.plan]}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${sm.color}`}>
              {sm.label}
            </span>
          </div>
          <p className="text-slate-500 text-sm">{tenant.primaryEmail} · {tenant.city}</p>
          <p className="text-slate-400 text-xs mt-0.5">Member since {tenant.joinedAt}</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Branches",       value: tenant.branchCount, icon: <Building2 className="h-4 w-4 text-indigo-600" />,  bg: "bg-indigo-50" },
          { label: "Staff",          value: tenant.staffCount,  icon: <Users className="h-4 w-4 text-violet-600" />,       bg: "bg-violet-50" },
          { label: "Orders (7d)",    value: tenant.ordersLast7d.toLocaleString(), icon: <ShoppingBag className="h-4 w-4 text-emerald-600" />, bg: "bg-emerald-50" },
          { label: "Revenue (7d)",   value: fmtNaira(tenant.revenueLast7d),       icon: <ShoppingBag className="h-4 w-4 text-amber-600" />,   bg: "bg-amber-50"   },
        ].map(({ label, value, icon, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className={`grid h-8 w-8 place-items-center rounded-lg ${bg} mb-2`}>{icon}</div>
            <p className="text-xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Two-column: Alerts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Bell className="h-4 w-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900">Alerts ({alerts.length})</h2>
          </div>
          {alerts.length === 0 ? (
            <p className="text-slate-400 text-sm px-5 py-6">No alerts for this tenant.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {alerts.map((a) => {
                const sev = ALERT_SEVERITY_META[a.severity];
                return (
                  <div key={a.id} className="px-5 py-3.5">
                    <div className="flex items-start gap-3">
                      <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${a.severity === "critical" ? "bg-rose-500" : a.severity === "warning" ? "bg-amber-500" : "bg-sky-400"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800">{a.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded border ${sev.color}`}>{sev.label}</span>
                          <span className="text-[11px] text-slate-400">{fmtRelativeTime(a.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Recent Activity</h2>
          </div>
          {events.length === 0 ? (
            <p className="text-slate-400 text-sm px-5 py-6">No recent activity.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold mt-0.5">
                    {ev.actor.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm text-slate-800">
                      <span className="font-medium">{ev.actor}</span>{" "}
                      <span className="text-slate-500">{ev.action}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{ev.branchName} · {fmtRelativeTime(ev.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
