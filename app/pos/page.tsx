"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Plus, Minus, Trash2, CreditCard, Banknote, Smartphone,
  CheckCircle2, ChevronLeft, Users, ShoppingBag, Bike, SlidersHorizontal, Tag, X,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Modal, ModalButton } from "@/components/Modal";
import { managerByPin } from "@/components/ManagerApprovalModal";
import { useAuth } from "@/lib/auth";
import {
  useStore, type MenuItem, type Order, type OrderLine, type OrderChannel, type OrderCustomer,
  type TableRec, type TableStatus, type Modifier, type PaymentEntry,
} from "@/lib/store";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CartItem {
  id: string;
  name: string;
  basePrice: number;
  emoji: string;
  qty: number;
  modifiers: Modifier[];
  note: string;
  sent?: boolean; // already fired to the kitchen on an open tab
}

interface ServiceOrder {
  channel: "Takeout" | "Delivery";
  name: string;
  phone: string;
  address?: string;
  pickup?: string;
  fee?: number; // delivery fee
}

// ── Static config ──────────────────────────────────────────────────────────────

const ZONES = ["Indoor", "Terrace", "Bar"] as const;

const STATUS_CONFIG: Record<TableStatus, {
  card: string; badge: string; dot: string; label: string; selectable: boolean;
}> = {
  available: { card: "border-border bg-card hover:border-primary/60 hover:bg-primary/5 cursor-pointer active:scale-[0.97]", badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", label: "Available", selectable: true },
  occupied:  { card: "border-amber-200 bg-amber-50/60 cursor-not-allowed", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500", label: "Occupied", selectable: false },
  reserved:  { card: "border-blue-200 bg-blue-50/60 cursor-not-allowed", badge: "bg-blue-100 text-blue-700", dot: "bg-blue-500", label: "Reserved", selectable: false },
};

const payMethods = [
  { id: "Cash",     Icon: Banknote,   color: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  { id: "Card",     Icon: CreditCard, color: "border-sky-300 bg-sky-50 text-sky-700" },
  { id: "Transfer", Icon: Smartphone, color: "border-purple-300 bg-purple-50 text-purple-700" },
];

/** Modifiers offered for any line — a fixed prototype set. */
const MODIFIERS: Modifier[] = [
  { label: "Extra cheese", price: 300 },
  { label: "Extra sauce", price: 200 },
  { label: "Extra protein", price: 800 },
  { label: "Extra spicy", price: 0 },
  { label: "No onions", price: 0 },
  { label: "Well done", price: 0 },
];

const PICKUP_OPTIONS = ["ASAP", "In 15 minutes", "In 30 minutes", "In 1 hour"];

const DISCOUNT_APPROVAL_THRESHOLD = 500;

let cartSeq = 0;
const cartId = () => `c${cartSeq++}`;

const lineUnit = (c: CartItem) => c.basePrice + c.modifiers.reduce((s, m) => s + m.price, 0);

const toLine = (c: CartItem): OrderLine => ({
  name: c.name,
  qty: c.qty,
  price: lineUnit(c),
  modifiers: c.modifiers.length ? c.modifiers : undefined,
  note: c.note || undefined,
});

// ── Component ──────────────────────────────────────────────────────────────────

export default function POS() {
  const store = useStore();
  const { user } = useAuth();
  const [selectedTable, setSelectedTable] = useState<TableRec | null>(null);
  const [guests, setGuests] = useState(0);
  const [seatingTable, setSeatingTable] = useState<TableRec | null>(null);
  const [service, setService] = useState<ServiceOrder | null>(null);
  const [serviceModal, setServiceModal] = useState<"Takeout" | "Delivery" | null>(null);
  const [cat, setCat] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customizing, setCustomizing] = useState<CartItem | null>(null);
  const [discount, setDiscount] = useState(0);
  const [discountNote, setDiscountNote] = useState("");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [screen, setScreen] = useState<"tables" | "menu" | "pay" | "done">("tables");
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  // When set, the screen is working an existing open tab rather than a fresh order.
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const staff = { id: user?.id ?? "0", name: user?.name ?? "Unknown" };

  const menuItems = store.menu.filter((m) => m.status === "Available");
  const categories = ["All", ...Array.from(new Set(menuItems.map((i) => i.category)))];
  const filtered = cat === "All" ? menuItems : menuItems.filter((i) => i.category === cat);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = cart.reduce((s, i) => s + lineUnit(i) * i.qty, 0);
  const cappedDiscount = Math.min(discount, subtotal);
  const vat = Math.round((subtotal - cappedDiscount) * 0.075);
  const total = subtotal - cappedDiscount + vat;
  const newItems = cart.filter((c) => !c.sent);
  const newItemCount = newItems.reduce((s, c) => s + c.qty, 0);
  const sentCount = cart.filter((c) => c.sent).reduce((s, c) => s + c.qty, 0);

  const orderLabel = editingOrder
    ? `${editingOrder.table} · #${editingOrder.id}`
    : selectedTable
      ? selectedTable.label
      : service
        ? `${service.channel} · ${service.name}`
        : "New order";

  function seatGuests(table: TableRec, count: number) {
    store.seatTable(table.id, count);
    setSelectedTable(table);
    setGuests(count);
    setService(null);
    setSeatingTable(null);
    setScreen("menu");
  }

  function startService(order: ServiceOrder) {
    setService(order);
    setSelectedTable(null);
    setGuests(0);
    setServiceModal(null);
    setScreen("menu");
  }

  // Resume an open tab to add more items.
  function openTab(order: Order) {
    setEditingOrder(order);
    setSelectedTable(null);
    setService(null);
    setGuests(order.guests ?? 0);
    setDiscount(order.discount ?? 0);
    setDiscountNote(order.discountNote ?? "");
    setCart(order.lines.map((l) => {
      const modifiers = l.modifiers ?? [];
      const modSum = modifiers.reduce((s, m) => s + m.price, 0);
      return {
        id: cartId(),
        name: l.name,
        basePrice: l.price - modSum,
        emoji: store.menu.find((m) => m.name === l.name)?.emoji ?? "🍽️",
        qty: l.qty,
        modifiers,
        note: l.note ?? "",
        sent: true,
      };
    }));
    setCat("All");
    setScreen("menu");
  }

  function addItem(item: MenuItem) {
    setCart((prev) => {
      // Merge into an existing plain line, but never into one already sent to the kitchen.
      const plain = prev.find((c) => c.name === item.name && c.modifiers.length === 0 && !c.note && !c.sent);
      if (plain) return prev.map((c) => (c.id === plain.id ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { id: cartId(), name: item.name, basePrice: item.price, emoji: item.emoji, qty: 1, modifiers: [], note: "" }];
    });
  }

  function changeQty(id: string, delta: number) {
    setCart((prev) =>
      prev.map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c)).filter((c) => c.qty > 0),
    );
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }

  function applyModifiers(id: string, modifiers: Modifier[], note: string) {
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, modifiers, note } : c)));
    setCustomizing(null);
  }

  // Pay for a fresh order in one go.
  function confirmPayment(payments: PaymentEntry[], splitWays: number, methodSummary: string) {
    const channel: OrderChannel = service ? service.channel : "Dine-in";
    const customer: OrderCustomer | undefined = service
      ? { name: service.name, phone: service.phone, address: service.address, pickup: service.pickup }
      : undefined;
    const order = store.recordSale({
      table: selectedTable?.label ?? service?.channel ?? "Walk-in",
      channel,
      customer,
      guests: selectedTable ? guests : undefined,
      lines: cart.map(toLine),
      discount: cappedDiscount || undefined,
      discountNote: cappedDiscount ? discountNote : undefined,
      payments,
      splitWays,
      method: methodSummary,
      deliveryFee: service?.channel === "Delivery" ? service.fee : undefined,
      staff,
    });
    setLastOrder(order);
    if (selectedTable) store.freeTable(selectedTable.id);
    setScreen("done");
  }

  // Open a tab — items fire to the kitchen now, the tab stays open until paid.
  function holdOrder() {
    if (cart.length === 0) return;
    const channel: OrderChannel = service ? service.channel : "Dine-in";
    const customer: OrderCustomer | undefined = service
      ? { name: service.name, phone: service.phone, address: service.address, pickup: service.pickup }
      : undefined;
    const order = store.recordSale({
      table: selectedTable?.label ?? service?.channel ?? "Walk-in",
      channel,
      customer,
      guests: selectedTable ? guests : undefined,
      lines: cart.map(toLine),
      discount: cappedDiscount || undefined,
      discountNote: cappedDiscount ? discountNote : undefined,
      payments: [],
      splitWays: 1,
      method: "On hold",
      deliveryFee: service?.channel === "Delivery" ? service.fee : undefined,
      staff,
      hold: true,
    });
    toast.success(`Tab ${order.id} opened — ${orderLabel} · sent to the kitchen`);
    reset();
  }

  // Send newly-added items on an open tab to the kitchen, keep the tab open.
  function updateTab() {
    if (!editingOrder || newItems.length === 0) return;
    store.appendToOrder(editingOrder.id, newItems.map(toLine), staff);
    toast.success(`Tab ${editingOrder.id} updated — ${newItemCount} item${newItemCount !== 1 ? "s" : ""} sent to the kitchen`);
    reset();
  }

  // Close an open tab: fire any new items, then take payment.
  function payTab(payments: PaymentEntry[], splitWays: number, methodSummary: string) {
    if (!editingOrder) return;
    if (newItems.length > 0) store.appendToOrder(editingOrder.id, newItems.map(toLine), staff);
    store.closeOrder(editingOrder.id, { payments, splitWays, method: methodSummary, staff });
    const tbl = store.tables.find((t) => t.label === editingOrder.table);
    if (editingOrder.channel === "Dine-in" && tbl) store.freeTable(tbl.id);
    setLastOrder({
      ...editingOrder,
      status: "Closed" as const,
      lines: cart.map(toLine),
      subtotal,
      discount: cappedDiscount || undefined,
      vat,
      total,
      payments,
      splitWays: splitWays > 1 ? splitWays : undefined,
      method: methodSummary,
    });
    setScreen("done");
  }

  function cancelOrder() {
    if (selectedTable) store.freeTable(selectedTable.id);
    reset();
  }

  function reset() {
    setCart([]);
    setDiscount(0);
    setDiscountNote("");
    setSelectedTable(null);
    setGuests(0);
    setService(null);
    setLastOrder(null);
    setEditingOrder(null);
    setScreen("tables");
  }

  // ── Table / service selection screen ────────────────────────────────────────

  if (screen === "tables") {
    const availCount    = store.tables.filter((t) => t.status === "available").length;
    const occupiedCount = store.tables.filter((t) => t.status === "occupied").length;
    const reservedCount = store.tables.filter((t) => t.status === "reserved").length;
    const heldOrders = store.orders.filter((o) => o.status === "On hold" && o.branch === store.currentBranch && !o.voided);

    return (
      <AppShell title="Start an order" subtitle="Pick a table, open a tab, or start a takeout / delivery order">
        <div className="space-y-6 max-w-3xl">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-0.5">Takeout &amp; Delivery</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" onClick={() => setServiceModal("Takeout")} className="flex items-center gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-left hover:border-primary/60 hover:bg-primary/10 transition-all active:scale-[0.97]">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><ShoppingBag className="h-6 w-6" strokeWidth={1.75} /></span>
                <span><span className="block text-sm font-bold">Takeout</span><span className="block text-xs text-muted-foreground">Customer collects · capture name &amp; phone</span></span>
              </button>
              <button type="button" onClick={() => setServiceModal("Delivery")} className="flex items-center gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-left hover:border-primary/60 hover:bg-primary/10 transition-all active:scale-[0.97]">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Bike className="h-6 w-6" strokeWidth={1.75} /></span>
                <span><span className="block text-sm font-bold">Delivery</span><span className="block text-xs text-muted-foreground">Rider drop-off · capture address &amp; phone</span></span>
              </button>
            </div>
          </section>

          {heldOrders.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-0.5">
                Open tabs · tap to add items or close &amp; pay
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {heldOrders.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => openTab(o)}
                    className="flex items-center justify-between gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-4 text-left transition-all hover:border-amber-300 active:scale-[0.97]"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold truncate">
                        {o.table} <span className="font-mono text-xs font-normal text-muted-foreground">#{o.id}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {o.channel} · {o.lines.reduce((s, l) => s + l.qty, 0)} items · {o.staffName}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold tabular-nums">₦{o.total.toLocaleString()}</span>
                      <span className="block text-[11px] font-semibold text-amber-700">Open tab →</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Available", count: availCount,    color: "text-emerald-600" },
              { label: "Occupied",  count: occupiedCount, color: "text-amber-600"   },
              { label: "Reserved",  count: reservedCount, color: "text-blue-600"    },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
                <p className={`text-3xl font-bold tabular-nums ${s.color}`}>{s.count}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {ZONES.map((zone) => (
            <section key={zone}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-0.5">{zone}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {store.tables.filter((t) => t.zone === zone).map((table) => {
                  const cfg = STATUS_CONFIG[table.status];
                  return (
                    <button key={table.id} type="button" disabled={!cfg.selectable} onClick={() => cfg.selectable && setSeatingTable(table)} className={`rounded-2xl border-2 p-4 text-left transition-all ${cfg.card}`}>
                      <div className="flex items-start justify-between mb-3">
                        <p className="text-sm font-bold leading-tight">{table.label}</p>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${cfg.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3 shrink-0" /><span>{table.seats} seats</span>
                      </div>
                      {table.status === "occupied" && (
                        <div className="mt-2.5 pt-2.5 border-t border-amber-200 space-y-0.5">
                          <p className="text-xs text-muted-foreground">{table.guests ?? 0} of {table.seats} seated</p>
                          {table.orderTotal != null && <p className="text-sm font-bold tabular-nums">₦{table.orderTotal.toLocaleString()}</p>}
                        </div>
                      )}
                      {table.status === "reserved" && (
                        <div className="mt-2.5 pt-2.5 border-t border-blue-200"><p className="text-xs text-muted-foreground leading-relaxed">{table.reservation}</p></div>
                      )}
                      {table.status === "available" && <p className="mt-2.5 text-xs font-medium text-primary/70">Tap to seat guests</p>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {seatingTable && <SeatGuestsModal table={seatingTable} onClose={() => setSeatingTable(null)} onConfirm={(c) => seatGuests(seatingTable, c)} />}
        {serviceModal && <ServiceFormModal channel={serviceModal} onClose={() => setServiceModal(null)} onSubmit={startService} />}
      </AppShell>
    );
  }

  // ── Order complete ──────────────────────────────────────────────────────────

  if (screen === "done") {
    const cust = lastOrder?.customer;
    const paid = (lastOrder?.payments ?? []).reduce((s, p) => s + p.amount, 0);
    const change = lastOrder ? Math.max(0, paid - lastOrder.total) : 0;
    return (
      <AppShell title="Order complete">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-10 w-10 text-primary" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-2xl font-bold">Payment received</p>
            <p className="mt-1 text-muted-foreground">
              Order #{lastOrder?.id} · {lastOrder?.table ?? orderLabel}
              {lastOrder?.guests ? ` · ${lastOrder.guests} guests` : ""} · ₦{lastOrder?.total.toLocaleString()}
            </p>
            <p className="mt-2 text-xs font-medium text-emerald-600">
              Tab closed · inventory deducted · logged to your shift
            </p>
          </div>

          <div className="w-full max-w-xs rounded-2xl border border-border bg-card p-4 text-left text-sm space-y-1">
            {lastOrder?.discount ? (
              <p className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-primary">−₦{lastOrder.discount.toLocaleString()}</span></p>
            ) : null}
            {(lastOrder?.payments ?? []).map((p, i) => (
              <p key={i} className="flex justify-between"><span className="text-muted-foreground">{p.method}</span><span>₦{p.amount.toLocaleString()}</span></p>
            ))}
            {change > 0 && (
              <p className="flex justify-between border-t border-border pt-1 font-semibold"><span>Change</span><span>₦{change.toLocaleString()}</span></p>
            )}
            {lastOrder && lastOrder.splitWays ? (
              <p className="text-xs text-muted-foreground border-t border-border pt-1">Bill split {lastOrder.splitWays} ways</p>
            ) : null}
          </div>

          {cust && (
            <div className="w-full max-w-xs rounded-2xl border border-border bg-card p-4 text-left text-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{lastOrder?.channel} details</p>
              <div className="space-y-1">
                <p><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{cust.name}</span></p>
                <p><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{cust.phone}</span></p>
                {cust.address && <p><span className="text-muted-foreground">Address:</span> <span className="font-medium">{cust.address}</span></p>}
                {cust.pickup && <p><span className="text-muted-foreground">Pickup:</span> <span className="font-medium">{cust.pickup}</span></p>}
              </div>
            </div>
          )}

          <button type="button" onClick={reset} className="rounded-2xl bg-primary px-8 py-3.5 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            New order
          </button>
        </div>
      </AppShell>
    );
  }

  // ── Payment screen ──────────────────────────────────────────────────────────

  if (screen === "pay") {
    return (
      <PaymentScreen
        total={total}
        orderLabel={orderLabel}
        cartCount={cartCount}
        discount={cappedDiscount}
        deliveryFee={!editingOrder && service?.channel === "Delivery" ? service.fee ?? 0 : undefined}
        onBack={() => setScreen("menu")}
        onComplete={editingOrder ? payTab : confirmPayment}
      />
    );
  }

  // ── Menu + cart screen ──────────────────────────────────────────────────────

  return (
    <AppShell
      title={orderLabel}
      subtitle={editingOrder ? "Add items to the open tab, then update or close it" : "Tap items to add · customise · then charge"}
    >
      <button type="button" onClick={cancelOrder} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground -mt-1">
        <ChevronLeft className="h-4 w-4" />
        {editingOrder ? "Back — tab stays open" : `Cancel order${selectedTable ? " · release table" : ""}`}
      </button>

      <div className="flex gap-5 items-start">
        {/* Menu grid */}
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((c) => (
              <button key={c} type="button" onClick={() => setCat(c)} className={["px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all shrink-0", cat === c ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground/70 hover:text-foreground hover:bg-surface"].join(" ")}>
                {c}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map((item) => {
              const inCart = cart.filter((c) => c.name === item.name).reduce((s, c) => s + c.qty, 0);
              return (
                <button key={item.name} type="button" onClick={() => addItem(item)} className="relative rounded-2xl border-2 border-border bg-card p-5 text-left hover:border-primary/40 hover:bg-surface transition-all active:scale-[0.97]">
                  {inCart > 0 && (
                    <span className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold grid place-items-center">{inCart}</span>
                  )}
                  <span className="text-3xl">{item.emoji}</span>
                  <p className="mt-2 text-sm font-semibold leading-tight">{item.name}</p>
                  <p className="mt-1 text-base font-bold text-primary tabular-nums">₦{item.price.toLocaleString()}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cart sidebar */}
        <aside className="hidden lg:flex w-80 shrink-0 flex-col rounded-2xl border border-border bg-card sticky top-20 overflow-hidden">
          <div className="px-5 pt-4 pb-3 border-b border-border">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-sm">{cartCount === 0 ? "Cart is empty" : `${cartCount} item${cartCount !== 1 ? "s" : ""}`}</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary truncate max-w-[10rem]">{orderLabel}</span>
            </div>
            {selectedTable && <p className="mt-1 text-xs text-muted-foreground">{guests} guest{guests !== 1 ? "s" : ""} seated</p>}
            {service && <p className="mt-1 text-xs text-muted-foreground truncate">{service.phone}{service.address ? ` · ${service.address}` : service.pickup ? ` · ${service.pickup}` : ""}</p>}
            {editingOrder && <p className="mt-1 text-xs text-muted-foreground">Open tab · {sentCount} item{sentCount !== 1 ? "s" : ""} already in the kitchen</p>}
          </div>

          {cart.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 text-center px-4">
              <p className="text-sm text-muted-foreground">Tap any item on the left to add it here</p>
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto divide-y divide-border">
              {cart.map((item) => (
                <li key={item.id} className="px-5 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">₦{lineUnit(item).toLocaleString()}</p>
                    </div>
                    {item.sent ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">×{item.qty}</span>
                        <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Sent</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button type="button" aria-label="Remove one" onClick={() => changeQty(item.id, -1)} className="grid h-7 w-7 place-items-center rounded-lg border border-border hover:bg-surface transition-colors"><Minus className="h-3 w-3" /></button>
                        <span className="w-5 text-center text-sm font-semibold tabular-nums">{item.qty}</span>
                        <button type="button" aria-label="Add one" onClick={() => changeQty(item.id, 1)} className="grid h-7 w-7 place-items-center rounded-lg border border-border hover:bg-surface transition-colors"><Plus className="h-3 w-3" /></button>
                        <button type="button" aria-label="Remove item" onClick={() => removeLine(item.id)} className="ml-1 grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </div>
                  {item.sent ? (
                    (item.modifiers.length > 0 || item.note) && (
                      <p className="pl-9 text-[11px] text-muted-foreground">
                        {[...item.modifiers.map((m) => m.label), item.note].filter(Boolean).join(" · ")}
                      </p>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCustomizing(item)}
                      className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                    >
                      <SlidersHorizontal className="h-3 w-3 shrink-0" />
                      {item.modifiers.length === 0 && !item.note
                        ? "Customise / special instructions"
                        : [...item.modifiers.map((m) => m.label), item.note].filter(Boolean).join(" · ")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-border p-5 space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span className="tabular-nums">₦{subtotal.toLocaleString()}</span>
              </div>
              {cappedDiscount > 0 && (
                <div className="flex justify-between text-primary">
                  <span className="flex items-center gap-1">
                    Discount
                    {!editingOrder && (
                      <button type="button" aria-label="Remove discount" onClick={() => { setDiscount(0); setDiscountNote(""); }} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                    )}
                  </span>
                  <span className="tabular-nums">−₦{cappedDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>VAT 7.5%</span><span className="tabular-nums">₦{vat.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-1">
                <span>Total</span><span className="tabular-nums">₦{total.toLocaleString()}</span>
              </div>
            </div>
            {!editingOrder && cappedDiscount === 0 && (
              <button type="button" disabled={cart.length === 0} onClick={() => setDiscountOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed">
                <Tag className="h-3.5 w-3.5" />Add discount
              </button>
            )}
            {editingOrder ? (
              <button type="button" disabled={newItemCount === 0} onClick={updateTab} className="w-full rounded-xl border border-border py-2.5 text-xs font-semibold hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed">
                {newItemCount === 0 ? "No new items to send" : `Send ${newItemCount} new item${newItemCount !== 1 ? "s" : ""} to kitchen`}
              </button>
            ) : (
              <button type="button" disabled={cart.length === 0} onClick={holdOrder} className="w-full rounded-xl border border-border py-2.5 text-xs font-semibold hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed">
                Open tab — send to kitchen, pay later
              </button>
            )}
            <button type="button" disabled={cart.length === 0} onClick={() => setScreen("pay")} className="w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {editingOrder ? "Close tab & pay" : "Charge"} ₦{total.toLocaleString()}
            </button>
          </div>
        </aside>
      </div>

      {customizing && (
        <ModifierModal
          line={customizing}
          onClose={() => setCustomizing(null)}
          onSave={(mods, note) => applyModifiers(customizing.id, mods, note)}
        />
      )}
      {discountOpen && (
        <DiscountModal
          subtotal={subtotal}
          onClose={() => setDiscountOpen(false)}
          onApply={(amount, note) => { setDiscount(amount); setDiscountNote(note); setDiscountOpen(false); }}
        />
      )}
    </AppShell>
  );
}

// ── Seat guests modal ───────────────────────────────────────────────────────────

function SeatGuestsModal({ table, onClose, onConfirm }: { table: TableRec; onClose: () => void; onConfirm: (guests: number) => void }) {
  const [count, setCount] = useState(Math.min(2, table.seats));
  const atCapacity = count >= table.seats;
  return (
    <Modal open onClose={onClose} title={`Seat guests — ${table.label}`} description={`${table.zone} · capacity ${table.seats} seats`}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={() => onConfirm(count)}>Seat &amp; start order</ModalButton></>}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">How many guests are being seated?</p>
        <div className="flex items-center justify-center gap-5">
          <button type="button" aria-label="Fewer guests" onClick={() => setCount((c) => Math.max(1, c - 1))} disabled={count <= 1} className="grid h-12 w-12 place-items-center rounded-xl border border-border hover:bg-surface disabled:opacity-30 transition-colors"><Minus className="h-5 w-5" /></button>
          <div className="text-center"><p className="text-4xl font-bold tabular-nums">{count}</p><p className="text-xs text-muted-foreground">guest{count !== 1 ? "s" : ""}</p></div>
          <button type="button" aria-label="More guests" onClick={() => setCount((c) => Math.min(table.seats, c + 1))} disabled={atCapacity} className="grid h-12 w-12 place-items-center rounded-xl border border-border hover:bg-surface disabled:opacity-30 transition-colors"><Plus className="h-5 w-5" /></button>
        </div>
        <div className={`rounded-xl border px-4 py-2.5 text-center text-xs font-medium ${atCapacity ? "border-warning/40 bg-warning/10 text-foreground" : "border-border bg-surface/60 text-muted-foreground"}`}>
          {atCapacity ? `Table is at full capacity (${table.seats} seats)` : `${table.seats - count} seat${table.seats - count !== 1 ? "s" : ""} still free`}
        </div>
      </div>
    </Modal>
  );
}

// ── Modifier modal ──────────────────────────────────────────────────────────────

function ModifierModal({ line, onClose, onSave }: { line: CartItem; onClose: () => void; onSave: (mods: Modifier[], note: string) => void }) {
  const [picked, setPicked] = useState<string[]>(line.modifiers.map((m) => m.label));
  const [note, setNote] = useState(line.note);

  function toggle(label: string) {
    setPicked((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]));
  }

  return (
    <Modal open onClose={onClose} title={`Customise — ${line.name}`} description="Modifiers reflect on the kitchen / bar ticket"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={() => onSave(MODIFIERS.filter((m) => picked.includes(m.label)), note.trim())}>Save</ModalButton></>}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Modifiers</p>
          <div className="flex flex-wrap gap-2">
            {MODIFIERS.map((m) => {
              const on = picked.includes(m.label);
              return (
                <button key={m.label} type="button" onClick={() => toggle(m.label)} className={`rounded-xl border-2 px-3 py-2 text-xs font-semibold transition-colors ${on ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground/70 hover:bg-surface"}`}>
                  {m.label}{m.price > 0 ? ` +₦${m.price}` : ""}
                </button>
              );
            })}
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Special instructions</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="e.g. no pepper, allergy note…" className={`${inputCls} resize-y`} />
        </label>
      </div>
    </Modal>
  );
}

// ── Discount modal (manager approval over ₦500) ─────────────────────────────────

function DiscountModal({ subtotal, onClose, onApply }: { subtotal: number; onClose: () => void; onApply: (amount: number, note: string) => void }) {
  const [mode, setMode] = useState<"percent" | "amount">("percent");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const raw = Number(value) || 0;
  const amount = mode === "percent"
    ? Math.round((subtotal * Math.min(100, Math.max(0, raw))) / 100)
    : Math.min(Math.max(0, raw), subtotal);
  const needsApproval = amount > DISCOUNT_APPROVAL_THRESHOLD;

  function apply() {
    if (amount <= 0) { setError("Enter a discount value"); return; }
    if (!reason.trim()) { setError("Enter a reason for the discount"); return; }
    let note = reason.trim();
    if (needsApproval) {
      const mgr = managerByPin(pin);
      if (!mgr) { setError(`Discounts over ₦${DISCOUNT_APPROVAL_THRESHOLD} need a manager PIN`); setPin(""); return; }
      note = `${note} · approved by ${mgr.name}`;
    }
    onApply(amount, note);
  }

  return (
    <Modal open onClose={onClose} title="Apply discount" description="Discounts above ₦500 require manager approval"
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={apply}>Apply discount</ModalButton></>}>
      <div className="space-y-4">
        <div className="flex gap-2">
          {(["percent", "amount"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setError(""); }} className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold transition-colors ${mode === m ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-surface"}`}>
              {m === "percent" ? "Percentage %" : "Fixed amount ₦"}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">{mode === "percent" ? "Discount %" : "Discount amount ₦"}</span>
          <input type="number" value={value} onChange={(e) => { setValue(e.target.value); setError(""); }} placeholder="0" autoFocus className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Reason</span>
          <input value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} placeholder="e.g. regular customer" className={inputCls} />
        </label>

        <div className="rounded-xl bg-surface/60 border border-border p-3 flex justify-between text-sm">
          <span className="text-muted-foreground">Discount applied</span>
          <span className="font-bold tabular-nums text-primary">−₦{amount.toLocaleString()}</span>
        </div>

        {needsApproval && (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Manager PIN <span className="text-destructive">· required over ₦{DISCOUNT_APPROVAL_THRESHOLD}</span></span>
            <input type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }} placeholder="••••" className={`${inputCls} text-center text-lg tracking-[0.5em]`} />
            <span className="mt-1 block text-[11px] text-muted-foreground">Dev PINs — Manager 1111 · Owner 0000</span>
          </label>
        )}

        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      </div>
    </Modal>
  );
}

// ── Payment screen — split payment & split bill ─────────────────────────────────

function PaymentScreen({
  total, orderLabel, cartCount, discount, deliveryFee, onBack, onComplete,
}: {
  total: number;
  orderLabel: string;
  cartCount: number;
  discount: number;
  deliveryFee?: number;
  onBack: () => void;
  onComplete: (payments: PaymentEntry[], splitWays: number, methodSummary: string) => void;
}) {
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [splitWays, setSplitWays] = useState(1);
  const [entryMethod, setEntryMethod] = useState("Cash");
  const [entryAmount, setEntryAmount] = useState("");

  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);
  const perShare = Math.ceil(total / splitWays);
  const covered = paid >= total;

  function addPayment() {
    const amt = Number(entryAmount) || 0;
    if (amt <= 0) return;
    setPayments((p) => [...p, { method: entryMethod, amount: amt }]);
    setEntryAmount("");
  }

  function complete() {
    if (!covered) return;
    const methods = Array.from(new Set(payments.map((p) => p.method)));
    const summary = methods.length === 1 ? methods[0] : "Split payment";
    onComplete(payments, splitWays, summary);
  }

  return (
    <AppShell title="Take payment" subtitle={orderLabel}>
      <div className="max-w-md mx-auto space-y-4">
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Back to cart
        </button>

        {/* Total */}
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">Amount due · {orderLabel}</p>
          <p className="text-4xl font-bold mt-1 tabular-nums">₦{total.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {cartCount} item{cartCount !== 1 ? "s" : ""} · incl. 7.5% VAT{discount > 0 ? ` · ₦${discount.toLocaleString()} discount` : ""}
          </p>
        </div>

        {/* Split bill */}
        <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Split the bill</p>
            <p className="text-xs text-muted-foreground">{splitWays === 1 ? "Paying as one bill" : `₦${perShare.toLocaleString()} per person`}</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" aria-label="Fewer ways" onClick={() => setSplitWays((n) => Math.max(1, n - 1))} disabled={splitWays <= 1} className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-surface disabled:opacity-30"><Minus className="h-4 w-4" /></button>
            <span className="w-6 text-center text-lg font-bold tabular-nums">{splitWays}</span>
            <button type="button" aria-label="More ways" onClick={() => setSplitWays((n) => Math.min(8, n + 1))} disabled={splitWays >= 8} className="grid h-9 w-9 place-items-center rounded-lg border border-border hover:bg-surface disabled:opacity-30"><Plus className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Payments taken */}
        {payments.length > 0 && (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border">
            {payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium">{p.method}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">₦{p.amount.toLocaleString()}</span>
                  <button type="button" aria-label="Remove payment" onClick={() => setPayments((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Add a payment */}
        {!covered && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold">Add a payment</p>
            <div className="grid grid-cols-3 gap-2">
              {payMethods.map(({ id, Icon, color }) => (
                <button key={id} type="button" onClick={() => setEntryMethod(id)} className={`flex flex-col items-center gap-1 rounded-xl border-2 py-2.5 text-xs font-semibold transition-all ${entryMethod === id ? color : "border-border text-muted-foreground hover:bg-surface"}`}>
                  <Icon className="h-5 w-5" strokeWidth={1.75} />{id}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={entryAmount}
              onChange={(e) => setEntryAmount(e.target.value)}
              placeholder="Amount ₦"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setEntryAmount(String(remaining))} className="rounded-lg bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface/70">
                Remaining ₦{remaining.toLocaleString()}
              </button>
              {splitWays > 1 && (
                <button type="button" onClick={() => setEntryAmount(String(Math.min(perShare, remaining)))} className="rounded-lg bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface/70">
                  One share ₦{Math.min(perShare, remaining).toLocaleString()}
                </button>
              )}
            </div>
            <button type="button" onClick={addPayment} disabled={!(Number(entryAmount) > 0)} className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed">
              Add {entryMethod} payment
            </button>
          </div>
        )}

        {/* Summary */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Paid so far</span><span className="tabular-nums">₦{paid.toLocaleString()}</span></div>
          {remaining > 0 ? (
            <div className="flex justify-between font-bold text-destructive"><span>Still due</span><span className="tabular-nums">₦{remaining.toLocaleString()}</span></div>
          ) : (
            <div className="flex justify-between font-bold text-primary"><span>{change > 0 ? "Change to give" : "Fully paid"}</span><span className="tabular-nums">₦{change.toLocaleString()}</span></div>
          )}
        </div>

        <button type="button" onClick={complete} disabled={!covered} className="w-full rounded-2xl bg-primary py-4 text-base font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
          {deliveryFee !== undefined ? "Complete — prepaid" : "Complete order"}
        </button>

        {/* Cash on delivery — the rider collects from the customer */}
        {deliveryFee !== undefined && (
          <>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              onClick={() => onComplete([], 1, "Cash on delivery")}
              className="w-full rounded-2xl border-2 border-primary/40 bg-primary/5 py-3.5 font-bold text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="flex items-center justify-center gap-2 text-base"><Bike className="h-5 w-5" />Cash on delivery</span>
              <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                Rider collects ₦{(total + (deliveryFee ?? 0)).toLocaleString()} on arrival
              </span>
            </button>
          </>
        )}
      </div>
    </AppShell>
  );
}

// ── Takeout / Delivery customer form ────────────────────────────────────────────

function ServiceFormModal({ channel, onClose, onSubmit }: { channel: "Takeout" | "Delivery"; onClose: () => void; onSubmit: (order: ServiceOrder) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [pickup, setPickup] = useState(PICKUP_OPTIONS[0]);
  const [fee, setFee] = useState("1500");
  const [error, setError] = useState("");

  function submit() {
    if (!name.trim()) { setError("Customer name is required"); return; }
    if (!phone.trim()) { setError("Phone number is required"); return; }
    if (channel === "Delivery" && !address.trim()) { setError("Delivery address is required"); return; }
    onSubmit({
      channel,
      name: name.trim(),
      phone: phone.trim(),
      address: channel === "Delivery" ? address.trim() : undefined,
      pickup: channel === "Takeout" ? pickup : undefined,
      fee: channel === "Delivery" ? Number(fee) || 0 : undefined,
    });
  }

  return (
    <Modal open onClose={onClose} title={`${channel} order`} description={channel === "Delivery" ? "Capture the customer & drop-off address" : "Capture the customer & pickup time"}
      footer={<><ModalButton variant="ghost" onClick={onClose}>Cancel</ModalButton><ModalButton onClick={submit}>Continue to menu</ModalButton></>}>
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Customer name</span>
          <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="e.g. John Doe" autoFocus className={inputCls} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Phone number</span>
          <input value={phone} onChange={(e) => { setPhone(e.target.value); setError(""); }} placeholder="+234 ..." inputMode="tel" className={inputCls} />
        </label>
        {channel === "Delivery" ? (
          <>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Delivery address</span>
              <textarea value={address} onChange={(e) => { setAddress(e.target.value); setError(""); }} placeholder="Street, area, landmark…" rows={3} className={`${inputCls} resize-y`} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Delivery fee ₦</span>
              <input type="number" value={fee} onChange={(e) => setFee(e.target.value)} className={inputCls} />
            </label>
          </>
        ) : (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Pickup time</span>
            <select value={pickup} onChange={(e) => setPickup(e.target.value)} className={inputCls}>
              {PICKUP_OPTIONS.map((o) => <option key={o}>{o}</option>)}
            </select>
          </label>
        )}
        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      </div>
    </Modal>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";
