"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DateRangePicker, type DateRange } from "@/components/DateRangePicker";
import { useAuth } from "@/lib/auth";
import { useStore, HUB_ID } from "@/lib/store";
import {
  computePnL, computeBalanceSheet, computeCashFlow, toFinRange, deltaPct,
  bandFoodCostPct, bandBevCostPct, bandLabourCostPct, bandPrimeCostPct, bandNetMarginPct,
  type KpiBand,
} from "@/lib/financials";
import {
  TrendingUp, TrendingDown, Building2, Scale, FileBarChart, ArrowUpRight, ArrowDownRight,
  Wallet, Boxes, Coins, Truck, HeartHandshake, Banknote, Smile,
  Beer, ChefHat, Bike, Sparkles, ShoppingBag, PiggyBank, Receipt, BadgeDollarSign,
} from "lucide-react";

/**
 * Financials — built so an owner who never hired an accountant can run their
 * restaurant from this page. Three reports, plain English first, accounting
 * terms in parentheses:
 *
 *  • **Profit & Loss** with revenue split by stream (food / drink / delivery),
 *    COGS by stream, full operating breakdown.
 *  • **Balance Sheet** with current vs fixed assets, liabilities, equity.
 *  • **Cash flow** in vs out.
 *
 * Plus a **health dashboard** at the top: the four restaurant ratios every
 * operator must know (Food cost · Drink cost · Labour cost · Prime cost) with
 * NRA / Toast industry-standard targets and red/amber/green bars.
 */
