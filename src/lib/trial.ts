/**
 * إعدادات الفترة التجريبية وحدود الاستخدام.
 * تُطبَّق هذه الحدود على الخادم داخل مسارات الـ API، فلا يمكن تجاوزها من المتصفح.
 */

import type { LicenseInfo } from "@/lib/types";

export const TRIAL_DAYS = 15;

export const TRIAL_LIMITS = {
  products: 20,
  invoices: 20,
  customers: 20,
  suppliers: 20,
} as const;

export type TrialLimitKey = keyof typeof TRIAL_LIMITS;

export const LIMIT_LABEL: Record<TrialLimitKey, string> = {
  products: "الصنف",
  invoices: "الفاتورة",
  customers: "العميل",
  suppliers: "المورد",
};

/** نوع الترخيص المدفوع معرّف في types.ts لأن الواجهة تحتاجه أيضاً */
export type { LicenseInfo } from "@/lib/types";

export type TrialStatus = {
  /** هل التطبيق ما زال في الفترة التجريبية (كل الحدود سارية) */
  trial: boolean;
  /** هل النسخة مفعّلة بكود HMAC (الترخيص المدفوع) */
  licensed: boolean;
  /** تفاصيل الترخيص المدفوع */
  license: LicenseInfo;
  /** تاريخ بداية التجربة (ISO) أو null لو لم تبدأ بعد */
  startedAt: string | null;
  /** تاريخ انتهاء التجربة (ISO) أو null */
  endsAt: string | null;
  /** الأيام المتبقية (0 عند الانتهاء) */
  daysLeft: number;
  /** هل انتهت المدة */
  expired: boolean;
  /** الاستهلاك الحالي مقابل الحدود */
  usage: Record<TrialLimitKey, number>;
  limits: typeof TRIAL_LIMITS;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const EMPTY_LICENSE: LicenseInfo = { active: false, validUntil: null, daysLeft: 0 };

/** حساب حالة التجربة من تاريخ البداية دون أي حالة إضافية. */
export function computeTrial(
  startedAt: Date | null,
  usage: Record<TrialLimitKey, number>,
  now = new Date(),
  license: LicenseInfo = EMPTY_LICENSE,
): TrialStatus {
  /* الترخيص المدفوع الساري يلغي كل حدود التجربة */
  if (license.active) {
    return {
      trial: false,
      licensed: true,
      license,
      startedAt: startedAt ? startedAt.toISOString() : null,
      endsAt: license.validUntil,
      daysLeft: license.daysLeft,
      expired: false,
      usage,
      limits: TRIAL_LIMITS,
    };
  }

  if (!startedAt) {
    return {
      trial: true,
      licensed: false,
      license,
      startedAt: null,
      endsAt: null,
      daysLeft: TRIAL_DAYS,
      expired: false,
      usage,
      limits: TRIAL_LIMITS,
    };
  }
  const endsAt = new Date(startedAt.getTime() + TRIAL_DAYS * DAY_MS);
  const remainingMs = endsAt.getTime() - now.getTime();
  const daysLeft = remainingMs <= 0 ? 0 : Math.ceil(remainingMs / DAY_MS);
  return {
    trial: remainingMs > 0,
    licensed: false,
    license,
    startedAt: startedAt.toISOString(),
    endsAt: endsAt.toISOString(),
    daysLeft,
    expired: remainingMs <= 0,
    usage,
    limits: TRIAL_LIMITS,
  };
}

/** رسالة موحّدة عند الوصول للحد. */
export function limitMessage(key: TrialLimitKey): string {
  return `الفترة التجريبية محدودة بـ ${TRIAL_LIMITS[key]} ${LIMIT_LABEL[key]} فقط. للترقية لنسخة كاملة تواصل مع الدعم الفني.`;
}

export function expiredMessage(): string {
  return `انتهت الفترة التجريبية (${TRIAL_DAYS} يوماً). للاستمرار في استخدام البرنامج افتح صفحة «التفعيل» وأدخل كود التفعيل الخاص بالجهاز.`;
}
