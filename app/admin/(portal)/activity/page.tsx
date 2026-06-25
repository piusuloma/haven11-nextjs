"use client";

import { useState } from "react";
import { Search, Download, Activity } from "lucide-react";
import { ACTIVITY_EVENTS, fmtRelativeTime } from "@/lib/adminData";

const ROLE_COLORS: Record<string, string> = {
  Owner:       "text-violet-700 bg-violet-50 border-violet-200",
  Manager:     "text-indigo-700 bg-indigo-50 border-indigo-200",
  Cashier:     "text-emerald-700 bg-emerald-50 border-emerald-200",
  Storekeeper: "text-amber-700 bg-amber-50 border-amber-200",
  Bartender:   "text-sky-700 bg-sky-50 border-sky-200",
  "Head Chef": "text-orange-700 bg-orange-50 border-orange-200",
};

function roleBadge(role: string) {
  const c = ROLE_COLORS[role] ?? "text-slate-600 bg-slate-100 border-slate-200";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${c}`}>
      {role}
    </span>
  );
}

export default function ActivityPage() {
  const [query,   setQuery]   = useState("");
  const [tenant,  setTenant]  = useState("all");

  const tenantOptions = ["all", ...Array.from(new Set(ACTIVITY_EVENTS.map((e) => e.tenantName)))];

  const filtered = ACTIVITY_EVENTS.filter((ev) => {
    if (tenant !== "all" && ev.tenantName !== tenant) return false;
    const q = query.toLowerCase();
    if (q && !ev.actor.toLowerCase().includes(q) && !ev.action.toLowerCase().includes(q) && !ev.entity.toLowerCase().includes(q) && !ev.tenantName.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Activity</h1>
          <p className="text-slate-500 text-sm mt-0.5">All write actions across every tenant, newest first</p>
        </div>
        <button className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl px-4 py-2 bg-white hover:bg-slate-50 transition-colors">
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search actor, action, or entity…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder:text-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          />
        </div>
        <select
          value={tenant}
          onChange={(e) => setTenant(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        >
          <option value="all">All tenants</option>
          {tenantOptions.slice(1).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Entity</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Tenant · Branch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Activity className="h-8 w-8 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No events match your filters</p>
                  </td>
                </tr>
              ) : filtered.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-3.5">
                    <p className="text-xs text-slate-500 whitespace-nowrap">{fmtRelativeTime(ev.timestamp)}</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">{new Date(ev.timestamp).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                        {ev.actor.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{ev.actor}</p>
                        <div className="mt-0.5">{roleBadge(ev.actorRole)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-700">{ev.action}</td>
                  <td className="px-4 py-3.5 text-slate-500 max-w-[160px] truncate">{ev.entity}</td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-slate-700 font-medium">{ev.tenantName}</p>
                    <p className="text-xs text-slate-400">{ev.branchName}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
            Showing {filtered.length} of {ACTIVITY_EVENTS.length} events
          </div>
        )}
      </div>
    </div>
  );
}
