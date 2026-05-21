"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { useAuth } from "@/lib/auth";
import { useStore, daysUntil, type Employee, type IncidentType } from "@/lib/store";
import { Plus, Clock, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";

const ROLES = ["Cashier", "Bartender", "Server", "Head Chef", "Cook", "Storekeeper", "Operations Manager", "Rider"];
const INCIDENT_TYPES: IncidentType[] = ["Lateness", "Customer complaint", "Shortage", "Misconduct", "Damage", "Commendation"];

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Staff() {
  const store = useStore();
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Employee | null>(null);
  const [logging, setLogging] = useState<Employee | null>(null);

  const branch = store.currentBranch;
  const employees = store.employees.filter((e) => e.branch === branch);
  const lateMarks = (id: string) => store.attendance.filter((a) => a.employeeId === id && a.lateMinutes >= 15).length;
  const onSite = (id: string) => store.attendance.some((a) => a.employeeId === id && a.date === todayISO());
  const complianceGap = (e: Employee) =>
    !e.compliance.guarantor || !e.compliance.contract || !e.compliance.idCard;

  const clockedIn = employees.filter((e) => onSite(e.id)).length;
  const gaps = employees.filter(complianceGap).length;
  const certsDue = employees.filter((e) => daysUntil(e.certExpiry) <= 30).length;

  return (
    <AppShell title="Staff" subtitle={`${store.branchName(branch)} · employee records, attendance & discipline`}>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { l: "Employees", v: String(employees.length) },
          { l: "Clocked in today", v: String(clockedIn) },
          { l: "Compliance gaps", v: String(gaps), tone: gaps > 0 ? "text-warning" : undefined },
          { l: "Certs expiring", v: String(certsDue), tone: certsDue > 0 ? "text-destructive" : undefined },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${s.tone ?? ""}`}>{s.v}</p>
          </div>
        ))}
      </section>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <header className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold">Employee records</h2>
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" />New employee
          </button>
        </header>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border bg-surface/40">
              <th className="font-medium px-5 py-2.5">Employee</th>
              <th className="font-medium px-5 py-2.5">Role</th>
              <th className="font-medium px-5 py-2.5">Today</th>
              <th className="font-medium px-5 py-2.5">Lateness</th>
              <th className="font-medium px-5 py-2.5">Flags</th>
              <th className="font-medium px-5 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No employees at this branch.</td></tr>
            ) : employees.map((e) => {
              const marks = lateMarks(e.id);
              const here = onSite(e.id);
              const certDays = daysUntil(e.certExpiry);
              return (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {e.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <span className="font-medium">{e.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{e.role}</td>
                  <td className="px-5 py-3">
                    {here
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-primary"><CheckCircle2 className="h-3 w-3" />On site</span>
                      : <span className="text-xs text-muted-foreground">Not clocked in</span>}
                  </td>
                  <td className="px-5 py-3">
                    {marks >= 3
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive"><ShieldAlert className="h-3.5 w-3.5" />{marks} marks · warning due</span>
                      : marks > 0
                        ? <span className="text-xs text-warning font-medium">{marks} late mark{marks !== 1 ? "s" : ""}</span>
                        : <span className="text-xs text-muted-foreground">Clean</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      {complianceGap(e) && <span className="inline-flex rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium">Docs</span>}
                      {certDays <= 30 && <span className="inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">Cert</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => setViewing(e)} className="text-xs font-medium text-primary hover:underline">View file</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {creating && <NewEmployeeModal branch={branch} onClose={() => setCreating(false)} />}
      {viewing && <EmployeeModal employee={viewing} onClose={() => setViewing(null)} onLogIncident={() => setLogging(viewing)} />}
      {logging && <LogIncidentModal employee={logging} onClose={() => setLogging(null)} />}
    </AppShell>
  );
}

// ── Employee file ────────────────────────────────────────────────────────────

function EmployeeModal({ employee, onClose, onLogIncident }: { employee: Employee; onClose: () => void; onLogIncident: () => void }) {
  const store = useStore();
  const e = store.employees.find((x) => x.id === employee.id) ?? employee;
  const att = store.attendance.filter((a) => a.employeeId === e.id);
  const marks = att.filter((a) => a.lateMinutes >= 15).length;
  const incidents = store.disciplinary.filter((d) => d.employeeId === e.id);
  const here = att.some((a) => a.date === todayISO());
  const certDays = daysUntil(e.certExpiry);
  const docs: [string, boolean][] = [
    ["Guarantor form", e.compliance.guarantor],
    ["Signed contract", e.compliance.contract],
    ["ID card", e.compliance.idCard],
  ];

  return (
    <Modal
      open
      onClose={onClose}
      title={e.name}
      description={`${e.role} · ${store.branchName(e.branch)} · since ${e.hireDate}`}
      size="lg"
      footer={
        <>
          <ModalButton variant="ghost" onClick={onLogIncident}>Log incident</ModalButton>
          {here
            ? <ModalButton onClick={() => { store.clockOut(e.id); toast.success(`${e.name} clocked out`); }}>Clock out</ModalButton>
            : <ModalButton onClick={() => { store.clockIn(e.id); toast.success(`${e.name} clocked in`); }}>Clock in</ModalButton>}
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Detail label="Phone" value={e.phone} />
          <Detail label="Next of kin" value={e.nextOfKin} />
          <Detail label="Scheduled start" value={e.scheduledStart} />
          <Detail label="Status" value={e.status} />
        </div>

        {/* Compliance */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Compliance documents</p>
          <div className="flex flex-wrap gap-2">
            {docs.map(([label, ok]) => (
              <span key={label} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${ok ? "border-border bg-surface/60" : "border-warning/40 bg-warning/10"}`}>
                {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                {label}{ok ? "" : " — missing"}
              </span>
            ))}
            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${certDays <= 30 ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-border bg-surface/60"}`}>
              <Clock className="h-3.5 w-3.5" />{e.certName} · {certDays < 0 ? "expired" : `${certDays}d left`}
            </span>
          </div>
        </div>

        {/* Pay structure */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Salary structure</p>
          <div className="grid grid-cols-4 gap-2 text-sm">
            <Box label="Base" value={`₦${e.baseSalary.toLocaleString()}`} />
            <Box label="Transport" value={`₦${e.transport.toLocaleString()}`} />
            <Box label="Housing" value={`₦${e.housing.toLocaleString()}`} />
            <Box label="Gross" value={`₦${(e.baseSalary + e.transport + e.housing).toLocaleString()}`} highlight />
          </div>
        </div>

        {/* Attendance */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Attendance · {marks >= 3 ? <span className="text-destructive font-semibold">{marks} late marks — warning due (3-strike rule)</span> : `${marks} late mark${marks !== 1 ? "s" : ""}`}
          </p>
          {att.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attendance recorded.</p>
          ) : (
            <ul className="space-y-1 text-sm">
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
        </div>

        {/* Disciplinary */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Disciplinary &amp; commendations</p>
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

// ── New employee ─────────────────────────────────────────────────────────────

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
    store.addEmployee({
      name: name.trim(), role, branch, phone: phone.trim(), nextOfKin: nextOfKin.trim(),
      hireDate: new Date().toISOString().slice(0, 10), scheduledStart: start,
      baseSalary: Number(base) || 0, transport: Number(transport) || 0, housing: Number(housing) || 0,
      compliance: { guarantor: false, contract: false, idCard: false },
      certName: "Food handler cert", certExpiry: dateInYear(), status: "Active",
    });
    toast.success(`${name.trim()} added to ${store.branchName(branch)}`);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New employee"
      description="Create the staff file — upload compliance docs later"
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

// ── Shared ───────────────────────────────────────────────────────────────────

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

function Box({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-2.5 text-center ${highlight ? "bg-primary/5 border-primary/20" : "bg-surface/60 border-border"}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}
