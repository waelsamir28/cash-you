const { app, BrowserWindow, ipcMain, shell, safeStorage } = require("electron");
const { registerDbHandlers, readLocalDbConfig, writeLocalDbConfig } = require("./db-config.cjs");
const { startLocalServer, hasLocalServer, stopLocalServer } = require("./local-server.cjs");
const {
  embeddedDatabaseError,
  ensureDatabaseExists,
  hasRunningEmbeddedInstance,
  startEmbeddedPostgres,
  stopEmbeddedPostgres,
  useInstalledPostgres,
} = require("./local-db.cjs");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

function getDeviceCode() {
  if (process.platform !== "win32") throw new Error("CASH YOU desktop activation is supported on Windows only");
  const result = execFileSync("reg.exe", [
    "query",
    "HKLM\\SOFTWARE\\Microsoft\\Cryptography",
    "/v",
    "MachineGuid",
  ], { encoding: "utf8", windowsHide: true });
  const match = result.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i);
  if (!match?.[1]) throw new Error("تعذر قراءة معرّف Windows للجهاز");
  const digest = createHash("sha256").update(`cash-you-device-v1:${match[1].trim()}`).digest("hex").slice(0, 24).toUpperCase();
  return `CYD-${digest.match(/.{1,4}/g).join("-")}`;
}

const windowIcon = path.join(__dirname, "icon.png");
/** شاشة البداية أثناء فتح البرنامج */
const splashPath = path.join(__dirname, "splash.html");

/**
 * نافذة شاشة البداية (بلا إطار) — تظهر أثناء تجهيز قاعدة البيانات
 * وتشغيل الخادم المحلي، ف给人的 انطباع أن البرنامج يستيقظ بهدوء.
 */
function createSplashWindow() {
  const win = new BrowserWindow({
    width: 560,
    height: 430,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    center: true,
    show: false,
    skipTaskbar: true,
    resizable: false,
    backgroundColor: "#0b1220",
    icon: windowIcon,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);
  void win.loadFile(splashPath);
  win.once("ready-to-show", () => {
    win.showInactive();
  });
  return win;
}

/** تحديث نص الحالة على شاشة البداية */
function setSplashStatus(win, text) {
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.executeJavaScript(
      `window.showSplashProgress && window.showSplashProgress(true); window.setSplashStatus && window.setSplashStatus(${JSON.stringify(text)});`,
    );
  } catch {
    /* الشاشة قد تكون مغلقة */
  }
}

ipcMain.handle("cash-you:get-device-code", () => getDeviceCode());
ipcMain.handle("cash-you:get-activation-record", () => {
  const file = path.join(app.getPath("userData"), "cash-you-license.bin");
  try {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows secure storage is unavailable");
    return safeStorage.decryptString(readFileSync(file));
  } catch {
    return null;
  }
});
ipcMain.handle("cash-you:save-activation-record", (_event, record) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows secure storage is unavailable");
  const folder = app.getPath("userData");
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, "cash-you-license.bin"), safeStorage.encryptString(String(record)));
  return true;
});

/**
 * تجهيز قاعدة البيانات المحلية على جهاز العميل.
 *
 * كل تثبيت مستقل تماماً:
 *  1) قاعدة محلية خيّرها العميل بنفسه (ليست المدمجة) → نحترم اختياره.
 *  2) غير ذلك → PostgreSQL مدمج مرفق مع البرنامج → نشغّله وننشئ قاعدة
 *     `cash_you` تلقائياً، ونعيد استخدام بياناته إن كان قد شُغّل سابقاً.
 *  3) المدمج غير متاح → خادم PostgreSQL مثبّت على الجهاز → ننشئ عليه `cash_you`.
 *
 * يُرجع رابط الاتصال أو null إن تعذّر كل ذلك.
 */
