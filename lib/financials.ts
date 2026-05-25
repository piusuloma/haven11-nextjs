/**
 * Restaurant financial reports — pure functions that compose the existing
 * append-only data into the three reports every restaurant owner (and
 * accountant) reads weekly:
 *
 *  • **Profit & Loss** — period summary with revenue *split by stream*
 *    (food / drink / delivery), COGS split by stream, full operating-cost
 *    breakdown (labour / fleet / petty cash / welfare), and **prime-cost +
 *    margin ratios** with industry-standard health bands.
 *  • **Balance Sheet** — snapshot of assets / liabilities / equity (standard
 *    accounting equation), grouped into Current vs Fixed.
 *  • **Cash Flow snapshot** — money in vs money out for the period.
 *  • **Period-over-period comparison** — same metrics for the prior matched
 *    window, used to render Δ% arrows.
 *
 * Plain-English labels are paired with each technical term ("Money customers
 * paid us" leads, "(Revenue)" parenthesises). Designed for a 10-year-old to
 * scan and an accountant to audit.
 */

import type {
  Order, MenuItem, ExpenseRequest, PayrollRun, WelfareRequest,
  FleetTxn, InventoryItem, Customer, PurchaseOrder, Wallet, Rider,
} from "./store";

export interface FinancialRange { start: number | null; end: number | null }

export function inFinRange(ts: number, r: FinancialRange): boolean {
  if (r.start != null && ts < r.start) return false;
  if (r.end != null && ts > r.end) return false;
  return true;
}

export function toFinRange(start: string | null, end: string | null): FinancialRange {
  return {
    start: start ? new Date(start).getTime() : null,
    end: end ? new Date(end).getTime() + 86400_000 - 1 : null,
  };
}

/** Compute the equivalent window immediately before the given one — for Δ% comparisons. */
export function priorRange(r: FinancialRange): FinancialRange {
  if (r.start == null || r.end == null) return { start: null, end: null };
  const length = r.end - r.start;
  return { start: r.start - length - 1, end: r.start - 1 };
}

// ── Category routing — food vs drink vs other ───────────────────────────────

/** Menu categories that count as *drink* revenue (and bar COGS). Anything else
 *  with a recipe counts as food. */
const DRINK_CATEGORIES = new Set(["Drinks", "Cocktails"]);

function isDrinkCategory(cat: string | undefined): boolean {
  return cat ? DRINK_CATEGORIES.has(cat) : false;
}

// ── Industry-standard health bands ──────────────────────────────────────────

/** Each KPI's `band` tells the UI what colour to draw. Targets are the public
 *  NRA / Toast / Restaurant 365 benchmarks for table-service restaurants. */
export interface KpiBand { tone: "good" | "ok" | "watch" | "bad"; label: string }

export function bandFoodCostPct(pct: number): KpiBand {
  // Target 28-35%. Below 28% = great, above 35% = warning, above 40% = bad.
  if (pct === 0) return { tone: "ok", label: "No food sold yet" };
  if (pct <= 28) return { tone: "good", label: "Excellent" };
  if (pct <= 35) return { tone: "good", label: "On target" };
  if (pct <= 40) return { tone: "watch", label: "Watch this" };
  return { tone: "bad", label: "Too high" };
}

export function bandBevCostPct(pct: number): KpiBand {
  // Bar targets are tighter: 18-24%.
  if (pct === 0) return { tone: "ok", label: "No drinks sold yet" };
  if (pct <= 18) return { tone: "good", label: "Excellent" };
  if (pct <= 24) return { tone: "good", label: "On target" };
  if (pct <= 30) return { tone: "watch", label: "Watch this" };
  return { tone: "bad", label: "Too high" };
}

export function bandLabourCostPct(pct: number): KpiBand {
  // Target 25-35%.
  if (pct <= 25) return { tone: "good", label: "Excellent" };
  if (pct <= 35) return { tone: "good", label: "On target" };
  if (pct <= 40) return { tone: "watch", label: "Watch this" };
  return { tone: "bad", label: "Too high" };
}

export function bandPrimeCostPct(pct: number): KpiBand {
  // Food COGS + Drink COGS + Labour / Revenue. Industry target ≤ 60%.
  if (pct <= 55) return { tone: "good", label: "Excellent" };
  if (pct <= 60) return { tone: "good", label: "On target" };
  if (pct <= 65) return { tone: "watch", label: "Watch this" };
  return { tone: "bad", label: "Too high" };
}

export function bandNetMarginPct(pct: number): KpiBand {
  // Healthy restaurant net margin: 10-15%+.
  if (pct < 0) return { tone: "bad", label: "Losing money" };
  if (pct < 5) return { tone: "watch", label: "Thin margin" };
  if (pct < 10) return { tone: "ok", label: "OK margin" };
  if (pct < 15) return { tone: "good", label: "Healthy" };
  return { tone: "good", label: "Excellent" };
}

