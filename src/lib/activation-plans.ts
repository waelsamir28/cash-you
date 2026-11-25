/*
 * ثوابت باقات التفعيل — موديول نقي (بدون أي استيراد من الخادم).
 *
 * لماذا هذا الملف منفصل؟
 * صفحة التفعيل (ActivationScreen) مكوّن عميل (client component). لو استوردت
 * من `@/lib/activation` لتجلب ثوابت الباقات، فسحب الملف `node:crypto` و
 * `@/lib/data` ← `@/db` ← `pg` (net/dns/fs) داخل حزمة المتصفح، فيفشل بناء
 * Next.js. لذلك كل الثوابت التي تحتاجها الواجهة موجودة هنا.
 */

/**
 * الباقات المتاحة بالأيام.
 * 365 = سنة · 730 = سنتان · 36500 = مدى الحياة (100 سنة عملياً بلا انتهاء).
 */
export const ACTIVATION_PLANS = [365, 730, 36500] as const;
export type ActivationPlan = (typeof ACTIVATION_PLANS)[number];

export const DEFAULT_ACTIVATION_PLAN: ActivationPlan = 365;

export const PLAN_LABEL: Record<ActivationPlan, string> = {
  365: "سنة",
  730: "سنتان",
  36500: "مدى الحياة",
};

/** بيانات الباقات التجارية المعروضة في صفحة التفعيل */
export type PlanInfo = {
  days: ActivationPlan;
  label: string;
  /** السعر بالجنيه المصري */
  price: number;
  /** مدة مختصرة للعرض */
  period: string;
  /** شارة تمييز */
  badge?: string;
  /** أهم الميزات */
  features: string[];
};

export const PLAN_CATALOG: PlanInfo[] = [
  {
    days: 365,
    label: "سنة",
    price: 1000,
    period: "١٢ شهراً",
    features: [
      "كل وحدات البرنامج مفتوحة",
      "عدد أصناف وعملاء غير محدود",
      "فواتير وطباعة بلا حدود",
      "تحديثات مجانية خلال السنة",
      "دعم فني على الهاتف",
    ],
  },
  {
    days: 730,
    label: "سنتان",
    price: 1500,
    period: "٢٤ شهراً",
    badge: "الأكثر طلباً",
    features: [
      "كل ميزات باقة السنة",
      "توفير ٥٠٠ ج على السعر السنوي",
      "أولوية في الدعم الفني",
      "نسخة احتياطية سحابية",
      "تدريب سريع على البرنامج",
    ],
  },
  {
    days: 36500,
    label: "مدى الحياة",
    price: 2500,
    period: "بلا انتهاء",
    badge: "أفضل قيمة",
    features: [
      "كل ميزات باقة السنتين",
      "ترخيص دائم بلا تجديد",
      "تحديثات مجانية للأبد",
      "دعم فني دائم",
      "تثبيت على جهازك بلا قيود زمنية",
    ],
  },
];

export function isActivationPlan(value: unknown): value is ActivationPlan {
  return typeof value === "number" && (ACTIVATION_PLANS as readonly number[]).includes(value);
}
