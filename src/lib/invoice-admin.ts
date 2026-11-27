import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, installmentPlans, invoiceItems, invoices, products, treasuryMovements } from "@/db/schema";
import { writeAudit } from "@/lib/audit";

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * حذف فاتورة مبيعات بسبب مسجّل، مع عكس أثرها:
 * - يرجع الكميات للمخزون.
 * - يعكس أثرها على رصيد العميل (الفواتير القديمة بدون أثر محفوظ تُعكس بالمتبقي).
 * - يسجّل حركة منصرف «إلغاء مبيعات» بقيمة المدفوع (لا تُحذف حركات الخزينة القديمة).
 * - يكتب نسخة كاملة من الفاتورة في سجل النشاط.
 * فواتير التقسيط لا تُحذف من هنا.
 */
export async function deleteInvoice(number: number, reason: string, actorName: string): Promise<{ number: number }> {
  const cleanReason = reason.trim();
  if (cleanReason.length < 3) throw new Error("اكتب سبب الحذف (3 أحرف على الأقل)");

  return db.transaction(async (tx) => {
    const [inv] = await tx.select().from(invoices).where(eq(invoices.number, number)).limit(1);
    if (!inv) throw new Error("الفاتورة غير موجودة");
    const plans = await tx.select({ id: installmentPlans.id }).from(installmentPlans).where(eq(installmentPlans.invoiceNumber, number)).limit(1);
    if (inv.saleType === "تقسيط" || plans.length) throw new Error("فواتير التقسيط لا تُحذف من هنا");

    const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));

    for (const item of items) {
      if (!item.productId) continue;
      const [product] = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
      if (product) await tx.update(products).set({ stock: r3(product.stock + item.qty) }).where(eq(products.id, product.id));
    }

    if (inv.customerId) {
      const [customer] = await tx.select().from(customers).where(eq(customers.id, inv.customerId)).limit(1);
      const effect = inv.balanceEffect ?? inv.remaining;
      if (customer) await tx.update(customers).set({ balance: r2(customer.balance - effect) }).where(eq(customers.id, customer.id));
    }

    if (inv.paid > 0) {
      await tx.insert(treasuryMovements).values({
        direction: "منصرف",
        source: "إلغاء مبيعات",
        reference: `إلغاء-بيع-${number}`,
        partyName: inv.customerName,
        amount: inv.paid,
        notes: `حذف الفاتورة رقم ${number}: ${cleanReason}`,
      });
    }

    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id));
    await tx.delete(invoices).where(eq(invoices.id, inv.id));

    const snapshot = {
      reason: cleanReason,
      createdAt: inv.createdAt.toISOString(),
      customerName: inv.customerName,
      paymentMethod: inv.paymentMethod,
      total: inv.total,
      paid: inv.paid,
      remaining: inv.remaining,
      balanceEffect: inv.balanceEffect,
      items: items.map((it) => ({ code: it.code, name: it.name, qty: it.qty, price: it.price, total: it.total })),
    };
    await writeAudit(tx, actorName, "حذف فاتورة", "فاتورة مبيعات", `فاتورة ${number}`, JSON.stringify(snapshot));
    return { number };
  });
}
