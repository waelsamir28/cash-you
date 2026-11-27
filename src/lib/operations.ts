import { db } from "@/db";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import {
  customers,
  expenses,
  installments,
  products,
  purchaseItems,
  purchases,
  returnItems,
  returns,
  settings,
  shifts,
  suppliers,
  treasuryMovements,
  vouchers,
} from "@/db/schema";
import { getSetting, setSetting } from "@/lib/data";
import type { Party, Product } from "@/lib/types";

export const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const must = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
const today = () => new Date().toISOString().slice(0, 10);

export type ProductInput = Omit<Product, "id" | "sortOrder"> & { id?: number };

export async function upsertProduct(input: ProductInput) {
  must(input.name.trim(), "اسم الصنف مطلوب");
  must(input.code.trim(), "الباركود مطلوب");
  must(input.price >= 0 && input.cost >= 0, "الأسعار يجب ألا تكون سالبة");
  const values = {
    code: input.code.trim(), name: input.name.trim(), categoryId: input.categoryId,
    unit: input.unit, price: r2(input.price), wholesalePrice: r2(input.wholesalePrice),
    cost: r2(input.cost), stock: r2(input.stock), minStockLimit: r2(input.minStockLimit),
  };
  if (input.id) {
    const rows = await db.update(products).set(values).where(eq(products.id, input.id)).returning();
    must(rows[0], "الصنف غير موجود");
    return rows[0];
  }
  const max = await db.select({ n: sql<number>`coalesce(max(${products.sortOrder}),0)` }).from(products);
  return (await db.insert(products).values({ ...values, sortOrder: Number(max[0].n) + 1 }).returning())[0];
}

export async function deleteProduct(id: number) {
  await db.delete(products).where(eq(products.id, id));
}

export type PartyInput = Omit<Party, "id"> & { id?: number };

export async function upsertParty(kind: "customer" | "supplier", input: PartyInput) {
  must(input.name.trim(), "الاسم مطلوب");
  const table = kind === "customer" ? customers : suppliers;
  const values = {
    name: input.name.trim(), phone: input.phone.trim(), address: input.address.trim(),
    openingBalance: r2(input.openingBalance), balance: r2(input.balance),
  };
  if (input.id) return (await db.update(table).set(values).where(eq(table.id, input.id)).returning())[0];
  return (await db.insert(table).values(values).returning())[0];
}

export type TradeItem = { productId: number; qty: number; price: number };
export type TradeInput = {
  kind: "purchase" | "salesReturn" | "purchaseReturn";
  partyId: number;
  referenceNumber?: number | null;
  paid: number;
  discountPercent?: number;
  notes?: string;
  items: TradeItem[];
  /** عند دفع أكثر من المطلوب لمستند شراء: تسليم الباقي من المورد نقداً، أو خصمه من رصيد المورد */
  overMode?: "change" | "credit";
};

