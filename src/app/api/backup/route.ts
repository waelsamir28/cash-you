import { db } from "@/db";
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
  purchaseItems,
  returns,
  returnItems,
  settings,
  suppliers,
  treasuryMovements,
  vouchers,
} from "@/db/schema";
import { ensureDatabaseSchema } from "@/lib/ensure-schema";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

/** تصدير نسخة احتياطية كاملة (JSON) */
export const GET = withTenant(async () => {
  await ensureDatabaseSchema();
  const [
    cats, prods, custs, sups, pays, invs, invItems, purs, purItems,
    rets, retItems, vouts, plans, dues, exps, cash, setts,
  ] = await Promise.all([
    db.select().from(categories),
    db.select().from(products),
    db.select().from(customers),
    db.select().from(suppliers),
    db.select().from(paymentMethods),
    db.select().from(invoices),
    db.select().from(invoiceItems),
    db.select().from(purchases),
    db.select().from(purchaseItems),
    db.select().from(returns),
    db.select().from(returnItems),
    db.select().from(vouchers),
    db.select().from(installmentPlans),
    db.select().from(installments),
    db.select().from(expenses),
    db.select().from(treasuryMovements),
    db.select().from(settings),
  ]);

  const backup = {
    app: "CASH YOU",
    version: 1,
    exportedAt: new Date().toISOString(),
    counts: {
      products: prods.length,
      customers: custs.length,
      suppliers: sups.length,
      invoices: invs.length,
      purchases: purs.length,
    },
    data: {
      categories: cats,
      products: prods,
      customers: custs,
      suppliers: sups,
      paymentMethods: pays,
      invoices: invs,
      invoiceItems: invItems,
      purchases: purs,
      purchaseItems: purItems,
      returns: rets,
      returnItems: retItems,
      vouchers: vouts,
      installmentPlans: plans,
      installments: dues,
      expenses: exps,
      treasuryMovements: cash,
      settings: setts,
    },
  };

  return Response.json(backup);
});

/** استعادة نسخة احتياطية (مع معاينة قبل التنفيذ) */
export const POST = withTenant(async (req: Request) => {
  try {
    const body = (await req.json()) as { preview?: boolean; data?: Record<string, unknown[]> };
    if (!body.data) return Response.json({ error: "ملف النسخة غير صالح" }, { status: 400 });

    if (body.preview) {
      const counts: Record<string, number> = {};
      for (const [key, value] of Object.entries(body.data)) {
        counts[key] = Array.isArray(value) ? value.length : 0;
      }
      return Response.json({ preview: true, counts, exportedAt: (body as { exportedAt?: string }).exportedAt });
    }

    /* الاستعادة: حذف البيانات الحالية وإدراج النسخة */
    await ensureDatabaseSchema();
    const d = body.data as Record<string, Record<string, unknown>[]>;

    /* ترتيب الحذف: الأبناء أولاً */
    await db.delete(invoiceItems);
    await db.delete(purchaseItems);
    await db.delete(returnItems);
    await db.delete(installments);
    await db.delete(invoices);
    await db.delete(purchases);
    await db.delete(returns);
    await db.delete(installmentPlans);
    await db.delete(vouchers);
    await db.delete(expenses);
    await db.delete(treasuryMovements);
    await db.delete(products);
    await db.delete(customers);
    await db.delete(suppliers);
    await db.delete(paymentMethods);
    await db.delete(categories);

    /* ترتيب الإدراج: الآباء أولاً */
    if (d.categories?.length) await db.insert(categories).values(d.categories as typeof categories.$inferInsert[]);
    if (d.paymentMethods?.length) await db.insert(paymentMethods).values(d.paymentMethods as typeof paymentMethods.$inferInsert[]);
    if (d.customers?.length) await db.insert(customers).values(d.customers as typeof customers.$inferInsert[]);
    if (d.suppliers?.length) await db.insert(suppliers).values(d.suppliers as typeof suppliers.$inferInsert[]);
    if (d.products?.length) await db.insert(products).values(d.products as typeof products.$inferInsert[]);
    if (d.invoices?.length) await db.insert(invoices).values(d.invoices as typeof invoices.$inferInsert[]);
    if (d.invoiceItems?.length) await db.insert(invoiceItems).values(d.invoiceItems as typeof invoiceItems.$inferInsert[]);
    if (d.purchases?.length) await db.insert(purchases).values(d.purchases as typeof purchases.$inferInsert[]);
    if (d.purchaseItems?.length) await db.insert(purchaseItems).values(d.purchaseItems as typeof purchaseItems.$inferInsert[]);
    if (d.returns?.length) await db.insert(returns).values(d.returns as typeof returns.$inferInsert[]);
    if (d.returnItems?.length) await db.insert(returnItems).values(d.returnItems as typeof returnItems.$inferInsert[]);
    if (d.vouchers?.length) await db.insert(vouchers).values(d.vouchers as typeof vouchers.$inferInsert[]);
    if (d.installmentPlans?.length) await db.insert(installmentPlans).values(d.installmentPlans as typeof installmentPlans.$inferInsert[]);
    if (d.installments?.length) await db.insert(installments).values(d.installments as typeof installments.$inferInsert[]);
    if (d.expenses?.length) await db.insert(expenses).values(d.expenses as typeof expenses.$inferInsert[]);
    if (d.treasuryMovements?.length) await db.insert(treasuryMovements).values(d.treasuryMovements as typeof treasuryMovements.$inferInsert[]);

    return Response.json({ ok: true, restoredAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "تعذرت الاستعادة" }, { status: 500 });
  }
});
