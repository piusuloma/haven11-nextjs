"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Boxes, ChefHat, Wine,
  ClipboardList, Coins, Users, CalendarRange, HeartHandshake,
  BarChart3, ShieldAlert, Bell, LogOut, AlertTriangle, CheckCircle2, Menu, X,
  ArrowLeftRight, Building2, Warehouse, ChevronDown, Check, Truck, ScrollText, Wallet, Banknote, Bike, History, UserCog, Settings, HandHeart, Scale,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAuth, type StaffRole } from "@/lib/auth";
import { useStore, statusOf, fmtQty, daysUntil } from "@/lib/store";

type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
};

/**
 * A *section* groups related items under a small muted header (Toast / Square /
 * Lightspeed pattern). An empty `label` ("") means no header — used for the
 * first section so the role's home page sits at the very top of the sidebar.
 */
type NavSection = { label: string; items: NavItem[] };

const roleNav: Record<StaffRole, NavSection[]> = {
  // ── Owner — full access, grouped into 6 sections ───────────────────────────
  owner: [
    { label: "", items: [
      { href: "/", icon: LayoutDashboard, label: "Overview" },
    ]},
    { label: "Operate", items: [
      { href: "/pos", icon: ShoppingCart, label: "Front of House" },
      { href: "/cashier", icon: Coins, label: "Shifts" },
      { href: "/kitchen-bar", icon: Wine, label: "Kitchen & Bar" },
      { href: "/dispatch", icon: Bike, label: "Dispatch & Fleet" },
      { href: "/alerts", icon: ShieldAlert, label: "Alerts" },
    ]},
    { label: "Inventory", items: [
      { href: "/inventory", icon: Boxes, label: "Stock" },
      { href: "/transfers", icon: ArrowLeftRight, label: "Transfers" },
      { href: "/purchase-orders", icon: ScrollText, label: "Procurement" },
      { href: "/vendors", icon: Truck, label: "Vendors" },
      { href: "/menu", icon: ChefHat, label: "Menu & Recipes" },
    ]},
    { label: "People", items: [
      { href: "/staff", icon: Users, label: "Staff" },
      { href: "/hr", icon: UserCog, label: "HR" },
      { href: "/payroll", icon: Banknote, label: "Payroll" },
      { href: "/welfare", icon: HandHeart, label: "Welfare" },
    ]},
    { label: "Money", items: [
      { href: "/customers", icon: HeartHandshake, label: "Customers" },
      { href: "/expenses", icon: Wallet, label: "Expenses" },
      { href: "/financials", icon: Scale, label: "Financials" },
      { href: "/audit", icon: History, label: "Audit Trail" },
    ]},
    { label: "Grow", items: [
      { href: "/events", icon: CalendarRange, label: "Events" },
      { href: "/reports", icon: BarChart3, label: "Analytics" },
    ]},
    { label: "System", items: [
      { href: "/settings", icon: Settings, label: "Settings" },
    ]},
  ],

  // ── Manager — same structure, branch-scoped ────────────────────────────────
  manager: [
    { label: "", items: [
      { href: "/manager-dashboard", icon: LayoutDashboard, label: "Dashboard" },
    ]},
    { label: "Operate", items: [
      { href: "/pos", icon: ShoppingCart, label: "Front of House" },
      { href: "/cashier", icon: Coins, label: "Shifts" },
      { href: "/kitchen-bar", icon: Wine, label: "Kitchen & Bar" },
      { href: "/dispatch", icon: Bike, label: "Dispatch & Fleet" },
    ]},
    { label: "Inventory", items: [
      { href: "/inventory", icon: Boxes, label: "Stock" },
      { href: "/transfers", icon: ArrowLeftRight, label: "Transfers" },
      { href: "/purchase-orders", icon: ScrollText, label: "Procurement" },
      { href: "/vendors", icon: Truck, label: "Vendors" },
    ]},
    { label: "People", items: [
      { href: "/staff", icon: Users, label: "Staff" },
      { href: "/hr", icon: UserCog, label: "HR" },
      { href: "/payroll", icon: Banknote, label: "Payroll" },
      { href: "/welfare", icon: HandHeart, label: "Welfare" },
    ]},
    { label: "Money", items: [
      { href: "/customers", icon: HeartHandshake, label: "Customers" },
      { href: "/expenses", icon: Wallet, label: "Expenses" },
      { href: "/financials", icon: Scale, label: "Financials" },
      { href: "/audit", icon: History, label: "Audit Trail" },
    ]},
    { label: "Grow", items: [
      { href: "/reports", icon: BarChart3, label: "Analytics" },
    ]},
    { label: "System", items: [
      { href: "/settings", icon: Settings, label: "Settings" },
    ]},
  ],

  // ── Single-task roles — flat sidebar, no headers needed ────────────────────
  cashier: [
    // Industry-standard cashier scope: take orders + take payments + manage their
    // shift + request petty cash. NOT: rider/fleet management, expense approval,
    // inventory, vendors, HR. Their dispatch view (assign/complete delivery jobs)
    // is reachable from `/cashier-home` ↦ the order-tracking strip when needed.
    { label: "", items: [
      { href: "/cashier-home", icon: LayoutDashboard, label: "My Shift" },
      { href: "/pos", icon: ShoppingCart, label: "Front of House" },
      { href: "/expenses", icon: Wallet, label: "Petty cash" },
    ]},
  ],
  kitchen: [
    { label: "", items: [
      { href: "/kitchen-home", icon: ChefHat, label: "Kitchen Display" },
    ]},
  ],
  bartender: [
    { label: "", items: [
      { href: "/bar-home", icon: Wine, label: "Bar Queue" },
      { href: "/pos", icon: ShoppingCart, label: "Front of House" },
    ]},
  ],

  // ── Specialist roles — small enough for one section but still grouped ──────
  storekeeper: [
    { label: "", items: [
      { href: "/store-home", icon: Boxes, label: "Store" },
    ]},
    { label: "Inventory", items: [
      { href: "/inventory", icon: Boxes, label: "Stock" },
      { href: "/transfers", icon: ArrowLeftRight, label: "Transfers" },
      { href: "/purchase-orders", icon: ScrollText, label: "Procurement" },
      { href: "/vendors", icon: Truck, label: "Vendors" },
    ]},
    { label: "Money", items: [
      { href: "/expenses", icon: Wallet, label: "Expenses" },
    ]},
  ],
  accountant: [
    { label: "", items: [
      { href: "/financials", icon: Scale, label: "Financials" },
    ]},
    { label: "Money", items: [
      { href: "/expenses", icon: Wallet, label: "Expenses" },
      { href: "/purchase-orders", icon: ScrollText, label: "Procurement" },
      { href: "/vendors", icon: Truck, label: "Vendors" },
    ]},
    { label: "People", items: [
      { href: "/welfare", icon: HandHeart, label: "Welfare" },
    ]},
    { label: "Oversight", items: [
      { href: "/audit", icon: History, label: "Audit Trail" },
    ]},
  ],
  hr: [
    { label: "", items: [
      { href: "/hr", icon: UserCog, label: "HR" },
    ]},
    { label: "People", items: [
      { href: "/staff", icon: Users, label: "Staff" },
      { href: "/payroll", icon: Banknote, label: "Payroll" },
      { href: "/welfare", icon: HandHeart, label: "Welfare" },
    ]},
    { label: "Oversight", items: [
      { href: "/audit", icon: History, label: "Audit Trail" },
    ]},
  ],
};