// ── Profit & Loss ────────────────────────────────────────────────────────────

export interface PnLBreakdown {
  // Revenue streams
  foodRevenue: number;
  drinkRevenue: number;
  deliveryRevenue: number;
  totalRevenue: number;
  // COGS streams
  foodCogs: number;
  drinkCogs: number;
  totalCogs: number;
  // Margin
  grossProfit: number;
  grossMarginPct: number;
  // Labour line items (everything that goes to staff)
  payrollNet: number;
  welfareGifts: number;
  totalLabour: number;
  // Other operating
  pettyCash: number;
  fleetCosts: number;
  totalOperating: number;
  // Bottom line
  netProfit: number;
  netMarginPct: number;
  // Counts (used by the UI for "X orders processed" hints)
  orderCount: number;
  // Health-band ratios (computed for the dashboard)
  foodCostPct: number;
  drinkCostPct: number;
  labourCostPct: number;
  primeCostPct: number;
}

export interface PnLReport extends PnLBreakdown {
  branchId: string | "all";
  range: FinancialRange;
  /** Prior-period numbers for Δ% — pre-computed so the UI can render arrows. */
  prior: PnLBreakdown | null;
}

export function computePnL(input: {
  branchId: string | "all";
  range: FinancialRange;
  orders: Order[];
  menu: MenuItem[];
  recipeCost: (recipe: MenuItem["recipe"]) => number;
  expenses: ExpenseRequest[];
  payrollRuns: PayrollRun[];
  welfare: WelfareRequest[];
  fleet: FleetTxn[];
}): PnLReport {
  const breakdown = computePnLBreakdown({ ...input, range: input.range });
  const prior = (input.range.start != null && input.range.end != null)
    ? computePnLBreakdown({ ...input, range: priorRange(input.range) })
    : null;
  return { branchId: input.branchId, range: input.range, ...breakdown, prior };
}

function computePnLBreakdown(input: {
  branchId: string | "all";
  range: FinancialRange;
  orders: Order[];
  menu: MenuItem[];
  recipeCost: (recipe: MenuItem["recipe"]) => number;
  expenses: ExpenseRequest[];
  payrollRuns: PayrollRun[];
  welfare: WelfareRequest[];
  fleet: FleetTxn[];
}): PnLBreakdown {
  const inWin = (ts: number) => inFinRange(ts, input.range);
  const matchBranch = <T extends { branch: string }>(arr: T[]) =>
    input.branchId === "all" ? arr : arr.filter((x) => x.branch === input.branchId);

  // ── Revenue + COGS, split by stream ──
  const orders = matchBranch(input.orders).filter((o) => !o.voided && inWin(o.at));
  let foodRevenue = 0, drinkRevenue = 0, foodCogs = 0, drinkCogs = 0;
  let lineRevenueSum = 0;
  for (const o of orders) {
    for (const line of o.lines) {
      const item = input.menu.find((m) => m.name === line.name);
      const lineRevenue = line.qty * (item?.price ?? 0);
      const lineCogs = item ? input.recipeCost(item.recipe) * line.qty : 0;
      lineRevenueSum += lineRevenue;
      if (isDrinkCategory(item?.category)) {
        drinkRevenue += lineRevenue; drinkCogs += lineCogs;
      } else {
        foodRevenue += lineRevenue; foodCogs += lineCogs;
      }
    }
  }
  // Total revenue uses the Order.total (which includes delivery fees, VAT
  // adjustments, etc.). The food/drink split is what we can map from menu
  // lines; the rest (delivery fees, manual line items) lands under "Other".
  const grossOrderTotal = orders.reduce((s, o) => s + o.total, 0);
  const totalRevenue = grossOrderTotal;
  // What couldn't be attributed to food/drink — delivery fees, untracked items.
  const deliveryRevenue = Math.max(0, totalRevenue - lineRevenueSum);
  const totalCogs = foodCogs + drinkCogs;
  const grossProfit = totalRevenue - totalCogs;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // ── Labour ──
  const payrollRuns = matchBranch(input.payrollRuns).filter((r) => inWin(r.ranAt));
  const payrollNet = payrollRuns.reduce((s, r) => s + r.totalNet, 0);
  const welfareGifts = matchBranch(input.welfare)
    .filter((w) => (w.disbursedAt ?? 0) > 0 && inWin(w.disbursedAt ?? 0) && !w.repayable)
    .reduce((s, w) => s + w.amount, 0);
  const totalLabour = payrollNet + welfareGifts;

  // ── Other operating ──
  const pettyCash = matchBranch(input.expenses)
    .filter((e) => (e.status === "Disbursed" || e.status === "Reconciled") && inWin(e.requestedAt))
    .reduce((s, e) => s + (e.actualSpent ?? e.amount), 0);
  const fleetCosts = matchBranch(input.fleet)
    .filter((t) => inWin(t.at) && (t.kind === "fuel" || t.kind === "maintenance" || t.kind === "fine" || t.kind === "expense" || t.kind === "purchase"))
    .reduce((s, t) => s + t.amount, 0);
  const totalOperating = totalLabour + pettyCash + fleetCosts;

  // ── Net + ratios ──
  const netProfit = grossProfit - totalOperating;
  const netMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const foodCostPct = foodRevenue > 0 ? (foodCogs / foodRevenue) * 100 : 0;
  const drinkCostPct = drinkRevenue > 0 ? (drinkCogs / drinkRevenue) * 100 : 0;
  const labourCostPct = totalRevenue > 0 ? (totalLabour / totalRevenue) * 100 : 0;
  const primeCostPct = totalRevenue > 0 ? ((totalCogs + totalLabour) / totalRevenue) * 100 : 0;

  return {
    foodRevenue, drinkRevenue, deliveryRevenue, totalRevenue,
    foodCogs, drinkCogs, totalCogs,
    grossProfit, grossMarginPct,
    payrollNet, welfareGifts, totalLabour,
    pettyCash, fleetCosts, totalOperating,
    netProfit, netMarginPct,
    orderCount: orders.length,
    foodCostPct, drinkCostPct, labourCostPct, primeCostPct,
  };
}

