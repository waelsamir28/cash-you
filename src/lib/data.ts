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
import type { Bootstrap, InstallmentInput, SavedInvoice, ShopSettings, TrialStatus } from "@/lib/types";
import { ensureDatabaseSchema } from "@/lib/ensure-schema";

export async function getSetting(key: string, fallback = ""): Promise<string> {
  /* أعمق نقطة وصول لقاعدة البيانات: نضمن وجود المخطط قبل أي استعلام */
  await ensureDatabaseSchema();
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureDatabaseSchema();
  await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

/** إصدار البرنامج — يُقرأ من package.json ويُعرض في صفحة الدعم الفني */
async function readAppVersion(): Promise<string> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    /* في النشر standalone يكون package.json بجوار الجذر */
    const roots = [process.cwd(), join(process.cwd(), ".."), join(process.cwd(), "..", "..")];
    for (const root of roots) {
      try {
        const raw = await readFile(join(root, "package.json"), "utf8");
        const version = (JSON.parse(raw) as { version?: string }).version;
        if (version) return `v${version}`;
      } catch {
        /* جرّب المسار التالي */
      }
    }
  } catch {
    /* تجاهل — الإصدار اختياري */
  }
  return "غير معروف";
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

/** إعدادات المتجر والثيم — تُقرأ مرة واحدة مع بيانات النظام */
async function readSettings(): Promise<ShopSettings> {
  const { mergeSettings } = await import("@/lib/settings");
  const raw = await getSetting("app.settings.v1", "");
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  const merged = mergeSettings(parsed);
  /* اسم المحل يُقرأ من الإعدادات إن وُجد وإلا من المفتاح القديم */
  return merged;
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
    settings: await readSettings(),
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
    },
    appVersion: await readAppVersion(),
    /* معلومات عزل العميل — تُعرض في شاشة الدعم الفني */
    tenant: await readTenantInfo(),
  };
}

/** معلومات وحدة عزل العميل الحالي (للتشخيص) */
export async function readTenantInfo(): Promise<{
  key: string;
  kind: string;
  isolated: boolean;
}> {
  const { currentTenantContext, tenantModeEnabled } = await import("@/db/tenant-context");
  const tenant = currentTenantContext()?.tenant;
  const enabled = tenantModeEnabled();
  return {
    key: tenant?.key ?? "legacy",
    kind: tenant?.kind ?? "legacy",
    isolated: enabled && tenant?.kind !== "legacy",
  };
}

export type SavePayload = {
  customerId: number | null;
  customerName: string;
  paymentMethod: string;
  saleType: string;
  discountPercent: number;
  paid: number;
  printed: boolean;
  userName?: string;
  installment?: InstallmentInput;
  items: { productId: number | null; code: string; name: string; unit: string; qty: number; price: number; discount: number }[];
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
  let subtotal = 0;
  const rows = p.items.map((it) => {
    const lineTotal = r2(Math.max(0, it.price * it.qty - it.discount));
    subtotal += lineTotal;
    return { productId: it.productId, code: it.code, name: it.name, unit: it.unit, qty: it.qty, price: it.price, discount: it.discount, total: lineTotal };
  });
  subtotal = r2(subtotal);
  const discountPercent = Math.min(100, Math.max(0, p.discountPercent || 0));
  const discountValue = r2(subtotal * discountPercent / 100);
  const total = r2(subtotal - discountValue);
  const paid = r2(Math.max(0, p.installment ? p.installment.downPayment : p.paid || 0));
  /* المبلغ المطبَّق على الفاتورة لا يزيد عن إجماليها — الزيادة «باقٍ» يُسلَّم أو يُنزَّل من الحساب */
  const applied = r2(Math.min(paid, total));
  const remaining = r2(total - applied);
  const number = Number.parseInt(await getSetting("next_invoice", "1"), 10);
  const inserted = await db.insert(invoices).values({
    number, customerId: p.customerId, customerName: p.customerName || "عميل نقدي",
    paymentMethod: p.paymentMethod || "نقدي", saleType: p.saleType || "نقدي",
    subtotal, discountPercent, discountValue, total, paid, remaining,
    itemsCount: rows.length, printed: p.printed,
  }).returning({ id: invoices.id, createdAt: invoices.createdAt });
  const invoiceId = inserted[0].id;
  if (rows.length) await db.insert(invoiceItems).values(rows.map((r) => ({ ...r, invoiceId })));
  for (const r of rows) if (r.productId) {
    await db.update(products).set({ stock: sql`${products.stock} - ${r.qty}` }).where(eq(products.id, r.productId));
    const prod = await db.select().from(products).where(eq(products.id, r.productId)).limit(1);
    if (prod[0]) {
      await recordStockMovement({
        productId: r.productId,
        productCode: r.code,
        productName: r.name,
        movementType: "بيع",
        qty: -r.qty,
        balanceAfter: prod[0].stock,
        referenceType: "فاتورة",
        referenceNumber: number,
        userName: p.userName ?? "",
      });
    }
  }

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
    newCustomerBalance = r2((current[0]?.balance ?? 0) + remaining + interestValue);
    await db.update(customers).set({ balance: newCustomerBalance }).where(eq(customers.id, p.customerId));
  }
  if (applied > 0) await db.insert(treasuryMovements).values({ direction: "وارد", source: "مبيعات", reference: `بيع-${number}`, partyName: p.customerName || "عميل نقدي", amount: applied, notes: p.saleType === "تقسيط" ? "مقدم تعاقد تقسيط" : "مدفوع فاتورة مبيعات" });
  await setSetting("next_invoice", String(number + 1));
  return { id: invoiceId, number, total, paid, remaining, customerName: p.customerName || "عميل نقدي", createdAt: inserted[0].createdAt.toISOString(), newCustomerBalance, nextInvoiceNumber: number + 1, installmentPlanId, installmentIds };
}

