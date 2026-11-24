const { app, BrowserWindow, ipcMain, shell, safeStorage } = require("electron");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

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
  for (const file of [path.join(app.getPath("userData"), "app-config.json"), path.join(__dirname, "app-config.json")]) {
    try {
      const config = JSON.parse(readFileSync(file, "utf8"));
      if (typeof config.url === "string") return config;
    } catch {}
  }
  return { url: "" };
}

function restrictNavigation(window, url) {
  const allowedOrigin = new URL(url).origin;
  window.webContents.on("will-navigate", (event, target) => {
    let targetOrigin = "";
    try { targetOrigin = new URL(target).origin; } catch {}
    if (targetOrigin !== allowedOrigin) {
      event.preventDefault();
      if (target.startsWith("https://") || target.startsWith("http://")) void shell.openExternal(target);
    }
  });
}

ipcMain.handle("cash-you:configure-app-url", async (event, value) => {
  const setupPage = pathToFileURL(path.join(__dirname, "setup.html")).href;
  if (event.sender.getURL() !== setupPage) throw new Error("إجراء الإعداد غير مصرح به");
  let parsed;
  try { parsed = new URL(String(value)); } catch { throw new Error("اكتب رابطًا صحيحًا يبدأ بـ https://"); }
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(isLocalhost && parsed.protocol === "http:")) {
    throw new Error("يجب أن يكون رابط الموقع آمنًا ويبدأ بـ https://");
  }
  parsed.hash = "";
  const url = parsed.toString().replace(/\/$/, "");
  const folder = app.getPath("userData");
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, "app-config.json"), JSON.stringify({ url }, null, 2), "utf8");
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) throw new Error("نافذة التطبيق غير متاحة");
  restrictNavigation(window, url);
  await window.loadURL(url);
  return { ok: true };
});

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

function createWindow() {
  const config = readConfig();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 980,
    minHeight: 650,
    backgroundColor: "#0b1220",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  if (!config.url || !/^https?:\/\//i.test(config.url)) {
    win.loadFile(path.join(__dirname, "setup.html"));
    return;
  }

  restrictNavigation(win, config.url);
  win.loadURL(config.url);
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.cashyou.pos");
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
