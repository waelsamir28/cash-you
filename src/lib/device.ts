"use client";

/**
 * كود الجهاز المستخدم في التفعيل:
 * - نسخة الويندوز: يُقرأ من Electron (بصمة MachineGuid).
 * - المتصفح: بصمة محلية ثابتة تُحفظ في localStorage.
 */
const DEVICE_STORAGE_KEY = "cash-you.device-id.v1";

type CashYouBridge = { getDeviceCode?: () => Promise<string> };

export function fallbackDeviceCode(): string {
  let value = window.localStorage.getItem(DEVICE_STORAGE_KEY);
  if (!value) {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
    window.localStorage.setItem(DEVICE_STORAGE_KEY, value);
  }
  const groups = value.match(/.{1,4}/g) ?? [value];
  return `CYD-${groups.join("-")}`;
}

export async function readDeviceCode(): Promise<{ code: string; desktop: boolean }> {
  const bridge = (window as unknown as { cashYou?: CashYouBridge }).cashYou;
  if (bridge?.getDeviceCode) {
    try {
      const code = await bridge.getDeviceCode();
      if (code) return { code: code.trim().toUpperCase(), desktop: true };
    } catch {
      /* نسخة غير ويندوز أو تعذر القراءة: نكمل بالبصمة المحلية */
    }
  }
  return { code: fallbackDeviceCode(), desktop: false };
}
