"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, STAFF_ROSTER, type StaffUser } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { ChefHat, Wine, CreditCard, LayoutDashboard, Boxes, Crown, Delete, Calculator, UserCog } from "lucide-react";

const roleIcon: Record<string, typeof ChefHat> = {
  owner: Crown,
  manager: LayoutDashboard,
  cashier: CreditCard,
  kitchen: ChefHat,
  bartender: Wine,
  storekeeper: Boxes,
  accountant: Calculator,
  hr: UserCog,
};

const roleColor: Record<string, { bg: string; text: string; border: string }> = {
  owner:       { bg: "bg-amber-50",   text: "text-amber-600",   border: "border-amber-200" },
  manager:     { bg: "bg-primary/5",  text: "text-primary",     border: "border-primary/20" },
  cashier:     { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-200" },
  kitchen:     { bg: "bg-orange-50",  text: "text-orange-600",  border: "border-orange-200" },
  bartender:   { bg: "bg-purple-50",  text: "text-purple-600",  border: "border-purple-200" },
  storekeeper: { bg: "bg-sky-50",     text: "text-sky-600",     border: "border-sky-200" },
  accountant:  { bg: "bg-teal-50",    text: "text-teal-600",    border: "border-teal-200" },
  hr:          { bg: "bg-indigo-50",  text: "text-indigo-600",  border: "border-indigo-200" },
};

function PinPad({ staff, onClose }: { staff: StaffUser; onClose: () => void }) {
  const { login } = useAuth();
  const store = useStore();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  // Track failed attempts within this PinPad session so the audit entry
  // distinguishes a slip ("Login failed × 1") from a real attack ("× 5+").
  const [failedAttempts, setFailedAttempts] = useState(0);

  const Icon = roleIcon[staff.role];
  const col = roleColor[staff.role];

  function press(digit: string) {
    if (pin.length >= 4) return;
    const next = pin + digit;
    setError(false);
    setPin(next);
    if (next.length === 4) setTimeout(() => attempt(next), 100);
  }

  function attempt(value: string) {
    if (login(staff.id, value)) {
      // Industry-standard audit trail — every successful login lands here.
      // Failed attempts (≥1) are appended to the same entry so we can spot
      // suspicious patterns at a glance from /audit.
      store.logAudit({
        branch: staff.branch ?? "—",
        actor: staff.name,
        category: "Security",
        action: "Sign-in",
        detail: failedAttempts > 0
          ? `${staff.role} signed in · ${failedAttempts} failed attempt${failedAttempts === 1 ? "" : "s"} before success`
          : `${staff.role} signed in`,
        ref: staff.id,
        severity: failedAttempts >= 3 ? "warning" : "info",
      });
      router.push(staff.defaultRoute);
    } else {
      // PCI-DSS-style audit on failed PIN attempts — every wrong entry is logged.
      const nextFailed = failedAttempts + 1;
      setFailedAttempts(nextFailed);
      store.logAudit({
        branch: staff.branch ?? "—",
        actor: staff.name,
        category: "Security",
        action: "Sign-in failed",
        detail: `Wrong PIN for ${staff.role} (attempt ${nextFailed})`,
        ref: staff.id,
        severity: nextFailed >= 3 ? "warning" : "info",
      });
      setShake(true);
      setError(true);
      setPin("");
      setTimeout(() => setShake(false), 400);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <div
        className={[
          "w-full max-w-xs rounded-3xl border border-border bg-card p-7 shadow-2xl",
          shake ? "animate-[shake_0.4s_ease]" : "",
        ].join(" ")}
      >
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className={`grid h-16 w-16 place-items-center rounded-2xl border-2 ${col.bg} ${col.border}`}>
            <Icon className={`h-8 w-8 ${col.text}`} strokeWidth={1.5} />
          </div>
          <p className="font-semibold text-base">{staff.name}</p>
          <p className="text-sm text-muted-foreground">{staff.title}</p>
        </div>

        <div className="flex justify-center gap-4 mb-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={[
                "h-4 w-4 rounded-full border-2 transition-all duration-150",
                pin.length > i
                  ? error ? "bg-destructive border-destructive scale-110"
                           : "bg-primary border-primary scale-110"
                  : "border-border bg-transparent",
              ].join(" ")}
            />
          ))}
        </div>
        {error && (
          <p className="text-center text-xs text-destructive font-medium mb-4">Wrong PIN — try again</p>
        )}
        {!error && <div className="mb-4" />}

        <div className="grid grid-cols-3 gap-2.5">
          {[1,2,3,4,5,6,7,8,9].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => press(String(n))}
              className="rounded-2xl border border-border bg-background py-4 text-xl font-semibold hover:bg-surface active:scale-95 transition-all"
            >
              {n}
            </button>
          ))}
          <div />
          <button
            type="button"
            onClick={() => press("0")}
            className="rounded-2xl border border-border bg-background py-4 text-xl font-semibold hover:bg-surface active:scale-95 transition-all"
          >
            0
          </button>
          <button
            type="button"
            aria-label="Delete"
            onClick={() => setPin((p) => { setError(false); return p.slice(0, -1); })}
            className="rounded-2xl border border-border bg-background py-4 flex items-center justify-center hover:bg-surface active:scale-95 transition-all"
          >
            <Delete className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<StaffUser | null>(null);

  useEffect(() => {
    if (user) router.push(user.defaultRoute);
  }, [user, router]);

  if (user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-12">
      <div className="mb-10 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold shadow-lg shadow-primary/20">
          H
        </div>
        <h1 className="text-2xl font-bold tracking-tight">NativeID</h1>
        <p className="mt-1 text-sm text-muted-foreground">Who&apos;s working today?</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-md">
        {STAFF_ROSTER.map((staff) => {
          const Icon = roleIcon[staff.role];
          const col = roleColor[staff.role];
          return (
            <button
              key={staff.id}
              type="button"
              onClick={() => setSelected(staff)}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-4 py-5 hover:border-primary/30 hover:shadow-sm transition-all text-center active:scale-95"
            >
              <div className={`grid h-14 w-14 place-items-center rounded-2xl border-2 ${col.bg} ${col.border} group-hover:scale-105 transition-transform`}>
                <Icon className={`h-7 w-7 ${col.text}`} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{staff.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{staff.title}</p>
              </div>
            </button>
          );
        })}
      </div>

      {selected && <PinPad staff={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
