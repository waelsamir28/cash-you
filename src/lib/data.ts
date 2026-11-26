import { db } from "@/db";
import { asc, desc, eq, sql } from "drizzle-orm";
import {
  categories,
  customers,
  expenses,
  installmentPlans,
  installments,
  invoiceItems,
  invoices,
  paymentMethods,
  products,
  purchases,
  returns,
  settings,
  shifts,
  suppliers,
  treasuryMovements,
  vouchers,
} from "@/db/schema";
import { ensureSeed } from "@/db/seed";
import { ensureExtendedSeed } from "@/db/extendedSeed";
import type { Bootstrap, InstallmentInput, SavedInvoice, TrialStatus } from "@/lib/types";

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

const iso = (d: Date | null) => d?.toISOString() ?? null;
const day = (d: Date) => d.toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** حالة الفترة التجريبية من جدول الإعدادات (دون طلبات إضافية من الواجهة). */
async function readTrial(): Promise<TrialStatus | undefined> {
  try {
    const { getTrialStatus } = await import("@/lib/auth");
    return await getTrialStatus();
  } catch {
    return undefined;
  }
}

export async function getBootstrap(): Promise<Bootstrap> {
  await ensureSeed();
  await ensureExtendedSeed();
  const [cats, prods, custs, sups, pays, invs, purs, rets, vouts, plans, dues, exps, cash, shiftRows, allItems] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(products).orderBy(asc(products.sortOrder)),
    db.select().from(customers).orderBy(asc(customers.id)),
    db.select().from(suppliers).orderBy(asc(suppliers.id)),
    db.select().from(paymentMethods).orderBy(asc(paymentMethods.id)),
    db.select().from(invoices).orderBy(desc(invoices.number)).limit(60),
    db.select().from(purchases).orderBy(desc(purchases.number)).limit(60),
    db.select().from(returns).orderBy(desc(returns.number)).limit(60),
    db.select().from(vouchers).orderBy(desc(vouchers.number)).limit(60),
    db.select().from(installmentPlans).orderBy(desc(installmentPlans.id)),
    db.select().from(installments).orderBy(asc(installments.dueDate), asc(installments.sequence)),
    db.select().from(expenses).orderBy(desc(expenses.number)).limit(60),
    db.select().from(treasuryMovements).orderBy(desc(treasuryMovements.id)),
    db.select().from(shifts).orderBy(desc(shifts.number)).limit(20),
    db.select().from(invoiceItems),
  ]);
  const planMap = new Map(plans.map((p) => [p.id, p.invoiceNumber]));
  const today = day(new Date());
  const isToday = (d: Date) => day(d) === today;
  const incoming = cash.filter((m) => m.direction === "وارد").reduce((s, m) => s + m.amount, 0);
  const outgoing = cash.filter((m) => m.direction === "منصرف").reduce((s, m) => s + m.amount, 0);
  const invMap = new Map(invs.map((i) => [i.id, i]));
  const productMap = new Map(prods.map((p) => [p.id, p]));
  const salesTotal = invs.reduce((s, i) => s + i.total, 0);
  const cogs = allItems.reduce((s, it) => invMap.has(it.invoiceId) ? s + it.qty * (productMap.get(it.productId ?? -1)?.cost ?? 0) : s, 0);
  const next = Number.parseInt(await getSetting("next_invoice", "1"), 10);
  const nextPurchase = Number.parseInt(await getSetting("next_purchase", "7001"), 10);
  const stripParty = <T extends { createdAt: Date }>(p: T) => { const { createdAt: _createdAt, ...rest } = p; void _createdAt; return rest; };

  return {
    trial: await readTrial(),
    categories: cats,
    products: prods,
    customers: custs.map(stripParty),
    suppliers: sups.map(stripParty),
    paymentMethods: pays,
    invoices: invs.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })),
    purchases: purs.map((p) => ({ id: p.id, number: p.number, supplierId: p.supplierId, supplierName: p.supplierName, total: p.total, paid: p.paid, remaining: p.remaining, createdAt: p.createdAt.toISOString() })),
    returns: rets.map((r) => ({ id: r.id, number: r.number, kind: r.kind, referenceNumber: r.referenceNumber, partyName: r.partyName, total: r.total, cashAmount: r.cashAmount, createdAt: r.createdAt.toISOString() })),
    vouchers: vouts.map((v) => ({ id: v.id, number: v.number, kind: v.kind, partyType: v.partyType, partyName: v.partyName, amount: v.amount, notes: v.notes, createdAt: v.createdAt.toISOString() })),
    installmentPlans: plans.map((p) => ({ ...p, createdAt: undefined })).map(({ createdAt: _c, ...p }) => { void _c; return p; }),
    installments: dues.map((d) => ({ ...d, paidAt: iso(d.paidAt), invoiceNumber: planMap.get(d.planId) ?? 0 })),
    expenses: exps.map((e) => ({ id: e.id, number: e.number, category: e.category, amount: e.amount, notes: e.notes, createdAt: e.createdAt.toISOString() })),
    treasury: cash.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
    shifts: shiftRows.map((s) => ({ id: s.id, number: s.number, openedAt: s.openedAt.toISOString(), closedAt: iso(s.closedAt), openingCash: s.openingCash, closingCash: s.closingCash, sales: s.sales, purchases: s.purchases, expenses: s.expenses, receipts: s.receipts, payments: s.payments, status: s.status })),
    summary: {
      todaySales: r2(invs.filter((i) => isToday(i.createdAt)).reduce((s, i) => s + i.total, 0)),
      todayPurchases: r2(purs.filter((p) => isToday(p.createdAt)).reduce((s, p) => s + p.total, 0)),
      todayExpenses: r2(exps.filter((e) => isToday(e.createdAt)).reduce((s, e) => s + e.amount, 0)),
      treasury: r2(incoming - outgoing),
      todayReturns: r2(rets.filter((r) => isToday(r.createdAt)).reduce((s, r) => s + r.total, 0)),
      dueInstallments: dues.filter((d) => d.status !== "مدفوع" && d.dueDate <= today).length,
      grossProfit: r2(salesTotal - cogs),
    },
    nextInvoiceNumber: Number.isFinite(next) ? next : 1,
    nextPurchaseNumber: Number.isFinite(nextPurchase) ? nextPurchase : 7001,
    shop: {
      name: await getSetting("shop_name", "كاش يو للتجارة والتوريدات المكتبية"),
      phone: await getSetting("shop_phone", "01222355769"),
      address: await getSetting("shop_address", ""),
      logo: await getSetting("shop_logo", ""),
    },
  };
}

