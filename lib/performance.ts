/**
 * Performance metrics — pure functions that aggregate the store's append-only
 * data into role-aware scorecards. Two surfaces use this:
 *
 *  • `/staff` Performance view — staff scorecards inside one branch (manager / HR / owner).
 *  • `/reports` Manager scorecards — branch-level KPIs compared across branches (owner only).
 *
 * Conventions:
 *  • All money values are in ₦ (whole-naira where possible).
 *  • All metrics accept an inclusive `[start, end]` window in ms (or `null` for open-ended).
 *  • Composite scores are 0–100, weighted by the standard hospitality KPIs
 *    (Toast / Lightspeed / NRA scorecard weighting).
 *  • Nothing here writes to the store — purely derived.
 */

import type {
  Order, Shift, WasteEntry, StockCount, Employee,
  Attendance, ComplaintTicket, Feedback,
} from "./store";

// ── Date-range helpers ──────────────────────────────────────────────────────

export interface PerfRange {
  start: number | null;
  end: number | null;
}

export function withinRange(ts: number, r: PerfRange): boolean {
  if (r.start != null && ts < r.start) return false;
  if (r.end != null && ts > r.end) return false;
  return true;
}

/** Convert an ISO `YYYY-MM-DD` range (from `DateRangePicker`) into a ms range. */
export function toPerfRange(start: string | null, end: string | null): PerfRange {
  return {
    start: start ? new Date(start).getTime() : null,
    end: end ? new Date(end).getTime() + 86400_000 - 1 : null,
  };
}

// ── Staff scorecard ─────────────────────────────────────────────────────────

export interface StaffScore {
  staffId: string;
  staffName: string;
  role: string;
  branch: string;
  // FOH metrics
  sales: number;
  orderCount: number;
  avgTicket: number;
  voidCount: number;
  voidValue: number;
  voidRate: number;          // 0..1
  discountValue: number;
  // Bar-specific (zero for other roles)
  overPourCount: number;
  varianceCost: number;
  // Kitchen-specific (zero for other roles)
  ticketsCompleted: number;
  avgPrepMinutes: number;
  // Storekeeper / cross-role
  wasteCost: number;
  // Attendance (shared)
  daysPresent: number;
  daysLate: number;
  totalLateMinutes: number;
  // Behaviour
  commendations: number;
  incidents: number;
  // Customer signal
  feedbackPositive: number;
  feedbackNegative: number;
  // Composite — 0..100, weighted for the role
  score: number;
}

export interface StaffMetricInputs {
  staff: Employee;
  orders: Order[];
  shifts: Shift[];
  wasteEntries: WasteEntry[];
  stockCounts: StockCount[];
  attendance: Attendance[];
  incidents: { staffId: string; type: string; at: number }[];
  feedback: Feedback[];
  range: PerfRange;
}

/**
 * Compute a single staff member's scorecard. Role determines the weighting in
 * the composite score and which secondary metrics matter.
 */
