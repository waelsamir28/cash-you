/*
 * جسر Electron لإعداد قاعدة البيانات.
 *
 * لماذا هذا الجسر؟
 * نسخة الويندوز تفتح الموقع المنشور على الإنترنت، فأي طلب حفظ يمر عبر
 * السيرفر البعيد ولا يصل إلى جهاز العميل. لذلك يقرأ التطبيق عبر Electron
 * الرابط المحفوظ محلياً، ويختبر الاتصال من جهاز العميل نفسه — وهذا ما يجعل
 * اختبار «قاعدة محلية» ذا معنى (localhost على جهاز العميل لا يراه السيرفر).
 *
 * كل العمليات تتم داخل عملية Electron الرئيسية (Node.js) — ولا تُسرَّب
 * أي حزمة Node أصلية إلى حزمة المتصفح.
 */
const { app, ipcMain, shell } = require("electron");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

/** مجلد بيانات المستخدم (يكتب فيه Electron عادةً) */
function userDataDir() {
  try {
    return app.getPath("userData");
  } catch {
    return path.join(process.cwd(), "electron");
  }
}

/** مسار ملف إعداد قاعدة البيانات على جهاز العميل */
function dbConfigPath() {
  return path.join(userDataDir(), "cash-you-db.json");
}

/**
 * قراءة الإعدادات المحفوظة على جهاز العميل.
 *
 * نخزّن رابطين بشكل منفصل:
 *  - `localUrl`: قاعدة بيانات العميل المحلية (تُنشأ تلقائياً — لا يدخلها العميل).
 *  - `cloudUrl`:  رابط القاعدة السحابية الذي أضافه العميل بنفسه (للمزامنة).
 *
 * ملاحظة مهمة: لا نقرأ أي إعداد من `app-config.json` المجاور للتطبيق، لأن
 * ذلك ملف مشترك بين كل من ياخد النسخة — ولا يجوز أن تُشتقّ منه إعدادات
 * خاصة بالعميل (رابط قاعدة سحابية مثلاً).
 */
function readLocalDbConfig() {
  let json = {};
  try {
    json = JSON.parse(readFileSync(dbConfigPath(), "utf8"));
  } catch {
    /* الملف غير موجود أو غير صالح */
  }
  const pick = (value) => (typeof value === "string" ? value.trim() : "");
  const localUrl = pick(json.localUrl);
  const cloudUrl = pick(json.cloudUrl);
  const legacyUrl = pick(json.dbUrl);
  const mode = json.dbMode === "local" ? "local" : "cloud";
  /* رابط قديم محفوظ قبل الفصل بين المحلي والسحابي */
  const legacyLocal = mode === "local" ? legacyUrl : "";
  const legacyCloud = mode === "cloud" ? legacyUrl : "";
  return {
    mode,
    url: cloudUrl || legacyCloud || localUrl || legacyLocal,
    localUrl: localUrl || legacyLocal,
    cloudUrl: cloudUrl || legacyCloud,
  };
}

/**
 * حفظ الإعداد على جهاز العميل.
 * حفظ رابط سحابي **لا يمسّ** رابط القاعدة المحلية، والعكس.
 */
function writeLocalDbConfig(cfg) {
  if (!/^postgres(ql)?:\/\//i.test(cfg.url)) {
    return { ok: false, message: "الرابط يجب أن يبدأ بـ postgresql://" };
  }
  const target = dbConfigPath();
  let existing = {};
  try {
    existing = JSON.parse(readFileSync(target, "utf8"));
  } catch {
    /* ملف جديد */
  }
  const next = {
    ...existing,
    dbMode: cfg.mode === "local" ? "local" : "cloud",
    dbUrl: cfg.url,
  };
  if (cfg.mode === "local") next.localUrl = cfg.url;
  else next.cloudUrl = cfg.url;
  try {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return { ok: true, message: "تم الحفظ على جهازك" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذر الحفظ";
    return { ok: false, message };
  }
}

/** إخفاء كلمة المرور داخل الرابط للعرض */
function maskDbUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "••••";
    return `${u.protocol}//${u.username ? `${u.username}:••••@` : ""}${u.host}${u.pathname}`;
  } catch {
    return "••••";
  }
}

