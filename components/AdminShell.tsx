"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  LayoutDashboard, Building2, Bell, Activity, CreditCard,
  Users, Settings, LogOut, ChevronDown, Menu, Shield,
} from "lucide-react";
import { useAdminAuth } from "@/lib/adminAuth";
import { PLATFORM_ALERTS } from "@/lib/adminData";

type NavItem = { href: string; icon: React.ComponentType<{ className?: string }>; label: string; badge?: number };

const NAV: NavItem[] = [
  { href: "/admin/dashboard",    icon: LayoutDashboard, label: "Dashboard"     },
  { href: "/admin/tenants",      icon: Building2,       label: "Tenants"       },
  { href: "/admin/alerts",       icon: Bell,            label: "Alerts"        },
  { href: "/admin/activity",     icon: Activity,        label: "Activity"      },
  { href: "/admin/subscriptions",icon: CreditCard,      label: "Subscriptions" },
  { href: "/admin/admins",       icon: Users,           label: "Admin Users"   },
];

const BOTTOM_NAV: NavItem[] = [
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { admin, logout } = useAdminAuth();
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const openAlerts    = PLATFORM_ALERTS.filter((a) => a.status === "open").length;
  const criticalAlerts = PLATFORM_ALERTS.filter((a) => a.status === "open" && a.severity === "critical").length;

  function handleLogout() {
    logout();
    router.replace("/admin/login");
  }

  const navWithBadges = NAV.map((item) =>
    item.href === "/admin/alerts" ? { ...item, badge: openAlerts } : item
  );

  function Sidebar() {
    return (
      <aside className="flex flex-col h-full w-60 bg-primary text-primary-foreground">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10 shrink-0">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-primary-foreground font-bold text-sm">
            N
          </div>
          <div className="leading-tight">
            <p className="text-primary-foreground font-semibold text-sm">NativeID</p>
            <p className="text-primary-foreground/50 text-[10px] uppercase tracking-widest">Admin Portal</p>
          </div>
        </div>

        {/* Main nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navWithBadges.map(({ href, icon: Icon, label, badge }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${active
                    ? "bg-white/20 text-white"
                    : "text-primary-foreground/60 hover:bg-white/10 hover:text-primary-foreground"
                  }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {badge !== undefined && badge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                    ${criticalAlerts > 0 ? "bg-destructive text-white" : "bg-warning text-foreground"}`}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom nav */}
        <div className="px-3 pb-2 space-y-0.5 border-t border-white/10 pt-3">
          {BOTTOM_NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${active ? "bg-white/20 text-white" : "text-primary-foreground/60 hover:bg-white/10 hover:text-primary-foreground"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-primary-foreground/60 hover:bg-white/10 hover:text-primary-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>

        {/* User chip */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-primary-foreground text-xs font-bold shrink-0">
              {admin?.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-primary-foreground font-medium truncate">{admin?.name}</p>
              <p className="text-[11px] text-primary-foreground/50 truncate">{admin?.roleLabel}</p>
            </div>
            <Shield className="h-3.5 w-3.5 text-primary-foreground/40 shrink-0" />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-60 z-10">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-4 h-16 px-6 bg-card border-b border-border shrink-0">
          <button
            className="lg:hidden p-1.5 rounded-lg text-muted-foreground hover:bg-surface"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Admin Portal</p>
          </div>

          {/* Critical alert chip */}
          {criticalAlerts > 0 && (
            <Link
              href="/admin/alerts"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
              style={{ color: "var(--color-destructive)", background: "color-mix(in oklch, var(--color-destructive) 8%, white)", borderColor: "color-mix(in oklch, var(--color-destructive) 30%, white)" }}
            >
              <Bell className="h-3 w-3" />
              {criticalAlerts} critical
            </Link>
          )}

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-surface transition-colors"
            >
              <div className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {admin?.initials}
              </div>
              <span className="hidden sm:block text-sm font-medium text-foreground">{admin?.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-lg z-30 py-1">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-medium text-foreground">{admin?.name}</p>
                  <p className="text-[11px] text-muted-foreground">{admin?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-surface transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
