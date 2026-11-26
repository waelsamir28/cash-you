import { db } from "@/db";
import { sql } from "drizzle-orm";
import {
  categories,
  products,
  customers,
  paymentMethods,
  settings,
} from "@/db/schema";

type CatSeed = { name: string; hue: string };

const CATS: CatSeed[] = [
  { name: "أقلام جاف ورصاص", hue: "amber" },
  { name: "كراسات وكشاكيل", hue: "emerald" },
  { name: "أدوات مكتبية", hue: "cyan" },
  { name: "ألوان وأدوات رسم", hue: "rose" },
  { name: "حقائب ومقالم", hue: "violet" },
  { name: "ورق ودفاتر", hue: "orange" },
  { name: "مستلزمات كمبيوتر", hue: "sky" },
];

type ProdSeed = [code: string, name: string, cat: number, unit: string, price: number, stock: number];

const PRODS: ProdSeed[] = [
  ["1001", "قلم جاف أزرق بايك", 1, "قطعة", 5, 240],
  ["1002", "قلم جاف أحمر بايك", 1, "قطعة", 5, 180],
  ["1003", "قلم جاف أسود بايك", 1, "قطعة", 5, 300],
  ["1004", "قلم رصاص فابر كاستل HB", 1, "قطعة", 7.5, 420],
  ["1005", "قلم رصاص سن 2B", 1, "قطعة", 6, 150],
  ["1006", "قلم سائل أزرق 0.5", 1, "قطعة", 12, 96],
  ["1007", "قلم سبورة أزرق", 1, "قطعة", 15, 88],
  ["1008", "قلم سبورة أحمر", 1, "قطعة", 15, 64],
  ["1009", "قلم تحديد أصفر فوسفوري", 1, "قطعة", 18, 55],
  ["1010", "طقم أقلام جاف 10 قطع", 1, "طقم", 42, 40],
  ["1011", "سن قلم رصاص 0.5", 1, "علبة", 9, 120],
  ["1012", "قلم حبر بايلوت أزرق", 1, "قطعة", 28, 35],
  ["2001", "كراسة 60 ورقة سلك", 2, "قطعة", 22, 300],
  ["2002", "كراسة 100 ورقة سلك", 2, "قطعة", 32, 260],
  ["2003", "كشكول 200 ورقة مجلد", 2, "قطعة", 68, 90],
  ["2004", "كراسة رسم A4", 2, "قطعة", 35, 110],
  ["2005", "كراسة 40 ورقة عادي", 2, "قطعة", 14, 400],
  ["2006", "كشكول 80 ورقة سلك", 2, "قطعة", 27, 175],
  ["2007", "كراسة موسيقى", 2, "قطعة", 30, 45],
  ["2008", "بلوك نوت صغير", 2, "قطعة", 11, 210],
];

const CUSTOMERS: [name: string, phone: string, balance: number][] = [
  ["عميل نقدي", "", 0],
  ["مكتبة النور - طنطا", "01001234567", 1250],
  ["مدرسة الأمل الخاصة", "01118887766", 0],
  ["شركة الدلتا للتوريدات", "01234567890", 3480.5],
  ["أ / محمد عبد الرحمن", "01099887766", 0],
  ["سوبر ماركت الأصيل", "01277665544", 640],
  ["مكتبة الزمالك", "01555443322", 0],
];

const PAYMENTS = ["نقدي", "فيزا", "محفظة إلكترونية", "تحويل بنكي", "شيك"];

export async function ensureSeed(): Promise<void> {
  const flag = await db
    .select()
    .from(settings)
    .where(sql`${settings.key} = 'seeded_v1'`)
    .limit(1);
  if (flag.length > 0) return;

  await db.insert(categories).values(
    CATS.map((c, i) => ({ name: c.name, hue: c.hue, sortOrder: i })),
  );

  await db.insert(products).values(
    PRODS.map((p, i) => ({
      code: p[0],
      name: p[1],
      categoryId: p[2],
      unit: p[3],
      price: p[4],
      cost: Math.round(p[4] * 0.72 * 100) / 100,
      stock: p[5],
      sortOrder: i,
    })),
  );

  await db.insert(customers).values(
    CUSTOMERS.map((c) => ({ name: c[0], phone: c[1], balance: c[2] })),
  );

  await db.insert(paymentMethods).values(PAYMENTS.map((n) => ({ name: n })));

  // النسخة تبدأ بلا فواتير تاريخية: كل رقم يُنشئه العميل فعلياً

  await db.insert(settings).values([
    { key: "seeded_v1", value: new Date().toISOString() },
    { key: "next_invoice", value: "1" },
    { key: "shop_name", value: "كاش يو للتجارة والتوريدات المكتبية" },
    { key: "shop_phone", value: "01222355769" },
  ]);
}