export default function Financials() {
  const store = useStore();
  const { user } = useAuth();
  const canSee = user?.role === "owner" || user?.role === "manager" || user?.role === "accountant";

  // Period — default to this month.
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [range, setRange] = useState<DateRange>({ start: firstOfMonth, end: today.toISOString().slice(0, 10) });
  const [tab, setTab] = useState<"pnl" | "balance" | "cash">("pnl");

  const branchScope = store.currentBranch;
  const isHub = branchScope === HUB_ID;

  const pnl = useMemo(
    () => computePnL({
      branchId: isHub ? "all" : branchScope,
      range: toFinRange(range.start, range.end),
      orders: store.orders, menu: store.menu, recipeCost: store.recipeCost,
      expenses: store.expenses, payrollRuns: store.payrollRuns,
      welfare: store.welfare, fleet: store.fleetLedger,
    }),
    [isHub, branchScope, range, store.orders, store.menu, store.recipeCost,
     store.expenses, store.payrollRuns, store.welfare, store.fleetLedger],
  );

  const balance = useMemo(
    () => computeBalanceSheet({
      branchId: isHub ? "all" : branchScope, at: Date.now(),
      inventory: store.inventory, customers: store.customers,
      purchaseOrders: store.purchaseOrders, wallets: store.wallets,
      riders: store.riders, welfare: store.welfare,
    }),
    [isHub, branchScope, store.inventory, store.customers,
     store.purchaseOrders, store.wallets, store.riders, store.welfare],
  );

  const cashflow = useMemo(
    () => computeCashFlow({
      branchId: isHub ? "all" : branchScope,
      range: toFinRange(range.start, range.end),
      orders: store.orders, payrollRuns: store.payrollRuns, expenses: store.expenses,
      welfare: store.welfare, fleet: store.fleetLedger, purchaseOrders: store.purchaseOrders,
    }),
    [isHub, branchScope, range, store.orders, store.payrollRuns,
     store.expenses, store.welfare, store.fleetLedger, store.purchaseOrders],
  );

  if (!canSee) {
    return (
      <AppShell title="Financials" subtitle="Restricted">
        <p className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Financials are restricted to the owner, branch managers, and the accountant.
        </p>
      </AppShell>
    );
  }

  const scopeLabel = isHub ? "All branches (group view)" : store.branchName(branchScope);
  const revenueDelta = pnl.prior ? deltaPct(pnl.totalRevenue, pnl.prior.totalRevenue) : null;
  const opCostDelta = pnl.prior ? deltaPct(pnl.totalCogs + pnl.totalOperating, pnl.prior.totalCogs + pnl.prior.totalOperating) : null;
  const profitDelta = pnl.prior ? deltaPct(pnl.netProfit, pnl.prior.netProfit) : null;

  return (
    <AppShell title="Financials" subtitle={`${scopeLabel} · the books in plain English`}>
      {/* ── 1 · The three numbers that matter most ────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <BigCard
          icon={Banknote}
          plain="You made"
          technical="Total revenue"
          amount={pnl.totalRevenue}
          delta={revenueDelta}
          hint={`${pnl.orderCount} order${pnl.orderCount === 1 ? "" : "s"} in this period`}
          tone="primary"
        />
        <BigCard
          icon={Receipt}
          plain="You spent"
          technical="COGS + operating costs"
          amount={pnl.totalCogs + pnl.totalOperating}
          delta={opCostDelta}
          deltaInverted
          hint="Food + drink + staff + everything else"
          tone="warning"
        />
        <BigCard
          icon={PiggyBank}
          plain={pnl.netProfit >= 0 ? "You kept" : "You lost"}
          technical="Net profit"
          amount={Math.abs(pnl.netProfit)}
          delta={profitDelta}
          hint={`${pnl.netMarginPct.toFixed(1)}% margin · ${bandNetMarginPct(pnl.netMarginPct).label}`}
          tone={pnl.netProfit >= 0 ? "primary" : "destructive"}
        />
      </section>

      {/* ── 2 · Health bars — the four ratios every operator must know ────── */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Smile className="h-4 w-4 text-muted-foreground" />How healthy is your business?
            </h2>
            <p className="text-xs text-muted-foreground">Four numbers every restaurant owner watches. Greens = good, ambers = watch, reds = fix.</p>
          </div>
          <DateRangePicker value={range} onChange={setRange} />
        </header>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <HealthBar
            icon={ChefHat}
            plain="Food cost"
            technical="Food cost %"
            pct={pnl.foodCostPct}
            band={bandFoodCostPct(pnl.foodCostPct)}
            target="Target 28-35%"
            hint={`₦${pnl.foodCogs.toLocaleString()} food cost on ₦${pnl.foodRevenue.toLocaleString()} food sales`}
          />
          <HealthBar
            icon={Beer}
            plain="Drink cost"
            technical="Beverage cost %"
            pct={pnl.drinkCostPct}
            band={bandBevCostPct(pnl.drinkCostPct)}
            target="Target 18-24%"
            hint={`₦${pnl.drinkCogs.toLocaleString()} drink cost on ₦${pnl.drinkRevenue.toLocaleString()} drink sales`}
          />
          <HealthBar
            icon={HeartHandshake}
            plain="Staff cost"
            technical="Labour cost %"
            pct={pnl.labourCostPct}
            band={bandLabourCostPct(pnl.labourCostPct)}
            target="Target 25-35%"
            hint={`₦${pnl.totalLabour.toLocaleString()} on salaries + welfare`}
          />
          <HealthBar
            icon={Sparkles}
            plain="Prime cost"
            technical="Prime cost % (Food + Drink + Labour)"
            pct={pnl.primeCostPct}
            band={bandPrimeCostPct(pnl.primeCostPct)}
            target="Target ≤ 60%"
            hint="Two biggest costs combined — the headline number for restaurants"
          />
        </div>
      </section>

      {/* ── 3 · Tabs — P&L · Balance · Cash flow ──────────────────────────── */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: "pnl",     label: "Profit & Loss",     Icon: FileBarChart },
          { id: "balance", label: "Balance Sheet",     Icon: Scale },
          { id: "cash",    label: "Cash flow",         Icon: BadgeDollarSign },
        ].map((t) => {
          const Icon = t.Icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-3.5 w-3.5" />{t.label}
              {active && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />}
            </button>
          );
        })}
      </div>

      {tab === "pnl" && <PnLTab pnl={pnl} />}
      {tab === "balance" && <BalanceTab balance={balance} />}
      {tab === "cash" && <CashTab cashflow={cashflow} />}

      <p className="text-[11px] text-muted-foreground">
        Switch branches via the header to see one branch's books. <span className="font-medium">Strong Room</span> shows the group consolidated.
        Bike depreciation isn't modelled yet — bikes are at acquisition cost. Tax / VAT computation is a roadmap item (§26.6).
      </p>
    </AppShell>
  );
}