export async function saveTrade(input: TradeInput) {
  must(input.items.length > 0, "أضف صنفاً واحداً على الأقل");
  must(input.partyId > 0, input.kind === "purchase" || input.kind === "purchaseReturn" ? "اختر المورد" : "اختر العميل");
  const prods = await db.select().from(products);
  const byId = new Map(prods.map((p) => [p.id, p]));
  const rows = input.items.map((it) => {
    const p = byId.get(it.productId);
    must(p, "أحد الأصناف غير موجود");
    must(it.qty > 0, `الكمية غير صحيحة للصنف ${p!.name}`);
    return { product: p!, qty: it.qty, price: r2(it.price), total: r2(it.qty * it.price) };
  });
  const subtotal = r2(rows.reduce((s, r) => s + r.total, 0));
  const discountPercent = Math.min(100, Math.max(0, input.discountPercent ?? 0));
  const total = r2(subtotal - r2((subtotal * discountPercent) / 100));
  const cash = r2(Math.max(0, Math.min(total, input.paid)));
  // الزيادة فوق الإجمالي (للشراء فقط): لا تضيع، ويقرر المستخدم مصيرها
  const overpay = input.kind === "purchase" ? r2(Math.max(0, input.paid - total)) : 0;
  if (overpay > 0) must(input.overMode === "change" || input.overMode === "credit", "المدفوع أكبر من المطلوب: اختر تسليم الباقي أو التنزيل على الحساب");

  if (input.kind === "purchase") {
    const supplier = (await db.select().from(suppliers).where(eq(suppliers.id, input.partyId)).limit(1))[0];
    must(supplier, "المورد غير موجود");
    const number = Number(await getSetting("next_purchase", "7001"));
    const inserted = await db.insert(purchases).values({
      number, supplierId: supplier.id, supplierName: supplier.name, total, paid: cash,
      remaining: r2(total - cash), notes: input.notes ?? "",
    }).returning();
    await db.insert(purchaseItems).values(rows.map((r) => ({
      purchaseId: inserted[0].id, productId: r.product.id, code: r.product.code,
      name: r.product.name, unit: r.product.unit, qty: r.qty, price: r.price, total: r.total,
    })));
    for (const r of rows) {
      await db.update(products).set({ stock: sql`${products.stock} + ${r.qty}`, cost: r.price })
        .where(eq(products.id, r.product.id));
    }
    const creditBack = overpay > 0 && input.overMode === "credit" ? overpay : 0;
    await db.update(suppliers).set({ balance: sql`${suppliers.balance} + ${r2(total - cash - creditBack)}` }).where(eq(suppliers.id, supplier.id));
    if (cash > 0) await db.insert(treasuryMovements).values({ direction: "منصرف", source: "مشتريات", reference: `شراء-${number}`, partyName: supplier.name, amount: cash, notes: "مدفوع من فاتورة مشتريات" });
    if (overpay > 0 && input.overMode === "change") {
      await db.insert(treasuryMovements).values({ direction: "وارد", source: "مشتريات", reference: `شراء-${number}`, partyName: supplier.name, amount: overpay, notes: "باقي مسلَّم من المورد للزيادة في الدفع" });
    }
    if (creditBack > 0) {
      await db.update(purchases).set({ notes: `${input.notes ?? ""} — زيادة ${overpay} نُزّلت على حساب المورد`.trim() }).where(eq(purchases.id, inserted[0].id));
    }
    await setSetting("next_purchase", String(number + 1));
    return { number, subtotal, discountPercent, total, paid: cash, remaining: r2(total - cash), overpay, overMode: overpay > 0 ? input.overMode : undefined, partyName: supplier.name, previousBalance: Number(supplier.balance), overpayCredit: creditBack };
  }

  const isSales = input.kind === "salesReturn";
  const table = isSales ? customers : suppliers;
  const party = (await db.select().from(table).where(eq(table.id, input.partyId)).limit(1))[0];
  must(party, isSales ? "العميل غير موجود" : "المورد غير موجود");
  const number = Number(await getSetting("next_return", "9001"));
  const inserted = await db.insert(returns).values({
    number, kind: isSales ? "مرتجع مبيعات" : "مرتجع مشتريات",
    referenceNumber: input.referenceNumber ?? null, partyId: party.id, partyName: party.name,
    total, cashAmount: cash, notes: input.notes ?? "",
  }).returning();
  await db.insert(returnItems).values(rows.map((r) => ({
    returnId: inserted[0].id, productId: r.product.id, code: r.product.code,
    name: r.product.name, unit: r.product.unit, qty: r.qty, price: r.price, total: r.total,
  })));
  for (const r of rows) {
    if (isSales) {
      await db.update(products).set({ stock: sql`${products.stock} + ${r.qty}` }).where(eq(products.id, r.product.id));
    } else {
      const current = byId.get(r.product.id)!;
      must(current.stock >= r.qty, `الرصيد لا يسمح بمرتجع ${r.product.name}`);
      await db.update(products).set({ stock: sql`${products.stock} - ${r.qty}` }).where(eq(products.id, r.product.id));
    }
  }
  const credit = r2(total - cash);
  await db.update(table).set({ balance: sql`${table.balance} - ${credit}` }).where(eq(table.id, party.id));
  if (cash > 0) await db.insert(treasuryMovements).values({
    direction: isSales ? "منصرف" : "وارد", source: isSales ? "مرتجع مبيعات" : "مرتجع مشتريات",
    reference: `مرتجع-${number}`, partyName: party.name, amount: cash,
    notes: isSales ? "مبلغ مسترد نقداً للعميل" : "مبلغ مسترد نقداً من المورد",
  });
  await setSetting("next_return", String(number + 1));
  return { number, subtotal, discountPercent, total, paid: cash, remaining: credit, partyName: party.name, previousBalance: Number(party.balance) };
}

