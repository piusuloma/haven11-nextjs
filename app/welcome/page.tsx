"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  ArrowRight, ShoppingCart, ChefHat, Wine, Boxes, Users, BarChart3,
  ShieldCheck, Building2, Bike, ScrollText, Wallet, Sparkles,
  Crown, LayoutDashboard, CreditCard, UserCog, Calculator,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const modules = [
  {
    icon: ShoppingCart,
    title: "Point of sale",
    body: "Dine-in, takeout and delivery in one rail. Splits, holds, voids and shift handover built in — no extra device.",
  },
  {
    icon: ChefHat,
    title: "Kitchen & bar displays",
    body: "Tickets route to the right station the moment a server fires them. Mark ready, time the pass, keep the line moving.",
  },
  {
    icon: Boxes,
    title: "Stock that ties to the recipe",
    body: "Every plate poured or plated decrements the recipe. Low-stock and expiry alerts surface before you 86 a dish.",
  },
  {
    icon: ScrollText,
    title: "Procurement & vendors",
    body: "Reorder from supplier price lists, receive against POs, and reconcile partial deliveries without paper trails.",
  },
  {
    icon: Bike,
    title: "Dispatch & fleet",
    body: "Assign riders, track jobs from kitchen-ready to delivered, and settle bike runs at end of shift.",
  },
  {
    icon: Users,
    title: "Staff, HR & payroll",
    body: "Rosters, leave, attendance and welfare in one place. Payroll runs off the same shifts that ran your POS.",
  },
  {
    icon: Wallet,
    title: "Expenses & financials",
    body: "Petty cash, vendor bills, daily P&L and cash-up — reconciled against POS without manual re-entry.",
  },
  {
    icon: BarChart3,
    title: "Reports & alerts",
    body: "Sales by channel, top dishes, over-pours and waste. Owner sees every branch live; managers see their own.",
  },
];

const roles = [
  { icon: Crown,           name: "Owner",        scope: "Every branch, every number." },
  { icon: LayoutDashboard, name: "Manager",      scope: "Branch-scoped command centre." },
  { icon: CreditCard,      name: "Cashier",      scope: "Front of house & shift money." },
  { icon: ChefHat,         name: "Kitchen",      scope: "Live ticket queue & pass." },
  { icon: Wine,            name: "Bartender",    scope: "Bar queue & quick re-rings." },
  { icon: Boxes,           name: "Storekeeper",  scope: "Receiving, transfers, counts." },
  { icon: Calculator,      name: "Accountant",   scope: "Expenses, vendors, financials." },
  { icon: UserCog,         name: "HR",           scope: "People, payroll, welfare." },
];

const proofPoints = [
  "Built for Nigerian restaurants — naira, branches, dispatch",
  "Multi-branch with a hub for strong-room transfers",
  "PIN-pad sign-in with a full audit trail on every action",
  "Works on the till, the back office and a manager's phone",
];

export default function WelcomePage() {
  const { user } = useAuth();
  const router = useRouter();

  // If a signed-in user lands here, hop them to their home — same as /login does.
  useEffect(() => {
    if (user) router.replace(user.defaultRoute);
  }, [user, router]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">
              N
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight">NativeID</p>
              <p className="text-[11px] text-muted-foreground">Restaurant OS</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
            <a href="#modules" className="hover:text-foreground transition-colors">Modules</a>
            <a href="#roles" className="hover:text-foreground transition-colors">Roles</a>
            <a href="#scale" className="hover:text-foreground transition-colors">Multi-branch</a>
          </nav>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Sign in <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-16 sm:pt-24 pb-16">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-surface-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Built for restaurants that outgrew their POS
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Run the dining room, the kitchen and the back office{" "}
            <span className="text-primary">from one screen.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
            NativeID ROS is a Restaurant Operating System — POS, kitchen and bar displays,
            inventory, dispatch, staff and reports — wired together so a poured drink
            updates stock and a closed shift settles the till.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Sign in to the demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#modules"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold hover:bg-surface transition-colors"
            >
              See what's inside
            </a>
          </div>

          <ul className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
            {proofPoints.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4.5 w-4.5 text-primary mt-0.5 shrink-0" strokeWidth={2} />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Modules</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              Eight tools that already know about each other.
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Most restaurants buy four systems and reconcile them on a spreadsheet.
              NativeID ships them as one — every action moves the right numbers.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.title}
                  className="rounded-2xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{m.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{m.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Built for every seat</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              One system, eight tailored views.
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              A cashier shouldn't see payroll. A storekeeper doesn't need the P&amp;L.
              Each role signs in with a 4-digit PIN and lands on a screen built for the job.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {roles.map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.name}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-surface text-primary">
                      <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                    </div>
                    <p className="text-sm font-semibold">{r.name}</p>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{r.scope}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Multi-branch */}
      <section id="scale" className="border-t border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-16 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Multi-branch</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
                A second outlet should add revenue, not chaos.
              </h2>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed">
                Open a new branch and it inherits your menu, recipes, suppliers and reporting
                templates. A central strong-room hub feeds each location through internal
                transfers — so you stop reconciling who owes what across outlets.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Feature icon={Building2} text="Outlet-scoped staff & stock" />
                <Feature icon={ShieldCheck} text="Owner sees every branch live" />
                <Feature icon={Boxes} text="Hub-to-branch transfers tracked" />
                <Feature icon={BarChart3} text="Consolidated P&L on demand" />
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <p className="text-sm font-semibold">Operations overview</p>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">Live</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-5">
                <MiniStat label="Sales today" value="₦1.84M" hint="42 paid orders" />
                <MiniStat label="Open tickets" value="11" hint="kitchen + bar" />
                <MiniStat label="Covers" value="58" hint="dine-in guests" />
                <MiniStat label="Stock alerts" value="3" hint="low / out" warn />
              </div>
              <div className="mt-5 rounded-xl border border-border bg-surface/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Revenue by channel</p>
                <ChannelBar label="Dine-in"  pct={62} tint="bg-primary" />
                <ChannelBar label="Takeout"  pct={24} tint="bg-amber-500" />
                <ChannelBar label="Delivery" pct={14} tint="bg-sky-500" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-4xl px-5 sm:px-8 py-20 sm:py-24 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Sign in and walk through a working restaurant.
          </h2>
          <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto">
            The demo ships pre-loaded with two branches, eight roles, real menu items and
            stock. Pick a role on the next screen and see exactly what that person sees.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Sign in to the demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} NativeID. Restaurant Operating System.</p>
          <p>Built for Lagos kitchens. Works wherever you cook.</p>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof Building2; text: string }) {
  return (
    <div className="flex items-center gap-2.5 text-muted-foreground">
      <Icon className="h-4 w-4 text-primary shrink-0" strokeWidth={1.75} />
      <span>{text}</span>
    </div>
  );
}

function MiniStat({ label, value, hint, warn }: { label: string; value: string; hint: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1.5 text-xl font-bold tracking-tight ${warn ? "text-warning" : ""}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function ChannelBar({ label, pct, tint }: { label: string; pct: number; tint: string }) {
  return (
    <div className="mt-3 first-of-type:mt-4">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background">
        <div className={`h-full ${tint} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