/** Convenience: percentage change between two numbers, handling the zero case. */
export function deltaPct(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? 0 : null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

// ── Balance Sheet ────────────────────────────────────────────────────────────

export interface BalanceSheetLine {
  plain: string;
  technical: string;
  amount: number;
  hint?: string;
}

export interface BalanceSheet {
  branchId: string | "all";
  at: number;
  // ── ASSETS — what we have / what's owed to us ──
  // Current
  cashOnHand: number;          // sum of branch wallet balances
  inventoryValue: number;      // sum of onHand × cost across all locations
  accountsReceivable: number;  // sum of customer credit
  welfareAdvancesOutstanding: number; // money out the door not yet recovered
  totalCurrentAssets: number;
  // Fixed
  fixedAssets: number;         // bike acquisition cost (no depreciation modelled)
  totalFixedAssets: number;
  totalAssets: number;
  // ── LIABILITIES — what we owe others ──
  accountsPayable: number;     // received POs not yet paid
  customerWallets: number;     // prepaid balances we owe in food
  totalLiabilities: number;
  // ── EQUITY (computed) ──
  equity: number;
  // Itemised lines
  currentAssets: BalanceSheetLine[];
  fixedAssetsLines: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
}

export function computeBalanceSheet(input: {
  branchId: string | "all";
  at: number;
  inventory: InventoryItem[];
  customers: Customer[];
  purchaseOrders: PurchaseOrder[];
  wallets: Wallet[];
  riders: Rider[];
  welfare: WelfareRequest[];
}): BalanceSheet {
  const matchBranch = <T extends { branch: string }>(arr: T[]) =>
    input.branchId === "all" ? arr : arr.filter((x) => x.branch === input.branchId);

  // ── Current assets ──
  const wallets = matchBranch(input.wallets);
  const cashOnHand = wallets.reduce((s, w) => s + w.balance, 0);

  const inventoryRows = matchBranch(input.inventory);
  const inventoryValue = inventoryRows.reduce((s, i) => s + i.onHand * i.cost, 0);

  // Customers are golden-record group-wide — count all.
  const accountsReceivable = input.customers.reduce((s, c) => s + c.credit, 0);

  // Welfare advances disbursed but not yet recovered through payroll.
  const welfareAdvancesOutstanding = matchBranch(input.welfare)
    .filter((w) => w.repayable && (w.status === "Repaying" || w.status === "Disbursed"))
    .reduce((s, w) => s + (w.amount - w.amountRepaid), 0);

  const totalCurrentAssets = cashOnHand + inventoryValue + accountsReceivable + welfareAdvancesOutstanding;

  // ── Fixed assets ──
  const riders = matchBranch(input.riders);
  const fixedAssets = riders.reduce((s, r) => s + (r.bikeAcquisitionCost ?? 0), 0);
  const totalFixedAssets = fixedAssets;

  const totalAssets = totalCurrentAssets + totalFixedAssets;

  // ── Liabilities ──
  const pos = matchBranch(input.purchaseOrders);
  const accountsPayable = pos
    .filter((p) => !p.paid && (p.status === "Partially Received" || p.status === "Received"))
    .reduce((s, p) => s + p.total, 0);

  const customerWallets = input.customers.reduce((s, c) => s + c.wallet, 0);
  const totalLiabilities = accountsPayable + customerWallets;

  const equity = totalAssets - totalLiabilities;

  const currentAssets: BalanceSheetLine[] = [
    { plain: "Cash in petty-cash wallets", technical: "Cash on hand", amount: cashOnHand, hint: `${wallets.length} branch float${wallets.length === 1 ? "" : "s"}` },
    { plain: "Food & drink in stock", technical: "Inventory", amount: inventoryValue, hint: `${inventoryRows.length} stock rows` },
    { plain: "Money customers owe us", technical: "Accounts receivable", amount: accountsReceivable, hint: "House-account balances" },
    { plain: "Staff advances given out", technical: "Receivable from staff", amount: welfareAdvancesOutstanding, hint: "Recovered monthly via payroll" },
  ];
  const fixedAssetsLines: BalanceSheetLine[] = [
    { plain: "Delivery bikes", technical: "Fixed assets · vehicles", amount: fixedAssets, hint: `${riders.filter((r) => r.bikeAcquisitionCost).length} bike${riders.filter((r) => r.bikeAcquisitionCost).length === 1 ? "" : "s"} · at cost (no depreciation yet)` },
  ];
  const liabilities: BalanceSheetLine[] = [
    { plain: "Money we owe suppliers", technical: "Accounts payable", amount: accountsPayable, hint: "Received POs not yet paid" },
    { plain: "Money customers prepaid us", technical: "Customer wallets", amount: customerWallets, hint: "We owe them food / drink" },
  ];

  return {
    branchId: input.branchId, at: input.at,
    cashOnHand, inventoryValue, accountsReceivable, welfareAdvancesOutstanding, totalCurrentAssets,
    fixedAssets, totalFixedAssets, totalAssets,
    accountsPayable, customerWallets, totalLiabilities,
    equity,
    currentAssets, fixedAssetsLines, liabilities,
  };
}

// ── Cash Flow snapshot ──────────────────────────────────────────────────────

export interface CashFlowReport {
  branchId: string | "all";
  range: FinancialRange;
  // Inflows
  customerSales: number;
  // Outflows
  payrollOut: number;
  pettyCashOut: number;
  welfareOut: number;
  fleetOut: number;
  inventoryReceived: number;  // POs paid in window
  totalIn: number;
  totalOut: number;
  netCashChange: number;
}

export function computeCashFlow(input: {
  branchId: string | "all";
  range: FinancialRange;
  orders: Order[];
  payrollRuns: PayrollRun[];
  expenses: ExpenseRequest[];
  welfare: WelfareRequest[];
  fleet: FleetTxn[];
  purchaseOrders: PurchaseOrder[];
}): CashFlowReport {
  const inWin = (ts: number) => inFinRange(ts, input.range);
  const matchBranch = <T extends { branch: string }>(arr: T[]) =>
    input.branchId === "all" ? arr : arr.filter((x) => x.branch === input.branchId);

  // Inflow: completed customer sales in the window.
  const customerSales = matchBranch(input.orders)
    .filter((o) => !o.voided && inWin(o.at))
    .reduce((s, o) => s + o.total, 0);

  // Outflows
  const payrollOut = matchBranch(input.payrollRuns).filter((r) => inWin(r.ranAt)).reduce((s, r) => s + r.totalNet, 0);
  const pettyCashOut = matchBranch(input.expenses)
    .filter((e) => (e.status === "Disbursed" || e.status === "Reconciled") && inWin(e.requestedAt))
    .reduce((s, e) => s + (e.actualSpent ?? e.amount), 0);
  const welfareOut = matchBranch(input.welfare)
    .filter((w) => (w.disbursedAt ?? 0) > 0 && inWin(w.disbursedAt ?? 0))
    .reduce((s, w) => s + w.amount, 0);
  const fleetOut = matchBranch(input.fleet)
    .filter((t) => inWin(t.at) && (t.kind === "fuel" || t.kind === "maintenance" || t.kind === "fine" || t.kind === "expense" || t.kind === "purchase"))
    .reduce((s, t) => s + t.amount, 0);
  // POs marked paid in the window.
  const inventoryReceived = matchBranch(input.purchaseOrders)
    .filter((p) => p.paid && p.receivedAt && inWin(p.receivedAt))
    .reduce((s, p) => s + p.total, 0);

  const totalIn = customerSales;
  const totalOut = payrollOut + pettyCashOut + welfareOut + fleetOut + inventoryReceived;

  return {
    branchId: input.branchId, range: input.range,
    customerSales, payrollOut, pettyCashOut, welfareOut, fleetOut, inventoryReceived,
    totalIn, totalOut, netCashChange: totalIn - totalOut,
  };
}