/**
 * معالجة الباقي عندما يدفع العميل أكثر من إجمالي الفاتورة.
 *
 * handOver: يُخرج الباقي من الخزينة نقداً ويبقى رصيد العميل كما هو.
 * credit:   يُخصم الباقي من مديونية العميل (رصيده المدين).
 */
export async function settleOverpay(p: {
  invoiceNumber: number;
  action: "handOver" | "credit";
  amount: number;
}): Promise<{ ok: true; action: "handOver" | "credit"; amount: number; newCustomerBalance: number | null }> {
  const amount = r2(Math.max(0, p.amount));
  if (amount <= 0) throw new Error("قيمة الباقي غير صالحة");
  const rows = await db.select().from(invoices).where(eq(invoices.number, p.invoiceNumber)).limit(1);
  const inv = rows[0];
  if (!inv) throw new Error("الفاتورة غير موجودة");
  const already = await getSetting(`overpay.${p.invoiceNumber}`, "");
  if (already) throw new Error("سبق معالجة باقي هذه الفاتورة");

  let newCustomerBalance: number | null = null;
  if (p.action === "credit") {
    if (!inv.customerId) throw new Error("عميل نقدي — لا يوجد حساب لتنزيل الباقي فيه");
    const cur = await db.select().from(customers).where(eq(customers.id, inv.customerId)).limit(1);
    newCustomerBalance = r2((cur[0]?.balance ?? 0) - amount);
    await db.update(customers).set({ balance: newCustomerBalance }).where(eq(customers.id, inv.customerId));
  } else {
    /* تسليم الباقي نقداً: مبلغ يخرج من الدرج */
    await db.insert(treasuryMovements).values({
      direction: "منصرف",
      source: "باقي عميل",
      reference: `باقي-${p.invoiceNumber}`,
      partyName: inv.customerName,
      amount,
      notes: `تسليم باقي الفاتورة رقم ${p.invoiceNumber} نقداً`,
    });
  }
  await setSetting(`overpay.${p.invoiceNumber}`, p.action);
  return { ok: true, action: p.action, amount, newCustomerBalance };
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

/* ============================ مميزات FATORA المضافة ============================ */

import {
  activityLog,
  deletedInvoices,
  screenPermissions,
  stockMovements,
  suspendedInvoices,
} from "@/db/schema";
import type { ActivityEntry, DeletedInvoice, StockMovement, SuspendedInvoice } from "@/lib/types";

/** تسجيل حركة مخزون */
export async function recordStockMovement(input: {
  productId: number;
  productCode: string;
  productName: string;
  movementType: string;
  qty: number;
  balanceAfter: number;
  referenceType?: string;
  referenceNumber?: number | null;
  userName?: string;
  notes?: string;
}): Promise<void> {
  await ensureDatabaseSchema();
  await db.insert(stockMovements).values({
    productId: input.productId,
    productCode: input.productCode,
    productName: input.productName,
    movementType: input.movementType,
    qty: input.qty,
    balanceAfter: input.balanceAfter,
    referenceType: input.referenceType ?? "",
    referenceNumber: input.referenceNumber ?? null,
    userName: input.userName ?? "",
    notes: input.notes ?? "",
  });
}

/** قائمة حركات المخزون (مع فلتر اختياري لصنف) */
export async function listStockMovements(productId?: number, limit = 200): Promise<StockMovement[]> {
  await ensureDatabaseSchema();
  const rows = productId
    ? await db.select().from(stockMovements).where(eq(stockMovements.productId, productId)).orderBy(desc(stockMovements.createdAt)).limit(limit)
    : await db.select().from(stockMovements).orderBy(desc(stockMovements.createdAt)).limit(limit);
  return rows.map((r) => ({ ...r, createdAt: iso(r.createdAt) ?? "" }));
}

/** تسجيل نشاط في سجل الرقابة */
export async function recordActivity(input: {
  userId?: number | null;
  userName?: string;
  action: string;
  entityType?: string;
  entityId?: number | null;
  details?: string;
}): Promise<void> {
  await ensureDatabaseSchema();
  await db.insert(activityLog).values({
    userId: input.userId ?? null,
    userName: input.userName ?? "",
    action: input.action,
    entityType: input.entityType ?? "",
    entityId: input.entityId ?? null,
    details: input.details ?? "",
  });
}

/** قائمة سجل النشاط */
export async function listActivity(limit = 200): Promise<ActivityEntry[]> {
  await ensureDatabaseSchema();
  const rows = await db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit);
  return rows.map((r) => ({ ...r, createdAt: iso(r.createdAt) ?? "" }));
}