/** تحويل أخطاء الاتصال إلى رسالة عربية مفهومة */
function describeDbError(err) {
  const codes = [];
  const texts = [];
  const collect = (e) => {
    if (!e || typeof e !== "object") return;
    if (typeof e.code === "string") codes.push(e.code);
    if (typeof e.message === "string" && e.message) texts.push(e.message);
    if (Array.isArray(e.errors)) e.errors.forEach(collect);
  };
  collect(err);
  const blob = [...codes, ...texts].join(" | ");

  if (/ECONNREFUSED/i.test(blob)) return "رفض الاتصال — تأكد أن الخادم يعمل والمنفذ صحيح";
  if (/ENOTFOUND|EAI_AGAIN/i.test(blob)) return "تعذر الوصول للمضيف — تحقق من عنوان الخادم";
  if (/timeout|ETIMEDOUT/i.test(blob)) return "انتهت المهلة — تحقق من الرابط والإنترنت";
  if (/password authentication failed/i.test(blob)) return "كلمة المرور غير صحيحة";
  if (/does not exist/i.test(blob)) return "اسم قاعدة البيانات غير موجود";
  if (/ECONNRESET/i.test(blob)) return "انقطع الاتصال — تحقق من الشبكة أو جدار الحماية";
  const detail = texts[0] || codes[0] || "غير معروف";
  return `تعذر الاتصال: ${detail}`;
}

/**
 * اختبار الاتصال من جهاز العميل نفسه.
 * نستخدم pg عبر require داخل عملية Electron (خارج حزمة المتصفح).
 */
