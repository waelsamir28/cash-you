/**
 * تفعيل الفترة التجريبية بكود HMAC-SHA256.
 *
 * الكود = أول 12 حرفاً من HMAC-SHA256(المفتاح السري, "كود الجهاز|المدة") بصيغة XXXX-XXXX-XXXX
 * نفس المفتاح ونفس الخوارزمية المستخدمة في tools/activation-generator.html فيبقى التوليد متوافقاً.
 *
 * التحقق يتم على الخادم فقط، فالمفتاح السري لا يُرسل للمتصفح أبداً.
 * كل كود يُستخدم مرة واحدة فقط (مخزّن في جدول settings بعد استهلاكه).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSetting, setSetting } from "@/lib/data";

/** المفتاح السري — يجب أن يطابق المفتاح المستخدم في أداة التوليد tools/activation-generator.html */
export const ACTIVATION_SECRET = process.env.CASH_YOU_ACTIVATION_SECRET?.trim() || "CASH_YOU_SECRET_KEY_2026_PRO";

/** المدد المتاحة بالأيام */
/** 365 = سنة، 730 = سنتين، 36500 = مدى الحياة (100 سنة) */
export const ACTIVATION_PLANS = [30, 90, 180, 365, 730, 36500] as const;
export type ActivationPlan = (typeof ACTIVATION_PLANS)[number];

export const DEFAULT_ACTIVATION_PLAN: ActivationPlan = 365;

export const PLAN_LABEL: Record<ActivationPlan, string> = {
  30: "شهر",
  90: "3 شهور",
  180: "6 شهور",
  365: "سنة",
  730: "سنتين",
  36500: "مدى الحياة",
};

export function isActivationPlan(value: unknown): value is ActivationPlan {
  return typeof value === "number" && (ACTIVATION_PLANS as readonly number[]).includes(value);
}

/** تطبيع كود الجهاز: إزالة المسافات + أحرف كبيرة */
export function normalizeDeviceCode(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/**
 * حساب الكود المتوقع لجهاز معين ومدة معينة.
 * يُستخدم للتوليد (أداة الدعم) وللتحقق (البرنامج).
 */
export function activationCodeFor(deviceCode: string, days: ActivationPlan = DEFAULT_ACTIVATION_PLAN): string {
  const device = normalizeDeviceCode(deviceCode);
  const hex = createHmac("sha256", ACTIVATION_SECRET)
    .update(`${device}|${days}`)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

/** تطبيع كود التفعيل الذي يكتبه المستخدم */
export function normalizeActivationCode(value: string): string {
  return value.replace(/[^0-9a-z]/gi, "").toUpperCase();
}

/** مقارنة آمنة زمنياً بين الكود المكتوب والكود المتوقع */
export function activationCodeMatches(input: string, deviceCode: string, days: ActivationPlan): boolean {
  const expected = normalizeActivationCode(activationCodeFor(deviceCode, days));
  const given = normalizeActivationCode(input);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(given, "utf8"));
}

/* ============================ حالة الترخيص المخزّنة ============================ */

const LICENSED_UNTIL_KEY = "license.validUntil";
const USED_CODES_KEY = "license.usedCodes";

export type LicenseState = {
  /** تاريخ انتهاء الترخيص المدفوع (ISO) أو null */
  validUntil: string | null;
  /** هل الترخيص المدفوع ساري الآن */
  active: boolean;
  /** الأيام المتبقية في الترخيص المدفوع */
  daysLeft: number;
};

export async function readLicense(now = new Date()): Promise<LicenseState> {
  const raw = await getSetting(LICENSED_UNTIL_KEY, "");
  const parsed = raw ? new Date(raw) : null;
  const validUntil = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  if (!validUntil) return { validUntil: null, active: false, daysLeft: 0 };
  const remainingMs = validUntil.getTime() - now.getTime();
  const daysLeft = remainingMs <= 0 ? 0 : Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
  return { validUntil: validUntil.toISOString(), active: remainingMs > 0, daysLeft };
}

async function readUsedCodes(): Promise<string[]> {
  const raw = await getSetting(USED_CODES_KEY, "");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export type ActivationFailure = "expired-plan" | "already-used" | "invalid-code" | "not-configured";

export type ActivationResult =
  | { ok: true; license: LicenseState; days: ActivationPlan }
  | { ok: false; reason: ActivationFailure; message: string };

/**
 * تحقّق من الكود ومدّد الترخيص.
 * الكود مرتبط بكود الجهاز والمدة معاً، ولا يُقبل كود مستهلك من قبل.
 */
export async function activateWithCode(input: {
  code: string;
  deviceCode: string;
  days: ActivationPlan;
  now?: Date;
}): Promise<ActivationResult> {
  const now = input.now ?? new Date();
  const deviceCode = normalizeDeviceCode(input.deviceCode);
  if (!deviceCode) {
    return { ok: false, reason: "not-configured", message: "كود الجهاز غير متوفر؛ افتح البرنامج من نسخة الويندوز أو الصق كود الجهاز يدوياً." };
  }

  if (!activationCodeMatches(input.code, deviceCode, input.days)) {
    return {
      ok: false,
      reason: "invalid-code",
      message: "كود التفعيل غير صحيح لهذا الجهاز أو لهذه المدة. تأكد من اختيار المدة التي صدر بها الكود.",
    };
  }

  const used = await readUsedCodes();
  const fingerprint = `${normalizeActivationCode(input.code)}@${deviceCode}`;
  if (used.includes(fingerprint)) {
    return { ok: false, reason: "already-used", message: "هذا الكود مستخدم من قبل على هذا الجهاز. اطلب كوداً جديداً من الدعم الفني." };
  }

  /* التمديد يبدأ من تاريخ انتهاء الترخيص الحالي إن كان ساريًا، وإلا من الآن */
  const current = await readLicense(now);
  const base = current.active && current.validUntil ? new Date(current.validUntil) : now;
  const validUntil = new Date(base.getTime() + input.days * 24 * 60 * 60 * 1000);

  await setSetting(LICENSED_UNTIL_KEY, validUntil.toISOString());
  await setSetting(USED_CODES_KEY, JSON.stringify([...used, fingerprint].slice(-200)));

  return {
    ok: true,
    days: input.days,
    license: await readLicense(now),
  };
}
