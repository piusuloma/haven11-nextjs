"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Shared in-memory data store for the Haven 11 / 702 ROS prototype.
 *
 * Multi-branch model: every branch (Lekki, Ikoyi, Agungi) plus the central
 * Strong Room holds its own stock. Branches receive stock only via transfers
 * from the Strong Room. `currentBranch` is the operating context — inventory,
 * the POS, waste and the KDS all act on the branch you're viewing.
 *
 * State is persisted to localStorage so a demo survives a page refresh.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type Line = "Bar" | "Kitchen" | "Lounge";

export interface Branch {
  id: string;
  name: string;
  kind: "hub" | "branch";
}

export interface InventoryItem {
  sku: string;
  branch: string; // branch id this stock row belongs to
  name: string;
  line: Line;
  onHand: number;
  reorder: number; // par / reorder level
  unit: string;
  cost: number; // ₦ per unit
}

export interface RecipeLine {
  sku: string;
  qty: number;
}

export type MenuStatus = "Available" | "Sold out" | "Coming soon";

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  emoji: string;
  status: MenuStatus;
  recipe: RecipeLine[];
}

export type ShiftRole = "cashier" | "bartender" | "manager";

export interface Shift {
  id: string;
  staffId: string;
  staffName: string;
  role: ShiftRole;
  branch: string;
  openedAt: number;
  closedAt?: number;
  openingFloat: number;
  countedCash?: number;
  status: "open" | "closed";
  seedSales?: number;
}

export interface Modifier { label: string; price: number }

export interface OrderLine {
  name: string;
  qty: number;
  price: number;
  modifiers?: Modifier[];
  note?: string;
}

export type OrderChannel = "Dine-in" | "Takeout" | "Delivery";

export interface OrderCustomer {
  name: string;
  phone: string;
  address?: string;
  pickup?: string;
}

export interface PaymentEntry { method: string; amount: number }

export interface Order {
  id: string;
  branch: string;
  table: string;
  channel: OrderChannel;
  customer?: OrderCustomer;
  guests?: number;
  lines: OrderLine[];
  subtotal: number;
  discount?: number;
  discountNote?: string;
  vat: number;
  total: number;
  method: string;
  payments?: PaymentEntry[];
  splitWays?: number;
  staffName: string;
  shiftId?: string;
  at: number;
  voided?: boolean;
  voidReason?: string;
  voidedBy?: string;
}

export interface WasteEntry {
  id: string;
  branch: string;
  sku: string;
  name: string;
  qty: number;
  unit: string;
  reason: string;
  cost: number;
  staffName: string;
  shiftId?: string;
  at: number;
}

export interface StockCount {
  id: string;
  branch: string;
  sku: string;
  name: string;
  line: Line;
  expected: number;
  actual: number;
  variance: number;
  varianceCost: number;
  overPour: boolean;
  staffName: string;
  shiftId?: string;
  at: number;
}

export type TableStatus = "available" | "occupied" | "reserved";

export interface TableRec {
  id: string;
  label: string;
  zone: string;
  seats: number;
  status: TableStatus;
  guests?: number;
  seatedAt?: number;
  orderTotal?: number;
  reservation?: string;
}

export type TicketStation = "Kitchen" | "Bar";
export type TicketStatus = "New" | "Preparing" | "Ready";

export interface TicketItem { name: string; qty: number; detail?: string }

export interface Ticket {
  id: string;
  branch: string;
  orderId: string;
  station: TicketStation;
  label: string;
  channel: OrderChannel;
  items: TicketItem[];
  status: TicketStatus;
  createdAt: number;
}

export type TransferStatus = "Requested" | "Approved" | "Rejected" | "Issued" | "Received" | "Disputed";

export interface TransferLine {
  sku: string;
  name: string;
  unit: string;
  qtyRequested: number;
  qtyIssued?: number;
  qtyReceived?: number;
}

export interface Transfer {
  id: string; // waybill ref
  fromBranch: string; // always the Strong Room
  toBranch: string;
  lines: TransferLine[];
  status: TransferStatus;
  reason?: string;
  requestedBy: string;
  requestedAt: number;
  approvedBy?: string;
  issuedBy?: string;
  issuedAt?: number;
  receivedBy?: string;
  receivedAt?: number;
  valueAtCost?: number;
}

// ── Procurement ──────────────────────────────────────────────────────────────

export interface Vendor {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  tin: string;
  terms: string; // COD / Net 15 / Net 30
  category: string;
}

export type POStatus = "Ordered" | "Partially Received" | "Received";

export interface POLine {
  sku: string;
  name: string;
  unit: string;
  qtyOrdered: number;
  unitCost: number;
  qtyReceived: number;
}

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  branch: string; // delivery destination (the Strong Room)
  lines: POLine[];
  status: POStatus;
  expectedDate: string;
  createdAt: number;
  receivedAt?: number;
  total: number;
  paid: boolean;
  paidAt?: number;
}

export interface PriceChange {
  id: string;
  sku: string;
  name: string;
  oldCost: number;
  newCost: number;
  vendorName: string;
  at: number;
}

export interface Batch {
  id: string;
  sku: string;
  branch: string;
  name: string;
  qty: number;
  unit: string;
  expiry: string; // ISO date
  receivedAt: number;
  poId?: string;
}

// ── Expenses & petty cash ────────────────────────────────────────────────────

export type ExpenseStatus = "Pending" | "Approved" | "Rejected" | "Disbursed" | "Reconciled";

export interface ExpenseRequest {
  id: string;
  branch: string;
  category: string;
  amount: number; // requested
  description: string;
  requestedBy: string;
  requestedAt: number;
  status: ExpenseStatus;
  approvedBy?: string;
  approvedAt?: number;
  disbursedAt?: number;
  actualSpent?: number;
  changeReturned?: number;
  receipt?: string; // attached evidence (or "Manager waiver")
  reconciledAt?: number;
}

export interface Wallet {
  branch: string;
  balance: number;
  float: number; // target imprest level
}

// ── HR & payroll ─────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  name: string;
  role: string;
  branch: string;
  phone: string;
  nextOfKin: string;
  hireDate: string;
  scheduledStart: string; // "08:00"
  baseSalary: number;
  transport: number;
  housing: number;
  compliance: { guarantor: boolean; contract: boolean; idCard: boolean };
  certName: string;
  certExpiry: string; // ISO date
  status: "Active" | "Suspended";
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string; // ISO date
  clockIn: number;
  clockOut?: number;
  lateMinutes: number;
}

export type IncidentType = "Lateness" | "Customer complaint" | "Shortage" | "Misconduct" | "Damage" | "Commendation";

export interface Disciplinary {
  id: string;
  employeeId: string;
  type: IncidentType;
  description: string;
  action: string;
  at: number;
  by: string;
}

export interface Payslip {
  employeeId: string;
  name: string;
  role: string;
  base: number;
  allowances: number;
  gross: number;
  paye: number;
  pension: number;
  nhf: number;
  latenessDeduction: number;
  shortageDeduction: number;
  net: number;
}

export interface PayrollRun {
  id: string;
  period: string;
  ranAt: number;
  ranBy: string;
  branch: string;
  payslips: Payslip[];
  totalNet: number;
}

// ── Dispatch & fleet ─────────────────────────────────────────────────────────

export type RiderType = "Internal bike" | "3PL partner";

export interface Rider {
  id: string;
  name: string;
  type: RiderType;
  branch: string;
  status: "Available" | "On delivery" | "Off";
  expenses: number; // accrued fleet cost (fuel, repairs) — internal bikes
}

export type DeliveryStatus = "Preparing" | "Ready for pickup" | "Out for delivery" | "Delivered";

export interface DeliveryJob {
  id: string;
  orderId: string;
  branch: string;
  customer: string;
  phone: string;
  address: string;
  fee: number;       // delivery fee — fleet revenue
  cod: boolean;
  codAmount: number; // cash the rider collects on delivery (0 if prepaid)
  status: DeliveryStatus;
  riderId?: string;
  createdAt: number;
  assignedAt?: number;
  deliveredAt?: number;
  codSettled: boolean;
}

// ── CRM ──────────────────────────────────────────────────────────────────────

export type CustomerTier = "New" | "Regular" | "VIP" | "Blacklisted";

export interface Customer {
  id: string;
  name: string;
  phone: string; // the golden-record key
  email?: string;
  tier: CustomerTier;
  birthday?: string; // "MM-DD"
  note?: string;
  joinedAt: number;
  lastContactedAt?: number;  // last marketing outreach
  lastContactKind?: string;  // "Win-back offer" / "Birthday treat"
  seedVisits?: number;
  seedSpend?: number;
  seedFavorite?: string;
  seedLastDays?: number; // days since last visit (seed baseline)
}

export type Sentiment = "Positive" | "Neutral" | "Negative";

export interface Feedback {
  id: string;
  branch: string;
  customerName: string;
  phone?: string;
  channel: OrderChannel;
  food: number;
  service: number;
  ambience: number;
  comment: string;
  sentiment: Sentiment;
  at: number;
}

export type ComplaintStatus = "Open" | "In progress" | "Resolved";

export interface ComplaintTicket {
  id: string;
  branch: string;
  customerName: string;
  phone?: string;
  subject: string;
  detail: string;
  status: ComplaintStatus;
  severity: "Low" | "High";
  raisedBy: string;
  raisedAt: number;
  resolvedAt?: number;
  fromFeedback?: boolean;
}

// ── Events & banquets ────────────────────────────────────────────────────────

export type EventStatus = "Deposit pending" | "Confirmed" | "Live" | "Completed";

export interface EventCost { label: string; amount: number }

export interface RestaurantEvent {
  id: string;
  branch: string;
  name: string;
  date: string;        // human-readable schedule label
  venue: string;
  guests: number;
  package: string;
  value: number;       // contract revenue
  deposit: number;     // paid so far
  status: EventStatus;
  costs: EventCost[];
  createdAt: number;
}

// ── Audit trail ──────────────────────────────────────────────────────────────

export type AuditCategory =
  | "Sales" | "Inventory" | "Transfers" | "Procurement" | "Finance" | "Payroll" | "HR";

/** An immutable who-did-what-when record for every sensitive override. */
export interface AuditEntry {
  id: string;
  at: number;
  branch: string;
  actor: string;       // staff name who performed the action
  category: AuditCategory;
  action: string;      // short verb phrase — "Order voided"
  detail: string;      // human-readable specifics
  ref?: string;        // related entity id
  amount?: number;     // ₦ value involved, when relevant
  severity: "info" | "warning";
}

interface StoreState {
  branches: Branch[];
  currentBranch: string;
  inventory: InventoryItem[];
  menu: MenuItem[];
  shifts: Shift[];
  orders: Order[];
  waste: WasteEntry[];
  counts: StockCount[];
  tables: TableRec[];
  tickets: Ticket[];
  transfers: Transfer[];
  vendors: Vendor[];
  purchaseOrders: PurchaseOrder[];
  priceChanges: PriceChange[];
  batches: Batch[];
  expenses: ExpenseRequest[];
  wallets: Wallet[];
  employees: Employee[];
  attendance: Attendance[];
  disciplinary: Disciplinary[];
  payrollRuns: PayrollRun[];
  riders: Rider[];
  deliveries: DeliveryJob[];
  customers: Customer[];
  feedback: Feedback[];
  complaints: ComplaintTicket[];
  events: RestaurantEvent[];
  auditLog: AuditEntry[];
}

// ── Seed data ────────────────────────────────────────────────────────────────

export const HUB_ID = "strong-room";

const SEED_BRANCHES: Branch[] = [
  { id: HUB_ID,   name: "Strong Room", kind: "hub" },
  { id: "lekki",  name: "Lekki",       kind: "branch" },
  { id: "ikoyi",  name: "Ikoyi",       kind: "branch" },
  { id: "agungi", name: "Agungi",      kind: "branch" },
];