// ── Notifications ────────────────────────────────────────────────────────────

type NoteTone = "danger" | "warn" | "ok";

interface Note {
  id: string;
  tone: NoteTone;
  title: string;
  meta: string;
  time: string;
  href: string;
}

function NotificationBell() {
  const router = useRouter();
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  // Notifications are derived live from the current branch's store state.
  const branch = store.currentBranch;
  const notes: Note[] = [
    // Ready tickets — kitchen / bar flagged these "Ready"; the waiter needs to
    // see them ASAP. Highest priority so they sit at the top of the bell.
    ...store.tickets.filter((t) => t.branch === branch && t.status === "Ready").slice(0, 6).map((t) => ({
      id: `ready-${t.id}`,
      tone: "ok" as NoteTone,
      title: `Ready to serve — ${t.label}`,
      meta: `${t.station} · ${t.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}`,
      time: "live",
      href: "/cashier-home",
    })),
    ...store.counts.filter((c) => c.overPour && c.branch === branch).slice(0, 3).map((c) => ({
      id: `op-${c.id}`,
      tone: "danger" as NoteTone,
      title: `Over-pour — ${c.name}`,
      meta: `${c.staffName} · ₦${Math.abs(c.varianceCost).toLocaleString()} loss`,
      time: "live",
      href: "/alerts",
    })),
    ...store.batches.filter((b) => b.branch === branch && daysUntil(b.expiry) <= 14).slice(0, 3).map((b) => {
      const d = daysUntil(b.expiry);
      return {
        id: `exp-${b.id}`,
        tone: (d <= 3 ? "danger" : "warn") as NoteTone,
        title: `${d < 0 ? "Expired" : "Expiring soon"} — ${b.name}`,
        meta: d < 0 ? `${-d} days overdue` : `${d} day${d !== 1 ? "s" : ""} left`,
        time: "live",
        href: "/inventory",
      };
    }),
    ...store.inventory.filter((i) => i.branch === branch && statusOf(i) !== "OK").slice(0, 6).map((i) => ({
      id: `stock-${i.sku}`,
      tone: (statusOf(i) === "Out" ? "danger" : "warn") as NoteTone,
      title: `${statusOf(i) === "Out" ? "Out of stock" : "Low stock"} — ${i.name}`,
      meta: `${i.line} · ${fmtQty(i.onHand)} ${i.unit} left`,
      time: "live",
      href: "/inventory",
    })),
  ];

  const unread = notes.filter((n) => !read.has(n.id)).length;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function openNote(note: Note) {
    setRead((prev) => new Set(prev).add(note.id));
    setOpen(false);
    router.push(note.href);
  }

  const toneIcon: Record<NoteTone, typeof AlertTriangle> = {
    danger: ShieldAlert,
    warn: AlertTriangle,
    ok: CheckCircle2,
  };
  const toneClass: Record<NoteTone, string> = {
    danger: "bg-destructive/10 text-destructive",
    warn: "bg-warning/15 text-foreground",
    ok: "bg-surface text-primary",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-border bg-card hover:bg-surface transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-border bg-card shadow-xl overflow-hidden z-20">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => setRead(new Set(notes.map((n) => n.id)))}
                className="text-xs font-medium text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          {notes.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-border">
              {notes.map((n) => {
                const Icon = toneIcon[n.tone];
                const isRead = read.has(n.id);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openNote(n)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface/60 transition-colors ${isRead ? "opacity-55" : ""}`}
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${toneClass[n.tone]}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-tight">{n.title}</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">{n.meta}</span>
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{n.time}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={() => { setOpen(false); router.push("/alerts"); }}
            className="block w-full border-t border-border px-4 py-2.5 text-center text-xs font-medium text-primary hover:bg-surface transition-colors"
          >
            View all alerts
          </button>
        </div>
      )}
    </div>
  );
}

// ── Branch switcher ──────────────────────────────────────────────────────────

function BranchSwitcher() {
  const store = useStore();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!store.hydrated) return null;
  const current = store.branches.find((b) => b.id === store.currentBranch);

  // The Owner, Accountant and HR roam branches — everyone else is pinned to their own.
  if (user?.role !== "owner" && user?.role !== "accountant" && user?.role !== "hr") {
    return (
      <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium">
        {current?.kind === "hub" ? <Warehouse className="h-4 w-4 text-primary" /> : <Building2 className="h-4 w-4 text-primary" />}
        <span className="hidden sm:inline">{current?.name ?? "Branch"}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-surface transition-colors"
      >
        {current?.kind === "hub" ? <Warehouse className="h-4 w-4 text-primary" /> : <Building2 className="h-4 w-4 text-primary" />}
        <span className="hidden sm:inline">{current?.name ?? "Branch"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-card shadow-xl overflow-hidden z-20">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
            Operating branch
          </p>
          <ul>
            {store.branches.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => { store.setBranch(b.id); setOpen(false); }}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-sm hover:bg-surface transition-colors ${b.id === store.currentBranch ? "font-semibold text-primary" : ""}`}
                >
                  <span className="flex items-center gap-2">
                    {b.kind === "hub" ? <Warehouse className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                    {b.name}
                    {b.kind === "hub" && <span className="text-[10px] text-muted-foreground">· hub</span>}
                  </span>
                  {b.id === store.currentBranch && <Check className="h-4 w-4" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────

export function AppShell({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const store = useStore();
  const [mobileNav, setMobileNav] = useState(false);

  // Branch managers and branch staff are locked to their home branch (Module 8 RBAC).
  useEffect(() => {
    if (user?.branch && store.currentBranch !== user.branch) store.setBranch(user.branch);
  }, [user, store.currentBranch, store.setBranch]);

  if (!user) return null;

  const modules = roleNav[user.role];

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  const navLinks = (
    <>
      {modules.map((section, sectionIdx) => (
        <div key={sectionIdx} className={sectionIdx > 0 ? "mt-4" : ""}>
          {section.label && (
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.label}
            </p>
          )}
          {section.items.map((m) => {
            const Icon = m.icon;
            const active = pathname === m.href;
            return (
              <Link
                key={m.href}
                href={m.href}
                onClick={() => setMobileNav(false)}
                className={[
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:bg-surface hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.75} />
                {m.label}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex sticky top-0 h-screen w-60 flex-col border-r border-border bg-card shrink-0">
        <div className="flex items-center gap-3 px-5 py-6 border-b border-border">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            N
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight">NativeID</p>
            <p className="text-[11px] text-muted-foreground">Restaurant OS</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">{navLinks}</nav>

        <div className="border-t border-border p-4 space-y-1">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
              {user.initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile nav drawer */}
      {mobileNav && (
        <div className="lg:hidden fixed inset-0 z-40 flex" onClick={() => setMobileNav(false)}>
          <div className="absolute inset-0 bg-foreground/25 backdrop-blur-sm" />
          <aside
            className="relative flex h-full w-64 flex-col border-r border-border bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground font-bold">N</div>
                <p className="text-sm font-bold">NativeID</p>
              </div>
              <button type="button" aria-label="Close menu" onClick={() => setMobileNav(false)} className="grid h-8 w-8 place-items-center rounded-lg border border-border">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">{navLinks}</nav>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 border-t border-border px-5 py-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 sm:px-6 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileNav(true)}
              className="lg:hidden grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card hover:bg-surface transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold tracking-tight leading-tight truncate">{title}</h1>
              {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BranchSwitcher />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 space-y-6">{children}</main>
      </div>
    </div>
  );
}

export function PageSection({ title, description, action, children }: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