// ── Top "Made / Spent / Kept" big cards ─────────────────────────────────────

function BigCard({
  icon: Icon, plain, technical, amount, delta, deltaInverted, hint, tone,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  plain: string;
  technical: string;
  amount: number;
  delta: number | null;
  /** When true (e.g. for "you spent"), a positive delta is BAD (red), negative is GOOD. */
  deltaInverted?: boolean;
  hint?: string;
  tone: "primary" | "warning" | "destructive";
}) {
  const toneCls =
    tone === "primary" ? "border-primary/30 bg-primary/5"
    : tone === "warning" ? "border-warning/30 bg-warning/10"
    : "border-destructive/30 bg-destructive/5";
  const iconColor = tone === "primary" ? "text-primary" : tone === "warning" ? "text-warning" : "text-destructive";

  const deltaIsGood = delta == null ? false : deltaInverted ? delta < 0 : delta > 0;
  const deltaIsBad = delta == null ? false : deltaInverted ? delta > 0 : delta < 0;
  const deltaTone = deltaIsGood ? "text-primary" : deltaIsBad ? "text-destructive" : "text-muted-foreground";
  const DeltaIcon = delta == null ? null : delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : null;

  return (
    <div className={`rounded-2xl border-2 p-5 ${toneCls}`}>
      <div className="flex items-center justify-between">
        <span className={`grid h-10 w-10 place-items-center rounded-xl bg-card ${iconColor}`}>
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        {delta != null && DeltaIcon && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${deltaTone}`}>
            <DeltaIcon className="h-3.5 w-3.5" />{Math.abs(delta).toFixed(0)}%
            <span className="text-muted-foreground font-normal ml-1">vs last period</span>
          </span>
        )}
      </div>
      <p className="mt-3 text-sm font-medium">{plain}</p>
      <p className="text-3xl font-bold tabular-nums mt-0.5">₦{Math.round(amount).toLocaleString()}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">({technical})</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-2">{hint}</p>}
    </div>
  );
}

// ── Health bar ──────────────────────────────────────────────────────────────

function HealthBar({
  icon: Icon, plain, technical, pct, band, target, hint,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  plain: string;
  technical: string;
  pct: number;
  band: KpiBand;
  target: string;
  hint?: string;
}) {
  const fillCls =
    band.tone === "good"  ? "bg-primary"
    : band.tone === "ok"   ? "bg-sky-400"
    : band.tone === "watch" ? "bg-warning"
    : "bg-destructive";
  const badgeCls =
    band.tone === "good"  ? "bg-primary/10 text-primary"
    : band.tone === "ok"   ? "bg-sky-100 text-sky-700"
    : band.tone === "watch" ? "bg-warning/20 text-foreground"
    : "bg-destructive/10 text-destructive";

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{plain}</p>
            <p className="text-[10px] text-muted-foreground">({technical}) · {target}</p>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeCls}`}>
          {band.label}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-2xl font-bold tabular-nums">{pct.toFixed(1)}<span className="text-base text-muted-foreground">%</span></p>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface">
        <div className={`h-full transition-all ${fillCls}`} style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
      </div>
      {hint && <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Tab 1 · Profit & Loss ──────────────────────────────────────────────────

function PnLTab({ pnl }: { pnl: ReturnType<typeof computePnL> }) {
  const safe = (v: number, t: number) => t > 0 ? (v / t) * 100 : 0;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-5">
      {/* Revenue */}
      <div>
        <SectionHead plain="Money came in" technical="Revenue" total={pnl.totalRevenue} tone="in" />
        <PnLLine plain="Food orders"        technical="Food revenue"     amount={pnl.foodRevenue}     pct={safe(pnl.foodRevenue, pnl.totalRevenue)}     icon={ChefHat} />
        <PnLLine plain="Drinks & cocktails" technical="Beverage revenue" amount={pnl.drinkRevenue}    pct={safe(pnl.drinkRevenue, pnl.totalRevenue)}    icon={Beer} />
        <PnLLine plain="Delivery fees"      technical="Other revenue"    amount={pnl.deliveryRevenue} pct={safe(pnl.deliveryRevenue, pnl.totalRevenue)} icon={Bike} />
      </div>

      {/* COGS */}
      <div>
        <SectionHead plain="What it cost to make" technical="Cost of goods sold (COGS)" total={pnl.totalCogs} tone="out" />
        <PnLLine plain="Food ingredients"  technical="Food cost"     amount={pnl.foodCogs}  pct={safe(pnl.foodCogs, pnl.totalRevenue)}  icon={ChefHat} negative />
        <PnLLine plain="Drink ingredients" technical="Beverage cost" amount={pnl.drinkCogs} pct={safe(pnl.drinkCogs, pnl.totalRevenue)} icon={Beer} negative />
      </div>

      {/* Gross profit highlight */}
      <HighlightLine
        plain="Profit after food & drink cost"
        technical={`Gross profit · ${pnl.grossMarginPct.toFixed(1)}% margin`}
        amount={pnl.grossProfit}
      />

      {/* Operating costs */}
      <div>
        <SectionHead plain="Running the business" technical="Operating expenses" total={pnl.totalOperating} tone="out" />
        <PnLLine plain="Staff salaries (net)" technical="Payroll"         amount={pnl.payrollNet}    pct={safe(pnl.payrollNet, pnl.totalRevenue)}    icon={HeartHandshake} negative />
        <PnLLine plain="Staff support given"  technical="Welfare (gifts)" amount={pnl.welfareGifts}  pct={safe(pnl.welfareGifts, pnl.totalRevenue)}  icon={HeartHandshake} negative />
        <PnLLine plain="Petty cash spending"  technical="Petty cash"      amount={pnl.pettyCash}     pct={safe(pnl.pettyCash, pnl.totalRevenue)}     icon={Wallet} negative />
        <PnLLine plain="Bike fuel & repairs"  technical="Fleet expenses"  amount={pnl.fleetCosts}    pct={safe(pnl.fleetCosts, pnl.totalRevenue)}    icon={Bike} negative />
      </div>

      {/* Net profit highlight */}
      <HighlightLine
        plain={pnl.netProfit >= 0 ? "What the owner keeps" : "Loss for the period"}
        technical={`Net profit · ${pnl.netMarginPct.toFixed(1)}% margin`}
        amount={pnl.netProfit}
        bold
      />
    </section>
  );
}

function SectionHead({ plain, technical, total, tone }: { plain: string; technical: string; total: number; tone: "in" | "out" }) {
  const colour = tone === "in" ? "text-primary" : "text-destructive";
  const Icon = tone === "in" ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-baseline justify-between gap-3 pb-2 border-b border-border mb-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${colour}`} />{plain}
        </p>
        <p className="text-[11px] text-muted-foreground">({technical})</p>
      </div>
      <span className={`tabular-nums font-bold text-base ${colour}`}>
        {tone === "out" ? "−" : ""}₦{total.toLocaleString()}
      </span>
    </div>
  );
}

function PnLLine({
  plain, technical, amount, pct, icon: Icon, negative,
}: {
  plain: string;
  technical: string;
  amount: number;
  pct: number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 pl-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">{plain}</p>
        <p className="text-[11px] text-muted-foreground">({technical})</p>
      </div>
      <span className="text-[11px] text-muted-foreground tabular-nums w-12 text-right shrink-0">{pct.toFixed(1)}%</span>
      <span className={`tabular-nums font-semibold w-32 text-right shrink-0 ${negative ? "text-destructive" : ""}`}>
        {negative ? "−" : ""}₦{amount.toLocaleString()}
      </span>
    </div>
  );
}

function HighlightLine({ plain, technical, amount, bold }: { plain: string; technical: string; amount: number; bold?: boolean }) {
  const positive = amount >= 0;
  return (
    <div className={`rounded-2xl border-2 p-4 ${positive ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-sm font-semibold ${bold ? "" : ""}`}>{plain}</p>
          <p className="text-[11px] text-muted-foreground">({technical})</p>
        </div>
        <p className={`tabular-nums font-bold ${bold ? "text-3xl" : "text-2xl"} ${positive ? "text-primary" : "text-destructive"}`}>
          {!positive ? "−" : ""}₦{Math.abs(amount).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// ── Tab 2 · Balance Sheet ──────────────────────────────────────────────────

function BalanceTab({ balance }: { balance: ReturnType<typeof computeBalanceSheet> }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <p className="text-xs text-muted-foreground">
        Snapshot as of {new Date(balance.at).toLocaleDateString()} ·
        <span className="ml-2 font-semibold text-foreground">Assets = Liabilities + Equity</span>
        <span className="ml-1">— the books balance when these match.</span>
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT — Assets */}
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />What we have <span className="text-[11px] text-muted-foreground font-normal">(Assets)</span>
          </h3>

          {/* Current */}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-2 mb-1">Cash & things we use this year</p>
          {balance.currentAssets.map((a, i) => <BalanceLine key={i} line={a} Icon={[Wallet, Boxes, HeartHandshake, ShoppingBag][i] ?? Coins} />)}
          <Subtotal label="Total current" amount={balance.totalCurrentAssets} />

          {/* Fixed */}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-3 mb-1">Long-life things we own</p>
          {balance.fixedAssetsLines.map((a, i) => <BalanceLine key={i} line={a} Icon={Truck} />)}
          <Subtotal label="Total long-life" amount={balance.totalFixedAssets} />

          <Total label="Everything we have" technical="Total assets" amount={balance.totalAssets} tone="in" />
        </div>

        {/* RIGHT — Liabilities + Equity */}
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Coins className="h-4 w-4 text-muted-foreground" />What we owe <span className="text-[11px] text-muted-foreground font-normal">(Liabilities)</span>
          </h3>
          {balance.liabilities.map((l, i) => <BalanceLine key={i} line={l} Icon={[Truck, HeartHandshake][i] ?? Coins} />)}
          <Total label="Everything we owe" technical="Total liabilities" amount={balance.totalLiabilities} tone="out" />

          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-muted-foreground" />What's left for the owner <span className="text-[11px] text-muted-foreground font-normal">(Equity)</span>
            </h3>
            <div className={`rounded-2xl border-2 p-4 ${balance.equity >= 0 ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Owner&apos;s share of the business</p>
                  <p className="text-[11px] text-muted-foreground">Assets − Liabilities</p>
                </div>
                <p className={`tabular-nums font-bold text-2xl ${balance.equity >= 0 ? "text-primary" : "text-destructive"}`}>
                  {balance.equity < 0 ? "−" : ""}₦{Math.abs(balance.equity).toLocaleString()}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              This is what you&apos;d have if you sold everything and paid every supplier.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function BalanceLine({ line, Icon }: { line: { plain: string; technical: string; amount: number; hint?: string }; Icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
      <div className="flex items-start gap-2 min-w-0">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface text-muted-foreground"><Icon className="h-3.5 w-3.5" /></span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{line.plain}</p>
          <p className="text-[11px] text-muted-foreground">({line.technical}){line.hint ? ` · ${line.hint}` : ""}</p>
        </div>
      </div>
      <span className="tabular-nums font-semibold shrink-0 text-sm">₦{line.amount.toLocaleString()}</span>
    </div>
  );
}

function Subtotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 mt-1 text-xs">
      <span className="text-muted-foreground italic">{label}</span>
      <span className="tabular-nums font-semibold">₦{amount.toLocaleString()}</span>
    </div>
  );
}

function Total({ label, technical, amount, tone }: { label: string; technical: string; amount: number; tone: "in" | "out" }) {
  const colour = tone === "in" ? "text-primary" : "text-destructive";
  return (
    <div className="flex items-center justify-between py-2.5 px-3 mt-2 rounded-lg bg-surface/40">
      <div>
        <p className="text-sm font-bold">{label}</p>
        <p className="text-[11px] text-muted-foreground">({technical})</p>
      </div>
      <span className={`tabular-nums font-bold ${colour}`}>₦{amount.toLocaleString()}</span>
    </div>
  );
}

// ── Tab 3 · Cash flow ──────────────────────────────────────────────────────

function CashTab({ cashflow }: { cashflow: ReturnType<typeof computeCashFlow> }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <p className="text-xs text-muted-foreground">
        Money <span className="font-semibold text-primary">in</span> minus money <span className="font-semibold text-destructive">out</span>, for the period above.
        Different from <em>profit</em>: a bike you bought for ₦850k is one big cash outflow but only depreciates a little each month.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <CashCard plain="Money in" technical="Cash inflows" amount={cashflow.totalIn} icon={TrendingUp} tone="primary" />
        <CashCard plain="Money out" technical="Cash outflows" amount={cashflow.totalOut} icon={TrendingDown} tone="warning" />
        <CashCard
          plain={cashflow.netCashChange >= 0 ? "Net cash gained" : "Net cash lost"}
          technical="Net change in cash"
          amount={Math.abs(cashflow.netCashChange)}
          icon={Banknote}
          tone={cashflow.netCashChange >= 0 ? "primary" : "destructive"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            <TrendingUp className="inline h-3 w-3 mr-1 text-primary" />Money in
          </p>
          <CashRow plain="Customer sales" technical="Revenue" amount={cashflow.customerSales} icon={Banknote} tone="in" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            <TrendingDown className="inline h-3 w-3 mr-1 text-destructive" />Money out
          </p>
          <CashRow plain="Staff salaries (net)" technical="Payroll"        amount={cashflow.payrollOut}        icon={HeartHandshake} tone="out" />
          <CashRow plain="Petty cash"           technical="Petty cash"     amount={cashflow.pettyCashOut}      icon={Wallet} tone="out" />
          <CashRow plain="Staff welfare paid"   technical="Welfare"        amount={cashflow.welfareOut}        icon={HeartHandshake} tone="out" />
          <CashRow plain="Bike costs"           technical="Fleet"          amount={cashflow.fleetOut}          icon={Bike} tone="out" />
          <CashRow plain="Supplier invoices"    technical="Inventory paid" amount={cashflow.inventoryReceived} icon={Truck} tone="out" />
        </div>
      </div>
    </section>
  );
}

function CashCard({ plain, technical, amount, icon: Icon, tone }: { plain: string; technical: string; amount: number; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; tone: "primary" | "warning" | "destructive" }) {
  const toneCls =
    tone === "primary" ? "border-primary/30 bg-primary/5 text-primary"
    : tone === "warning" ? "border-warning/30 bg-warning/10 text-warning"
    : "border-destructive/30 bg-destructive/5 text-destructive";
  return (
    <div className={`rounded-2xl border-2 p-5 ${toneCls}`}>
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{plain}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums`}>₦{amount.toLocaleString()}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">({technical})</p>
    </div>
  );
}

function CashRow({ plain, technical, amount, icon: Icon, tone }: { plain: string; technical: string; amount: number; icon: React.ComponentType<{ className?: string }>; tone: "in" | "out" }) {
  if (amount === 0) return null;
  const colour = tone === "in" ? "text-primary" : "text-destructive";
  return (
    <div className="flex items-center gap-2 py-2 border-b border-border last:border-0">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface text-muted-foreground"><Icon className="h-3.5 w-3.5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">{plain}</p>
        <p className="text-[11px] text-muted-foreground">({technical})</p>
      </div>
      <span className={`tabular-nums font-semibold ${colour}`}>{tone === "out" ? "−" : ""}₦{amount.toLocaleString()}</span>
    </div>
  );
}