/** Master product catalogue — stock rows are generated per branch from this. */
const PRODUCTS = [
  { sku: "BAR-RUM",     name: "White Rum",       line: "Bar" as Line,     unit: "L",     cost: 8200,  reorder: 6,  hub: 60,  branch: 5  },
  { sku: "BAR-HEIN",    name: "Heineken 330ml",  line: "Bar" as Line,     unit: "btl",   cost: 1100,  reorder: 48, hub: 600, branch: 96 },
  { sku: "BAR-LIME",    name: "Lime",            line: "Bar" as Line,     unit: "pcs",   cost: 120,   reorder: 24, hub: 300, branch: 60 },
  { sku: "BAR-MINT",    name: "Mint",            line: "Bar" as Line,     unit: "bunch", cost: 200,   reorder: 6,  hub: 40,  branch: 14 },
  { sku: "BAR-SODA",    name: "Soda Water",      line: "Bar" as Line,     unit: "L",     cost: 600,   reorder: 4,  hub: 40,  branch: 9  },
  { sku: "BAR-SYRUP",   name: "Simple Syrup",    line: "Bar" as Line,     unit: "L",     cost: 4000,  reorder: 2,  hub: 18,  branch: 4  },
  { sku: "BAR-COFFEE",  name: "Coffee Beans",    line: "Bar" as Line,     unit: "kg",    cost: 12000, reorder: 2,  hub: 20,  branch: 5  },
  { sku: "KIT-RICE",    name: "Basmati Rice",    line: "Kitchen" as Line, unit: "kg",    cost: 2400,  reorder: 20, hub: 400, branch: 48 },
  { sku: "KIT-OIL",     name: "Vegetable Oil",   line: "Kitchen" as Line, unit: "L",     cost: 2900,  reorder: 10, hub: 200, branch: 26 },
  { sku: "KIT-GOAT",    name: "Goat Meat",       line: "Kitchen" as Line, unit: "kg",    cost: 5600,  reorder: 10, hub: 120, branch: 8  },
  { sku: "KIT-TILAPIA", name: "Tilapia (whole)", line: "Kitchen" as Line, unit: "pcs",   cost: 3200,  reorder: 8,  hub: 80,  branch: 6  },
  { sku: "KIT-BEEF",    name: "Beef Sirloin",    line: "Kitchen" as Line, unit: "kg",    cost: 6000,  reorder: 5,  hub: 90,  branch: 11 },
  { sku: "KIT-SUYA",    name: "Suya Spice",      line: "Kitchen" as Line, unit: "kg",    cost: 8750,  reorder: 2,  hub: 24,  branch: 5  },
  { sku: "KIT-YAM",     name: "Yam",             line: "Kitchen" as Line, unit: "kg",    cost: 1750,  reorder: 8,  hub: 160, branch: 22 },
  { sku: "KIT-PLANTAIN",name: "Plantain",        line: "Kitchen" as Line, unit: "pcs",   cost: 250,   reorder: 30, hub: 500, branch: 80 },
];

const SPOKE_IDS = ["lekki", "ikoyi", "agungi"];

const SEED_INVENTORY: InventoryItem[] = PRODUCTS.flatMap((p) => [
  { sku: p.sku, branch: HUB_ID, name: p.name, line: p.line, onHand: p.hub, reorder: Math.round(p.reorder * 4), unit: p.unit, cost: p.cost },
  ...SPOKE_IDS.map((b) => ({ sku: p.sku, branch: b, name: p.name, line: p.line, onHand: p.branch, reorder: p.reorder, unit: p.unit, cost: p.cost })),
]);

const SEED_MENU: MenuItem[] = [
  { id: "m1",  name: "Jollof Rice",     category: "Mains",     price: 4500, emoji: "🍚", status: "Available", recipe: [{ sku: "KIT-RICE", qty: 0.25 }, { sku: "KIT-OIL", qty: 0.04 }] },
  { id: "m2",  name: "Pounded Yam",     category: "Mains",     price: 4200, emoji: "🫙", status: "Available", recipe: [{ sku: "KIT-YAM", qty: 0.4 }] },
  { id: "m3",  name: "Pepper Soup",     category: "Starters",  price: 5200, emoji: "🍲", status: "Available", recipe: [{ sku: "KIT-GOAT", qty: 0.2 }] },
  { id: "m4",  name: "Suya Platter",    category: "Grill",     price: 7800, emoji: "🥩", status: "Available", recipe: [{ sku: "KIT-BEEF", qty: 0.3 }, { sku: "KIT-SUYA", qty: 0.04 }] },
  { id: "m5",  name: "Grilled Tilapia", category: "Grill",     price: 9200, emoji: "🐟", status: "Available", recipe: [{ sku: "KIT-TILAPIA", qty: 1 }, { sku: "KIT-OIL", qty: 0.04 }] },
  { id: "m6",  name: "Goat Meat Asun",  category: "Grill",     price: 6800, emoji: "🍖", status: "Available", recipe: [{ sku: "KIT-GOAT", qty: 0.25 }, { sku: "KIT-OIL", qty: 0.03 }] },
  { id: "m7",  name: "Fried Plantain",  category: "Sides",     price: 1800, emoji: "🍌", status: "Available", recipe: [{ sku: "KIT-PLANTAIN", qty: 2 }, { sku: "KIT-OIL", qty: 0.05 }] },
  { id: "m8",  name: "Chin Chin",       category: "Sides",     price: 1500, emoji: "🍪", status: "Available", recipe: [] },
  { id: "m9",  name: "Heineken",        category: "Drinks",    price: 2200, emoji: "🍺", status: "Available", recipe: [{ sku: "BAR-HEIN", qty: 1 }] },
  { id: "m10", name: "Chapman",         category: "Drinks",    price: 3500, emoji: "🍹", status: "Available", recipe: [{ sku: "BAR-SYRUP", qty: 0.05 }, { sku: "BAR-SODA", qty: 0.15 }, { sku: "BAR-LIME", qty: 1 }] },
  { id: "m11", name: "Espresso",        category: "Drinks",    price: 2000, emoji: "☕", status: "Available", recipe: [{ sku: "BAR-COFFEE", qty: 0.018 }] },
  { id: "m12", name: "Mojito",          category: "Cocktails", price: 4800, emoji: "🍸", status: "Available", recipe: [{ sku: "BAR-RUM", qty: 0.05 }, { sku: "BAR-LIME", qty: 0.5 }, { sku: "BAR-MINT", qty: 0.4 }, { sku: "BAR-SODA", qty: 0.1 }, { sku: "BAR-SYRUP", qty: 0.01 }] },
];

const DAY = 24 * 60 * 60 * 1000;

// Seed order history (today, Lekki) so analytics & dashboards have data to chew on.
let seedOrderNo = 0;
function mkOrder(
  minsAgo: number,
  channel: OrderChannel,
  table: string,
  spec: [string, number][],
  method: string,
  staffName: string,
  customer?: OrderCustomer,
): Order {
  const lines: OrderLine[] = spec.map(([name, qty]) => {
    const mi = SEED_MENU.find((m) => m.name === name)!;
    return { name, qty, price: mi.price };
  });
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const vat = Math.round(subtotal * 0.075);
  seedOrderNo += 1;
  return {
    id: `A-${2360 + seedOrderNo}`, branch: "lekki", table, channel, customer,
    lines, subtotal, vat, total: subtotal + vat, method, staffName,
    at: Date.now() - minsAgo * 60000,
  };
}

const SEED_ORDERS: Order[] = [
  mkOrder(545, "Dine-in", "Table 3", [["Jollof Rice", 2], ["Heineken", 2], ["Suya Platter", 1]], "Cash", "Ada O."),
  mkOrder(482, "Dine-in", "Table 7", [["Jollof Rice", 3], ["Pounded Yam", 1], ["Pepper Soup", 1]], "Card", "Ada O."),
  mkOrder(421, "Takeout", "Takeout", [["Jollof Rice", 1], ["Fried Plantain", 2], ["Heineken", 1]], "Transfer", "Ada O.",
    { name: "Nkechi A.", phone: "+234 805 332 7781", pickup: "ASAP" }),
  mkOrder(358, "Dine-in", "Table 2", [["Mojito", 2], ["Suya Platter", 1], ["Chapman", 1]], "Card", "Ada O."),
  mkOrder(297, "Dine-in", "Bar", [["Heineken", 3], ["Mojito", 1], ["Espresso", 1]], "Cash", "Ada O."),
  mkOrder(243, "Delivery", "Delivery", [["Jollof Rice", 2], ["Grilled Tilapia", 1], ["Fried Plantain", 1]], "Cash on delivery", "Ada O.",
    { name: "Tola Bankole", phone: "+234 803 111 2200", address: "14 Admiralty Way, Lekki" }),
  mkOrder(176, "Dine-in", "Table 10", [["Suya Platter", 2], ["Jollof Rice", 1], ["Chin Chin", 1]], "Card", "Ada O."),
  mkOrder(119, "Dine-in", "Table 5", [["Pounded Yam", 2], ["Mojito", 1], ["Heineken", 2]], "Cash", "Ada O."),
  mkOrder(74, "Takeout", "Takeout", [["Jollof Rice", 2], ["Fried Plantain", 1], ["Heineken", 1]], "Transfer", "Ada O.",
    { name: "Femi Okoro", phone: "+234 802 998 1042", pickup: "In 15 minutes" }),
  mkOrder(33, "Dine-in", "Table 12", [["Jollof Rice", 1], ["Mojito", 1], ["Grilled Tilapia", 1], ["Pepper Soup", 1]], "Card", "Ada O."),
];

const SEED_SHIFTS: Shift[] = [
  { id: "S-201", staffId: "3", staffName: "Bayo K.", role: "cashier", branch: "lekki", openedAt: Date.now() - DAY, closedAt: Date.now() - DAY + 8 * 3600_000, openingFloat: 50000, countedCash: 537400, status: "closed", seedSales: 488200 },
  { id: "S-202", staffId: "3", staffName: "Ada O.",  role: "cashier", branch: "lekki", openedAt: Date.now() - DAY, closedAt: Date.now() - DAY + 8 * 3600_000, openingFloat: 50000, countedCash: 662400, status: "closed", seedSales: 612400 },
];

const SEED_TABLES: TableRec[] = [
  { id: "T1",  label: "Table 1",  zone: "Indoor",  seats: 2, status: "available" },
  { id: "T2",  label: "Table 2",  zone: "Indoor",  seats: 4, status: "occupied",  guests: 3, orderTotal: 48200, seatedAt: Date.now() - 35 * 60000 },
  { id: "T3",  label: "Table 3",  zone: "Indoor",  seats: 4, status: "occupied",  guests: 4, orderTotal: 76500, seatedAt: Date.now() - 52 * 60000 },
  { id: "T4",  label: "Table 4",  zone: "Indoor",  seats: 6, status: "reserved",  reservation: "19:30 · Tola Bankole" },
  { id: "T5",  label: "Table 5",  zone: "Indoor",  seats: 2, status: "available" },
  { id: "T6",  label: "Table 6",  zone: "Indoor",  seats: 4, status: "available" },
  { id: "T7",  label: "Table 7",  zone: "Indoor",  seats: 8, status: "occupied",  guests: 7, orderTotal: 122400, seatedAt: Date.now() - 18 * 60000 },
  { id: "T8",  label: "Table 8",  zone: "Indoor",  seats: 4, status: "available" },
  { id: "T9",  label: "Table 9",  zone: "Terrace", seats: 4, status: "available" },
  { id: "T10", label: "Table 10", zone: "Terrace", seats: 6, status: "occupied",  guests: 5, orderTotal: 94800, seatedAt: Date.now() - 64 * 60000 },
  { id: "T11", label: "Table 11", zone: "Terrace", seats: 4, status: "reserved",  reservation: "20:00 · Nkechi A." },
  { id: "T12", label: "Table 12", zone: "Terrace", seats: 2, status: "available" },
  { id: "BAR", label: "Bar",      zone: "Bar",     seats: 8, status: "occupied",  guests: 4, orderTotal: 38600, seatedAt: Date.now() - 12 * 60000 },
];

