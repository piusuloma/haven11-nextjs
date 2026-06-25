// ── Types ─────────────────────────────────────────────────────────────────────

export type TenantPlan   = "starter" | "growth" | "scale";
export type TenantStatus = "healthy" | "idle_3d" | "idle_7d" | "suspended";

export interface Tenant {
  id: string;
  name: string;
  logoInitials: string;
  plan: TenantPlan;
  status: TenantStatus;
  primaryEmail: string;
  city: string;
  branchCount: number;
  staffCount: number;
  ordersLast7d: number;
  revenueLast7d: number; // in kobo (×100 = Naira)
  ordersToday: number;
  revenueToday: number;
  lastActive: string; // ISO datetime
  joinedAt: string;   // ISO date
}

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertStatus   = "open" | "acknowledged" | "resolved";
export type AlertType     =
  | "tenant_inactive"
  | "repeated_failed_pins"
  | "high_void_rate"
  | "stock_critically_low"
  | "large_cash_transaction"
  | "subscription_nearing_limit";

export interface PlatformAlert {
  id: string;
  tenantId: string;
  tenantName: string;
  branchName?: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  description: string;
  createdAt: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  note?: string;
}

export interface ActivityEvent {
  id: string;
  tenantId: string;
  tenantName: string;
  branchName: string;
  actor: string;
  actorRole: string;
  action: string;
  entity: string;
  timestamp: string;
}

export interface AdminUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: "super_admin" | "support" | "viewer";
  roleLabel: string;
  lastLogin: string;
  active: boolean;
}

// ── Tenants ───────────────────────────────────────────────────────────────────

export const TENANTS: Tenant[] = [
  {
    id: "t1", name: "Haven Restaurant",  logoInitials: "HR",
    plan: "scale",   status: "healthy",
    primaryEmail: "ops@havenrestaurant.ng", city: "Lagos",
    branchCount: 4, staffCount: 32, ordersLast7d: 2840, revenueLast7d: 142_000_00,
    ordersToday: 312, revenueToday: 16_200_00,
    lastActive: "2026-06-25T14:42:00Z", joinedAt: "2024-03-12",
  },
  {
    id: "t2", name: "Buka & Suya Co.", logoInitials: "BS",
    plan: "growth",  status: "healthy",
    primaryEmail: "hello@bukaandsuya.ng", city: "Abuja",
    branchCount: 3, staffCount: 21, ordersLast7d: 1620, revenueLast7d: 81_000_00,
    ordersToday: 188, revenueToday: 9_400_00,
    lastActive: "2026-06-25T13:55:00Z", joinedAt: "2024-07-08",
  },
  {
    id: "t3", name: "The Garden Grill", logoInitials: "GG",
    plan: "growth",  status: "healthy",
    primaryEmail: "admin@gardengrill.ng", city: "Lagos",
    branchCount: 2, staffCount: 14, ordersLast7d: 980, revenueLast7d: 49_000_00,
    ordersToday: 104, revenueToday: 5_200_00,
    lastActive: "2026-06-25T12:30:00Z", joinedAt: "2025-01-20",
  },
  {
    id: "t4", name: "Suya Republic",    logoInitials: "SR",
    plan: "scale",   status: "healthy",
    primaryEmail: "info@suyarepublic.ng", city: "Lagos",
    branchCount: 5, staffCount: 41, ordersLast7d: 3210, revenueLast7d: 160_500_00,
    ordersToday: 421, revenueToday: 21_000_00,
    lastActive: "2026-06-25T15:01:00Z", joinedAt: "2023-11-05",
  },
  {
    id: "t5", name: "Lagos Chops",      logoInitials: "LC",
    plan: "growth",  status: "idle_3d",
    primaryEmail: "support@lagoschops.ng", city: "Lagos",
    branchCount: 2, staffCount: 11, ordersLast7d: 0, revenueLast7d: 0,
    ordersToday: 0, revenueToday: 0,
    lastActive: "2026-06-21T09:15:00Z", joinedAt: "2025-04-14",
  },
  {
    id: "t6", name: "Mama Titi's Kitchen", logoInitials: "MT",
    plan: "starter", status: "healthy",
    primaryEmail: "titi@mamatiti.ng", city: "Port Harcourt",
    branchCount: 1, staffCount: 6, ordersLast7d: 340, revenueLast7d: 17_000_00,
    ordersToday: 38, revenueToday: 1_900_00,
    lastActive: "2026-06-25T11:10:00Z", joinedAt: "2025-09-01",
  },
  {
    id: "t7", name: "Naija Bites",      logoInitials: "NB",
    plan: "starter", status: "idle_7d",
    primaryEmail: "ops@naijabites.ng", city: "Ibadan",
    branchCount: 1, staffCount: 5, ordersLast7d: 0, revenueLast7d: 0,
    ordersToday: 0, revenueToday: 0,
    lastActive: "2026-06-17T16:40:00Z", joinedAt: "2025-11-22",
  },
  {
    id: "t8", name: "The Spice Route",  logoInitials: "TS",
    plan: "starter", status: "suspended",
    primaryEmail: "hello@spiceroute.ng", city: "Enugu",
    branchCount: 1, staffCount: 4, ordersLast7d: 0, revenueLast7d: 0,
    ordersToday: 0, revenueToday: 0,
    lastActive: "2026-05-30T08:00:00Z", joinedAt: "2025-06-10",
  },
];

