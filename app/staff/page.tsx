"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { useAuth } from "@/lib/auth";
import {
  useStore, daysUntil, complianceGap,
  type Employee, type IncidentType, type ComplianceDoc,
} from "@/lib/store";
import {
  Clock, CheckCircle2, AlertTriangle, ShieldAlert, CalendarDays, UserMinus, UserPlus,
  ChevronRight, FileCheck2, Upload, Download, FileWarning,
} from "lucide-react";

const ROLES = ["Cashier", "Bartender", "Server", "Head Chef", "Cook", "Storekeeper", "Operations Manager", "Rider"];
const INCIDENT_TYPES: IncidentType[] = ["Lateness", "Customer complaint", "Shortage", "Misconduct", "Damage", "Commendation"];

// Mon..Sun.
const WEEK_DAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const SHIFT_OPTIONS = ["Off", "Full day", "1st shift", "2nd shift", "3rd shift"] as const;
type ShiftOption = typeof SHIFT_OPTIONS[number];
const DEFAULT_SCHEDULE: string[] = ["Off", "Off", "Off", "Off", "Off", "Off", "Off"];

// Shift colour key — matches scheduling apps like Deputy / When I Work.
const shiftActive: Record<ShiftOption, string> = {
  "Off":       "bg-muted text-muted-foreground border-border",
  "Full day":  "bg-primary text-primary-foreground border-primary",
  "1st shift": "bg-sky-100 text-sky-700 border-sky-300",
  "2nd shift": "bg-amber-100 text-amber-800 border-amber-300",
  "3rd shift": "bg-violet-100 text-violet-700 border-violet-300",
};

const statusBadge: Record<Employee["status"], string> = {
  Active:      "bg-surface text-primary border-primary/20",
  Suspended:   "bg-warning/15 text-foreground border-warning/30",
  Offboarded:  "bg-muted text-muted-foreground border-border",
};

const todayISO = () => new Date().toISOString().slice(0, 10);

function workingDays(schedule: string[] | undefined): string {
  const s = schedule ?? DEFAULT_SCHEDULE;
  const working = s.filter((d) => d !== "Off").length;
  if (working === 0) return "No working days set";
  if (working === 7) return "Works every day";
  return `${working} working day${working !== 1 ? "s" : ""} / week`;
}

