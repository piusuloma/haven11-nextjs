"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { exportCsv } from "@/lib/export";
import { useAuth } from "@/lib/auth";
import { useStore, type AuditCategory, type AuditEntry } from "@/lib/store";
import { Download, ShieldCheck, Search, Lock } from "lucide-react";

const CATEGORIES: AuditCategory[] = ["Sales", "Inventory", "Transfers", "Procurement", "Finance", "Payroll", "HR", "Security"];

const CAT: Record<AuditCategory, string> = {
  Sales:       "bg-primary/10 text-primary",
  Inventory:   "bg-sky-100 text-sky-700",
  Transfers:   "bg-violet-100 text-violet-700",
  Procurement: "bg-amber-100 text-amber-700",
  Finance:     "bg-emerald-100 text-emerald-700",
  Payroll:     "bg-rose-100 text-rose-700",
  HR:          "bg-slate-100 text-slate-700",
  Security:    "bg-orange-100 text-orange-700",
};

function dayLabel(iso: string): string {
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AuditTrail() {
  const store = useStore();
  const { user } = useAuth();
  const isOwner = user?.role === "owner";
  const branch = store.currentBranch;

  const [cat, setCat] = useState<AuditCategory | "All">("All");
  const [branchFilter, setBranchFilter] = useState("All");
  const [sensitiveOnly, setSensitiveOnly] = useState(false);
  const [query, setQuery] = useState("");

  // RBAC (Module 8) — the owner sees the whole group; a manager only their branch.
  const scoped = useMemo(
    () => (isOwner ? store.auditLog : store.auditLog.filter((e) => e.branch === branch)),
    [store.auditLog, isOwner, branch],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((e) => {
      if (cat !== "All" && e.category !== cat) return false;
      if (isOwner && branchFilter !== "All" && e.branch !== branchFilter) return false;
      if (sensitiveOnly && e.severity !== "warning") return false;
      if (q && !`${e.actor} ${e.action} ${e.detail} ${e.ref ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [scoped, cat, branchFilter, sensitiveOnly, query, isOwner]);

  const groups = useMemo(() => {
    const m = new Map<string, AuditEntry[]>();
    for (const e of filtered) {
      const key = new Date(e.at).toISOString().slice(0, 10);
      const arr = m.get(key);
      if (arr) arr.push(e);
      else m.set(key, [e]);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  // Stats reflect everything visible to this user, not the active filter.
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCount = scoped.filter((e) => new Date(e.at).toISOString().slice(0, 10) === todayKey).length;
  const sensitiveCount = scoped.filter((e) => e.severity === "warning").length;
  const actorCount = new Set(scoped.map((e) => e.actor)).size;

  function exportLog() {
    exportCsv(
      `audit-trail-${todayKey}.csv`,
      filtered.map((e) => ({
        Timestamp: new Date(e.at).toLocaleString(),
        Actor: e.actor,
        Branch: store.branchName(e.branch),
        Category: e.category,
        Action: e.action,
        Detail: e.detail,
        Reference: e.ref ?? "",
        Amount: e.amount != null ? Math.abs(e.amount) : "",
        Severity: e.severity,
      })),
    );
    toast.success("Audit trail exported to CSV");
  }

  return (
    <AppShell
      title="Audit Trail"
      subtitle={isOwner ? "Group-wide · every sensitive action, who & when" : `${store.branchName(branch)} · every sensitive action, who & when`}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />Activity log
        </h2>
        <button
          onClick={exportLog}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-surface"
        >
          <Download className="h-3.5 w-3.5" />Export
        </button>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Events logged", v: String(scoped.length), hint: "all time" },
          { l: "Today", v: String(todayCount), hint: "entries today" },
          { l: "Sensitive actions", v: String(sensitiveCount), hint: "overrides & risk", tone: sensitiveCount > 0 ? "text-warning" : undefined },
          { l: "Staff acting", v: String(actorCount), hint: "distinct actors" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{k.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${k.tone ?? ""}`}>{k.v}</p>
            <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>
          </div>
        ))}
      </section>

      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["All", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                cat === c ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-surface"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actor, action or reference…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          {isOwner && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="All">All branches</option>
              {store.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium cursor-pointer">
            <input type="checkbox" checked={sensitiveOnly} onChange={(e) => setSensitiveOnly(e.target.checked)} />
            Sensitive only
          </label>
        </div>
      </div>

      {/* Timeline */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No audit entries match these filters.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([day, entries]) => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{dayLabel(day)}</h3>
                <span className="text-xs text-muted-foreground">{entries.length} event{entries.length !== 1 ? "s" : ""}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <ul className="space-y-2">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className={`rounded-xl border bg-card p-4 ${
                      e.severity === "warning" ? "border-warning/40" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          e.severity === "warning" ? "bg-warning" : "bg-primary/40"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{e.action}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CAT[e.category]}`}>
                            {e.category}
                          </span>
                          {e.severity === "warning" && (
                            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                              Sensitive
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{e.detail}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {e.actor} · {store.branchName(e.branch)} · {clock(e.at)}
                        </p>
                      </div>
                      {e.amount != null && (
                        <span className="shrink-0 text-sm font-bold tabular-nums">
                          ₦{Math.abs(e.amount).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Lock className="h-3 w-3" />
        Immutable log — entries are written automatically and cannot be edited or deleted.
      </p>
    </AppShell>
  );
}
