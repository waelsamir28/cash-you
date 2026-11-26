import { db } from "@/db";
import { sql } from "drizzle-orm";
import {
  categories,
  products,
  customers,
  paymentMethods,
  invoices,
  invoiceItems,
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

  ["3001", "دباسة مكتبية كبيرة", 3, "قطعة", 85, 26],
  ["3002", "دبابيس 24/6", 3, "علبة", 8, 300],
  ["3003", "مقص مكتبي 8 بوصة", 3, "قطعة", 34, 62],
  ["3004", "شريط لاصق شفاف", 3, "قطعة", 9, 240],
  ["3005", "صمغ عصا 21 جم", 3, "قطعة", 16, 130],
  ["3006", "استيكة بيضاء", 3, "قطعة", 5, 380],
  ["3007", "براية معدن", 3, "قطعة", 7, 190],
  ["3008", "مشبك ورق 33 مم", 3, "علبة", 12, 145],
  ["3009", "حامل أقلام معدني", 3, "قطعة", 55, 30],
  ["3010", "ختم تاريخ دوّار", 3, "قطعة", 75, 18],
  ["3011", "منظم مكتب 3 أدراج", 3, "قطعة", 145, 12],

  ["4001", "علبة ألوان خشبية 12 لون", 4, "علبة", 48, 70],
  ["4002", "علبة ألوان خشبية 24 لون", 4, "علبة", 92, 44],
  ["4003", "ألوان فلوماستر 12 لون", 4, "علبة", 56, 58],
  ["4004", "ألوان أكريليك 6 أنابيب", 4, "طقم", 110, 22],
  ["4005", "فرشة رسم رقم 4", 4, "قطعة", 13, 96],
  ["4006", "باليتة ألوان بلاستيك", 4, "قطعة", 17, 40],
  ["4007", "قلم رصاص تلوين أسود", 4, "قطعة", 9, 88],

  ["5001", "شنطة ظهر مدرسية", 5, "قطعة", 385, 24],
  ["5002", "مقلمة قماش زيبر", 5, "قطعة", 45, 80],
  ["5003", "مقلمة بلاستيك دورين", 5, "قطعة", 62, 36],
  ["5004", "شنطة لابتوب 15 بوصة", 5, "قطعة", 420, 14],
  ["5005", "حافظة مستندات A4", 5, "قطعة", 25, 120],

  ["6001", "رزمة ورق A4 500 ورقة", 6, "رزمة", 165, 85],
  ["6002", "دفتر 200 ورقة مجلد", 6, "قطعة", 78, 60],
  ["6003", "ورق مقوى ملون A4", 6, "رزمة", 38, 74],
  ["6004", "ملف بلاستيك كبس", 6, "قطعة", 10, 260],
  ["6005", "فاصل ملفات ملون", 6, "طقم", 21, 95],
  ["6006", "ورق فاكس حراري", 6, "رول", 19, 130],
  ["6007", "دفتر إيصالات مرقم", 6, "قطعة", 26, 105],
  ["6008", "رول كاشير 80 مم", 6, "رول", 14, 320],

  ["7001", "فلاشة 32 جيجا", 7, "قطعة", 195, 42],
  ["7002", "ماوس لاسلكي", 7, "قطعة", 175, 33],
  ["7003", "كيبورد عربي USB", 7, "قطعة", 210, 21],
  ["7004", "وصلة HDMI 2 متر", 7, "قطعة", 120, 28],
  ["7005", "حبر طابعة أسود 803", 7, "قطعة", 340, 16],
  ["7006", "منظف شاشات 250 مل", 7, "قطعة", 48, 52],
  ["7007", "ماوس باد مريح", 7, "قطعة", 39, 66],
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

  // فواتير تاريخية للوحة الرئيسية
  const now = Date.now();
  const history: {
    number: number;
    customerName: string;
    method: string;
    type: string;
    lines: [string, number][];
    ago: number;
    paidFull: boolean;
  }[] = [
    {
      number: 4011,
      customerName: "مكتبة النور - طنطا",
      method: "تحويل بنكي",
      type: "آجل",
      lines: [["6001", 6], ["2002", 20], ["1010", 4]],
      ago: 3600_000 * 26,
      paidFull: false,
    },
    {
      number: 4012,
      customerName: "عميل نقدي",
      method: "نقدي",
      type: "نقدي",
      lines: [["1001", 12], ["2005", 6]],
      ago: 3600_000 * 20,
      paidFull: true,
    },
    {
      number: 4013,
      customerName: "شركة الدلتا للتوريدات",
      method: "فيزا",
      type: "نقدي",
      lines: [["7005", 3], ["7002", 5], ["6001", 10]],
      ago: 3600_000 * 7,
      paidFull: true,
    },
    {
      number: 4014,
      customerName: "مدرسة الأمل الخاصة",
      method: "نقدي",
      type: "آجل",
      lines: [["5001", 8], ["5002", 20], ["4001", 15]],
      ago: 3600_000 * 4,
      paidFull: false,
    },
    {
      number: 4015,
      customerName: "سوبر ماركت الأصيل",
      method: "محفظة إلكترونية",
      type: "نقدي",
      lines: [["6008", 40], ["3004", 12]],
      ago: 3600_000 * 1.5,
      paidFull: true,
    },
  ];

  const allProducts = await db.select().from(products);
  const byCode = new Map(allProducts.map((p) => [p.code, p]));

  for (const h of history) {
    let subtotal = 0;
    const rows = h.lines.map(([code, qty]) => {
      const p = byCode.get(code)!;
      const lineTotal = p.price * qty;
      subtotal += lineTotal;
      return {
        productId: p.id,
        code: p.code,
        name: p.name,
        unit: p.unit,
        qty,
        price: p.price,
        discount: 0,
        total: lineTotal,
      };
    });
    const total = Math.round(subtotal * 100) / 100;
    const paid = h.paidFull ? total : Math.round(total * 0.4 * 100) / 100;
    const inserted = await db
      .insert(invoices)
      .values({
        number: h.number,
        customerName: h.customerName,
        paymentMethod: h.method,
        saleType: h.type,
        subtotal,
        discountPercent: 0,
        discountValue: 0,
        total,
        paid,
        remaining: Math.round((total - paid) * 100) / 100,
        itemsCount: rows.length,
        printed: true,
        createdAt: new Date(now - h.ago),
      })
      .returning({ id: invoices.id });
    await db
      .insert(invoiceItems)
      .values(rows.map((r) => ({ ...r, invoiceId: inserted[0].id })));
  }

  await db.insert(settings).values([
    { key: "seeded_v1", value: new Date().toISOString() },
    { key: "next_invoice", value: "4016" },
    { key: "shop_name", value: "كاش يو للتجارة والتوريدات المكتبية" },
    { key: "shop_phone", value: "01222355769" },
  ]);
}