export function scoreStaff(input: StaffMetricInputs): StaffScore {
  const { staff, orders, shifts, wasteEntries, stockCounts, attendance, incidents, feedback, range } = input;
  const inWindow = (ts: number) => withinRange(ts, range);

  // FOH: orders booked by this staff (works for cashiers and bartenders)
  const myOrders = orders.filter((o) => o.staffName === staff.name && inWindow(o.at));
  const livesOrders = myOrders.filter((o) => !o.voided);
  const voided = myOrders.filter((o) => o.voided);
  const sales = livesOrders.reduce((s, o) => s + o.total, 0);
  const discountValue = livesOrders.reduce((s, o) => s + (o.discount ?? 0), 0);
  const voidValue = voided.reduce((s, o) => s + o.total, 0);
  const orderCount = livesOrders.length;
  const avgTicket = orderCount ? Math.round(sales / orderCount) : 0;
  const voidRate = myOrders.length ? voided.length / myOrders.length : 0;

  // Bar over-pour signal
  const myCounts = stockCounts.filter((c) => c.staffName === staff.name && inWindow(c.at));
  const overPourCount = myCounts.filter((c) => c.overPour).length;
  const varianceCost = myCounts.reduce((s, c) => s + Math.abs(c.varianceCost ?? 0), 0);

  // Waste recorded by this staff
  const myWaste = wasteEntries.filter((w) => w.staffName === staff.name && inWindow(w.at));
  const wasteCost = myWaste.reduce((s, w) => s + w.cost, 0);

  // Kitchen: tickets completed via shift sales (proxy — we don't currently
  // store per-ticket completer; use shift count for kitchen role until that
  // field exists).
  const myShifts = shifts.filter((sh) => sh.staffName === staff.name && inWindow(sh.openedAt));
  const ticketsCompleted = staff.role === "kitchen"
    ? myOrders.length // kitchen tickets ≈ orders processed at their station
    : 0;
  const avgPrepMinutes = 0; // placeholder — wire when ticket lifecycle timestamps are added

  // Attendance — punctuality.
  const myAttendance = attendance.filter((a) => a.employeeId === staff.id && inWindow(a.clockIn));
  const daysPresent = myAttendance.length;
  const daysLate = myAttendance.filter((a) => a.lateMinutes > 0).length;
  const totalLateMinutes = myAttendance.reduce((s, a) => s + a.lateMinutes, 0);

  // Discipline / commendations.
  const myIncidents = incidents.filter((i) => i.staffId === staff.id && inWindow(i.at));
  const commendations = myIncidents.filter((i) => i.type === "Commendation").length;
  const negativeIncidents = myIncidents.filter((i) => i.type !== "Commendation").length;

  // Feedback — match by branch + date as a soft signal (we don't pin servers to feedback yet).
  const myBranchFeedback = feedback.filter((f) => f.branch === staff.branch && inWindow(f.at));
  const feedbackPositive = myBranchFeedback.filter((f) => f.sentiment === "Positive").length;
  const feedbackNegative = myBranchFeedback.filter((f) => f.sentiment === "Negative").length;

  // ── Composite score ───────────────────────────────────────────────────────
  // Role-weighted 0..100. Each component is bounded to its own scale, then
  // weighted. Tuned for the common Nigerian-hospitality scorecard.
  let score = 0;
  const role = staff.role;

  // Sales productivity (cashier / bartender / waiter — anyone who books orders)
  if (myOrders.length > 0) {
    // 50 orders in window → max signal at 100k+ sales/staff.
    const salesSignal = Math.min(1, sales / 500_000);
    const voidPenalty = Math.min(1, voidRate * 5);                       // 20% voids ⇒ full penalty
    const productivity = Math.round((salesSignal * (1 - voidPenalty)) * 100);
    const weight = role === "cashier" || role === "bartender" ? 0.45 : 0.20;
    score += productivity * weight;
  }

  // Cash / stock integrity
  const integrityPenalty = Math.min(1, (overPourCount * 0.1) + (varianceCost / 50_000));
  const integrity = Math.round((1 - integrityPenalty) * 100);
  score += integrity * (role === "bartender" ? 0.30 : role === "storekeeper" ? 0.45 : 0.15);

  // Waste discipline (lower is better)
  const wastePenalty = Math.min(1, wasteCost / 100_000);
  const wasteScore = Math.round((1 - wastePenalty) * 100);
  score += wasteScore * (role === "kitchen" ? 0.40 : 0.10);

  // Punctuality
  const punctuality = daysPresent > 0
    ? Math.round((1 - Math.min(1, daysLate / daysPresent)) * 100)
    : 100; // no data ⇒ neutral
  score += punctuality * 0.10;

  // Behaviour — commendations boost, incidents (non-commendation) penalise.
  const behaviour = Math.max(0, Math.min(100, 80 + commendations * 10 - negativeIncidents * 15));
  score += behaviour * 0.10;

  // Customer feedback (soft signal — branch-wide)
  if (feedbackPositive + feedbackNegative > 0) {
    const customer = Math.round((feedbackPositive / (feedbackPositive + feedbackNegative)) * 100);
    score += customer * 0.05;
  } else {
    score += 70 * 0.05; // neutral
  }

  return {
    staffId: staff.id,
    staffName: staff.name,
    role: staff.role,
    branch: staff.branch,
    sales, orderCount, avgTicket, voidCount: voided.length, voidValue, voidRate, discountValue,
    overPourCount, varianceCost,
    ticketsCompleted, avgPrepMinutes,
    wasteCost,
    daysPresent, daysLate, totalLateMinutes,
    commendations, incidents: negativeIncidents,
    feedbackPositive, feedbackNegative,
    score: Math.round(Math.max(0, Math.min(100, score))),
  };
}

// ── Branch / manager scorecard ──────────────────────────────────────────────

export interface BranchScore {
  branchId: string;
  branchName: string;
  managerName?: string;
  managerId?: string;
  revenue: number;
  orderCount: number;
  avgTicket: number;
  voidValue: number;
  voidRate: number;
  discountValue: number;
  /** ₦ value of all waste logged in window. */
  wasteCost: number;
  /** ₦ value of stock count variance (abs). */
  varianceCost: number;
  /** ₦ value of over-pour-flagged shortages — most leakage-sensitive metric. */
  overPourValue: number;
  /** Customer complaints raised this window. */
  complaintCount: number;
  /** Average hours to mark a complaint resolved (0 if none resolved in window). */
  avgResolutionHours: number;
  /** Mean of food + service + ambience ratings (1..5) across all feedback. */
  customerMood: number;
  /** Count of feedback entries in window (for confidence on mood). */
  feedbackVolume: number;
  /** Composite 0..100. Higher is better. */
  score: number;
}

