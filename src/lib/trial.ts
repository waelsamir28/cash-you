/**
 * إعدادات الفترة التجريبية وحدود الاستخدام.
 * تُطبَّق هذه الحدود على الخادم داخل مسارات الـ API، فلا يمكن تجاوزها من المتصفح.
 */

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

export type TrialStatus = {
  /** هل التطبيق ما زال في الفترة التجريبية (كل الحدود سارية) */
  trial: boolean;
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

/** حساب حالة التجربة من تاريخ البداية دون أي حالة إضافية. */
export function computeTrial(startedAt: Date | null, usage: Record<TrialLimitKey, number>, now = new Date()): TrialStatus {
  if (!startedAt) {
    return {
      trial: true,
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
  return `انتهت الفترة التجريبية (${TRIAL_DAYS} يوماً). للاستمرار في استخدام البرنامج يرجى تفعيل النسخة الكاملة مع الدعم الفني.`;
}
