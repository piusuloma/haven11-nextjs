"use client";

import { useState } from "react";
import { Bell, Filter } from "lucide-react";
import {
  PLATFORM_ALERTS, fmtRelativeTime,
  ALERT_SEVERITY_META, ALERT_STATUS_META, ALERT_TYPE_LABELS,
  type AlertSeverity, type AlertStatus,
} from "@/lib/adminData";

const SEV_OPTIONS: Array<{ value: AlertSeverity | "all"; label: string }> = [
  { value: "all",      label: "All severities" },
  { value: "critical", label: "Critical"       },
  { value: "warning",  label: "Warning"        },
  { value: "info",     label: "Info"           },
];

const STAT_OPTIONS: Array<{ value: AlertStatus | "all"; label: string }> = [
  { value: "all",          label: "All statuses"  },
  { value: "open",         label: "Open"          },
  { value: "acknowledged", label: "Acknowledged"  },
  { value: "resolved",     label: "Resolved"      },
];

export default function AlertsPage() {
  const [sevFilter,  setSevFilter]  = useState<AlertSeverity | "all">("all");
  const [statFilter, setStatFilter] = useState<AlertStatus   | "all">("open");

  const filtered = PLATFORM_ALERTS.filter((a) => {
    if (sevFilter  !== "all" && a.severity !== sevFilter)  return false;
    if (statFilter !== "all" && a.status   !== statFilter) return false;
    return true;
  });

  const criticalOpen = PLATFORM_ALERTS.filter((a) => a.status === "open" && a.severity === "critical").length;
  const warningOpen  = PLATFORM_ALERTS.filter((a) => a.status === "open" && a.severity === "warning").length;
  const totalOpen    = PLATFORM_ALERTS.filter((a) => a.status === "open").length;

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Alerts</h1>
          <p className="text-slate-500 text-sm mt-0.5">System-generated monitoring events across all tenants</p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: `${criticalOpen} Critical`,    color: "text-rose-700 bg-rose-50 border-rose-200"    },
          { label: `${warningOpen} Warning`,      color: "text-amber-700 bg-amber-50 border-amber-200"  },
          { label: `${totalOpen} Total open`,     color: "text-slate-700 bg-slate-50 border-slate-200"  },
        ].map(({ label, color }) => (
          <span key={label} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${color}`}>
            <Bell className="h-3.5 w-3.5" />
            {label}
          </span>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-slate-400" />
        <select
          value={sevFilter}
          onChange={(e) => setSevFilter(e.target.value as AlertSeverity | "all")}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        >
          {SEV_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={statFilter}
          onChange={(e) => setStatFilter(e.target.value as AlertStatus | "all")}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        >
          {STAT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span className="text-xs text-slate-400">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 px-6 py-16 text-center">
            <Bell className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No alerts match your filters</p>
          </div>
        ) : filtered.map((alert) => {
          const sev  = ALERT_SEVERITY_META[alert.severity];
          const stat = ALERT_STATUS_META[alert.status];
          const sevDot = alert.severity === "critical" ? "bg-rose-500" : alert.severity === "warning" ? "bg-amber-500" : "bg-sky-400";
          return (
            <div key={alert.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-4">
                <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${sevDot}`} />

                <div className="flex-1 min-w-0">
                  {/* Top row */}
                  <div className="flex items-start flex-wrap gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                      {ALERT_TYPE_LABELS[alert.type]}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${sev.color}`}>
                      {sev.label}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${stat.color}`}>
                      {stat.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-800 font-medium leading-snug">{alert.description}</p>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
                    <span className="font-medium text-slate-600">{alert.tenantName}</span>
                    {alert.branchName && <span>{alert.branchName}</span>}
                    <span>{fmtRelativeTime(alert.createdAt)}</span>
                    {alert.acknowledgedBy && <span>Acknowledged by {alert.acknowledgedBy}</span>}
                    {alert.resolvedAt    && <span>Resolved {fmtRelativeTime(alert.resolvedAt)}</span>}
                  </div>

                  {/* Note */}
                  {alert.note && (
                    <div className="mt-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-xs text-slate-600 italic">
                      {alert.note}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