// ── Platform Alerts ───────────────────────────────────────────────────────────

export const PLATFORM_ALERTS: PlatformAlert[] = [
  {
    id: "al1", tenantId: "t7", tenantName: "Naija Bites",
    type: "tenant_inactive", severity: "critical", status: "open",
    description: "No POS orders recorded for 8 days. Operating hours have passed with zero activity.",
    createdAt: "2026-06-25T08:00:00Z",
  },
  {
    id: "al2", tenantId: "t5", tenantName: "Lagos Chops", branchName: "Yaba",
    type: "tenant_inactive", severity: "warning", status: "acknowledged",
    description: "No POS orders for 4 days at Yaba branch.",
    createdAt: "2026-06-22T10:00:00Z",
    acknowledgedBy: "Kemi Okafor",
    note: "Owner says branch is being renovated. Will reopen June 28.",
  },
  {
    id: "al3", tenantId: "t1", tenantName: "Haven Restaurant", branchName: "Ikoyi",
    type: "repeated_failed_pins", severity: "warning", status: "open",
    description: "Cashier account 'Ada O.' — 7 failed PIN attempts in 8 minutes.",
    createdAt: "2026-06-25T13:22:00Z",
  },
  {
    id: "al4", tenantId: "t4", tenantName: "Suya Republic", branchName: "Victoria Island",
    type: "large_cash_transaction", severity: "info", status: "resolved",
    description: "Single cash transaction of ₦720,000 recorded at 21:04.",
    createdAt: "2026-06-24T21:04:00Z",
    resolvedAt: "2026-06-25T09:30:00Z",
    note: "Confirmed with manager — private event settlement, legitimate.",
    acknowledgedBy: "Yemi Adeyemi",
  },
  {
    id: "al5", tenantId: "t2", tenantName: "Buka & Suya Co.", branchName: "Wuse 2",
    type: "stock_critically_low", severity: "warning", status: "open",
    description: "6 menu items are at zero stock — Beef Suya, Chapman, Peppered Gizzard, and 3 others.",
    createdAt: "2026-06-25T07:45:00Z",
  },
  {
    id: "al6", tenantId: "t4", tenantName: "Suya Republic",
    type: "subscription_nearing_limit", severity: "info", status: "open",
    description: "Branch count is 5/5 (100% of Scale plan limit). Cannot add more branches.",
    createdAt: "2026-06-24T00:00:00Z",
  },
  {
    id: "al7", tenantId: "t3", tenantName: "The Garden Grill", branchName: "Lekki Phase 1",
    type: "high_void_rate", severity: "warning", status: "open",
    description: "Order void rate hit 22% during the lunch shift (13:00 – 15:00).",
    createdAt: "2026-06-25T15:10:00Z",
  },
];