const SEED_TICKETS: Ticket[] = [
  { id: "KT-seed1", branch: "lekki", orderId: "A-2390", station: "Kitchen", label: "Table 7", channel: "Dine-in",
    items: [{ name: "Suya Platter", qty: 2 }, { name: "Jollof Rice", qty: 1 }], status: "Preparing", createdAt: Date.now() - 9 * 60000 },
  { id: "KT-seed2", branch: "lekki", orderId: "A-2392", station: "Kitchen", label: "Delivery · Nkechi A.", channel: "Delivery",
    items: [{ name: "Grilled Tilapia", qty: 1 }, { name: "Fried Plantain", qty: 2 }], status: "New", createdAt: Date.now() - 3 * 60000 },
  { id: "BT-seed1", branch: "lekki", orderId: "A-2391", station: "Bar", label: "Table 2", channel: "Dine-in",
    items: [{ name: "Mojito", qty: 2 }, { name: "Heineken", qty: 2 }], status: "New", createdAt: Date.now() - 4 * 60000 },
];

const SEED_TRANSFERS: Transfer[] = [
  {
    id: "WB-001", fromBranch: HUB_ID, toBranch: "ikoyi", status: "Requested", reason: "Low stock",
    requestedBy: "Ikoyi Manager", requestedAt: Date.now() - 40 * 60000,
    lines: [
      { sku: "KIT-GOAT", name: "Goat Meat", unit: "kg", qtyRequested: 15 },
      { sku: "KIT-YAM",  name: "Yam",       unit: "kg", qtyRequested: 30 },
    ],
  },
  {
    id: "WB-002", fromBranch: HUB_ID, toBranch: "agungi", status: "Issued", reason: "Event prep",
    requestedBy: "Agungi Manager", requestedAt: Date.now() - 3 * 3600_000,
    approvedBy: "Tunde A.", issuedBy: "Eze M.", issuedAt: Date.now() - 2 * 3600_000, valueAtCost: 132000,
    lines: [{ sku: "BAR-HEIN", name: "Heineken 330ml", unit: "btl", qtyRequested: 120, qtyIssued: 120 }],
  },
];

const SEED_VENDORS: Vendor[] = [
  { id: "v1", name: "ABC Foods Supplier",       contact: "Mr. Banjo",  phone: "+234 802 111 0001", email: "sales@abcfoods.ng",    tin: "12345678-0001", terms: "Net 30", category: "Dry goods" },
  { id: "v2", name: "Mama Nkechi Meat Supply",  contact: "Mrs. Nkechi", phone: "+234 803 222 0002", email: "nkechi@meatsupply.ng", tin: "22345678-0001", terms: "Net 15", category: "Protein" },
  { id: "v3", name: "Lagos Beverage Distributors", contact: "Tunde O.", phone: "+234 805 333 0003", email: "orders@lagosbev.ng",   tin: "32345678-0001", terms: "COD",    category: "Beverage" },
  { id: "v4", name: "FreshFarm Produce",        contact: "Ada E.",     phone: "+234 807 444 0004", email: "hello@freshfarm.ng",   tin: "42345678-0001", terms: "Net 15", category: "Produce" },
];

const SEED_POS: PurchaseOrder[] = [
  {
    id: "PO-2026-001", vendorId: "v2", branch: HUB_ID, status: "Ordered",
    expectedDate: "2026-05-23", createdAt: Date.now() - 2 * DAY, total: 628000, paid: false,
    lines: [
      { sku: "KIT-GOAT", name: "Goat Meat",    unit: "kg", qtyOrdered: 80, unitCost: 5600, qtyReceived: 0 },
      { sku: "KIT-BEEF", name: "Beef Sirloin", unit: "kg", qtyOrdered: 30, unitCost: 6000, qtyReceived: 0 },
    ],
  },
  {
    id: "PO-2026-002", vendorId: "v1", branch: HUB_ID, status: "Received",
    expectedDate: "2026-05-19", createdAt: Date.now() - 5 * DAY, receivedAt: Date.now() - 3 * DAY, total: 480000, paid: false,
    lines: [{ sku: "KIT-RICE", name: "Basmati Rice", unit: "kg", qtyOrdered: 200, unitCost: 2400, qtyReceived: 200 }],
  },
];

const SEED_PRICE_CHANGES: PriceChange[] = [
  { id: "pc1", sku: "KIT-RICE", name: "Basmati Rice", oldCost: 2200, newCost: 2400, vendorName: "ABC Foods Supplier", at: Date.now() - 3 * DAY },
];

const SEED_BATCHES: Batch[] = [
  { id: "b1", sku: "KIT-TILAPIA", branch: "lekki", name: "Tilapia (whole)", qty: 6,  unit: "pcs", expiry: "2026-05-24", receivedAt: Date.now() - 2 * DAY },
  { id: "b2", sku: "KIT-GOAT",    branch: "lekki", name: "Goat Meat",       qty: 8,  unit: "kg",  expiry: "2026-06-02", receivedAt: Date.now() - 1 * DAY },
  { id: "b3", sku: "BAR-SODA",    branch: "lekki", name: "Soda Water",      qty: 9,  unit: "L",   expiry: "2026-08-15", receivedAt: Date.now() - 4 * DAY },
];

const SEED_WALLETS: Wallet[] = [
  { branch: HUB_ID,   balance: 100000, float: 150000 },
  { branch: "lekki",  balance: 142000, float: 200000 },
  { branch: "ikoyi",  balance: 200000, float: 200000 },
  { branch: "agungi", balance: 38000,  float: 200000 },
];

const SEED_EXPENSES: ExpenseRequest[] = [
  {
    id: "EXP-001", branch: "ikoyi", category: "Repairs & Maintenance", amount: 25000,
    description: "Plumbing repair — kitchen sink", requestedBy: "Ikoyi Manager",
    requestedAt: Date.now() - 90 * 60000, status: "Pending",
  },
  {
    id: "EXP-002", branch: "lekki", category: "Cleaning", amount: 8000,
    description: "Cleaning supplies restock", requestedBy: "Fatima L.",
    requestedAt: Date.now() - 5 * 3600_000, status: "Approved",
    approvedBy: "Tunde A.", approvedAt: Date.now() - 4 * 3600_000,
  },
  {
    id: "EXP-003", branch: "lekki", category: "Diesel / Fuel", amount: 50000,
    description: "50 litres diesel — generator", requestedBy: "Eze M.",
    requestedAt: Date.now() - DAY, status: "Disbursed",
    approvedBy: "Tunde A.", approvedAt: Date.now() - DAY, disbursedAt: Date.now() - DAY + 3600_000,
  },
  {
    id: "EXP-004", branch: "lekki", category: "Transport", amount: 15000,
    description: "Market run — okrika", requestedBy: "David K.",
    requestedAt: Date.now() - 2 * DAY, status: "Reconciled",
    approvedBy: "Tunde A.", approvedAt: Date.now() - 2 * DAY, disbursedAt: Date.now() - 2 * DAY,
    actualSpent: 13500, changeReturned: 1500, receipt: "market-receipt.jpg", reconciledAt: Date.now() - 2 * DAY + 4 * 3600_000,
  },
];

const dateISO = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

const SEED_EMPLOYEES: Employee[] = [
  { id: "e1", name: "Ada O.",    role: "Cashier",             branch: "lekki", phone: "+234 803 100 0001", nextOfKin: "Chidi Okafor",  hireDate: "2024-03-01", scheduledStart: "08:00", baseSalary: 120000, transport: 20000, housing: 30000, compliance: { guarantor: true,  contract: true,  idCard: true  }, certName: "Food handler cert", certExpiry: dateISO(45),  status: "Active" },
  { id: "e2", name: "Bayo K.",   role: "Cashier",             branch: "lekki", phone: "+234 803 100 0002", nextOfKin: "Sade Kuti",     hireDate: "2024-07-15", scheduledStart: "08:00", baseSalary: 115000, transport: 20000, housing: 28000, compliance: { guarantor: true,  contract: true,  idCard: false }, certName: "Food handler cert", certExpiry: dateISO(60),  status: "Active" },
  { id: "e3", name: "Chukwu B.", role: "Bartender",           branch: "lekki", phone: "+234 803 100 0003", nextOfKin: "Ngozi Eze",     hireDate: "2023-11-02", scheduledStart: "10:00", baseSalary: 110000, transport: 18000, housing: 25000, compliance: { guarantor: true,  contract: true,  idCard: true  }, certName: "Food handler cert", certExpiry: dateISO(7),   status: "Active" },
  { id: "e4", name: "Amara K.",  role: "Head Chef",           branch: "lekki", phone: "+234 803 100 0004", nextOfKin: "Obi Kalu",      hireDate: "2022-05-20", scheduledStart: "07:00", baseSalary: 200000, transport: 30000, housing: 50000, compliance: { guarantor: true,  contract: true,  idCard: true  }, certName: "Food handler cert", certExpiry: dateISO(120), status: "Active" },
  { id: "e5", name: "Eze M.",    role: "Storekeeper",         branch: "lekki", phone: "+234 803 100 0005", nextOfKin: "Uche Mba",      hireDate: "2023-02-10", scheduledStart: "07:30", baseSalary: 105000, transport: 18000, housing: 24000, compliance: { guarantor: true,  contract: true,  idCard: true  }, certName: "Food handler cert", certExpiry: dateISO(90),  status: "Active" },
  { id: "e6", name: "Fatima L.", role: "Server",              branch: "lekki", phone: "+234 803 100 0006", nextOfKin: "Musa Lawal",    hireDate: "2025-01-08", scheduledStart: "09:00", baseSalary: 85000,  transport: 15000, housing: 18000, compliance: { guarantor: false, contract: true,  idCard: true  }, certName: "Food handler cert", certExpiry: dateISO(30),  status: "Active" },
  { id: "e7", name: "Tunde A.",  role: "Operations Manager",  branch: "ikoyi", phone: "+234 803 100 0007", nextOfKin: "Bisi Adekunle", hireDate: "2021-09-01", scheduledStart: "08:00", baseSalary: 280000, transport: 40000, housing: 70000, compliance: { guarantor: true,  contract: true,  idCard: true  }, certName: "Food handler cert", certExpiry: dateISO(200), status: "Active" },
  { id: "e8", name: "David K.",  role: "Server",              branch: "ikoyi", phone: "+234 803 100 0008", nextOfKin: "Grace Koko",    hireDate: "2024-10-12", scheduledStart: "09:00", baseSalary: 85000,  transport: 15000, housing: 18000, compliance: { guarantor: true,  contract: true,  idCard: true  }, certName: "Food handler cert", certExpiry: dateISO(50),  status: "Active" },
];

const SEED_ATTENDANCE: Attendance[] = [
  { id: "at1", employeeId: "e3", date: dateISO(0),  clockIn: Date.now() - 3 * 3600_000,        lateMinutes: 18 },
  { id: "at2", employeeId: "e3", date: dateISO(-1), clockIn: Date.now() - DAY,                 lateMinutes: 22 },
  { id: "at3", employeeId: "e3", date: dateISO(-2), clockIn: Date.now() - 2 * DAY,             lateMinutes: 16 },
  { id: "at4", employeeId: "e1", date: dateISO(0),  clockIn: Date.now() - 5 * 3600_000,        lateMinutes: 0 },
  { id: "at5", employeeId: "e4", date: dateISO(0),  clockIn: Date.now() - 6 * 3600_000,        lateMinutes: 4 },
];

const SEED_DISCIPLINARY: Disciplinary[] = [
  { id: "d1", employeeId: "e3", type: "Misconduct", description: "Bar variance −2.4% across three shifts — over-pouring suspected.", action: "Retraining on pour sizes", at: Date.now() - 2 * DAY, by: "Tunde A." },
];

const SEED_RIDERS: Rider[] = [
  { id: "r1", name: "Musa O.",   type: "Internal bike", branch: "lekki", status: "Available", expenses: 12000 },
  { id: "r2", name: "Sani A.",   type: "Internal bike", branch: "lekki", status: "Available", expenses: 8000 },
  { id: "r3", name: "Chowdeck",  type: "3PL partner",   branch: "lekki", status: "Available", expenses: 0 },
  { id: "r4", name: "Glovo",     type: "3PL partner",   branch: "lekki", status: "Available", expenses: 0 },
];

