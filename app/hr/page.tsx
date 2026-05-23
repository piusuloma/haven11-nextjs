"use client";

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useStore, daysUntil, complianceGap, type Employee } from "@/lib/store";
import {
  Users, UserPlus, UserMinus, Clock, ShieldAlert, AlertTriangle, CalendarDays,
} from "lucide-react";

// Weekly schedule is stored Mon..Sun (index 0..6).
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type ShiftOption = "Off" | "Full day" | "1st shift" | "2nd shift" | "3rd shift";

// Shift colour key — matches the schedule editor in /staff.
const shiftCell: Record<ShiftOption, string> = {
  "Off":       "bg-muted/40 text-muted-foreground",
  "Full day":  "bg-primary/15 text-primary",
  "1st shift": "bg-sky-100 text-sky-700",
  "2nd shift": "bg-amber-100 text-amber-800",
  "3rd shift": "bg-violet-100 text-violet-700",
};

function todayIndex(): number {
  // JS Date.getDay(): 0=Sun..6=Sat. Remap to 0=Mon..6=Sun.
  return (new Date().getDay() + 6) % 7;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function daysAgo(ms: number) { return Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000)); }
function fmtDate() {
  return new Date().toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
}

export default function HRDashboard() {
  const store = useStore();
  const branch = store.currentBranch;
  const all = store.employees.filter((e) => e.branch === branch);
  const active = all.filter((e) => e.status === "Active");
  const offboarded = all.filter((e) => e.status === "Offboarded");

  const today = todayISO();
  const tIdx = todayIndex();
  const todayDay = WEEK_DAYS[tIdx];

  const onSite = (id: string) => store.attendance.some((a) => a.employeeId === id && a.date === today);
  const lateMarks = (id: string) => store.attendance.filter((a) => a.employeeId === id && a.lateMinutes >= 15).length;

  const clockedIn = active.filter((e) => onSite(e.id)).length;
  const gaps = active.filter(complianceGap).length;
  const certsDue = active.filter((e) => daysUntil(e.certExpiry) <= 30).length;
  const recentlyHired = active.filter((e) => Date.now() - new Date(e.hireDate).getTime() <= 30 * 24 * 60 * 60 * 1000);
  const recentlyOffboarded = offboarded.filter((e) => e.offboardedAt != null && daysAgo(e.offboardedAt) <= 30);
  const lateToday = active.filter((e) => {
    const a = store.attendance.find((x) => x.employeeId === e.id && x.date === today);
    return a && a.lateMinutes >= 15;
  });

  // Today's roster — who is scheduled today, grouped by shift period.
  const buckets: { period: ShiftOption; staff: Employee[] }[] = [];
  for (const e of active) {
    const period = (e.weeklySchedule?.[tIdx] ?? "Off") as ShiftOption;
    if (period === "Off") continue;
    const found = buckets.find((b) => b.period === period);
    if (found) found.staff.push(e);
    else buckets.push({ period, staff: [e] });
  }
  // Stable display order.
  const order: ShiftOption[] = ["Full day", "1st shift", "2nd shift", "3rd shift"];
  buckets.sort((a, b) => order.indexOf(a.period) - order.indexOf(b.period));

  // Combined recent activity, newest first.
  const activity = [
    ...recentlyHired.map((e) => ({
      kind: "Onboarded" as const,
      name: e.name, role: e.role,
      at: new Date(e.hireDate).getTime(),
      note: "",
    })),
    ...recentlyOffboarded.map((e) => ({
      kind: "Offboarded" as const,
      name: e.name, role: e.role,
      at: e.offboardedAt ?? 0,
      note: e.offboardReason ?? "",
    })),
  ].sort((a, b) => b.at - a.at);

  return (
    <AppShell title="HR Dashboard" subtitle={`${fmtDate()} · ${store.branchName(branch)}`}>
      {/* KPI row — four primary tiles, breathing room. */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Active staff",      v: String(active.length),              hint: "on the roster",       I: Users },
          { l: "On shift today",    v: String(clockedIn),                   hint: `of ${active.length} active`, I: Clock },
          { l: "Onboarded (30d)",   v: String(recentlyHired.length),        hint: "new hires",           I: UserPlus, tone: "text-primary" },
          { l: "Offboarded (30d)",  v: String(recentlyOffboarded.length),   hint: "records retained",    I: UserMinus, tone: recentlyOffboarded.length > 0 ? "text-warning" : undefined },
        ].map((s) => {
          const I = s.I;
          return (
            <div key={s.l} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-primary"><I className="h-4 w-4" /></span>
              </div>
              <p className={`mt-2 text-3xl font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
            </div>
          );
        })}
      </section>

      {/* Alerts strip — single panel summarising things that need attention. */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
          <span className="flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${gaps > 0 ? "text-warning" : "text-muted-foreground/40"}`} />
            <span className={gaps > 0 ? "text-foreground" : "text-muted-foreground"}>
              <strong className="font-semibold">{gaps}</strong> missing document{gaps !== 1 ? "s" : ""}
            </span>
          </span>
          <span className="flex items-center gap-2">
            <Clock className={`h-4 w-4 ${certsDue > 0 ? "text-destructive" : "text-muted-foreground/40"}`} />
            <span className={certsDue > 0 ? "text-foreground" : "text-muted-foreground"}>
              <strong className="font-semibold">{certsDue}</strong> cert{certsDue !== 1 ? "s" : ""} expiring (30d)
            </span>
          </span>
          <span className="flex items-center gap-2">
            <ShieldAlert className={`h-4 w-4 ${lateToday.length > 0 ? "text-destructive" : "text-muted-foreground/40"}`} />
            <span className={lateToday.length > 0 ? "text-foreground" : "text-muted-foreground"}>
              <strong className="font-semibold">{lateToday.length}</strong> late today
              {lateToday.length > 0 && ` · ${lateToday.map((e) => e.name).join(", ")}`}
            </span>
          </span>
          <Link href="/staff" className="ml-auto text-xs font-medium text-primary hover:underline">Manage staff →</Link>
        </div>
      </section>

      {/* Today's roster, by shift period. */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />Today&apos;s roster
            </h2>
            <p className="text-xs text-muted-foreground">{todayDay} · staff scheduled to work, grouped by shift</p>
          </div>
        </div>
        {buckets.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No staff scheduled today. <Link href="/staff" className="text-primary hover:underline">Set weekly schedules</Link>.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {buckets.map((b) => (
              <div key={b.period} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${shiftCell[b.period]}`}>{b.period}</span>
                  <span className="text-xs text-muted-foreground">{b.staff.length} staff</span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {b.staff.map((s) => {
                    const here = onSite(s.id);
                    const warn = lateMarks(s.id) >= 3;
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${here ? "bg-primary" : "bg-muted-foreground/30"}`} />
                          <span className="truncate">{s.name}</span>
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {s.role}{warn ? " · ⚠" : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Weekly schedule grid. */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">This week</h2>
            <p className="text-xs text-muted-foreground">Each staff member&apos;s shift for every day</p>
          </div>
          <Link href="/staff" className="text-xs font-medium text-primary hover:underline">Edit schedules →</Link>
        </div>
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
          {active.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No active staff at this branch.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Staff</th>
                  {WEEK_DAYS.map((d, i) => (
                    <th key={d} className={`px-2 py-2.5 text-center font-medium ${i === tIdx ? "text-primary" : ""}`}>
                      {d}{i === tIdx ? " ·" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.map((e) => {
                  const schedule = e.weeklySchedule ?? Array(7).fill("Off");
                  return (
                    <tr key={e.id} className="border-b border-border last:border-0 hover:bg-surface/40">
                      <td className="px-4 py-2">
                        <p className="font-medium">{e.name}</p>
                        <p className="text-[11px] text-muted-foreground">{e.role}</p>
                      </td>
                      {WEEK_DAYS.map((_d, i) => {
                        const v = (schedule[i] ?? "Off") as ShiftOption;
                        const isToday = i === tIdx;
                        return (
                          <td key={i} className="px-2 py-2 text-center">
                            <span
                              className={[
                                "inline-block rounded-md px-2 py-1 text-[11px] font-medium",
                                shiftCell[v],
                                isToday && v !== "Off" ? "ring-2 ring-primary/40" : "",
                              ].join(" ")}
                              title={v}
                            >
                              {v === "Off" ? "—" : v === "Full day" ? "Full" : v.replace(" shift", "")}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Combined onboarding / offboarding timeline. */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Recent activity</h2>
            <p className="text-xs text-muted-foreground">Last 30 days of onboarding and offboarding</p>
          </div>
        </div>
        {activity.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No HR activity in the last 30 days.
          </div>
        ) : (
          <ul className="space-y-2">
            {activity.map((a, i) => {
              const onb = a.kind === "Onboarded";
              const Icon = onb ? UserPlus : UserMinus;
              return (
                <li key={`${a.kind}-${i}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${onb ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">{a.name}</span>
                      <span className="text-muted-foreground"> · {a.role} · {a.kind.toLowerCase()}</span>
                    </p>
                    {a.note && <p className="text-xs text-muted-foreground truncate">{a.note}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{daysAgo(a.at)}d ago</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