// ── Activity Feed ─────────────────────────────────────────────────────────────

export const ACTIVITY_EVENTS: ActivityEvent[] = [
  { id: "e1",  tenantId: "t4", tenantName: "Suya Republic",      branchName: "VI",             actor: "Seun O.",   actorRole: "Owner",    action: "Closed shift",        entity: "Shift #SH-0091",    timestamp: "2026-06-25T15:04:00Z" },
  { id: "e2",  tenantId: "t1", tenantName: "Haven Restaurant",   branchName: "Lekki",          actor: "Ada O.",    actorRole: "Cashier",  action: "Opened order",        entity: "Order #ORD-4421",   timestamp: "2026-06-25T14:58:00Z" },
  { id: "e3",  tenantId: "t3", tenantName: "The Garden Grill",   branchName: "Lekki Phase 1",  actor: "Tunde A.",  actorRole: "Manager",  action: "Voided order",        entity: "Order #ORD-2109",   timestamp: "2026-06-25T14:55:00Z" },
  { id: "e4",  tenantId: "t2", tenantName: "Buka & Suya Co.",    branchName: "Garki",          actor: "Ngozi P.",  actorRole: "Storekeeper", action: "Submitted requisition", entity: "REQ-0034",       timestamp: "2026-06-25T14:50:00Z" },
  { id: "e5",  tenantId: "t1", tenantName: "Haven Restaurant",   branchName: "Agungi",         actor: "Eze M.",    actorRole: "Storekeeper", action: "Stock adjusted",   entity: "Chicken Thighs",    timestamp: "2026-06-25T14:44:00Z" },
  { id: "e6",  tenantId: "t6", tenantName: "Mama Titi's Kitchen",branchName: "GRA",            actor: "Mama Titi", actorRole: "Owner",    action: "Added menu item",     entity: "Banga Soup",        timestamp: "2026-06-25T14:38:00Z" },
  { id: "e7",  tenantId: "t4", tenantName: "Suya Republic",      branchName: "Surulere",       actor: "Chidi B.",  actorRole: "Cashier",  action: "Completed order",     entity: "Order #ORD-3881",   timestamp: "2026-06-25T14:30:00Z" },
  { id: "e8",  tenantId: "t1", tenantName: "Haven Restaurant",   branchName: "Ikoyi",          actor: "Seun O.",   actorRole: "Owner",    action: "Added staff member",  entity: "Emeka D. (Cashier)",timestamp: "2026-06-25T14:20:00Z" },
  { id: "e9",  tenantId: "t2", tenantName: "Buka & Suya Co.",    branchName: "Wuse 2",         actor: "Amaka R.",  actorRole: "Manager",  action: "Created transfer",    entity: "TRF-0018",          timestamp: "2026-06-25T14:10:00Z" },
  { id: "e10", tenantId: "t3", tenantName: "The Garden Grill",   branchName: "Lekki Phase 1",  actor: "Bisi A.",   actorRole: "Cashier",  action: "Opened shift",        entity: "Shift #SH-0044",    timestamp: "2026-06-25T13:58:00Z" },
  { id: "e11", tenantId: "t4", tenantName: "Suya Republic",      branchName: "Ikeja",          actor: "Yinka F.",  actorRole: "Manager",  action: "Updated vendor",      entity: "Fresh Farm Supplies",timestamp: "2026-06-25T13:45:00Z" },
  { id: "e12", tenantId: "t1", tenantName: "Haven Restaurant",   branchName: "Lekki",          actor: "Tunde A.",  actorRole: "Manager",  action: "Approved requisition",entity: "REQ-0091",          timestamp: "2026-06-25T13:30:00Z" },
  { id: "e13", tenantId: "t6", tenantName: "Mama Titi's Kitchen",branchName: "GRA",            actor: "Mama Titi", actorRole: "Owner",    action: "Completed order",     entity: "Order #ORD-0188",   timestamp: "2026-06-25T13:20:00Z" },
  { id: "e14", tenantId: "t2", tenantName: "Buka & Suya Co.",    branchName: "Garki",          actor: "Kola S.",   actorRole: "Cashier",  action: "Applied discount",    entity: "Order #ORD-1744",   timestamp: "2026-06-25T13:10:00Z" },
  { id: "e15", tenantId: "t1", tenantName: "Haven Restaurant",   branchName: "Ikoyi",          actor: "Seun O.",   actorRole: "Owner",    action: "Changed settings",    entity: "Tax rate → 7.5%",   timestamp: "2026-06-25T12:55:00Z" },
];