const SEED_DELIVERIES: DeliveryJob[] = [
  {
    id: "DEL-001", orderId: "A-2388", branch: "lekki", customer: "Tunde B.", phone: "+234 803 555 1010",
    address: "14 Admiralty Way, Lekki Phase 1", fee: 1500, cod: true, codAmount: 14500,
    status: "Ready for pickup", createdAt: Date.now() - 22 * 60000, codSettled: false,
  },
  {
    id: "DEL-002", orderId: "A-2389", branch: "lekki", customer: "Amaka N.", phone: "+234 805 555 2020",
    address: "Block C, Oniru Estate", fee: 1500, cod: true, codAmount: 22000,
    status: "Delivered", riderId: "r1", createdAt: Date.now() - 2 * 3600_000,
    assignedAt: Date.now() - 90 * 60000, deliveredAt: Date.now() - 35 * 60000, codSettled: false,
  },
];

const SEED_CUSTOMERS: Customer[] = [
  { id: "c1", name: "Tola Bankole", phone: "+234 803 111 2200", email: "tola@mail.com", tier: "VIP",       birthday: "05-28", note: "Likes Grilled Tilapia · window seat", joinedAt: Date.now() - 300 * DAY, seedVisits: 42, seedSpend: 1820000, seedFavorite: "Grilled Tilapia", seedLastDays: 2 },
  { id: "c2", name: "Nkechi A.",    phone: "+234 805 332 7781", email: "nkechi@mail.com", tier: "Regular", birthday: "11-04", note: "", joinedAt: Date.now() - 200 * DAY, seedVisits: 28, seedSpend: 940000, seedFavorite: "Suya Platter", seedLastDays: 1 },
  { id: "c3", name: "Femi Okoro",   phone: "+234 802 998 1042", email: "femi@mail.com", tier: "Regular",  birthday: "05-12", note: "Complained about cold soup 2 weeks ago", joinedAt: Date.now() - 240 * DAY, seedVisits: 21, seedSpend: 712000, seedFavorite: "Pepper Soup", seedLastDays: 5 },
  { id: "c4", name: "Sade Williams",phone: "+234 807 220 5519", email: "sade@mail.com", tier: "Regular",  birthday: "08-19", note: "", joinedAt: Date.now() - 120 * DAY, seedVisits: 12, seedSpend: 308000, seedFavorite: "Mojito", seedLastDays: 38 },
  { id: "c5", name: "Idris M.",     phone: "+234 809 445 8830", email: "idris@mail.com", tier: "Regular", birthday: "02-09", note: "", joinedAt: Date.now() - 90 * DAY, seedVisits: 8, seedSpend: 184000, seedFavorite: "Jollof Rice", seedLastDays: 44 },
  { id: "c6", name: "Acme Corp",    phone: "+234 814 777 0001", email: "orders@acme.ng", tier: "VIP",     note: "Corporate account · bulk lunch orders", joinedAt: Date.now() - 160 * DAY, seedVisits: 9, seedSpend: 2100000, seedFavorite: "Event catering", seedLastDays: 3 },
];

const SEED_FEEDBACK: Feedback[] = [
  { id: "fb1", branch: "lekki", customerName: "Tola Bankole", phone: "+234 803 111 2200", channel: "Dine-in",  food: 5, service: 5, ambience: 4, comment: "Excellent jollof, very friendly service.", sentiment: "Positive", at: Date.now() - 6 * 3600_000 },
  { id: "fb2", branch: "lekki", customerName: "Femi Okoro",   phone: "+234 802 998 1042", channel: "Delivery", food: 2, service: 3, ambience: 3, comment: "The soup arrived cold and a bit late.", sentiment: "Negative", at: Date.now() - 2 * DAY },
  { id: "fb3", branch: "lekki", customerName: "Walk-in guest", channel: "Dine-in", food: 4, service: 4, ambience: 5, comment: "Lovely ambience, will come again.", sentiment: "Positive", at: Date.now() - 26 * 3600_000 },
];

const SEED_COMPLAINTS: ComplaintTicket[] = [
  { id: "CMP-001", branch: "lekki", customerName: "Femi Okoro", phone: "+234 802 998 1042", subject: "Cold soup on delivery", detail: "Pepper soup arrived cold and 20 minutes late. Customer rated 2★.", status: "In progress", severity: "High", raisedBy: "System · red flag", raisedAt: Date.now() - 2 * DAY, fromFeedback: true },
  { id: "CMP-002", branch: "lekki", customerName: "Nkechi A.", phone: "+234 805 332 7781", subject: "Wrong side served", detail: "Asked for plantain, served chips. Resolved with a replacement.", status: "Resolved", severity: "Low", raisedBy: "Tunde A.", raisedAt: Date.now() - 4 * DAY, resolvedAt: Date.now() - 4 * DAY + 2 * 3600_000 },
];

const SEED_EVENTS: RestaurantEvent[] = [
  {
    id: "EVT-001", branch: "lekki", name: "Adeyemi × Okoro Wedding", date: "Today · 16:00", venue: "Garden Hall",
    guests: 180, package: "Premium", value: 4200000, deposit: 2000000, status: "Live", createdAt: Date.now() - 40 * DAY,
    costs: [
      { label: "Food & bar COGS", amount: 1480000 },
      { label: "Staff (12 × shift)", amount: 142000 },
      { label: "Decoration & rentals", amount: 520000 },
      { label: "DJ & entertainment", amount: 350000 },
    ],
  },
  {
    id: "EVT-002", branch: "lekki", name: "Acme Corp End-of-year", date: "Fri 22 May · 19:00", venue: "Lounge",
    guests: 60, package: "Cocktail", value: 1450000, deposit: 700000, status: "Confirmed", createdAt: Date.now() - 18 * DAY,
    costs: [
      { label: "Food & bar COGS", amount: 540000 },
      { label: "Staff (6 × shift)", amount: 64000 },
      { label: "Decoration & rentals", amount: 180000 },
    ],
  },
  {
    id: "EVT-003", branch: "lekki", name: "Birthday — Tola B.", date: "Sat 23 May · 20:00", venue: "Terrace",
    guests: 25, package: "À la carte", value: 620000, deposit: 300000, status: "Confirmed", createdAt: Date.now() - 12 * DAY,
    costs: [
      { label: "Food & bar COGS", amount: 210000 },
      { label: "Staff (3 × shift)", amount: 28000 },
      { label: "Cake & decoration", amount: 90000 },
    ],
  },
  {
    id: "EVT-004", branch: "lekki", name: "Product Launch — Greenleaf", date: "Mon 25 May · 18:00", venue: "Garden Hall",
    guests: 120, package: "Buffet", value: 2800000, deposit: 0, status: "Deposit pending", createdAt: Date.now() - 6 * DAY,
    costs: [
      { label: "Food & bar COGS", amount: 1020000 },
      { label: "Staff (10 × shift)", amount: 110000 },
      { label: "Staging & AV", amount: 640000 },
    ],
  },
];

const SEED_AUDIT: AuditEntry[] = [
  { id: "AUD-seed1", at: Date.now() - 3 * 3600_000, branch: "lekki", actor: "Tunde A.", category: "Sales",
    action: "Order voided", detail: "A-2361 · Wrong order keyed · ₦19,350", ref: "A-2361", amount: 19350, severity: "warning" },
  { id: "AUD-seed2", at: Date.now() - 5 * 3600_000, branch: "lekki", actor: "Ada O.", category: "Sales",
    action: "Discount applied", detail: "A-2364 · Staff meal 20% · ₦3,400 off", ref: "A-2364", amount: 3400, severity: "warning" },
  { id: "AUD-seed3", at: Date.now() - DAY, branch: "lekki", actor: "Tunde A.", category: "Finance",
    action: "Expense approved", detail: "EXP-003 · Diesel / Fuel · ₦50,000", ref: "EXP-003", amount: 50000, severity: "info" },
  { id: "AUD-seed4", at: Date.now() - DAY - 2 * 3600_000, branch: "agungi", actor: "Eze M.", category: "Transfers",
    action: "Transfer issued", detail: "WB-002 → Agungi · 120 btl Heineken · ₦132,000", ref: "WB-002", amount: 132000, severity: "info" },
  { id: "AUD-seed5", at: Date.now() - 2 * DAY, branch: HUB_ID, actor: "Storekeeper", category: "Procurement",
    action: "Cost price changed", detail: "Basmati Rice · ₦2,200 → ₦2,400 · ABC Foods Supplier", ref: "KIT-RICE", severity: "warning" },
  { id: "AUD-seed6", at: Date.now() - 2 * DAY, branch: "lekki", actor: "Tunde A.", category: "HR",
    action: "Disciplinary logged", detail: "Chukwu B. · Misconduct · Retraining on pour sizes", ref: "e3", severity: "warning" },
];

const SEED_STATE: StoreState = {
  branches: SEED_BRANCHES,
  currentBranch: "lekki",
  inventory: SEED_INVENTORY,
  menu: SEED_MENU,
  shifts: SEED_SHIFTS,
  orders: SEED_ORDERS,
  waste: [],
  counts: [],
  tables: SEED_TABLES,
  tickets: SEED_TICKETS,
  transfers: SEED_TRANSFERS,
  vendors: SEED_VENDORS,
  purchaseOrders: SEED_POS,
  priceChanges: SEED_PRICE_CHANGES,
  batches: SEED_BATCHES,
  expenses: SEED_EXPENSES,
  wallets: SEED_WALLETS,
  employees: SEED_EMPLOYEES,
  attendance: SEED_ATTENDANCE,
  disciplinary: SEED_DISCIPLINARY,
  payrollRuns: [],
  riders: SEED_RIDERS,
  deliveries: SEED_DELIVERIES,
  customers: SEED_CUSTOMERS,
  feedback: SEED_FEEDBACK,
  complaints: SEED_COMPLAINTS,
  events: SEED_EVENTS,
  auditLog: SEED_AUDIT,
};

// ── Store value ──────────────────────────────────────────────────────────────