async function testLocalDbConnection(url) {
  const started = Date.now();
  let Client;
  try {
    const pg = require("pg");
    Client = pg.Client;
  } catch {
    return { ok: false, message: "مكتبة الاتصال غير متاحة في هذه النسخة", latencyMs: 0 };
  }

  const client = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    await client.query("select 1");
    return { ok: true, message: "الاتصال ناجح — تم الوصول لقاعدة البيانات", latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, message: describeDbError(err), latencyMs: Date.now() - started };
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** تسجيل معالجات IPC لقاعدة البيانات */
function registerDbHandlers() {
  ipcMain.handle("cash-you:get-db-config", () => {
    const cfg = readLocalDbConfig();
    return {
      saved: Boolean(cfg.url),
      mode: cfg.mode,
      maskedUrl: cfg.url ? maskDbUrl(cfg.url) : "",
      /* قاعدة العميل المحلية (تُنشأ تلقائياً) */
      hasLocalDb: Boolean(cfg.localUrl),
      localMasked: cfg.localUrl ? maskDbUrl(cfg.localUrl) : "",
      /* رابط العميل السحابي (أضافه بنفسه) */
      hasCloudDb: Boolean(cfg.cloudUrl),
      cloudMasked: cfg.cloudUrl ? maskDbUrl(cfg.cloudUrl) : "",
    };
  });

  ipcMain.handle("cash-you:save-db-config", (_event, payload) => {
    const url = String((payload && payload.url) || "").trim();
    const mode = payload && payload.mode === "local" ? "local" : "cloud";
    if (!url) return { ok: false, message: "أدخل رابط الاتصال أولاً" };
    return writeLocalDbConfig({ mode, url });
  });

  ipcMain.handle("cash-you:test-db-connection", async (_event, payload) => {
    const url = String((payload && payload.url) || "").trim();
    if (!url) return { ok: false, message: "أدخل رابط الاتصال أولاً", latencyMs: 0 };
    if (!/^postgres(ql)?:\/\//i.test(url)) {
      return { ok: false, message: "الرابط يجب أن يبدأ بـ postgresql://", latencyMs: 0 };
    }
    return testLocalDbConnection(url);
  });

  ipcMain.handle("cash-you:open-db-help", async () => {
    await shell.openExternal("https://github.com/waelsamir28/cash-you");
    return true;
  });

  /*
   * مزامنة بين القاعدة المحلية والسحابية — تُنفَّذ من جهاز العميل.
   * السبب: القاعدة المحلية على جهاز العميل لا يراها السيرفر البعيد.
   */
  ipcMain.handle("cash-you:sync-databases", async (_event, payload) => {
    /*
     * قاعدة العميل المحلية تُملأ تلقائياً من إعدادات جهازه (لا يعرف العميل
     * رابطها ولا كلمة مروره) — والرابط السحابي يُؤخذ مما حفظه بنفسه.
     */
    const cfg = readLocalDbConfig();
    const localUrl =
      String((payload && payload.localUrl) || "").trim() || cfg.localUrl || "";
    const cloudUrl =
      String((payload && payload.cloudUrl) || "").trim() || cfg.cloudUrl || "";
    if (!localUrl || !cloudUrl) {
      return { ok: false, message: "يلزم رابط القاعدتين: المحلية والسحابية", copied: 0, details: [] };
    }
    if (localUrl === cloudUrl) {
      return { ok: false, message: "الرابطان متطابقان — لا حاجة للمزامنة", copied: 0, details: [] };
    }
    for (const url of [localUrl, cloudUrl]) {
      if (!/^postgres(ql)?:\/\//i.test(url)) {
        return { ok: false, message: "الرابط يجب أن يبدأ بـ postgresql://", copied: 0, details: [] };
      }
    }

    const started = Date.now();
    const details = [];
    let localClient;
    let cloudClient;
    try {
      const { Client } = require("pg");
      localClient = new Client({ connectionString: localUrl, connectionTimeoutMillis: 10000 });
      cloudClient = new Client({ connectionString: cloudUrl, connectionTimeoutMillis: 10000 });
      await localClient.connect();
      await cloudClient.connect();
    } catch (err) {
      if (localClient) await localClient.end().catch(() => undefined);
      if (cloudClient) await cloudClient.end().catch(() => undefined);
      return {
        ok: false,
        message: describeDbError(err),
        copied: 0,
        pushed: 0,
        pulled: 0,
        details: [],
        durationMs: Date.now() - started,
      };
    }

    /* نستخدم نفس منطق المزامنة الموجود في src/lib/db-sync.ts — لكن نسخة
       CommonJS هنا لأن ملف المصدر TypeScript لا يمكن استيراده مباشرة. */
    let syncModule;
    try {
      syncModule = require("./db-sync.cjs");
    } catch {
      await localClient.end().catch(() => undefined);
      await cloudClient.end().catch(() => undefined);
      return {
        ok: false,
        message: "وحدة المزامنة غير متاحة في هذه النسخة",
        copied: 0,
        pushed: 0,
        pulled: 0,
        details: [],
        durationMs: Date.now() - started,
      };
    }

    try {
      /* فحص هوية العميل: يمنع نقل الحسابات والإعدادات بين عملاء مختلفين */
      const identity = await syncModule.checkCustomerIdentity(localClient, cloudClient);
      if (!identity.ok) {
        return {
          ok: false,
          message: identity.reason || "تم رفض المزامنة لحماية بيانات العملاء",
          copied: 0,
          pushed: 0,
          pulled: 0,
          details: [],
          durationMs: Date.now() - started,
        };
      }

      const report = await syncModule.syncDatabases(localClient, cloudClient, "both", { identity });
      const blocked =
        !syncModule.allowIdentityTablesFor(identity, "push") ||
        !syncModule.allowIdentityTablesFor(identity, "pull");
      const message = blocked
        ? report.message +
          " — لم تُنسخ الحسابات أو الإعدادات لأن القاعدتين تخصّان عميلين مختلفين"
        : report.message;
      return { ...report, message, durationMs: Date.now() - started };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "تعذر تنفيذ المزامنة",
        copied: 0,
        pushed: 0,
        pulled: 0,
        details: [],
        durationMs: Date.now() - started,
      };
    } finally {
      await localClient.end().catch(() => undefined);
      await cloudClient.end().catch(() => undefined);
    }
  });
}

module.exports = {
  readLocalDbConfig,
  writeLocalDbConfig,
  maskDbUrl,
  testLocalDbConnection,
  registerDbHandlers,
};