/** حذف فاتورة بأمان: ينقلها لسجل المحذوفات ويعكس أثرها */
export async function deleteInvoiceSafely(number: number, reason: string, deletedBy: string): Promise<{ ok: boolean; error?: string }> {
  await ensureDatabaseSchema();
  const data = await getInvoiceWithItems(number);
  if (!data) return { ok: false, error: "الفاتورة غير موجودة" };
  const { invoice, items } = data;

  /* حفظ نسخة في سجل المحذوفات */
  await db.insert(deletedInvoices).values({
    invoiceNumber: invoice.number,
    customerName: invoice.customerName,
    total: invoice.total,
    itemsJson: JSON.stringify(items),
    deleteReason: reason,
    deletedBy,
  });

  /* عكس أثر الفاتورة: إعادة الرصيد للعميل وإعادة المخزون */
  if (invoice.customerId) {
    await db.update(customers).set({
      balance: sql`${customers.balance} - ${invoice.remaining}`,
    }).where(eq(customers.id, invoice.customerId));
  }
  for (const item of items) {
    if (item.productId) {
      await db.update(products).set({
        stock: sql`${products.stock} + ${item.qty}`,
      }).where(eq(products.id, item.productId));
      const prod = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
      if (prod[0]) {
        await recordStockMovement({
          productId: item.productId,
          productCode: item.code,
          productName: item.name,
          movementType: "عكس بيع",
          qty: item.qty,
          balanceAfter: prod[0].stock,
          referenceType: "فاتورة محذوفة",
          referenceNumber: invoice.number,
          userName: deletedBy,
          notes: reason,
        });
      }
    }
  }

  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoice.id));
  await db.delete(invoices).where(eq(invoices.id, invoice.id));
  await recordActivity({
    userName: deletedBy,
    action: "حذف فاتورة",
    entityType: "invoice",
    entityId: invoice.id,
    details: `فاتورة رقم ${invoice.number} — السبب: ${reason}`,
  });
  return { ok: true };
}

/** قائمة الفواتير المحذوفة */
export async function listDeletedInvoices(limit = 100): Promise<DeletedInvoice[]> {
  await ensureDatabaseSchema();
  const rows = await db.select().from(deletedInvoices).orderBy(desc(deletedInvoices.deletedAt)).limit(limit);
  return rows.map((r) => ({ ...r, deletedAt: iso(r.deletedAt) ?? "" }));
}

/** إنشاء فاتورة معلقة */
export async function createSuspended(title: string, draftJson: string, userName: string): Promise<SuspendedInvoice> {
  await ensureDatabaseSchema();
  const rows = await db.insert(suspendedInvoices).values({ title, draftJson, userName }).returning();
  const r = rows[0];
  return { ...r, createdAt: iso(r.createdAt) ?? "", updatedAt: iso(r.updatedAt) ?? "" };
}

/** قائمة الفواتير المعلقة */
export async function listSuspended(): Promise<SuspendedInvoice[]> {
  await ensureDatabaseSchema();
  const rows = await db.select().from(suspendedInvoices).orderBy(desc(suspendedInvoices.updatedAt));
  return rows.map((r) => ({ ...r, createdAt: iso(r.createdAt) ?? "", updatedAt: iso(r.updatedAt) ?? "" }));
}

/** حذف فاتورة معلقة */
export async function deleteSuspended(id: number): Promise<void> {
  await ensureDatabaseSchema();
  await db.delete(suspendedInvoices).where(eq(suspendedInvoices.id, id));
}

/** صلاحيات الشاشات لمستخدم */
export async function getScreenPermissions(userId: number): Promise<string[]> {
  await ensureDatabaseSchema();
  const rows = await db.select().from(screenPermissions).where(eq(screenPermissions.userId, userId));
  return rows.filter((r) => r.allowed).map((r) => r.screenKind);
}

/** تعيين صلاحيات الشاشات لمستخدم */
export async function setScreenPermissions(userId: number, kinds: string[]): Promise<void> {
  await ensureDatabaseSchema();
  await db.delete(screenPermissions).where(eq(screenPermissions.userId, userId));
  for (const kind of kinds) {
    await db.insert(screenPermissions).values({ userId, screenKind: kind, allowed: true });
  }
}