interface StoreValue extends StoreState {
  hydrated: boolean;
  products: InventoryItem[]; // unique by SKU — the product catalogue
  setBranch: (branchId: string) => void;
  branchName: (id: string) => string;
  // shifts
  openShift: (staff: { id: string; name: string }, role: ShiftRole, openingFloat: number) => Shift;
  closeShift: (shiftId: string, countedCash: number) => void;
  activeShift: (staffId: string) => Shift | undefined;
  barShift: () => Shift | undefined;
  shiftSales: (shiftId: string) => number;
  // sales
  recordSale: (input: {
    table: string;
    channel: OrderChannel;
    customer?: OrderCustomer;
    guests?: number;
    lines: OrderLine[];
    discount?: number;
    discountNote?: string;
    payments: PaymentEntry[];
    splitWays?: number;
    method: string;
    deliveryFee?: number;
    staff: { id: string; name: string };
  }) => Order;
  voidOrder: (id: string, reason: string, by: string) => void;
  // inventory — all act on the current branch
  addInventoryItem: (item: InventoryItem) => void;
  receiveStock: (sku: string, qty: number) => void;
  recordStockCount: (sku: string, actual: number, by: { name: string; shiftId?: string }) => StockCount;
  recordWaste: (input: { sku: string; qty: number; reason: string; staffName: string; shiftId?: string }) => WasteEntry;
  importInventory: (items: InventoryItem[]) => void;
  // menu
  addMenuItem: (item: MenuItem) => void;
  updateMenuItem: (item: MenuItem) => void;
  importMenu: (items: MenuItem[]) => void;
  recipeCost: (recipe: RecipeLine[]) => number;
  // tables & kitchen/bar tickets
  seatTable: (id: string, guests: number) => void;
  freeTable: (id: string) => void;
  advanceTicket: (id: string) => void;
  markTicketReady: (id: string) => void;
  // strong-room transfers
  requestTransfer: (input: { toBranch: string; lines: { sku: string; qty: number }[]; reason: string; by: string }) => Transfer;
  approveTransfer: (id: string, by: string) => void;
  rejectTransfer: (id: string, by: string) => void;
  issueTransfer: (id: string, issued: { sku: string; qty: number }[], by: string) => void;
  receiveTransfer: (id: string, received: { sku: string; qty: number }[], by: string) => void;
  // procurement
  addVendor: (v: Omit<Vendor, "id">) => Vendor;
  createPO: (input: { vendorId: string; branch: string; expectedDate: string; lines: { sku: string; qtyOrdered: number; unitCost: number }[] }) => PurchaseOrder;
  receivePO: (id: string, received: { sku: string; qtyReceived: number; unitCost: number; expiry?: string }[], by: string) => void;
  markPOPaid: (id: string) => void;
  // expenses & petty cash
  walletOf: (branch: string) => Wallet | undefined;
  requestExpense: (input: { category: string; amount: number; description: string; by: string }) => ExpenseRequest;
  approveExpense: (id: string, by: string) => void;
  rejectExpense: (id: string, by: string) => void;
  disburseExpense: (id: string, by: string) => void;
  reconcileExpense: (id: string, input: { actualSpent: number; receipt: string }, by: string) => void;
  topUpWallet: (branch: string, amount: number, by: string) => void;
  // hr & payroll
  addEmployee: (e: Omit<Employee, "id">) => Employee;
  updateEmployee: (e: Employee) => void;
  clockIn: (employeeId: string) => void;
  clockOut: (employeeId: string) => void;
  logDisciplinary: (input: { employeeId: string; type: IncidentType; description: string; action: string; by: string }) => void;
  runPayroll: (period: string, by: string) => PayrollRun;
  // dispatch & fleet
  addRider: (input: { name: string; type: RiderType }) => Rider;
  setRiderStatus: (id: string, status: Rider["status"]) => void;
  advanceDelivery: (id: string) => void;
  assignDelivery: (id: string, riderId: string) => void;
  completeDelivery: (id: string) => void;
  settleCOD: (riderId: string) => void;
  logFleetExpense: (riderId: string, amount: number) => void;
  // crm
  addCustomer: (input: { name: string; phone: string; email?: string; tier?: CustomerTier; birthday?: string }) => Customer;
  updateCustomer: (c: Customer) => void;
  recordFeedback: (input: { customerName: string; phone?: string; channel: OrderChannel; food: number; service: number; ambience: number; comment: string }) => void;
  addComplaint: (input: { customerName: string; phone?: string; subject: string; detail: string; severity: "Low" | "High"; by: string }) => void;
  setComplaintStatus: (id: string, status: ComplaintStatus) => void;
  contactCustomer: (id: string, kind: string) => void;
  // events
  addEvent: (input: { name: string; date: string; venue: string; guests: number; package: string; value: number; deposit: number; costs: EventCost[] }) => RestaurantEvent;
  recordEventDeposit: (id: string, amount: number) => void;
  advanceEventStatus: (id: string) => void;
  // audit trail
  logAudit: (e: Omit<AuditEntry, "id" | "at">) => void;
  resetAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

const STORAGE_KEY = "haven11_store_v11";

let counter = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Build an immutable audit-trail record. */
const audit = (e: Omit<AuditEntry, "id" | "at">): AuditEntry => ({ ...e, id: uid("AUD"), at: Date.now() });

const TICKET_FLOW: TicketStatus[] = ["New", "Preparing", "Ready"];

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreState>(SEED_STATE);
  const [hydrated, setHydrated] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoreState;
        if (parsed.branches && parsed.inventory) setState(parsed);
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }, [state, hydrated]);

  const products = useMemo(() => {
    const m = new Map<string, InventoryItem>();
    for (const i of state.inventory) if (!m.has(i.sku)) m.set(i.sku, i);
    return Array.from(m.values());
  }, [state.inventory]);

  const setBranch = useCallback<StoreValue["setBranch"]>((branchId) => {
    setState((p) => ({ ...p, currentBranch: branchId }));
  }, []);

  const branchName = useCallback(
    (id: string) => state.branches.find((b) => b.id === id)?.name ?? id,
    [state.branches],
  );

  const recipeCost = useCallback(
    (recipe: RecipeLine[]) =>
      recipe.reduce((sum, line) => {
        const inv = state.inventory.find((i) => i.sku === line.sku);
        return sum + (inv ? inv.cost * line.qty : 0);
      }, 0),
    [state.inventory],
  );

  const activeShift = useCallback(
    (staffId: string) => state.shifts.find((s) => s.staffId === staffId && s.status === "open"),
    [state.shifts],
  );

  const barShift = useCallback(
    () => state.shifts.find((s) => s.role === "bartender" && s.status === "open"),
    [state.shifts],
  );

  const shiftSales = useCallback(
    (shiftId: string) => {
      const shift = state.shifts.find((s) => s.id === shiftId);
      if (shift?.seedSales != null) return shift.seedSales;
      return state.orders
        .filter((o) => o.shiftId === shiftId && !o.voided)
        .reduce((s, o) => s + o.total, 0);
    },
    [state.shifts, state.orders],
  );

  const openShift = useCallback<StoreValue["openShift"]>((staff, role, openingFloat) => {
    const shift: Shift = {
      id: uid("S"), staffId: staff.id, staffName: staff.name, role,
      branch: stateRef.current.currentBranch,
      openedAt: Date.now(), openingFloat, status: "open",
    };
    setState((p) => ({ ...p, shifts: [shift, ...p.shifts] }));
    return shift;
  }, []);

  const closeShift = useCallback<StoreValue["closeShift"]>((shiftId, countedCash) => {
    setState((p) => {
      const sh = p.shifts.find((s) => s.id === shiftId);
      if (!sh) return p;
      const sales = sh.seedSales ?? p.orders.filter((o) => o.shiftId === shiftId && !o.voided).reduce((sum, o) => sum + o.total, 0);
      const variance = countedCash - (sh.openingFloat + sales);
      const entry = audit({
        branch: sh.branch, actor: sh.staffName, category: "Finance", action: "Shift closed",
        detail: `${shiftId} · counted ₦${countedCash.toLocaleString()} · ${variance === 0 ? "balanced" : `₦${Math.abs(variance).toLocaleString()} ${variance < 0 ? "short" : "over"}`}`,
        ref: shiftId, amount: variance, severity: variance < 0 ? "warning" : "info",
      });
      return {
        ...p,
        shifts: p.shifts.map((s) =>
          s.id === shiftId ? { ...s, status: "closed", closedAt: Date.now(), countedCash } : s,
        ),
        auditLog: [entry, ...p.auditLog],
      };
    });
  }, []);

  const recordSale = useCallback<StoreValue["recordSale"]>((input) => {
    const s = stateRef.current;
    const branch = s.currentBranch;
    const subtotal = input.lines.reduce((sum, l) => sum + l.price * l.qty, 0);
    const discount = input.discount && input.discount > 0 ? input.discount : 0;
    const vat = Math.round((subtotal - discount) * 0.075);
    const total = subtotal - discount + vat;
    const shift = s.shifts.find((x) => x.staffId === input.staff.id && x.status === "open");

    const created: Order = {
      id: `A-${2400 + s.orders.length + 1}`,
      branch,
      table: input.table,
      channel: input.channel,
      customer: input.customer,
      guests: input.guests,
      lines: input.lines,
      subtotal,
      discount: discount || undefined,
      discountNote: discount ? input.discountNote : undefined,
      vat,
      total,
      method: input.method,
      payments: input.payments,
      splitWays: input.splitWays && input.splitWays > 1 ? input.splitWays : undefined,
      staffName: input.staff.name,
      shiftId: shift?.id,
      at: Date.now(),
    };

    // A discount is an override worth recording in the audit trail.
    const discountEntry = discount > 0
      ? audit({
          branch, actor: input.staff.name, category: "Sales", action: "Discount applied",
          detail: `${created.id} · ${input.discountNote || "Discount"} · ₦${discount.toLocaleString()} off`,
          ref: created.id, amount: discount, severity: "warning",
        })
      : null;

    const barCats = new Set(["Drinks", "Cocktails"]);
    const label = input.channel === "Dine-in"
      ? input.table
      : `${input.channel} · ${input.customer?.name ?? "Guest"}`;
    const toTicketItem = (line: OrderLine): TicketItem => {
      const parts = [...(line.modifiers ?? []).map((m) => m.label)];
      if (line.note) parts.push(line.note);
      return { name: line.name, qty: line.qty, detail: parts.length ? parts.join(", ") : undefined };
    };
    const kitchenItems: TicketItem[] = [];
    const barItems: TicketItem[] = [];
    for (const line of input.lines) {
      const mi = s.menu.find((m) => m.name === line.name);
      (mi && barCats.has(mi.category) ? barItems : kitchenItems).push(toTicketItem(line));
    }
    const newTickets: Ticket[] = [];
    if (kitchenItems.length) {
      newTickets.push({ id: uid("KT"), branch, orderId: created.id, station: "Kitchen", label, channel: input.channel, items: kitchenItems, status: "New", createdAt: Date.now() });
    }
    if (barItems.length) {
      newTickets.push({ id: uid("BT"), branch, orderId: created.id, station: "Bar", label, channel: input.channel, items: barItems, status: "New", createdAt: Date.now() });
    }

    // A delivery order also raises a dispatch job for the road.
    let deliveryJob: DeliveryJob | undefined;
    if (input.channel === "Delivery") {
      const fee = input.deliveryFee ?? 0;
      const cod = input.method === "Cash on delivery";
      deliveryJob = {
        id: uid("DEL"),
        orderId: created.id,
        branch,
        customer: input.customer?.name ?? "Guest",
        phone: input.customer?.phone ?? "",
        address: input.customer?.address ?? "",
        fee,
        cod,
        codAmount: cod ? created.total + fee : 0,
        status: "Preparing",
        createdAt: Date.now(),
        codSettled: false,
      };
    }

    setState((p) => {
      // Deduct recipe ingredients from THIS branch's stock.
      const inventory = p.inventory.map((inv) => ({ ...inv }));
      for (const line of input.lines) {
        const menuItem = p.menu.find((m) => m.name === line.name);
        if (!menuItem) continue;
        for (const r of menuItem.recipe) {
          const inv = inventory.find((i) => i.sku === r.sku && i.branch === branch);
          if (inv) inv.onHand = Math.max(0, +(inv.onHand - r.qty * line.qty).toFixed(4));
        }
      }
      // Golden record — capture a customer from takeout/delivery orders, keyed by phone.
      let customers = p.customers;
      if ((input.channel === "Takeout" || input.channel === "Delivery") && input.customer?.phone) {
        const phone = input.customer.phone;
        if (!p.customers.some((c) => c.phone === phone)) {
          customers = [
            { id: uid("cust"), name: input.customer.name, phone, tier: "New", joinedAt: Date.now() },
            ...p.customers,
          ];
        }
      }
      return {
        ...p,
        inventory,
        orders: [created, ...p.orders],
        tickets: [...newTickets, ...p.tickets],
        deliveries: deliveryJob ? [deliveryJob, ...p.deliveries] : p.deliveries,
        customers,
        auditLog: discountEntry ? [discountEntry, ...p.auditLog] : p.auditLog,
      };
    });

    return created;
  }, []);

  const voidOrder = useCallback<StoreValue["voidOrder"]>((id, reason, by) => {
    setState((p) => {
      const order = p.orders.find((o) => o.id === id);
      if (!order || order.voided) return p;
      const inventory = p.inventory.map((i) => ({ ...i }));
      for (const line of order.lines) {
        const mi = p.menu.find((m) => m.name === line.name);
        if (!mi) continue;
        for (const r of mi.recipe) {
          const inv = inventory.find((i) => i.sku === r.sku && i.branch === order.branch);
          if (inv) inv.onHand = +(inv.onHand + r.qty * line.qty).toFixed(4);
        }
      }
      const entry = audit({
        branch: order.branch, actor: by, category: "Sales", action: "Order voided",
        detail: `${order.id} · ${reason} · ₦${order.total.toLocaleString()}`,
        ref: order.id, amount: order.total, severity: "warning",
      });
      return {
        ...p,
        inventory,
        orders: p.orders.map((o) => (o.id === id ? { ...o, voided: true, voidReason: reason, voidedBy: by } : o)),
        tickets: p.tickets.filter((t) => t.orderId !== id),
        auditLog: [entry, ...p.auditLog],
      };
    });
  }, []);

  const addInventoryItem = useCallback<StoreValue["addInventoryItem"]>((item) => {
    setState((p) => ({ ...p, inventory: [{ ...item, branch: item.branch || p.currentBranch }, ...p.inventory] }));
  }, []);

  const receiveStock = useCallback<StoreValue["receiveStock"]>((sku, qty) => {
    setState((p) => ({
      ...p,
      inventory: p.inventory.map((i) =>
        i.sku === sku && i.branch === p.currentBranch ? { ...i, onHand: +(i.onHand + qty).toFixed(4) } : i,
      ),
    }));
  }, []);

  const recordStockCount = useCallback<StoreValue["recordStockCount"]>((sku, actual, by) => {
    const branch = stateRef.current.currentBranch;
    const inv = stateRef.current.inventory.find((i) => i.sku === sku && i.branch === branch)!;
    const variance = +(actual - inv.onHand).toFixed(4);
    const created: StockCount = {
      id: uid("VC"), branch, sku, name: inv.name, line: inv.line,
      expected: inv.onHand, actual, variance,
      varianceCost: Math.round(variance * inv.cost),
      overPour: inv.line === "Bar" && variance < 0,
      staffName: by.name, shiftId: by.shiftId, at: Date.now(),
    };
    const countEntry = variance !== 0
      ? audit({
          branch, actor: by.name, category: "Inventory",
          action: created.overPour ? "Over-pour recorded" : "Stock variance recorded",
          detail: `${inv.name} · expected ${fmtQty(inv.onHand)}, counted ${fmtQty(actual)} · ₦${Math.abs(created.varianceCost).toLocaleString()} ${variance < 0 ? "loss" : "gain"}`,
          ref: sku, amount: created.varianceCost, severity: created.overPour || variance < 0 ? "warning" : "info",
        })
      : null;
    setState((p) => ({
      ...p,
      inventory: p.inventory.map((i) => (i.sku === sku && i.branch === branch ? { ...i, onHand: actual } : i)),
      counts: [created, ...p.counts],
      auditLog: countEntry ? [countEntry, ...p.auditLog] : p.auditLog,
    }));
    return created;
  }, []);

  const recordWaste = useCallback<StoreValue["recordWaste"]>((input) => {
    const branch = stateRef.current.currentBranch;
    const inv = stateRef.current.inventory.find((i) => i.sku === input.sku && i.branch === branch)!;
    const created: WasteEntry = {
      id: uid("W"), branch, sku: input.sku, name: inv.name, qty: input.qty, unit: inv.unit,
      reason: input.reason, cost: Math.round(input.qty * inv.cost),
      staffName: input.staffName, shiftId: input.shiftId, at: Date.now(),
    };
    const wasteEntry = audit({
      branch, actor: input.staffName, category: "Inventory", action: "Waste logged",
      detail: `${created.name} · ${fmtQty(created.qty)} ${created.unit} · ${input.reason} · ₦${created.cost.toLocaleString()}`,
      ref: input.sku, amount: created.cost, severity: "info",
    });
    setState((p) => ({
      ...p,
      inventory: p.inventory.map((i) =>
        i.sku === input.sku && i.branch === branch ? { ...i, onHand: Math.max(0, +(i.onHand - input.qty).toFixed(4)) } : i,
      ),
      waste: [created, ...p.waste],
      auditLog: [wasteEntry, ...p.auditLog],
    }));
    return created;
  }, []);

  const importInventory = useCallback<StoreValue["importInventory"]>((items) => {
    setState((p) => {
      const branch = p.currentBranch;
      const keyed = new Map(p.inventory.map((i) => [`${i.branch}:${i.sku}`, i]));
      for (const it of items) {
        const row = { ...it, branch };
        keyed.set(`${branch}:${row.sku}`, row);
      }
      return { ...p, inventory: Array.from(keyed.values()) };
    });
  }, []);

  const addMenuItem = useCallback<StoreValue["addMenuItem"]>((item) => {
    setState((p) => ({ ...p, menu: [item, ...p.menu] }));
  }, []);

  const updateMenuItem = useCallback<StoreValue["updateMenuItem"]>((item) => {
    setState((p) => ({ ...p, menu: p.menu.map((m) => (m.id === item.id ? item : m)) }));
  }, []);

  const importMenu = useCallback<StoreValue["importMenu"]>((items) => {
    setState((p) => {
      const byName = new Map(p.menu.map((m) => [m.name.toLowerCase(), m]));
      for (const it of items) {
        const existing = byName.get(it.name.toLowerCase());
        byName.set(it.name.toLowerCase(), existing ? { ...existing, ...it, id: existing.id, recipe: existing.recipe } : it);
      }
      return { ...p, menu: Array.from(byName.values()) };
    });
  }, []);

  const seatTable = useCallback<StoreValue["seatTable"]>((id, guests) => {
    setState((p) => ({
      ...p,
      tables: p.tables.map((t) => (t.id === id ? { ...t, status: "occupied", guests, seatedAt: Date.now() } : t)),
    }));
  }, []);

  const freeTable = useCallback<StoreValue["freeTable"]>((id) => {
    setState((p) => ({
      ...p,
      tables: p.tables.map((t) =>
        t.id === id ? { ...t, status: "available", guests: undefined, seatedAt: undefined, orderTotal: undefined } : t,
      ),
    }));
  }, []);

  const advanceTicket = useCallback<StoreValue["advanceTicket"]>((id) => {
    setState((p) => ({
      ...p,
      tickets: p.tickets.flatMap((t) => {
        if (t.id !== id) return [t];
        const idx = TICKET_FLOW.indexOf(t.status);
        if (idx >= TICKET_FLOW.length - 1) return [];
        return [{ ...t, status: TICKET_FLOW[idx + 1] }];
      }),
    }));
  }, []);

  const markTicketReady = useCallback<StoreValue["markTicketReady"]>((id) => {
    setState((p) => ({
      ...p,
      tickets: p.tickets.map((t) => (t.id === id ? { ...t, status: "Ready" } : t)),
    }));
  }, []);

  // ── Strong-room transfers ──────────────────────────────────────────────────

  const requestTransfer = useCallback<StoreValue["requestTransfer"]>((input) => {
    const s = stateRef.current;
    const lines: TransferLine[] = input.lines.map((l) => {
      const prod = s.inventory.find((i) => i.sku === l.sku);
      return { sku: l.sku, name: prod?.name ?? l.sku, unit: prod?.unit ?? "", qtyRequested: l.qty };
    });
    const created: Transfer = {
      id: `WB-${String(s.transfers.length + 1).padStart(3, "0")}`,
      fromBranch: HUB_ID,
      toBranch: input.toBranch,
      lines,
      status: "Requested",
      reason: input.reason,
      requestedBy: input.by,
      requestedAt: Date.now(),
    };
    setState((p) => ({ ...p, transfers: [created, ...p.transfers] }));
    return created;
  }, []);

  const approveTransfer = useCallback<StoreValue["approveTransfer"]>((id, by) => {
    setState((p) => {
      const t = p.transfers.find((x) => x.id === id);
      if (!t) return p;
      const dest = p.branches.find((b) => b.id === t.toBranch)?.name ?? t.toBranch;
      const entry = audit({
        branch: t.toBranch, actor: by, category: "Transfers", action: "Transfer approved",
        detail: `${id} → ${dest} · ${t.lines.length} item${t.lines.length !== 1 ? "s" : ""}`,
        ref: id, severity: "info",
      });
      return {
        ...p,
        transfers: p.transfers.map((x) => (x.id === id ? { ...x, status: "Approved", approvedBy: by } : x)),
        auditLog: [entry, ...p.auditLog],
      };
    });
  }, []);

  const rejectTransfer = useCallback<StoreValue["rejectTransfer"]>((id, by) => {
    setState((p) => {
      const t = p.transfers.find((x) => x.id === id);
      if (!t) return p;
      const dest = p.branches.find((b) => b.id === t.toBranch)?.name ?? t.toBranch;
      const entry = audit({
        branch: t.toBranch, actor: by, category: "Transfers", action: "Transfer rejected",
        detail: `${id} → ${dest} · request declined`,
        ref: id, severity: "warning",
      });
      return {
        ...p,
        transfers: p.transfers.map((x) => (x.id === id ? { ...x, status: "Rejected", approvedBy: by } : x)),
        auditLog: [entry, ...p.auditLog],
      };
    });
  }, []);

  const issueTransfer = useCallback<StoreValue["issueTransfer"]>((id, issued, by) => {
    setState((p) => {
      const transfer = p.transfers.find((t) => t.id === id);
      if (!transfer) return p;
      const issuedMap = new Map(issued.map((x) => [x.sku, x.qty]));
      // Deduct issued quantities from the Strong Room.
      const inventory = p.inventory.map((i) => {
        if (i.branch !== HUB_ID) return i;
        const q = issuedMap.get(i.sku);
        return q != null ? { ...i, onHand: Math.max(0, +(i.onHand - q).toFixed(4)) } : i;
      });
      let valueAtCost = 0;
      const lines = transfer.lines.map((l) => {
        const q = issuedMap.get(l.sku) ?? l.qtyRequested;
        const cost = p.inventory.find((i) => i.sku === l.sku)?.cost ?? 0;
        valueAtCost += q * cost;
        return { ...l, qtyIssued: q };
      });
      const dest = p.branches.find((b) => b.id === transfer.toBranch)?.name ?? transfer.toBranch;
      const entry = audit({
        branch: transfer.toBranch, actor: by, category: "Transfers", action: "Transfer issued",
        detail: `${id} → ${dest} · ₦${Math.round(valueAtCost).toLocaleString()} at cost`,
        ref: id, amount: Math.round(valueAtCost), severity: "info",
      });
      return {
        ...p,
        inventory,
        transfers: p.transfers.map((t) =>
          t.id === id ? { ...t, status: "Issued", lines, issuedBy: by, issuedAt: Date.now(), valueAtCost: Math.round(valueAtCost) } : t,
        ),
        auditLog: [entry, ...p.auditLog],
      };
    });
  }, []);

  const receiveTransfer = useCallback<StoreValue["receiveTransfer"]>((id, received, by) => {
    setState((p) => {
      const transfer = p.transfers.find((t) => t.id === id);
      if (!transfer) return p;
      const recvMap = new Map(received.map((x) => [x.sku, x.qty]));
      const inventory = p.inventory.map((i) => ({ ...i }));
      let disputed = false;
      const lines = transfer.lines.map((l) => {
        const got = recvMap.get(l.sku) ?? l.qtyIssued ?? l.qtyRequested;
        if (l.qtyIssued != null && got < l.qtyIssued) disputed = true;
        // Add received stock to the destination branch (create the row if absent).
        const row = inventory.find((i) => i.sku === l.sku && i.branch === transfer.toBranch);
        if (row) {
          row.onHand = +(row.onHand + got).toFixed(4);
        } else {
          const tmpl = p.inventory.find((i) => i.sku === l.sku);
          if (tmpl) inventory.push({ ...tmpl, branch: transfer.toBranch, onHand: got });
        }
        return { ...l, qtyReceived: got };
      });
      const dest = p.branches.find((b) => b.id === transfer.toBranch)?.name ?? transfer.toBranch;
      const entry = audit({
        branch: transfer.toBranch, actor: by, category: "Transfers",
        action: disputed ? "Transfer received — disputed" : "Transfer received",
        detail: `${id} at ${dest}${disputed ? " · short delivery flagged" : " · quantities confirmed"}`,
        ref: id, severity: disputed ? "warning" : "info",
      });
      return {
        ...p,
        inventory,
        transfers: p.transfers.map((t) =>
          t.id === id ? { ...t, status: disputed ? "Disputed" : "Received", lines, receivedBy: by, receivedAt: Date.now() } : t,
        ),
        auditLog: [entry, ...p.auditLog],
      };
    });
  }, []);

  // ── Procurement ────────────────────────────────────────────────────────────

  const addVendor = useCallback<StoreValue["addVendor"]>((v) => {
    const created: Vendor = { ...v, id: uid("v") };
    setState((p) => ({ ...p, vendors: [created, ...p.vendors] }));
    return created;
  }, []);

  const createPO = useCallback<StoreValue["createPO"]>((input) => {
    const s = stateRef.current;
    const lines: POLine[] = input.lines.map((l) => {
      const prod = s.inventory.find((i) => i.sku === l.sku);
      return {
        sku: l.sku, name: prod?.name ?? l.sku, unit: prod?.unit ?? "",
        qtyOrdered: l.qtyOrdered, unitCost: l.unitCost, qtyReceived: 0,
      };
    });
    const total = lines.reduce((sum, l) => sum + l.qtyOrdered * l.unitCost, 0);
    const seq = String(s.purchaseOrders.length + 1).padStart(3, "0");
    const created: PurchaseOrder = {
      id: `PO-${new Date().getFullYear()}-${seq}`,
      vendorId: input.vendorId, branch: input.branch, lines,
      status: "Ordered", expectedDate: input.expectedDate, createdAt: Date.now(),
      total, paid: false,
    };
    setState((p) => ({ ...p, purchaseOrders: [created, ...p.purchaseOrders] }));
    return created;
  }, []);

  const receivePO = useCallback<StoreValue["receivePO"]>((id, received, by) => {
    setState((p) => {
      const po = p.purchaseOrders.find((x) => x.id === id);
      if (!po) return p;
      const recvMap = new Map(received.map((r) => [r.sku, r]));
      const inventory = p.inventory.map((i) => ({ ...i }));
      const priceChanges = [...p.priceChanges];
      const batches = [...p.batches];
      const auditEntries: AuditEntry[] = [];
      const vendorName = p.vendors.find((v) => v.id === po.vendorId)?.name ?? "Vendor";

      for (const line of po.lines) {
        const r = recvMap.get(line.sku);
        if (!r || r.qtyReceived <= 0) continue;
        // Add received stock to the delivery branch (create the row if absent).
        const row = inventory.find((i) => i.sku === line.sku && i.branch === po.branch);
        if (row) {
          row.onHand = +(row.onHand + r.qtyReceived).toFixed(4);
        } else {
          const tmpl = p.inventory.find((i) => i.sku === line.sku);
          if (tmpl) inventory.push({ ...tmpl, branch: po.branch, onHand: r.qtyReceived });
        }
        // Price-change variance — log it and roll the cost forward.
        const curCost = p.inventory.find((i) => i.sku === line.sku)?.cost ?? r.unitCost;
        if (r.unitCost > 0 && r.unitCost !== curCost) {
          priceChanges.unshift({ id: uid("PC"), sku: line.sku, name: line.name, oldCost: curCost, newCost: r.unitCost, vendorName, at: Date.now() });
          for (const inv of inventory) if (inv.sku === line.sku) inv.cost = r.unitCost;
          auditEntries.push(audit({
            branch: po.branch, actor: by, category: "Procurement", action: "Cost price changed",
            detail: `${line.name} · ₦${curCost.toLocaleString()} → ₦${r.unitCost.toLocaleString()} · ${vendorName}`,
            ref: line.sku, severity: "warning",
          }));
        }
        // Batch & expiry capture for perishables.
        if (r.expiry) {
          batches.unshift({ id: uid("B"), sku: line.sku, branch: po.branch, name: line.name, qty: r.qtyReceived, unit: line.unit, expiry: r.expiry, receivedAt: Date.now(), poId: po.id });
        }
      }

      const lines = po.lines.map((l) => {
        const r = recvMap.get(l.sku);
        return r ? { ...l, qtyReceived: l.qtyReceived + r.qtyReceived, unitCost: r.unitCost || l.unitCost } : l;
      });
      const allReceived = lines.every((l) => l.qtyReceived >= l.qtyOrdered);
      const status: POStatus = allReceived ? "Received" : "Partially Received";

      auditEntries.push(audit({
        branch: po.branch, actor: by, category: "Procurement", action: "Goods received",
        detail: `${po.id} · ${vendorName} · ${status}`,
        ref: po.id, amount: po.total, severity: "info",
      }));

      return {
        ...p,
        inventory, priceChanges, batches,
        purchaseOrders: p.purchaseOrders.map((x) => (x.id === id ? { ...x, lines, status, receivedAt: Date.now() } : x)),
        auditLog: [...auditEntries, ...p.auditLog],
      };
    });
  }, []);

  const markPOPaid = useCallback<StoreValue["markPOPaid"]>((id) => {
    setState((p) => ({
      ...p,
      purchaseOrders: p.purchaseOrders.map((x) => (x.id === id ? { ...x, paid: true, paidAt: Date.now() } : x)),
    }));
  }, []);

  // ── Expenses & petty cash ──────────────────────────────────────────────────

  const walletOf = useCallback(
    (branch: string) => state.wallets.find((w) => w.branch === branch),
    [state.wallets],
  );

  const requestExpense = useCallback<StoreValue["requestExpense"]>((input) => {
    const s = stateRef.current;
    const created: ExpenseRequest = {
      id: `EXP-${String(s.expenses.length + 1).padStart(3, "0")}`,
      branch: s.currentBranch,
      category: input.category,
      amount: input.amount,
      description: input.description,
      requestedBy: input.by,
      requestedAt: Date.now(),
      status: "Pending",
    };
    setState((p) => ({ ...p, expenses: [created, ...p.expenses] }));
    return created;
  }, []);

  const approveExpense = useCallback<StoreValue["approveExpense"]>((id, by) => {
    setState((p) => {
      const e = p.expenses.find((x) => x.id === id);
      if (!e) return p;
      const entry = audit({
        branch: e.branch, actor: by, category: "Finance", action: "Expense approved",
        detail: `${id} · ${e.category} · ₦${e.amount.toLocaleString()}`,
        ref: id, amount: e.amount, severity: "info",
      });
      return {
        ...p,
        expenses: p.expenses.map((x) => (x.id === id ? { ...x, status: "Approved", approvedBy: by, approvedAt: Date.now() } : x)),
        auditLog: [entry, ...p.auditLog],
      };
    });
  }, []);

  const rejectExpense = useCallback<StoreValue["rejectExpense"]>((id, by) => {
    setState((p) => {
      const e = p.expenses.find((x) => x.id === id);
      if (!e) return p;
      const entry = audit({
        branch: e.branch, actor: by, category: "Finance", action: "Expense rejected",
        detail: `${id} · ${e.category} · ₦${e.amount.toLocaleString()}`,
        ref: id, amount: e.amount, severity: "warning",
      });
      return {
        ...p,
        expenses: p.expenses.map((x) => (x.id === id ? { ...x, status: "Rejected" } : x)),
        auditLog: [entry, ...p.auditLog],
      };
    });
  }, []);

  const disburseExpense = useCallback<StoreValue["disburseExpense"]>((id, by) => {
    setState((p) => {
      const exp = p.expenses.find((e) => e.id === id);
      if (!exp) return p;
      const entry = audit({
        branch: exp.branch, actor: by, category: "Finance", action: "Petty cash disbursed",
        detail: `${id} · ₦${exp.amount.toLocaleString()} to ${exp.requestedBy}`,
        ref: id, amount: exp.amount, severity: "warning",
      });
      return {
        ...p,
        expenses: p.expenses.map((e) => (e.id === id ? { ...e, status: "Disbursed", disbursedAt: Date.now() } : e)),
        wallets: p.wallets.map((w) => (w.branch === exp.branch ? { ...w, balance: w.balance - exp.amount } : w)),
        auditLog: [entry, ...p.auditLog],
      };
    });
  }, []);

  const reconcileExpense = useCallback<StoreValue["reconcileExpense"]>((id, input, by) => {
    setState((p) => {
      const exp = p.expenses.find((e) => e.id === id);
      if (!exp) return p;
      const change = Math.max(0, exp.amount - input.actualSpent);
      const entry = audit({
        branch: exp.branch, actor: by, category: "Finance", action: "Expense reconciled",
        detail: `${id} · spent ₦${input.actualSpent.toLocaleString()} · ₦${change.toLocaleString()} change returned · ${input.receipt}`,
        ref: id, amount: input.actualSpent, severity: "info",
      });
      return {
        ...p,
        expenses: p.expenses.map((e) =>
          e.id === id
            ? { ...e, status: "Reconciled", actualSpent: input.actualSpent, changeReturned: change, receipt: input.receipt, reconciledAt: Date.now() }
            : e,
        ),
        // Unspent change is returned to the branch wallet.
        wallets: change > 0 ? p.wallets.map((w) => (w.branch === exp.branch ? { ...w, balance: w.balance + change } : w)) : p.wallets,
        auditLog: [entry, ...p.auditLog],
      };
    });
  }, []);

  const topUpWallet = useCallback<StoreValue["topUpWallet"]>((branch, amount, by) => {
    setState((p) => {
      const entry = audit({
        branch, actor: by, category: "Finance", action: "Wallet topped up",
        detail: `${p.branches.find((b) => b.id === branch)?.name ?? branch} petty-cash wallet · ₦${amount.toLocaleString()}`,
        amount, severity: "info",
      });
      return {
        ...p,
        wallets: p.wallets.map((w) => (w.branch === branch ? { ...w, balance: w.balance + amount } : w)),
        auditLog: [entry, ...p.auditLog],
      };
    });
  }, []);

  // ── HR & payroll ───────────────────────────────────────────────────────────

  const addEmployee = useCallback<StoreValue["addEmployee"]>((e) => {
    const created: Employee = { ...e, id: uid("e") };
    setState((p) => ({ ...p, employees: [created, ...p.employees] }));
    return created;
  }, []);

  const updateEmployee = useCallback<StoreValue["updateEmployee"]>((e) => {
    setState((p) => ({ ...p, employees: p.employees.map((x) => (x.id === e.id ? e : x)) }));
  }, []);

  const clockIn = useCallback<StoreValue["clockIn"]>((employeeId) => {
    setState((p) => {
      const emp = p.employees.find((e) => e.id === employeeId);
      if (!emp) return p;
      const today = new Date().toISOString().slice(0, 10);
      if (p.attendance.some((a) => a.employeeId === employeeId && a.date === today)) return p;
      const now = new Date();
      const [sh, sm] = emp.scheduledStart.split(":").map(Number);
      const lateMinutes = Math.max(0, now.getHours() * 60 + now.getMinutes() - (sh * 60 + sm));
      const rec: Attendance = { id: uid("at"), employeeId, date: today, clockIn: Date.now(), lateMinutes };
      return { ...p, attendance: [rec, ...p.attendance] };
    });
  }, []);

  const clockOut = useCallback<StoreValue["clockOut"]>((employeeId) => {
    setState((p) => {
      const today = new Date().toISOString().slice(0, 10);
      return {
        ...p,
        attendance: p.attendance.map((a) =>
          a.employeeId === employeeId && a.date === today && a.clockOut == null ? { ...a, clockOut: Date.now() } : a,
        ),
      };
    });
  }, []);

  const logDisciplinary = useCallback<StoreValue["logDisciplinary"]>((input) => {
    const created: Disciplinary = { ...input, id: uid("d"), at: Date.now() };
    const emp = stateRef.current.employees.find((e) => e.id === input.employeeId);
    const entry = audit({
      branch: emp?.branch ?? stateRef.current.currentBranch, actor: input.by, category: "HR",
      action: input.type === "Commendation" ? "Commendation logged" : "Disciplinary logged",
      detail: `${emp?.name ?? "Employee"} · ${input.type} · ${input.action}`,
      ref: input.employeeId, severity: input.type === "Commendation" ? "info" : "warning",
    });
    setState((p) => ({ ...p, disciplinary: [created, ...p.disciplinary], auditLog: [entry, ...p.auditLog] }));
  }, []);

  const runPayroll = useCallback<StoreValue["runPayroll"]>((period, by) => {
    const s = stateRef.current;
    const branch = s.currentBranch;
    const emps = s.employees.filter((e) => e.branch === branch && e.status === "Active");
    const payslips: Payslip[] = emps.map((e) => {
      const base = e.baseSalary;
      const allowances = e.transport + e.housing;
      const gross = base + allowances;
      const lateMarks = s.attendance.filter((a) => a.employeeId === e.id && a.lateMinutes >= 15).length;
      const latenessDeduction = lateMarks * 500;
      // Shortages: negative shift variances under this person's name (Finance ↔ HR).
      let shortageDeduction = 0;
      for (const sh of s.shifts) {
        if (sh.staffName !== e.name || sh.countedCash == null) continue;
        const sales = sh.seedSales ?? s.orders.filter((o) => o.shiftId === sh.id && !o.voided).reduce((sum, o) => sum + o.total, 0);
        const variance = sh.countedCash - (sh.openingFloat + sales);
        if (variance < 0) shortageDeduction += -variance;
      }
      const paye = Math.round(gross * 0.08);
      const pension = Math.round(base * 0.08);
      const nhf = Math.round(base * 0.025);
      const net = gross - paye - pension - nhf - latenessDeduction - shortageDeduction;
      return { employeeId: e.id, name: e.name, role: e.role, base, allowances, gross, paye, pension, nhf, latenessDeduction, shortageDeduction, net };
    });
    const created: PayrollRun = {
      id: uid("PR"), period, ranAt: Date.now(), ranBy: by, branch,
      payslips, totalNet: payslips.reduce((sum, ps) => sum + ps.net, 0),
    };
    const entry = audit({
      branch, actor: by, category: "Payroll", action: "Payroll run",
      detail: `${period} · ${payslips.length} employee${payslips.length !== 1 ? "s" : ""} · net ₦${created.totalNet.toLocaleString()}`,
      ref: created.id, amount: created.totalNet, severity: "warning",
    });
    setState((p) => ({ ...p, payrollRuns: [created, ...p.payrollRuns], auditLog: [entry, ...p.auditLog] }));
    return created;
  }, []);

  // ── Dispatch & fleet ───────────────────────────────────────────────────────

  const addRider = useCallback<StoreValue["addRider"]>((input) => {
    const created: Rider = {
      id: uid("r"), name: input.name, type: input.type,
      branch: stateRef.current.currentBranch, status: "Available", expenses: 0,
    };
    setState((p) => ({ ...p, riders: [created, ...p.riders] }));
    return created;
  }, []);

  const setRiderStatus = useCallback<StoreValue["setRiderStatus"]>((id, status) => {
    setState((p) => ({
      ...p,
      riders: p.riders.map((r) => (r.id === id ? { ...r, status } : r)),
    }));
  }, []);

  const advanceDelivery = useCallback<StoreValue["advanceDelivery"]>((id) => {
    setState((p) => ({
      ...p,
      deliveries: p.deliveries.map((d) =>
        d.id === id && d.status === "Preparing" ? { ...d, status: "Ready for pickup" } : d,
      ),
    }));
  }, []);

  const assignDelivery = useCallback<StoreValue["assignDelivery"]>((id, riderId) => {
    setState((p) => ({
      ...p,
      deliveries: p.deliveries.map((d) =>
        d.id === id ? { ...d, riderId, status: "Out for delivery", assignedAt: Date.now() } : d,
      ),
      riders: p.riders.map((r) => (r.id === riderId ? { ...r, status: "On delivery" } : r)),
    }));
  }, []);

  const completeDelivery = useCallback<StoreValue["completeDelivery"]>((id) => {
    setState((p) => {
      const job = p.deliveries.find((d) => d.id === id);
      if (!job) return p;
      const deliveries = p.deliveries.map((d) =>
        d.id === id ? { ...d, status: "Delivered" as DeliveryStatus, deliveredAt: Date.now() } : d,
      );
      const stillOut = job.riderId
        ? deliveries.some((d) => d.riderId === job.riderId && d.status === "Out for delivery")
        : false;
      return {
        ...p,
        deliveries,
        riders: job.riderId && !stillOut
          ? p.riders.map((r) => (r.id === job.riderId ? { ...r, status: "Available" } : r))
          : p.riders,
      };
    });
  }, []);

  const settleCOD = useCallback<StoreValue["settleCOD"]>((riderId) => {
    setState((p) => ({
      ...p,
      deliveries: p.deliveries.map((d) =>
        d.riderId === riderId && d.cod && d.status === "Delivered" && !d.codSettled
          ? { ...d, codSettled: true }
          : d,
      ),
    }));
  }, []);

  const logFleetExpense = useCallback<StoreValue["logFleetExpense"]>((riderId, amount) => {
    setState((p) => ({
      ...p,
      riders: p.riders.map((r) => (r.id === riderId ? { ...r, expenses: r.expenses + amount } : r)),
    }));
  }, []);

  // ── CRM ────────────────────────────────────────────────────────────────────

  const addCustomer = useCallback<StoreValue["addCustomer"]>((input) => {
    const created: Customer = {
      id: uid("cust"), name: input.name, phone: input.phone, email: input.email,
      tier: input.tier ?? "New", birthday: input.birthday, joinedAt: Date.now(),
    };
    setState((p) => ({ ...p, customers: [created, ...p.customers] }));
    return created;
  }, []);

  const updateCustomer = useCallback<StoreValue["updateCustomer"]>((c) => {
    setState((p) => ({ ...p, customers: p.customers.map((x) => (x.id === c.id ? c : x)) }));
  }, []);

  const recordFeedback = useCallback<StoreValue["recordFeedback"]>((input) => {
    const s = stateRef.current;
    const sentiment = sentimentOf(input.comment);
    const avg = (input.food + input.service + input.ambience) / 3;
    const created: Feedback = {
      id: uid("fb"), branch: s.currentBranch,
      customerName: input.customerName, phone: input.phone, channel: input.channel,
      food: input.food, service: input.service, ambience: input.ambience,
      comment: input.comment, sentiment, at: Date.now(),
    };
    // Red flag — a low rating or negative sentiment auto-raises a complaint ticket.
    const redFlag = avg <= 2 || sentiment === "Negative";
    const complaint: ComplaintTicket | undefined = redFlag
      ? {
          id: `CMP-${String(s.complaints.length + 1).padStart(3, "0")}`,
          branch: s.currentBranch, customerName: input.customerName, phone: input.phone,
          subject: "Low rating — auto-flagged", status: "Open", severity: "High",
          detail: `Feedback: "${input.comment}" — food ${input.food}★ / service ${input.service}★ / ambience ${input.ambience}★`,
          raisedBy: "System · red flag", raisedAt: Date.now(), fromFeedback: true,
        }
      : undefined;
    setState((p) => ({
      ...p,
      feedback: [created, ...p.feedback],
      complaints: complaint ? [complaint, ...p.complaints] : p.complaints,
    }));
  }, []);

  const addComplaint = useCallback<StoreValue["addComplaint"]>((input) => {
    const s = stateRef.current;
    const created: ComplaintTicket = {
      id: `CMP-${String(s.complaints.length + 1).padStart(3, "0")}`,
      branch: s.currentBranch, customerName: input.customerName, phone: input.phone,
      subject: input.subject, detail: input.detail, status: "Open",
      severity: input.severity, raisedBy: input.by, raisedAt: Date.now(),
    };
    setState((p) => ({ ...p, complaints: [created, ...p.complaints] }));
  }, []);

  const setComplaintStatus = useCallback<StoreValue["setComplaintStatus"]>((id, status) => {
    setState((p) => ({
      ...p,
      complaints: p.complaints.map((c) =>
        c.id === id ? { ...c, status, resolvedAt: status === "Resolved" ? Date.now() : c.resolvedAt } : c,
      ),
    }));
  }, []);

  const contactCustomer = useCallback<StoreValue["contactCustomer"]>((id, kind) => {
    setState((p) => ({
      ...p,
      customers: p.customers.map((c) =>
        c.id === id ? { ...c, lastContactedAt: Date.now(), lastContactKind: kind } : c,
      ),
    }));
  }, []);

  // ── Events & banquets ──────────────────────────────────────────────────────

  const addEvent = useCallback<StoreValue["addEvent"]>((input) => {
    const s = stateRef.current;
    const seq = String(s.events.length + 1).padStart(3, "0");
    const created: RestaurantEvent = {
      id: `EVT-${seq}`, branch: s.currentBranch, name: input.name, date: input.date,
      venue: input.venue, guests: input.guests, package: input.package, value: input.value,
      deposit: input.deposit, status: input.deposit > 0 ? "Confirmed" : "Deposit pending",
      costs: input.costs, createdAt: Date.now(),
    };
    setState((p) => ({ ...p, events: [created, ...p.events] }));
    return created;
  }, []);

  const recordEventDeposit = useCallback<StoreValue["recordEventDeposit"]>((id, amount) => {
    setState((p) => ({
      ...p,
      events: p.events.map((e) =>
        e.id === id
          ? {
              ...e,
              deposit: e.deposit + amount,
              // A first deposit confirms a pending booking.
              status: e.status === "Deposit pending" && e.deposit + amount > 0 ? "Confirmed" : e.status,
            }
          : e,
      ),
    }));
  }, []);

  const advanceEventStatus = useCallback<StoreValue["advanceEventStatus"]>((id) => {
    const flow: EventStatus[] = ["Deposit pending", "Confirmed", "Live", "Completed"];
    setState((p) => ({
      ...p,
      events: p.events.map((e) => {
        if (e.id !== id) return e;
        const idx = flow.indexOf(e.status);
        return idx >= 0 && idx < flow.length - 1 ? { ...e, status: flow[idx + 1] } : e;
      }),
    }));
  }, []);

  const logAudit = useCallback<StoreValue["logAudit"]>((e) => {
    setState((p) => ({ ...p, auditLog: [audit(e), ...p.auditLog] }));
  }, []);

  const resetAll = useCallback(() => {
    setState(SEED_STATE);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      hydrated,
      products,
      setBranch, branchName,
      openShift, closeShift, activeShift, barShift, shiftSales,
      recordSale, voidOrder,
      addInventoryItem, receiveStock, recordStockCount, recordWaste, importInventory,
      addMenuItem, updateMenuItem, importMenu, recipeCost,
      seatTable, freeTable, advanceTicket, markTicketReady,
      requestTransfer, approveTransfer, rejectTransfer, issueTransfer, receiveTransfer,
      addVendor, createPO, receivePO, markPOPaid,
      walletOf, requestExpense, approveExpense, rejectExpense, disburseExpense, reconcileExpense, topUpWallet,
      addEmployee, updateEmployee, clockIn, clockOut, logDisciplinary, runPayroll,
      addRider, setRiderStatus, advanceDelivery, assignDelivery, completeDelivery, settleCOD, logFleetExpense,
      addCustomer, updateCustomer, recordFeedback, addComplaint, setComplaintStatus, contactCustomer,
      addEvent, recordEventDeposit, advanceEventStatus,
      logAudit, resetAll,
    }),
    [state, hydrated, products, setBranch, branchName,
     openShift, closeShift, activeShift, barShift, shiftSales, recordSale, voidOrder,
     addInventoryItem, receiveStock, recordStockCount, recordWaste, importInventory,
     addMenuItem, updateMenuItem, importMenu, recipeCost,
     seatTable, freeTable, advanceTicket, markTicketReady,
     requestTransfer, approveTransfer, rejectTransfer, issueTransfer, receiveTransfer,
     addVendor, createPO, receivePO, markPOPaid,
     walletOf, requestExpense, approveExpense, rejectExpense, disburseExpense, reconcileExpense, topUpWallet,
     addEmployee, updateEmployee, clockIn, clockOut, logDisciplinary, runPayroll,
     addRider, setRiderStatus, advanceDelivery, assignDelivery, completeDelivery, settleCOD, logFleetExpense,
     addCustomer, updateCustomer, recordFeedback, addComplaint, setComplaintStatus, contactCustomer,
     addEvent, recordEventDeposit, advanceEventStatus, logAudit, resetAll],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

export function statusOf(item: InventoryItem): "OK" | "Low" | "Out" {
  if (item.onHand <= 0) return "Out";
  if (item.onHand <= item.reorder) return "Low";
  return "OK";
}

const NEG_WORDS = ["cold", "rude", "slow", "bad", "wrong", "dirty", "late", "poor", "terrible", "awful", "disgust", "worst", "burnt", "stale", "unhappy", "rude"];
const POS_WORDS = ["great", "love", "excellent", "delicious", "amazing", "wonderful", "best", "fast", "friendly", "perfect", "fantastic", "lovely", "nice"];

/** Keyword-based sentiment classifier — a stand-in for a real NLP model. */
export function sentimentOf(text: string): Sentiment {
  const t = text.toLowerCase();
  let score = 0;
  for (const w of POS_WORDS) if (t.includes(w)) score++;
  for (const w of NEG_WORDS) if (t.includes(w)) score--;
  return score > 0 ? "Positive" : score < 0 ? "Negative" : "Neutral";
}

/** Whole days from now until an ISO date — negative if already past. */
export function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}
