/**
 * صلاحيات الشاشات لكل حساب.
 * - المالك يملك كل الشاشات دائماً.
 * - الكاشير: إن لم يُضبط له شيء (null) يأخذ الافتراضي، وهو كل الشاشات التشغيلية
 *   ما عدا الجرد وحذف الفواتير وسجل النشاط (صلاحيات حساسة تُمنح يدوياً).
 * ملف مشترك بين الخادم والواجهة: لا يستورد أي شيء من الخادم.
 */

export const SCREENS = [
  { key: "sales", label: "فاتورة المبيعات ومرتجع المبيعات", hint: "البيع والفواتير المعلّقة والتحصيل" },
  { key: "purchases", label: "فاتورة المشتريات ومرتجع المشتريات", hint: "التوريد وحسابات الموردين" },
  { key: "products", label: "الأصناف والمخازن", hint: "إضافة الأصناف وتعديل الأسعار وكارت الصنف" },
  { key: "inventory", label: "الجرد", hint: "تعديل أرصدة المخزون بالجرد الفعلي" },
  { key: "parties", label: "العملاء والموردون", hint: "الكشوف والسندات والأرصدة" },
  { key: "installments", label: "نظام التقسيط", hint: "تحصيل الأقساط" },
  { key: "expenses", label: "المصروفات", hint: "تسجيل المصروفات" },
  { key: "treasury", label: "الخزينة", hint: "الوارد والمنصرف وإغلاق الوردية" },
  { key: "reports", label: "التقارير والأرباح", hint: "عرض الأرباح والتحليل" },
  { key: "invoiceDelete", label: "حذف الفواتير", hint: "حذف فاتورة بسبب مسجّل وعكس أثرها" },
  { key: "audit", label: "سجل النشاط", hint: "الاطلاع على من عمل ماذا ومتى" },
] as const;

export type ScreenKey = (typeof SCREENS)[number]["key"];

const ALL_KEYS = SCREENS.map((s) => s.key) as ScreenKey[];
const SENSITIVE: ScreenKey[] = ["inventory", "invoiceDelete", "audit"];

export const CASHIER_DEFAULT: ScreenKey[] = ALL_KEYS.filter((k) => !SENSITIVE.includes(k));

export function isScreenKey(value: unknown): value is ScreenKey {
  return typeof value === "string" && (ALL_KEYS as string[]).includes(value);
}

/** يحوّل النص المخزّن (JSON) إلى قائمة صلاحيات صالحة */
export function parseStoredPermissions(stored: string | null | undefined): ScreenKey[] | null {
  if (stored === null || stored === undefined || stored === "") return null;
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return null;
    return ALL_KEYS.filter((k) => parsed.includes(k));
  } catch {
    return null;
  }
}

/** الصلاحيات الفعلية لحساب بحسب دوره وما هو مخزّن له */
export function effectivePermissions(role: string, stored: string | null | undefined): ScreenKey[] {
  if (role === "owner") return [...ALL_KEYS];
  return parseStoredPermissions(stored) ?? [...CASHIER_DEFAULT];
}

export function can(user: { role: string; permissions?: ScreenKey[] } | null | undefined, key: ScreenKey): boolean {
  if (!user) return false;
  if (user.role === "owner") return true;
  /* جلسة قديمة محفوظة بدون قائمة صلاحيات: نستخدم الافتراضي */
  return (user.permissions ?? CASHIER_DEFAULT).includes(key);
}

/** الشاشة المطلوبة لكل عنصر في القائمة/الرئيسية، والعناصر المفتوحة للجميع غير مذكورة */
export const MODULE_SCREEN: Record<string, ScreenKey> = {
  invoice: "sales",
  salesReturn: "sales",
  lastInvoice: "sales",
  purchase: "purchases",
  purchaseReturn: "purchases",
  products: "products",
  parties: "parties",
  installments: "installments",
  expenses: "expenses",
  treasury: "treasury",
  reports: "reports",
  inventory: "inventory",
  audit: "audit",
};