export async function saveVoucher(input: { kind: "receipt" | "payment"; partyId: number; amount: number; notes?: string }) {
  must(input.amount > 0, "قيمة السند يجب أن تكون أكبر من صفر");
  const isReceipt = input.kind === "receipt";
  const table = isReceipt ? customers : suppliers;
  const party = (await db.select().from(table).where(eq(table.id, input.partyId)).limit(1))[0];
  must(party, isReceipt ? "اختر العميل" : "اختر المورد");
  const number = Number(await getSetting("next_voucher", "3001"));
  await db.insert(vouchers).values({
    number, kind: isReceipt ? "سند قبض من عميل" : "سند صرف لمورد",
    partyType: isReceipt ? "عميل" : "مورد", partyId: party.id, partyName: party.name,
    amount: r2(input.amount), notes: input.notes ?? "",
  });
  await db.update(table).set({ balance: sql`${table.balance} - ${r2(input.amount)}` }).where(eq(table.id, party.id));
  await db.insert(treasuryMovements).values({
    direction: isReceipt ? "وارد" : "منصرف", source: isReceipt ? "سند قبض" : "سند صرف",
    reference: `سند-${number}`, partyName: party.name, amount: r2(input.amount), notes: input.notes ?? "",
  });
  await setSetting("next_voucher", String(number + 1));
  return { number, partyName: party.name, amount: r2(input.amount) };
}

export async function collectInstallment(id: number) {
  const row = (await db.select().from(installments).where(eq(installments.id, id)).limit(1))[0];
  must(row, "القسط غير موجود");
  must(row.status !== "مدفوع", "هذا القسط محصل بالفعل");
  await db.update(installments).set({ status: "مدفوع", paidAt: new Date() }).where(eq(installments.id, id));
  await db.update(customers).set({ balance: sql`${customers.balance} - ${row.amount}` }).where(eq(customers.id, row.customerId));
  const ref = `قسط-${row.planId}-${row.sequence}`;
  await db.insert(treasuryMovements).values({ direction: "وارد", source: "تحصيل أقساط", reference: ref, partyName: row.customerName, amount: row.amount, notes: `القسط رقم ${row.sequence} المستحق ${row.dueDate}` });
  return { ...row, reference: ref, paidAt: new Date().toISOString() };
}

export async function addExpense(input: { category: string; amount: number; notes?: string }) {
  must(input.category.trim(), "اختر نوع المصروف");
  must(input.amount > 0, "قيمة المصروف يجب أن تكون أكبر من صفر");
  const number = Number(await getSetting("next_expense", "1003"));
  await db.insert(expenses).values({ number, category: input.category, amount: r2(input.amount), notes: input.notes ?? "" });
  await db.insert(treasuryMovements).values({ direction: "منصرف", source: "مصروفات", reference: `مصروف-${number}`, partyName: input.category, amount: r2(input.amount), notes: input.notes ?? "" });
  await setSetting("next_expense", String(number + 1));
  return { number, amount: r2(input.amount) };
}

export async function closeShift(notes = "") {
  const open = (await db.select().from(shifts).where(eq(shifts.status, "مفتوحة")).orderBy(asc(shifts.id)).limit(1))[0];
  must(open, "لا توجد وردية مفتوحة");
  const movements = await db.select().from(treasuryMovements).where(gte(treasuryMovements.createdAt, open.openedAt));
  const sum = (direction: string, sources: string[]) => r2(movements.filter((m) => m.direction === direction && sources.includes(m.source)).reduce((s, m) => s + m.amount, 0));
  const incoming = r2(movements.filter((m) => m.direction === "وارد" && m.source !== "رصيد افتتاحي").reduce((s, m) => s + m.amount, 0));
  const outgoing = r2(movements.filter((m) => m.direction === "منصرف").reduce((s, m) => s + m.amount, 0));
  const closingCash = r2(open.openingCash + incoming - outgoing);
  const sales = sum("وارد", ["مبيعات"]);
  const purchaseCash = sum("منصرف", ["مشتريات"]);
  const expenseCash = sum("منصرف", ["مصروفات"]);
  const receipts = sum("وارد", ["سند قبض", "تحصيل أقساط"]);
  const payments = sum("منصرف", ["سند صرف"]);
  await db.update(shifts).set({
    closedAt: new Date(), closingCash, sales,
    purchases: purchaseCash, expenses: expenseCash, receipts, payments,
    status: "مغلقة", notes,
  }).where(eq(shifts.id, open.id));
  const nextNumber = open.number + 1;
  await db.insert(shifts).values({ number: nextNumber, openingCash: closingCash, status: "مفتوحة" });
  return { number: open.number, closingCash, nextNumber, openingCash: open.openingCash, incoming, outgoing, sales, purchases: purchaseCash, expenses: expenseCash, receipts, payments };
}

export async function addMonths(day: string, months: number) {
  const d = new Date(`${day}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export { today };
