import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invoiceItems, invoices, products, purchaseItems, purchases, returnItems, returns, stockAdjustments } from "@/db/schema";
import { writeAudit } from "@/lib/audit";

const r3 = (n: number) => Math.round(n * 1000) / 1000;

export type CountLine = { productId: number; actual: number };

/**
 * تطبيق الجرد: لكل صنف يُقارن الرصيد الفعلي بالرصيد الحالي في النظام وقت الحفظ،
 * ويُكتب الفرق كتسوية مخزون مع اسم المستخدم، ويُسجَّل الجرد كله في سجل النشاط.
 */
export async function applyStockCount(lines: CountLine[], actorName: string, reason = "جرد"): Promise<{ changed: number; adjustments: { name: string; before: number; after: number; diff: number }[] }> {
  for (const line of lines) {
    if (!Number.isInteger(line.productId) || !Number.isFinite(line.actual) || line.actual < 0) {
      throw new Error("بيانات الجرد غير صالحة");
    }
  }
  return db.transaction(async (tx) => {
    const adjustments: { name: string; before: number; after: number; diff: number }[] = [];
    for (const line of lines) {
      const [product] = await tx.select().from(products).where(eq(products.id, line.productId)).limit(1);
      if (!product) throw new Error(`الصنف رقم ${line.productId} غير موجود`);
      const after = r3(line.actual);
      const before = r3(product.stock);
      const diff = r3(after - before);
      if (diff === 0) continue;
      await tx.update(products).set({ stock: after }).where(eq(products.id, product.id));
      await tx.insert(stockAdjustments).values({ productId: product.id, productName: product.name, before, after, diff, reason, userName: actorName });
      adjustments.push({ name: product.name, before, after, diff });
    }
    if (adjustments.length) {
      await writeAudit(tx, actorName, "جرد مخزون", "أصناف", `${adjustments.length} صنف`, JSON.stringify(adjustments));
    }
    return { changed: adjustments.length, adjustments };
  });
}

export type MovementRow = {
  at: string;
  type: string;
  reference: string;
  party: string;
  delta: number;
  balanceAfter: number;
};

/** حركات الصنف (بيع، شراء، مرتجعات، جرد) مرتبة من الأحدث، مع الرصيد بعد كل حركة */
export async function productMovements(productId: number): Promise<{ product: { id: number; code: string; name: string; unit: string; stock: number } | null; rows: MovementRow[] }> {
  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) return { product: null, rows: [] };

  const [sold, bought, returned, counted] = await Promise.all([
    db
      .select({ number: invoices.number, at: invoices.createdAt, party: invoices.customerName, qty: invoiceItems.qty })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoices.id, invoiceItems.invoiceId))
      .where(eq(invoiceItems.productId, productId)),
    db
      .select({ number: purchases.number, at: purchases.createdAt, party: purchases.supplierName, qty: purchaseItems.qty })
      .from(purchaseItems)
      .innerJoin(purchases, eq(purchases.id, purchaseItems.purchaseId))
      .where(eq(purchaseItems.productId, productId)),
    db
      .select({ number: returns.number, kind: returns.kind, at: returns.createdAt, party: returns.partyName, qty: returnItems.qty })
      .from(returnItems)
      .innerJoin(returns, eq(returns.id, returnItems.returnId))
      .where(eq(returnItems.productId, productId)),
    db.select().from(stockAdjustments).where(eq(stockAdjustments.productId, productId)),
  ]);

  const raw: { at: Date; type: string; reference: string; party: string; delta: number }[] = [
    ...sold.map((r) => ({ at: r.at, type: "بيع", reference: `فاتورة ${r.number}`, party: r.party, delta: -r.qty })),
    ...bought.map((r) => ({ at: r.at, type: "شراء", reference: `شراء ${r.number}`, party: r.party, delta: r.qty })),
    ...returned.map((r) =>
      r.kind === "مرتجع مبيعات"
        ? { at: r.at, type: "مرتجع مبيعات", reference: `مرتجع ${r.number}`, party: r.party, delta: r.qty }
        : { at: r.at, type: "مرتجع مشتريات", reference: `مرتجع ${r.number}`, party: r.party, delta: -r.qty },
    ),
    ...counted.map((r) => ({ at: r.createdAt, type: "جرد", reference: r.reason || "جرد", party: r.userName, delta: r.diff })),
  ];
  raw.sort((a, b) => b.at.getTime() - a.at.getTime());

  let running = r3(product.stock);
  const rows: MovementRow[] = raw.map((row) => {
    const out = { at: row.at.toISOString(), type: row.type, reference: row.reference, party: row.party, delta: r3(row.delta), balanceAfter: running };
    running = r3(running - row.delta);
    return out;
  });

  return { product: { id: product.id, code: product.code, name: product.name, unit: product.unit, stock: product.stock }, rows };
}