async function prepareLocalDatabase(onStatus) {
  const report = (text) => {
    if (typeof onStatus === "function") onStatus(text);
  };
  const saved = readLocalDbConfig();
  const savedIsLocal = Boolean(saved && saved.mode === "local" && /^postgres(ql)?:\/\//i.test(saved.url));

  /* قاعدة اختارها العميل بنفسه (خادمه المحلي) — نحترمها */
  if (savedIsLocal && !hasRunningEmbeddedInstance()) {
    const created = await ensureDatabaseExists(saved.url);
    if (created.ok) {
      process.stdout.write(`[cash-you] using saved local database (${created.message})\n`);
      return saved.url;
    }
    process.stdout.write(`[cash-you] saved local database is unreachable: ${created.message}\n`);
  }

  /* القاعدة المدمجة — تُنشأ تلقائياً وتُحفظ بيانات العميل فيها */
  report("جارٍ تجهيز قاعدة بيانات جهازك…");
  const embedded = await startEmbeddedPostgres();
  if (embedded) {
    writeLocalDbConfig({ mode: "local", url: embedded });
    process.stdout.write("[cash-you] bundled PostgreSQL is ready with the cash_you database\n");
    return embedded;
  }

  /* القاعدة التي اختارها العميل قد تكون ما زالت صالحة */
  if (savedIsLocal) {
    const created = await ensureDatabaseExists(saved.url);
    if (created.ok) return saved.url;
  }

  const installed = await useInstalledPostgres();
  if (installed) {
    writeLocalDbConfig({ mode: "local", url: installed });
    process.stdout.write("[cash-you] created cash_you on the local PostgreSQL server\n");
    return installed;
  }

  return null;
}

/**
 * تحديد عنوان التطبيق:
 *  - نسخة ويندوز تعمل **دائماً** على قاعدة بيانات العميل المحلية، فلا تفتح
 *    الموقع المشترك أبداً — وإلا لبست حساب مالك واحد بين كل من ياخد البرنامج.
 *  - إن تعذّر تجهيز قاعدة محلية، نفتح صفحة إعداد تشرح له الحل.
 */
async function resolveAppUrl(onStatus) {
  const report = (text) => {
    if (typeof onStatus === "function") onStatus(text);
  };
  if (!hasLocalServer()) {
    process.stdout.write("[cash-you] local server bundle is missing\n");
    return null;
  }

  report("جارٍ تجهيز قاعدة بيانات جهازك…");
  const databaseUrl = await prepareLocalDatabase(report);
  if (!databaseUrl) {
    process.stdout.write("[cash-you] could not prepare a local database\n");
    return null;
  }

  report("جارٍ تشغيل الخادم المحلي…");
  const localUrl = await startLocalServer(databaseUrl);
  if (localUrl) {
    process.stdout.write(`[cash-you] using local server at ${localUrl}\n`);
    return localUrl;
  }
  process.stdout.write("[cash-you] local server failed to start\n");
  return null;
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 650,
    backgroundColor: "#0b1220",
    title: "CASH YOU — كاش يو",
    icon: windowIcon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  /*
   * نسخة ويندوز لا تفتح الموقع المشترك أبداً — كل عميل يعمل على قاعدة
   * بياناته المحلية الخاصة. إن تعذّر تجهيزها نعرض تعليمات واضحة.
   */
  const splash = createSplashWindow();
  const appUrl = await resolveAppUrl((text) => setSplashStatus(splash, text));
  if (splash && !splash.isDestroyed()) splash.destroy();
  if (!appUrl) {
    /* لم نتمكن من تجهيز قاعدة بيانات محلية — نعرض تعليمات واضحة بدل شاشة مكسورة */
    const iconDataUrl = `data:image/png;base64,${readFileSync(windowIcon).toString("base64")}`;
    /* نعرض السبب الحقيقي بدل رسالة عامة — يوفّر على العميل جولة تشخيص */
    const reason = embeddedDatabaseError();
    const reasonHtml = reason
      ? `<details style="margin:0 0 18px"><summary style="cursor:pointer;color:#fbbf24;line-height:2">تفاصيل تقنية</summary><pre dir="ltr" style="white-space:pre-wrap;word-break:break-word;background:#0b1220;border:1px solid #334155;border-radius:12px;padding:12px;color:#94a3b8;font:12px/1.7 monospace;margin:8px 0 0">${reason
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")}</pre></details>`
      : "";
    const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><body style="margin:0;background:#0b1220;color:#e2e8f0;font:16px Tahoma;display:grid;place-items:center;height:100vh"><main style="max-width:640px;padding:36px;border:1px solid #334155;border-radius:22px;background:#111c31"><img src="${iconDataUrl}" alt="CASH YOU" width="96" height="96" style="border-radius:22px;margin-bottom:16px"><h1 style="color:#fbbf24">CASH YOU</h1><p style="line-height:1.9">لم نتمكن من إنشاء قاعدة البيانات المحلية على هذا الجهاز تلقائياً.</p>${reasonHtml}<p style="line-height:1.9;color:#94a3b8">شغّل PostgreSQL على جهازك (منفذ 5432) ثم أعد تشغيل البرنامج — أو ثبّت نسخة جديدة من CASH YOU تحتوي قاعدة بيانات مدمجة.</p></main></body></html>`;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return;
  }
  win.loadURL(appUrl);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) void shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.cashyou.pos");
  registerDbHandlers();
  void createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  stopLocalServer();
  if (process.platform !== "darwin") app.quit();
});

/* نوقف خادم PostgreSQL المدمج قبل الخروج حتى لا يبقى يعمل في الخلفية */
let shuttingDown = false;
app.on("before-quit", (event) => {
  if (shuttingDown) return;
  event.preventDefault();
  shuttingDown = true;
  void (async () => {
    await stopEmbeddedPostgres();
    stopLocalServer();
    app.quit();
  })();
});