// ── Platform KPIs ─────────────────────────────────────────────────────────────

export function getPlatformKPIs() {
  const activeTenants  = TENANTS.filter((t) => t.status !== "suspended").length;
  const totalBranches  = TENANTS.reduce((s, t) => s + t.branchCount, 0);
  const ordersToday    = TENANTS.reduce((s, t) => s + t.ordersToday, 0);
  const revenueToday   = TENANTS.reduce((s, t) => s + t.revenueToday, 0);
  const openAlerts     = PLATFORM_ALERTS.filter((a) => a.status === "open").length;
  const criticalAlerts = PLATFORM_ALERTS.filter((a) => a.status === "open" && a.severity === "critical").length;
  return { activeTenants, totalBranches, ordersToday, revenueToday, openAlerts, criticalAlerts, activeSessions: 38 };
}

// ── Admin users ───────────────────────────────────────────────────────────────

export const ADMIN_USERS: AdminUser[] = [
  { id: "a1", name: "Yemi Adeyemi", initials: "YA", email: "yemi@nativeid.app", role: "super_admin", roleLabel: "Super Admin",   lastLogin: "2026-06-25T08:00:00Z", active: true },
  { id: "a2", name: "Kemi Okafor",  initials: "KO", email: "kemi@nativeid.app", role: "support",     roleLabel: "Support Agent", lastLogin: "2026-06-25T09:15:00Z", active: true },
  { id: "a3", name: "Dayo Balogun", initials: "DB", email: "dayo@nativeid.app", role: "viewer",      roleLabel: "Viewer",        lastLogin: "2026-06-24T17:00:00Z", active: true },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtNaira(kobo: number) {
  const naira = kobo / 100;
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`;
  if (naira >= 1_000)     return `₦${(naira / 1_000).toFixed(0)}K`;
  return `₦${naira.toLocaleString()}`;
}

export function fmtRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export const PLAN_LABELS: Record<TenantPlan, string> = {
  starter: "Starter",
  growth:  "Growth",
  scale:   "Scale",
};

export const STATUS_META: Record<TenantStatus, { label: string; color: string }> = {
  healthy:   { label: "Healthy",           color: "text-emerald-700 bg-emerald-50 border-emerald-200"  },
  idle_3d:   { label: "Idle >3d",          color: "text-amber-700 bg-amber-50 border-amber-200"        },
  idle_7d:   { label: "No activity >7d",   color: "text-orange-700 bg-orange-50 border-orange-200"     },
  suspended: { label: "Suspended",         color: "text-rose-700 bg-rose-50 border-rose-200"           },
};

export const ALERT_SEVERITY_META: Record<AlertSeverity, { label: string; color: string }> = {
  critical: { label: "Critical", color: "text-rose-700 bg-rose-50 border-rose-200"     },
  warning:  { label: "Warning",  color: "text-amber-700 bg-amber-50 border-amber-200"  },
  info:     { label: "Info",     color: "text-sky-700 bg-sky-50 border-sky-200"        },
};

export const ALERT_STATUS_META: Record<AlertStatus, { label: string; color: string }> = {
  open:         { label: "Open",         color: "text-rose-700 bg-rose-50 border-rose-200"       },
  acknowledged: { label: "Acknowledged", color: "text-amber-700 bg-amber-50 border-amber-200"    },
  resolved:     { label: "Resolved",     color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  tenant_inactive:           "Tenant Inactive",
  repeated_failed_pins:      "Repeated Failed PINs",
  high_void_rate:            "High Void Rate",
  stock_critically_low:      "Stock Critically Low",
  large_cash_transaction:    "Large Cash Transaction",
  subscription_nearing_limit:"Subscription Nearing Limit",
};
