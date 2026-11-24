import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import {
  customers,
  expenses,
  installmentPlans,
  installments,
  invoices,
  products,
  settings,
  suppliers,
  treasuryMovements,
  shifts,
} from "@/db/schema";

const isoDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

export async function ensureExtendedSeed() {
  const flag = await db.select().from(settings).where(eq(settings.key, "seeded_v2")).limit(1);
  if (flag.length) return;

  await db.update(products).set({
    wholesalePrice: sql`round((${products.price} * 0.9)::numeric, 2)::double precision`,
    minStockLimit: 20,
  });
  await db.update(customers).set({ openingBalance: sql`${customers.balance}` });

  await db.insert(suppliers).values([
    { name: "شركة المتحدة للورق", phone: "01023456781", address: "القاهرة - العتبة", openingBalance: 1800, balance: 1800 },
    { name: "مكتب النيل للتوريدات", phone: "01145678902", address: "طنطا - شارع الجلاء", openingBalance: 0, balance: 0 },
    { name: "الدلتا لأدوات الكمبيوتر", phone: "01234509876", address: "المنصورة - الجمهورية", openingBalance: 750, balance: 750 },
    { name: "مؤسسة المستقبل للأدوات المكتبية", phone: "01567890123", address: "المحلة الكبرى", openingBalance: 0, balance: 0 },
  ]);

  const cust = await db.select().from(customers).orderBy(customers.id);
  const school = cust.find((c) => c.name.includes("مدرسة")) ?? cust[1] ?? cust[0];
  if (school) {
    const principal = 3600;
    const down = 600;
    const interest = 240;
    const monthly = 810;
    const plan = await db.insert(installmentPlans).values({
      invoiceNumber: 4014,
      customerId: school.id,
      customerName: school.name,
      principal,
      downPayment: down,
      interestRate: 8,
      interestValue: interest,
      months: 4,
      monthlyAmount: monthly,
      firstDueDate: isoDay(-1),
      guarantorName: "أ / أحمد سالم",
      guarantorPhone: "01033445566",
    }).returning({ id: installmentPlans.id });
    await db.insert(installments).values([
      { planId: plan[0].id, customerId: school.id, customerName: school.name, sequence: 1, dueDate: isoDay(-1), amount: monthly },
      { planId: plan[0].id, customerId: school.id, customerName: school.name, sequence: 2, dueDate: isoDay(0), amount: monthly },
      { planId: plan[0].id, customerId: school.id, customerName: school.name, sequence: 3, dueDate: isoDay(30), amount: monthly },
      { planId: plan[0].id, customerId: school.id, customerName: school.name, sequence: 4, dueDate: isoDay(60), amount: monthly },
    ]);
    await db.update(customers).set({ balance: sql`${customers.balance} + ${monthly * 4}` }).where(eq(customers.id, school.id));
  }

  await db.insert(expenses).values([
    { number: 1001, category: "كهرباء", amount: 320, notes: "فاتورة كهرباء الفرع الرئيسي" },
    { number: 1002, category: "نثريات", amount: 85, notes: "أكياس وتغليف ومشروبات للعملاء" },
  ]);

  const oldInvoices = await db.select().from(invoices);
  await db.insert(treasuryMovements).values([
    { direction: "وارد", source: "رصيد افتتاحي", reference: "خزينة-1", partyName: "الخزينة الرئيسية", amount: 5000, notes: "رصيد بداية التشغيل" },
    ...oldInvoices.filter((i) => i.paid > 0).map((i) => ({
      direction: "وارد", source: "مبيعات", reference: `بيع-${i.number}`,
      partyName: i.customerName, amount: i.paid, notes: `تحصيل من فاتورة مبيعات ${i.number}`,
      createdAt: i.createdAt,
    })),
    { direction: "منصرف", source: "مصروفات", reference: "مصروف-1001", partyName: "كهرباء", amount: 320, notes: "فاتورة كهرباء الفرع الرئيسي" },
    { direction: "منصرف", source: "مصروفات", reference: "مصروف-1002", partyName: "نثريات", amount: 85, notes: "أكياس وتغليف" },
  ]);

  await db.insert(shifts).values({ number: 1, openingCash: 5000, status: "مفتوحة" });
  await db.insert(settings).values([
    { key: "seeded_v2", value: new Date().toISOString() },
    { key: "next_purchase", value: "7001" },
    { key: "next_return", value: "9001" },
    { key: "next_voucher", value: "3001" },
    { key: "next_expense", value: "1003" },
  ]).onConflictDoNothing();
}