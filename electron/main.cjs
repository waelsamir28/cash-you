const { app, BrowserWindow, ipcMain, shell, safeStorage } = require("electron");
const { registerDbHandlers, readLocalDbConfig } = require("./db-config.cjs");
const { startLocalServer, hasLocalServer, stopLocalServer } = require("./local-server.cjs");
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

function readConfig() {
  try {
    return JSON.parse(readFileSync(path.join(__dirname, "app-config.json"), "utf8"));
  } catch {
    return { url: "" };
  }
}

const windowIcon = path.join(__dirname, "icon.png");

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
 * تحديد عنوان التطبيق:
 *  - إن حُفظت قاعدة بيانات محلية على جهاز العميل، شغّل خادم Next محلياً
 *    يستخدمها (بيانات العميل تبقى على جهازه).
 *  - وإلا فاستخدم الموقع المنشور كالمعتاد.
 */
async function resolveAppUrl(config) {
  const dbConfig = readLocalDbConfig();
  if (dbConfig && dbConfig.mode === "local" && hasLocalServer()) {
    const localUrl = await startLocalServer(dbConfig.url);
    if (localUrl) {
      process.stdout.write(`[cash-you] using local server at ${localUrl}\n`);
      return localUrl;
    }
    process.stdout.write("[cash-you] local server failed to start — falling back to the published site\n");
  }
  return config.url;
}

async function createWindow() {
  const config = readConfig();
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

  if (!config.url || !/^https?:\/\//i.test(config.url)) {
    /* صفحة الإعداد تظهر عند عدم ضبط رابط الموقع في app-config.json */
    const iconDataUrl = `data:image/png;base64,${readFileSync(windowIcon).toString("base64")}`;
    const html = `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><body style="margin:0;background:#0b1220;color:#e2e8f0;font:16px Tahoma;display:grid;place-items:center;height:100vh"><main style="max-width:620px;padding:36px;border:1px solid #334155;border-radius:22px;background:#111c31"><img src="${iconDataUrl}" alt="CASH YOU" width="96" height="96" style="border-radius:22px"><h1 style="color:#fbbf24">CASH YOU</h1><p>أضف رابط موقع CASH YOU المنشور داخل electron/app-config.json ثم أعد تشغيل التطبيق.</p><p style="color:#94a3b8">للتطوير شغّل npm run dev ثم استخدم http://localhost:3000.</p></main></body></html>`;
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return;
  }

  const appUrl = await resolveAppUrl(config);
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

app.on("before-quit", () => {
  stopLocalServer();
});
