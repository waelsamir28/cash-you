"use client";

/**
 * إدارة ربط قاعدة البيانات.
 *
 * نسخة ويندوز (Electron) تحفظ الإعدادات وتختبر الاتصال **على جهاز العميل** عبر
 * جسر Electron، لأن التطبيق يفتح الموقع المنشور على الإنترنت — فأي طلب يمرّ
 * عبر السيرفر البعيد لا يصل إلى جهاز العميل ولا يستطيع اختبار قاعدة محلية.
 *
 * نسخة الويب تستخدم مسار API على السيرفر.
 */

export type DbMode = "cloud" | "local";

export type DbConfigState = {
  saved: boolean;
  mode: DbMode;
  /** الرابط مع إخفاء كلمة المرور */
  maskedUrl: string;
};

export type DbTestResult = {
  ok: boolean;
  message: string;
  latencyMs?: number;
  saved?: boolean;
};

export type SyncTableDetail = {
  table: string;
  copied: number;
  /** السجلات التي تعذّر ربطها بسبب مرجع مفقود */
  skipped?: number;
  /** اتجاه النسخ: push = من المحلية إلى السحابية، pull = من السحابية إلى المحلية */
  direction: "push" | "pull";
  error?: string;
};

export type SyncReport = {
  ok: boolean;
  message: string;
  /** إجمالي السجلات المنسوخة */
  copied: number;
  /** عدد السجلات المرفوعة إلى السحابية */
  pushed: number;
  /** عدد السجلات المسحوبة إلى القاعدة المحلية */
  pulled: number;
  /** تفاصيل لكل جدول مع اتجاهه */
  details: SyncTableDetail[];
  durationMs?: number;
};

type DbBridge = {
  getDbConfig?: () => Promise<DbConfigState>;
  saveDbConfig?: (config: { mode: DbMode; url: string }) => Promise<{ ok: boolean; message: string }>;
  testDbConnection?: (config: { url: string }) => Promise<DbTestResult>;
  syncDatabases?: (config: {
    localUrl: string;
    cloudUrl: string;
  }) => Promise<SyncReport>;
};

type CashYouWindow = Window & { cashYou?: DbBridge };

/** هل التطبيق يعمل داخل نسخة ويندوز؟ */
export function isDesktopBridge(): boolean {
  if (typeof window === "undefined") return false;
  const bridge = (window as CashYouWindow).cashYou;
  return Boolean(bridge?.getDbConfig && bridge?.saveDbConfig && bridge?.testDbConnection);
}

/** قراءة الإعداد المحفوظ */
export async function loadDbConfig(): Promise<DbConfigState> {
  const empty: DbConfigState = { saved: false, mode: "cloud", maskedUrl: "" };
  if (typeof window === "undefined") return empty;

  const bridge = (window as CashYouWindow).cashYou;
  if (bridge?.getDbConfig) {
    try {
      return await bridge.getDbConfig();
    } catch {
      return empty;
    }
  }

  try {
    const res = await fetch("/api/db-connection", { cache: "no-store" });
    if (!res.ok) return empty;
    return (await res.json()) as DbConfigState;
  } catch {
    return empty;
  }
}

/** اختبار الاتصال — محلياً على جهاز العميل في نسخة ويندوز */
export async function testDbConnection(url: string): Promise<DbTestResult> {
  const bridge = typeof window !== "undefined" ? (window as CashYouWindow).cashYou : undefined;
  if (bridge?.testDbConnection) {
    try {
      return await bridge.testDbConnection({ url });
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "تعذر الاختبار" };
    }
  }

  try {
    const res = await fetch("/api/db-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test", url }),
    });
    return (await res.json()) as DbTestResult;
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "تعذر الاختبار" };
  }
}

/**
 * الحفظ.
 * - نسخة ويندوز: يحفظ على جهاز العميل (bridged).
 * - نسخة الويب: يحفظ على السيرفر.
 */
export async function saveDbConfig(mode: DbMode, url: string): Promise<DbTestResult> {
  const bridge = typeof window !== "undefined" ? (window as CashYouWindow).cashYou : undefined;
  if (bridge?.saveDbConfig) {
    try {
      const res = await bridge.saveDbConfig({ mode, url });
      return { ok: res.ok, message: res.message, saved: res.ok };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "تعذر الحفظ" };
    }
  }

  try {
    const res = await fetch("/api/db-connection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", mode, url }),
    });
    return (await res.json()) as DbTestResult;
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "تعذر الحفظ" };
  }
}

/**
 * مزامنة البيانات بين القاعدة المحلية والسحابية.
 *
 * في نسخة ويندوز تُنفَّذ على جهاز العميل (لأن القاعدة المحلية هناك)،
 * وفي نسخة الويب تُنفَّذ على الخادم.
 */
export async function syncDatabases(
  localUrl: string,
  cloudUrl: string,
  /** في السحابة: القاعدة السحابية تُحدَّد من الخادم (قاعدة العميل) */
  cloudLocked = false,
): Promise<SyncReport> {
  const bridge = typeof window !== "undefined" ? (window as CashYouWindow).cashYou : undefined;
  if (bridge?.syncDatabases) {
    try {
      return await bridge.syncDatabases({ localUrl, cloudUrl });
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "تعذر تنفيذ المزامنة",
        copied: 0,
        pushed: 0,
        pulled: 0,
        details: [],
      };
    }
  }

  try {
    const res = await fetch("/api/db-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ localUrl, cloudUrl, useSessionTenant: cloudLocked }),
    });
    const json = (await res.json()) as SyncReport;
    return json;
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "تعذر تنفيذ المزامنة",
      copied: 0,
      pushed: 0,
      pulled: 0,
      details: [],
    };
  }
}