export interface BranchMetricInputs {
  branchId: string;
  branchName: string;
  managerName?: string;
  managerId?: string;
  orders: Order[];
  wasteEntries: WasteEntry[];
  stockCounts: StockCount[];
  complaints: ComplaintTicket[];
  feedback: Feedback[];
  range: PerfRange;
}

export function scoreBranch(input: BranchMetricInputs): BranchScore {
  const { range } = input;
  const inWindow = (ts: number) => withinRange(ts, range);

  const branchOrders = input.orders.filter((o) => o.branch === input.branchId && inWindow(o.at));
  const live = branchOrders.filter((o) => !o.voided);
  const voided = branchOrders.filter((o) => o.voided);

  const revenue = live.reduce((s, o) => s + o.total, 0);
  const orderCount = live.length;
  const avgTicket = orderCount ? Math.round(revenue / orderCount) : 0;
  const voidValue = voided.reduce((s, o) => s + o.total, 0);
  const voidRate = branchOrders.length ? voided.length / branchOrders.length : 0;
  const discountValue = live.reduce((s, o) => s + (o.discount ?? 0), 0);

  const branchWaste = input.wasteEntries.filter((w) => w.branch === input.branchId && inWindow(w.at));
  const wasteCost = branchWaste.reduce((s, w) => s + w.cost, 0);

  const branchCounts = input.stockCounts.filter((c) => c.branch === input.branchId && inWindow(c.at));
  const varianceCost = branchCounts.reduce((s, c) => s + Math.abs(c.varianceCost ?? 0), 0);
  const overPourValue = branchCounts.filter((c) => c.overPour).reduce((s, c) => s + Math.abs(c.varianceCost ?? 0), 0);

  const branchComplaints = input.complaints.filter((c) => c.branch === input.branchId && inWindow(c.raisedAt));
  const complaintCount = branchComplaints.length;
  const resolved = branchComplaints.filter((c) => c.resolvedAt != null);
  const avgResolutionHours = resolved.length
    ? resolved.reduce((s, c) => s + ((c.resolvedAt! - c.raisedAt) / 3600_000), 0) / resolved.length
    : 0;

  const branchFeedback = input.feedback.filter((f) => f.branch === input.branchId && inWindow(f.at));
  const customerMood = branchFeedback.length
    ? branchFeedback.reduce((s, f) => s + (f.food + f.service + f.ambience) / 3, 0) / branchFeedback.length
    : 0;
  const feedbackVolume = branchFeedback.length;

  // ── Composite score for the manager of this branch ─────────────────────
  // Weighted: revenue (30) + integrity (25) + waste/COGS (15) + customer (20) + complaints (10).
  let score = 0;
  // Revenue — relative to a ₦5M-window target (signal saturates above).
  score += Math.min(1, revenue / 5_000_000) * 30;
  // Integrity — variance + over-pour as ₦ leakage; 0 = perfect, ₦100k = 0 score.
  score += (1 - Math.min(1, (varianceCost + overPourValue) / 100_000)) * 25;
  // Waste — ₦100k = 0; ₦0 = full.
  score += (1 - Math.min(1, wasteCost / 100_000)) * 15;
  // Customer mood — 5★ = 20, 1★ = 0; if no feedback in window, neutral 14/20.
  if (feedbackVolume > 0) {
    score += ((customerMood - 1) / 4) * 20;
  } else {
    score += 14;
  }
  // Complaints — 0 = full 10; >5 = 0.
  score += (1 - Math.min(1, complaintCount / 5)) * 10;

  return {
    branchId: input.branchId,
    branchName: input.branchName,
    managerName: input.managerName,
    managerId: input.managerId,
    revenue, orderCount, avgTicket, voidValue, voidRate, discountValue,
    wasteCost, varianceCost, overPourValue,
    complaintCount, avgResolutionHours, customerMood, feedbackVolume,
    score: Math.round(Math.max(0, Math.min(100, score))),
  };
}

// ── Score → label / colour helpers ──────────────────────────────────────────

export function scoreBand(score: number): { label: string; tone: string } {
  if (score >= 85) return { label: "Excellent", tone: "text-primary bg-primary/10" };
  if (score >= 70) return { label: "Strong",    tone: "text-primary bg-surface" };
  if (score >= 55) return { label: "OK",        tone: "text-foreground bg-warning/15" };
  if (score >= 40) return { label: "Concerning", tone: "text-warning bg-warning/20" };
  return                  { label: "At risk",    tone: "text-destructive bg-destructive/10" };
}