export type SavePayload = {
  customerId: number | null;
  customerName: string;
  paymentMethod: string;
  saleType: string;
  paid: number;
  /** المبلغ الزائد الذي يُنزَّل في رصيد العميل (دائن) — لا يدخل الخزينة */
  credit?: number;
  printed: boolean;
  installment?: InstallmentInput;
  items: { productId: number | null; code: string; name: string; unit: string; qty: number; price: number }[];
};

const addMonths = (dateText: string, n: number) => {
  const d = new Date(`${dateText}T12:00:00`);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

export async function saveInvoice(p: SavePayload): Promise<SavedInvoice> {
  await ensureSeed();
  await ensureExtendedSeed();
  if (p.saleType === "تقسيط" && (!p.customerId || !p.installment)) throw new Error("بيانات التقسيط والعميل مطلوبة");
  // لا يوجد خصم على الفاتورة: الإجمالي = مجموع الأسطر
  const rows = p.items.map((it) => {
    const lineTotal = r2(Math.max(0, it.price * it.qty));
    return { productId: it.productId, code: it.code, name: it.name, unit: it.unit, qty: it.qty, price: it.price, discount: 0, total: lineTotal };
  });
  const subtotal = r2(rows.reduce((s, r) => s + r.total, 0));
  const discountPercent = 0;
  const discountValue = 0;
  const total = subtotal;
  // المدفوع لا يتجاوز إجمالي الفاتورة؛ الزيادة تُعالج بالرصيد الدائن أو تُسلَّم للعميل
  const paid = r2(Math.max(0, Math.min(total, p.installment ? p.installment.downPayment : p.paid || 0)));
  const credit = p.installment ? 0 : r2(Math.max(0, p.credit || 0));
  if (credit > 0 && !p.customerId) throw new Error("اختر عميلاً لتنزيل الزيادة على حسابه");
  const remaining = r2(total - paid);
  const number = Number.parseInt(await getSetting("next_invoice", "1"), 10);
  const inserted = await db.insert(invoices).values({
    number, customerId: p.customerId, customerName: p.customerName || "عميل نقدي",
    paymentMethod: p.paymentMethod || "نقدي", saleType: p.saleType || "نقدي",
    subtotal, discountPercent, discountValue, total, paid, remaining,
    itemsCount: rows.length, printed: p.printed,
  }).returning({ id: invoices.id, createdAt: invoices.createdAt });
  const invoiceId = inserted[0].id;
  if (rows.length) await db.insert(invoiceItems).values(rows.map((r) => ({ ...r, invoiceId })));
  for (const r of rows) if (r.productId) await db.update(products).set({ stock: sql`${products.stock} - ${r.qty}` }).where(eq(products.id, r.productId));

  let interestValue = 0;
  let installmentPlanId: number | undefined;
  let installmentIds: number[] = [];
  if (p.installment && p.customerId) {
    const cfg = p.installment;
    const months = Math.max(1, Math.min(60, Math.floor(cfg.months)));
    const financed = Math.max(0, total - paid);
    interestValue = r2(financed * Math.max(0, cfg.interestRate) / 100);
    const planTotal = r2(financed + interestValue);
    const monthly = r2(planTotal / months);
    const plan = await db.insert(installmentPlans).values({
      invoiceNumber: number, customerId: p.customerId, customerName: p.customerName,
      principal: financed, downPayment: paid, interestRate: cfg.interestRate,
      interestValue, months, monthlyAmount: monthly, firstDueDate: cfg.firstDueDate,
      guarantorName: cfg.guarantorName, guarantorPhone: cfg.guarantorPhone,
    }).returning({ id: installmentPlans.id });
    installmentPlanId = plan[0].id;
    let allocated = 0;
    const dues = Array.from({ length: months }, (_, i) => {
      const amount = i === months - 1 ? r2(planTotal - allocated) : monthly;
      allocated = r2(allocated + amount);
      return { planId: plan[0].id, customerId: p.customerId!, customerName: p.customerName, sequence: i + 1, dueDate: addMonths(cfg.firstDueDate, i), amount };
    });
    installmentIds = (await db.insert(installments).values(dues).returning({ id: installments.id })).map((row) => row.id);
  }

  let newCustomerBalance = 0;
  if (p.customerId) {
    const current = await db.select().from(customers).where(eq(customers.id, p.customerId)).limit(1);
    newCustomerBalance = r2((current[0]?.balance ?? 0) + remaining + interestValue - credit);
    await db.update(customers).set({ balance: newCustomerBalance }).where(eq(customers.id, p.customerId));
  }
  if (paid > 0) await db.insert(treasuryMovements).values({ direction: "وارد", source: "مبيعات", reference: `بيع-${number}`, partyName: p.customerName || "عميل نقدي", amount: paid, notes: p.saleType === "تقسيط" ? "مقدم تعاقد تقسيط" : "مدفوع فاتورة مبيعات" });
  await setSetting("next_invoice", String(number + 1));
  return { id: invoiceId, number, total, paid, remaining, customerName: p.customerName || "عميل نقدي", createdAt: inserted[0].createdAt.toISOString(), newCustomerBalance, nextInvoiceNumber: number + 1, installmentPlanId, installmentIds };
}

export async function markInvoicePrinted(number: number): Promise<void> {
  await db.update(invoices).set({ printed: true }).where(eq(invoices.number, number));
}

export async function getInvoiceWithItems(number: number) {
  const inv = await db.select().from(invoices).where(eq(invoices.number, number)).limit(1);
  if (!inv[0]) return null;
  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv[0].id));
  return { invoice: inv[0], items };
}
