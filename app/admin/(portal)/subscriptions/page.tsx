"use client";

import { CreditCard } from "lucide-react";
import { TENANTS, PLAN_LABELS, fmtNaira, fmtRelativeTime, STATUS_META, type TenantPlan } from "@/lib/adminData";

const PLAN_LIMITS: Record<TenantPlan, string> = {
  starter: "1 branch · 10 staff",
  growth:  "3 branches · 30 staff",
  scale:   "Unlimited",
};

const planColors: Record<TenantPlan, string> = {
  starter: "text-slate-600 bg-slate-100 border-slate-200",
  growth:  "text-indigo-700 bg-indigo-50 border-indigo-200",
  scale:   "text-violet-700 bg-violet-50 border-violet-200",
};

export default function SubscriptionsPage() {
  const totals = {
    starter: TENANTS.filter((t) => t.plan === "starter").length,
    growth:  TENANTS.filter((t) => t.plan === "growth").length,
    scale:   TENANTS.filter((t) => t.plan === "scale").length,
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Subscriptions</h1>
        <p className="text-slate-500 text-sm mt-0.5">Plan distribution and billing overview</p>
      </div>

      {/* Plan summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(["starter", "growth", "scale"] as TenantPlan[]).map((plan) => (
          <div key={plan} className="bg-white rounded-2xl border border-slate-200 p-5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${planColors[plan]} mb-3`}>
              {PLAN_LABELS[plan]}
            </span>
            <p className="text-3xl font-bold text-slate-900">{totals[plan]}</p>
            <p className="text-slate-400 text-sm mt-0.5">tenants</p>
            <p className="text-xs text-slate-400 mt-2 border-t border-slate-100 pt-2">{PLAN_LIMITS[plan]}</p>
          </div>
        ))}
      </div>

      {/* Tenant subscription table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">All Subscriptions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Restaurant</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Limits</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Usage</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {TENANTS.map((t) => {
                const sm = STATUS_META[t.status];
                const atLimit = (t.plan === "starter" && t.branchCount >= 1) || (t.plan === "growth" && t.branchCount >= 3);
                return (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                          {t.logoInitials}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{t.name}</p>
                          <p className="text-xs text-slate-400">{t.primaryEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${planColors[t.plan]}`}>
                        {PLAN_LABELS[t.plan]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{PLAN_LIMITS[t.plan]}</td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-slate-700">
                        <span className={atLimit ? "text-rose-600 font-medium" : ""}>{t.branchCount} branch{t.branchCount !== 1 ? "es" : ""}</span>
                        {" · "}
                        {t.staffCount} staff
                      </div>
                      {atLimit && <p className="text-[10px] text-rose-500 mt-0.5">At branch limit</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${sm.color}`}>
                        {sm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{t.joinedAt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