export default function Staff() {
  const store = useStore();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Employee | null>(null);
  const [logging, setLogging] = useState<Employee | null>(null);
  const [scheduling, setScheduling] = useState<Employee | null>(null);
  const [offboarding, setOffboarding] = useState<Employee | null>(null);
  const [showOffboarded, setShowOffboarded] = useState(false);

  const branch = store.currentBranch;
  const allBranchEmps = store.employees.filter((e) => e.branch === branch);
  const employees = showOffboarded ? allBranchEmps : allBranchEmps.filter((e) => e.status !== "Offboarded");

  const lateMarks = (id: string) => store.attendance.filter((a) => a.employeeId === id && a.lateMinutes >= 15).length;
  const onSite = (id: string) => store.attendance.some((a) => a.employeeId === id && a.date === todayISO());

  const activeEmps = allBranchEmps.filter((e) => e.status === "Active");
  const clockedIn = activeEmps.filter((e) => onSite(e.id)).length;
  const gaps = activeEmps.filter(complianceGap).length;
  const certsDue = activeEmps.filter((e) => daysUntil(e.certExpiry) <= 30).length;
  const offboardedCount = allBranchEmps.filter((e) => e.status === "Offboarded").length;

  return (
    <AppShell title="Staff" subtitle={`${store.branchName(branch)} · employee records, compliance & schedules`}>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Active staff", v: String(activeEmps.length) },
          { l: "On shift today", v: String(clockedIn), hint: `of ${activeEmps.length}` },
          { l: "Compliance gaps", v: String(gaps), tone: gaps > 0 ? "text-warning" : undefined, hint: "missing documents" },
          { l: "Certs expiring", v: String(certsDue), tone: certsDue > 0 ? "text-destructive" : undefined, hint: "within 30 days" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 text-3xl font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</p>
            {s.hint && <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>}
          </div>
        ))}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-semibold">Employees</h2>
            <p className="text-xs text-muted-foreground">Click any row to open the staff file</p>
          </div>
          <div className="flex items-center gap-3">
            {offboardedCount > 0 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={showOffboarded} onChange={(e) => setShowOffboarded(e.target.checked)} />
                Show offboarded ({offboardedCount})
              </label>
            )}
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <UserPlus className="h-4 w-4" />Onboard staff
            </button>
          </div>
        </div>

        {employees.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            No employees at this branch yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {employees.map((e) => {
              const here = onSite(e.id);
              const marks = lateMarks(e.id);
              const certDays = daysUntil(e.certExpiry);
              const off = e.status === "Offboarded";
              return (
                <li key={e.id}>
                  <button
                    onClick={() => setViewing(e)}
                    className={`flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-surface ${off ? "opacity-60" : ""}`}
                  >
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {e.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{e.name}</p>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusBadge[e.status]}`}>{e.status}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {e.role} · {workingDays(e.weeklySchedule)}
                      </p>
                      {!off && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                          <span className={`inline-flex items-center gap-1 ${here ? "text-primary" : "text-muted-foreground"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${here ? "bg-primary" : "bg-muted-foreground/40"}`} />
                            {here ? "On site today" : "Not clocked in"}
                          </span>
                          {marks >= 3 && (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <ShieldAlert className="h-3 w-3" />{marks} late marks — warning due
                            </span>
                          )}
                          {marks > 0 && marks < 3 && (
                            <span className="text-warning">{marks} late mark{marks !== 1 ? "s" : ""}</span>
                          )}
                          {complianceGap(e) && (
                            <span className="inline-flex items-center gap-1 text-warning">
                              <AlertTriangle className="h-3 w-3" />Missing documents
                            </span>
                          )}
                          {certDays <= 30 && (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <Clock className="h-3 w-3" />Cert {certDays < 0 ? "expired" : `in ${certDays}d`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {creating && <NewEmployeeModal branch={branch} onClose={() => setCreating(false)} />}
      {viewing && (
        <EmployeeModal
          employee={viewing}
          onClose={() => setViewing(null)}
          onLogIncident={() => setLogging(viewing)}
          onEditSchedule={() => setScheduling(viewing)}
          onOffboard={() => setOffboarding(viewing)}
        />
      )}
      {logging && <LogIncidentModal employee={logging} onClose={() => setLogging(null)} />}
      {scheduling && <ScheduleModal employee={scheduling} onClose={() => setScheduling(null)} />}
      {offboarding && <OffboardModal employee={offboarding} onClose={() => setOffboarding(null)} />}
    </AppShell>
  );
}

// ── Employee file ────────────────────────────────────────────────────────────

function EmployeeModal({
  employee, onClose, onLogIncident, onEditSchedule, onOffboard,
}: {
  employee: Employee;
  onClose: () => void;
  onLogIncident: () => void;
  onEditSchedule: () => void;
  onOffboard: () => void;
}) {
  const store = useStore();
  const { user } = useAuth();
  const me = user?.name ?? "Manager";
  const e = store.employees.find((x) => x.id === employee.id) ?? employee;
  const att = store.attendance.filter((a) => a.employeeId === e.id);
  const marks = att.filter((a) => a.lateMinutes >= 15).length;
  const incidents = store.disciplinary.filter((d) => d.employeeId === e.id);
  const here = att.some((a) => a.date === todayISO());
  const certDays = daysUntil(e.certExpiry);
  const offboarded = e.status === "Offboarded";
  const schedule = e.weeklySchedule ?? DEFAULT_SCHEDULE;

  function setDoc(field: "guarantor" | "contract" | "idCard", doc: ComplianceDoc) {
    store.updateEmployee({ ...e, compliance: { ...e.compliance, [field]: doc } });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={e.name}
      description={`${e.role} · ${store.branchName(e.branch)} · since ${e.hireDate}`}
      size="lg"
      footer={
        offboarded ? (
          <ModalButton onClick={() => { store.reactivateEmployee(e.id, me); toast.success(`${e.name} reactivated`); onClose(); }}>
            Reactivate staff
          </ModalButton>
        ) : (
          <>
            <ModalButton variant="ghost" onClick={onLogIncident}>Log incident</ModalButton>
            {here
              ? <ModalButton onClick={() => { store.clockOut(e.id); toast.success(`${e.name} clocked out`); }}>Clock out</ModalButton>
              : <ModalButton onClick={() => { store.clockIn(e.id); toast.success(`${e.name} clocked in`); }}>Clock in</ModalButton>}
          </>
        )
      }
    >
      <div className="space-y-6">
        {/* Profile */}
        <Section title="Profile">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Detail label="Phone" value={e.phone} />
            <Detail label="Next of kin" value={e.nextOfKin} />
            <Detail label="Shift start" value={e.scheduledStart} />
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</p>
              <span className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge[e.status]}`}>{e.status}</span>
            </div>
          </div>
          {offboarded && (
            <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Offboarded</p>
              <p className="mt-1">{e.offboardReason || "No reason recorded."}</p>
              {e.offboardedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(e.offboardedAt).toLocaleDateString()} — record retained on file.
                </p>
              )}
            </div>
          )}
        </Section>

        {/* Compliance documents */}
        <Section title="Compliance documents" hint="Accepted: PDF, JPG, PNG (max 5 MB)">
          <div className="space-y-2">
            <DocRow label="Guarantor form" doc={e.compliance.guarantor} disabled={offboarded} onSet={(d) => setDoc("guarantor", d)} />
            <DocRow label="Signed contract" doc={e.compliance.contract} disabled={offboarded} onSet={(d) => setDoc("contract", d)} />
            <DocRow label="ID card" doc={e.compliance.idCard} disabled={offboarded} onSet={(d) => setDoc("idCard", d)} />
            <div className={`flex items-center gap-3 rounded-lg border p-3 ${certDays <= 30 ? "border-destructive/30 bg-destructive/5" : "border-border"}`}>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface text-primary">
                <Clock className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{e.certName}</p>
                <p className="text-xs text-muted-foreground">
                  Expires {e.certExpiry} · {certDays < 0 ? `${-certDays}d overdue` : `${certDays}d left`}
                </p>
              </div>
            </div>
          </div>
        </Section>

        {/* Weekly schedule */}
        <Section
          title="Weekly schedule"
          right={
            !offboarded && (
              <button onClick={onEditSchedule} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                <CalendarDays className="h-3.5 w-3.5" />Edit schedule
              </button>
            )
          }
        >
          <div className="grid grid-cols-7 gap-1.5">
            {(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const).map((d, i) => {
              const shift = (schedule[i] ?? "Off") as ShiftOption;
              const off = shift === "Off";
              return (
                <div key={d} className={`rounded-lg border px-2 py-2 text-center ${off ? "border-border bg-surface/40 text-muted-foreground" : shiftActive[shift]}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{d}</p>
                  <p className="mt-0.5 text-[11px] font-medium">{shift === "Off" ? "Off" : shift.replace(" shift", "")}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{workingDays(schedule)}</p>
        </Section>

        {/* Salary structure */}
        <Section title="Salary structure">
          <div className="grid grid-cols-4 gap-2 text-sm">
            <Stat label="Base" value={`₦${e.baseSalary.toLocaleString()}`} />
            <Stat label="Transport" value={`₦${e.transport.toLocaleString()}`} />
            <Stat label="Housing" value={`₦${e.housing.toLocaleString()}`} />
            <Stat label="Gross" value={`₦${(e.baseSalary + e.transport + e.housing).toLocaleString()}`} highlight />
          </div>
        </Section>

        {/* Attendance */}
        <Section title="Attendance" hint={marks >= 3 ? "Warning due — 3-strike rule" : `${marks} late mark${marks !== 1 ? "s" : ""}`}>
          {att.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance recorded.</p>
          ) : (
            <ul className="text-sm">
              {att.slice(0, 5).map((a) => (
                <li key={a.id} className="flex justify-between border-b border-border last:border-0 py-1.5">
                  <span>{a.date}</span>
                  <span className={a.lateMinutes >= 15 ? "text-destructive font-medium" : "text-muted-foreground"}>
                    {a.lateMinutes > 0 ? `${a.lateMinutes} min late` : "on time"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Disciplinary */}
        <Section title="Disciplinary & commendations">
          {incidents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents on file.</p>
          ) : (
            <ul className="space-y-2">
              {incidents.map((d) => (
                <li key={d.id} className={`rounded-lg border p-3 text-sm ${d.type === "Commendation" ? "border-primary/20 bg-primary/5" : "border-border"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{d.type}</span>
                    <span className="text-xs text-muted-foreground">{d.by}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>
                  <p className="text-xs mt-0.5">Action: <span className="font-medium">{d.action}</span></p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Offboarding action */}
        {!offboarded && (
          <div className="border-t border-border pt-4">
            <button
              onClick={onOffboard}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:underline"
            >
              <UserMinus className="h-3.5 w-3.5" />Offboard staff (record retained)
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Compliance document row (upload / replace / download) ────────────────────

function DocRow({ label, doc, onSet, disabled }: { label: string; doc: ComplianceDoc; onSet: (d: ComplianceDoc) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const MAX_FILE_BYTES = 5 * 1024 * 1024;     // 5 MB upload ceiling
  const MAX_INLINE_BYTES = 1024 * 1024;       // 1 MB — only files at or under this keep a downloadable dataUrl

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`${file.name} is too large (max 5 MB)`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onSet({
        uploaded: true,
        fileName: file.name,
        size: file.size,
        uploadedAt: Date.now(),
        dataUrl: file.size <= MAX_INLINE_BYTES ? dataUrl : undefined,
      });
      toast.success(`${file.name} uploaded`);
    };
    reader.onerror = () => toast.error("Couldn't read the file");
    reader.readAsDataURL(file);
  }

  const sizeKB = doc.size ? Math.max(1, Math.round(doc.size / 1024)) : 0;
  const fmtDate = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "";

  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${doc.uploaded ? "border-border" : "border-warning/40 bg-warning/5"}`}>
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${doc.uploaded ? "bg-primary/10 text-primary" : "bg-warning/15 text-foreground"}`}>
        {doc.uploaded ? <FileCheck2 className="h-5 w-5" /> : <FileWarning className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {doc.uploaded ? (
          <p className="text-xs text-muted-foreground truncate">
            {doc.fileName} · {sizeKB} KB · uploaded {fmtDate}
          </p>
        ) : (
          <p className="text-xs text-warning">Not uploaded yet</p>
        )}
      </div>
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFile} />
      <div className="flex items-center gap-1.5">
        {doc.uploaded && doc.dataUrl && (
          <a
            href={doc.dataUrl}
            download={doc.fileName}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium hover:bg-surface"
          >
            <Download className="h-3.5 w-3.5" />Download
          </a>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold ${doc.uploaded ? "border border-border bg-card hover:bg-surface" : "bg-primary text-primary-foreground hover:bg-primary/90"} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <Upload className="h-3.5 w-3.5" />{doc.uploaded ? "Replace" : "Upload"}
        </button>
      </div>
    </div>
  );
}

// ── Schedule editor — chip picker + quick-fill presets ───────────────────────

function ScheduleModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const store = useStore();
  const [schedule, setSchedule] = useState<string[]>(
    employee.weeklySchedule ? [...employee.weeklySchedule] : [...DEFAULT_SCHEDULE],
  );

  function setDay(i: number, value: string) {
    setSchedule((prev) => prev.map((s, idx) => (idx === i ? value : s)));
  }

  function applyPreset(values: string[]) {
    setSchedule(values);
  }

  const PRESETS: { label: string; values: string[] }[] = [
    { label: "Mon–Fri · 1st shift", values: ["1st shift", "1st shift", "1st shift", "1st shift", "1st shift", "Off", "Off"] },
    { label: "Mon–Fri · 2nd shift", values: ["2nd shift", "2nd shift", "2nd shift", "2nd shift", "2nd shift", "Off", "Off"] },
    { label: "Mon–Sat · Full day",   values: ["Full day", "Full day", "Full day", "Full day", "Full day", "Full day", "Off"] },
    { label: "Tue–Sat · 2nd shift", values: ["Off", "2nd shift", "2nd shift", "2nd shift", "2nd shift", "2nd shift", "Off"] },
    { label: "All days off",         values: [...DEFAULT_SCHEDULE] },
  ];

  const workingCount = schedule.filter((s) => s !== "Off").length;

  function submit() {
    store.updateEmployee({ ...employee, weeklySchedule: schedule });
    toast.success(`Schedule saved for ${employee.name}`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Weekly schedule — ${employee.name}`}
      description="Set each day's shift period · the HR Dashboard rolls this up into a branch roster"
      size="lg"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Save schedule</ModalButton></>}
    >
      <div className="space-y-5">
        {/* Quick fills */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Quick fill</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.values)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-surface"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Per-day chip picker */}
        <div className="space-y-2">
          {WEEK_DAYS_LONG.map((day, i) => {
            const current = (schedule[i] ?? "Off") as ShiftOption;
            return (
              <div key={day} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
                <p className="w-24 shrink-0 text-sm font-medium">{day}</p>
                <div className="flex flex-wrap gap-1.5">
                  {SHIFT_OPTIONS.map((opt) => {
                    const selected = current === opt;
                    const cls = selected
                      ? `${shiftActive[opt]} border`
                      : "border border-border bg-card text-foreground/70 hover:bg-surface";
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setDay(i, opt)}
                        aria-pressed={selected}
                        className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${cls}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary + colour key */}
        <div className="flex items-center justify-between gap-3 rounded-lg bg-surface/50 px-3 py-2 text-xs">
          <span className="font-medium">{workingCount} working day{workingCount !== 1 ? "s" : ""} · {7 - workingCount} off</span>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {(["Full day", "1st shift", "2nd shift", "3rd shift"] as ShiftOption[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${shiftActive[s].split(" ")[0]}`} />
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Offboard ─────────────────────────────────────────────────────────────────

function OffboardModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const store = useStore();
  const { user } = useAuth();
  const [reason, setReason] = useState("Resignation");
  const [note, setNote] = useState("");

  function submit() {
    const fullReason = note.trim() ? `${reason} — ${note.trim()}` : reason;
    store.offboardEmployee(employee.id, fullReason, user?.name ?? "Manager");
    toast.success(`${employee.name} offboarded — record retained on file`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Offboard ${employee.name}`}
      description="The record is retained on file — only the active status is changed"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton variant="danger" onClick={submit}>Offboard staff</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Reason</span>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
            {["Resignation", "Termination", "End of contract", "Retirement", "Redundancy", "Other"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Note (optional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Context — e.g. last working day, handover notes" className={`${inputCls} resize-y`} />
        </label>
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
          The employee is marked <strong>Offboarded</strong>: they no longer count in active staff, payroll, or the roster — but the file, attendance and disciplinary history stay searchable.
        </div>
      </div>
    </Modal>
  );
}

// ── Log incident ─────────────────────────────────────────────────────────────

function LogIncidentModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const store = useStore();
  const { user } = useAuth();
  const [type, setType] = useState<IncidentType>("Lateness");
  const [description, setDescription] = useState("");
  const [action, setAction] = useState("Verbal warning");

  function submit() {
    if (!description.trim()) { toast.error("Add a description"); return; }
    store.logDisciplinary({ employeeId: employee.id, type, description: description.trim(), action, by: user?.name ?? "Manager" });
    toast.success(`Incident logged for ${employee.name}`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Log incident — ${employee.name}`}
      description="Disciplinary query or commendation"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Save to file</ModalButton></>}
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as IncidentType)} className={inputCls}>
            {INCIDENT_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What happened…" className={`${inputCls} resize-y`} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Action taken</span>
          <select value={action} onChange={(e) => setAction(e.target.value)} className={inputCls}>
            {["Verbal warning", "Written warning", "Query issued", "Retraining", "Suspension", "Commendation", "No action"].map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
      </div>
    </Modal>
  );
}

// ── Onboard new employee ─────────────────────────────────────────────────────

function NewEmployeeModal({ branch, onClose }: { branch: string; onClose: () => void }) {
  const store = useStore();
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLES[0]);
  const [phone, setPhone] = useState("");
  const [nextOfKin, setNextOfKin] = useState("");
  const [start, setStart] = useState("08:00");
  const [base, setBase] = useState("");
  const [transport, setTransport] = useState("");
  const [housing, setHousing] = useState("");

  function submit() {
    if (!name.trim()) { toast.error("Enter the employee's name"); return; }
    const empty: ComplianceDoc = { uploaded: false };
    store.addEmployee({
      name: name.trim(), role, branch, phone: phone.trim(), nextOfKin: nextOfKin.trim(),
      hireDate: new Date().toISOString().slice(0, 10), scheduledStart: start,
      baseSalary: Number(base) || 0, transport: Number(transport) || 0, housing: Number(housing) || 0,
      compliance: { guarantor: empty, contract: empty, idCard: empty },
      certName: "Food handler cert", certExpiry: dateInYear(), status: "Active",
      weeklySchedule: [...DEFAULT_SCHEDULE],
    });
    toast.success(`${name.trim()} onboarded at ${store.branchName(branch)}`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Onboard new staff"
      description="Create the staff file — set the schedule and upload compliance docs from their file once created"
      size="lg"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Create file</ModalButton></>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label="Role">
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={inputCls} /></Field>
          <Field label="Next of kin"><input value={nextOfKin} onChange={(e) => setNextOfKin(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Field label="Shift start"><input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} /></Field>
          <Field label="Base ₦"><input type="number" value={base} onChange={(e) => setBase(e.target.value)} className={inputCls} /></Field>
          <Field label="Transport ₦"><input type="number" value={transport} onChange={(e) => setTransport(e.target.value)} className={inputCls} /></Field>
          <Field label="Housing ₦"><input type="number" value={housing} onChange={(e) => setHousing(e.target.value)} className={inputCls} /></Field>
        </div>
      </div>
    </Modal>
  );
}

function dateInYear() {
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ── Shared layout primitives ─────────────────────────────────────────────────

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-2.5 text-center ${highlight ? "bg-primary/5 border-primary/20" : "bg-surface/60 border-border"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

function Section({ title, hint, right, children }: { title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
