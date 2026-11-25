import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import {
  customers,
  products,
  settings,
  suppliers,
  shifts,
} from "@/db/schema";

export async function ensureExtendedSeed() {
  /* قاعدة جديدة تماماً — ننشئ المخطط أولاً */
  const { ensureDatabaseSchema } = await import("@/lib/ensure-schema");
  await ensureDatabaseSchema();
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

  /* النسخة التجريبية تبدأ بخزينة صفرية وبلا فواتير أو مصروفات أو تعاقدات تجريبية،
     حتى تكون كل أرقام الشاشة ناتجة عن استخدام العميل الفعلي. */
  await db.insert(shifts).values({ number: 1, openingCash: 0, status: "مفتوحة" });
  await db.insert(settings).values([
    { key: "seeded_v2", value: new Date().toISOString() },
    { key: "next_purchase", value: "7001" },
    { key: "next_return", value: "9001" },
    { key: "next_voucher", value: "3001" },
    { key: "next_expense", value: "1003" },
  ]).onConflictDoNothing();
}
