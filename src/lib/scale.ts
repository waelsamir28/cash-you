/**
 * ميزان الباركود: ملصقات EAN-13 تطبعها موازين المحلات بهذا الشكل:
 *   [بادئة] [كود الصنف 5 أرقام] [الوزن بالجرام أو السعر بالقرش 5 أرقام] [رقم التحقق]
 * مثال (بادئة 2 ووضع الوزن): 2 00012 01250 7 = صنف 12 وزن 1.250 كجم.
 * الدالة خالصة ولا تقرأ الإعدادات: تُرجع null إن لم يكن الكود ملصق ميزان.
 */
import type { ScalePrefs } from "@/lib/ui-prefs";

export type ScaleReading = { itemCode: string; value: number; mode: ScalePrefs["mode"] };

/** رقم التحقق لـ EAN-13: الأرقام في المواضع الفردية × 1 والزوجية × 3 */
export function ean13CheckDigit(twelve: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const d = Number(twelve[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

export function parseScaleCode(raw: string, prefs: ScalePrefs): ScaleReading | null {
  if (!prefs.enabled) return null;
  const code = raw.trim();
  if (code.length !== 13 || !/^\d{13}$/.test(code)) return null;
  const prefix = prefs.prefix || "2";
  if (!code.startsWith(prefix)) return null;
  if (ean13CheckDigit(code.slice(0, 12)) !== Number(code[12])) return null;
  const body = code.slice(prefix.length, 12); // بعد البادئة حتى قبل رقم التحقق
  if (body.length < 6) return null;
  const itemCode = body.slice(0, -5).replace(/^0+/, "") || "0";
  const value = Number(body.slice(-5));
  if (value <= 0) return null;
  return { itemCode, value, mode: prefs.mode };
}

/** مطابقة كود الصنف مع كود الميزان مع تجاهل الأصفار البادئة */
export function sameItemCode(productCode: string, itemCode: string): boolean {
  return productCode.trim().replace(/^0+/, "") === itemCode;
}

/** الكمية الناتجة من القراءة: الوزن بالكيلوجرام، أو السعر ÷ سعر الصنف */
export function scaleQty(reading: ScaleReading, unitPrice: number): number {
  if (reading.mode === "weight") return Math.round((reading.value / 1000) * 1000) / 1000;
  if (unitPrice <= 0) return 0;
  return Math.round((reading.value / 100 / unitPrice) * 1000) / 1000;
}
