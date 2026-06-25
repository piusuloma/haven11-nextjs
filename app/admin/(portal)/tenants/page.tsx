"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ArrowUpRight, Building2, Users, ShoppingBag } from "lucide-react";
import {
  TENANTS, fmtNaira, fmtRelativeTime,
  STATUS_META, PLAN_LABELS,
  type TenantPlan, type TenantStatus,
} from "@/lib/adminData";

const PLAN_OPTIONS: Array<{ value: TenantPlan | "all"; label: string }> = [
  { value: "all",     label: "All plans"  },
  { value: "starter", label: "Starter"    },
  { value: "growth",  label: "Growth"     },
  { value: "scale",   label: "Scale"      },
];

const STATUS_OPTIONS: Array<{ value: TenantStatus | "all"; label: string }> = [
  { value: "all",       label: "All statuses"     },
  { value: "healthy",   label: "Healthy"          },
  { value: "idle_3d",   label: "Idle >3d"         },
  { value: "idle_7d",   label: "No activity >7d"  },
  { value: "suspended", label: "Suspended"        },
];

const planColors: Record<TenantPlan, string> = {
  starter: "text-slate-600 bg-slate-100 border-slate-200",
  growth:  "text-indigo-700 bg-indigo-50 border-indigo-200",
  scale:   "text-violet-700 bg-violet-50 border-violet-200",
};

export default function TenantsPage() {
  const [query,      setQuery]      = useState("");
  const [planFilter, setPlanFilter] = useState<TenantPlan | "all">("all");
  const [statFilter, setStatFilter] = useState<TenantStatus | "all">("all");

  const filtered = TENANTS.filter((t) => {
    const q = query.toLowerCase();
    if (q && !t.name.toLowerCase().includes(q) && !t.city.toLowerCase().includes(q) && !t.primaryEmail.toLowerCase().includes(q)) return false;
    if (planFilter !== "all" && t.plan !== planFilter) return false;
    if (statFilter !== "all" && t.status !== statFilter) return false;
    return true;
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tenants</h1>
        <p className="text-slate-500 text-sm mt-0.5">{TENANTS.length} registered restaurants</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, city, or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder:text-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as TenantPlan | "all")}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        >
          {PLAN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={statFilter}
          onChange={(e) => setStatFilter(e.target.value as TenantStatus | "all")}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Restaurant</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Plan</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center justify-end gap-1"><Building2 className="h-3 w-3" /> Branches</span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center justify-end gap-1"><Users className="h-3 w-3" /> Staff</span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center justify-end gap-1"><ShoppingBag className="h-3 w-3" /> Orders 7d</span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Revenue 7d</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Last Active</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 text-sm">
                    No tenants match your filters.
                  </td>
                </tr>
              ) : filtered.map((t) => {
                const sm = STATUS_META[t.status];
                return (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">
                          {t.logoInitials}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{t.name}</p>
                          <p className="text-xs text-slate-400">{t.primaryEmail}</p>
                          <p className="text-xs text-slate-400">{t.city} · since {t.joinedAt}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${planColors[t.plan]}`}>
                        {PLAN_LABELS[t.plan]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-slate-700 tabular-nums">{t.branchCount}</td>
                    <td className="px-4 py-4 text-right font-medium text-slate-700 tabular-nums">{t.staffCount}</td>
                    <td className="px-4 py-4 text-right tabular-nums">
                      <span className={t.ordersLast7d === 0 ? "text-slate-400" : "font-medium text-slate-700"}>
                        {t.ordersLast7d.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">
                      <span className={t.revenueLast7d === 0 ? "text-slate-400" : "font-medium text-slate-700"}>
                        {t.revenueLast7d === 0 ? "—" : fmtNaira(t.revenueLast7d)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-500 text-xs whitespace-nowrap">{fmtRelativeTime(t.lastActive)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${sm.color}`}>
                        {sm.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/tenants/${t.id}`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                      >
                        View <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
            Showing {filtered.length} of {TENANTS.length} tenants
          </div>
        )}
      </div>
    </div>
  );
}
