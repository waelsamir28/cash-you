/* تحديث تلقائي لبرنامج سطح المكتب (ويندوز فقط، النسخة المثبّتة فقط).
 * يفحص GitHub Releases عند فتح البرنامج ثم كل 6 ساعات، ويرسل حالة التحديث للواجهة
 * فتظهر رسالة عائمة فيها زر «تحديث الآن». لا يثبّت شيئاً إلا بعد ضغطة المستخدم. */
const { app, ipcMain } = require("electron");

const FIRST_CHECK_DELAY_MS = 8_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CHANNEL = "cash-you:update-state";

function plainNotes(notes) {
  const text = Array.isArray(notes) ? notes.map((n) => n?.note ?? "").join(" ") : String(notes ?? "");
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
}

function createUpdateService({ getWindow }) {
  let autoUpdater = null;
  let timer = null;
  let state = { status: "idle", currentVersion: app.getVersion() };

  const send = () => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send(CHANNEL, state);
  };
  const set = (patch) => {
    state = { ...state, ...patch };
    send();
  };

  function init() {
    if (!app.isPackaged || process.platform !== "win32") return;
    try {
      ({ autoUpdater } = require("electron-updater"));
    } catch (error) {
      console.error("electron-updater unavailable", error);
      return;
    }
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on("update-available", (info) =>
      set({ status: "available", version: info.version, notes: plainNotes(info.releaseNotes), percent: 0, message: "" }),
    );
    autoUpdater.on("update-downloaded", (info) => set({ status: "downloaded", version: info.version, percent: 100 }));
    autoUpdater.on("download-progress", (p) => set({ status: "downloading", percent: Math.round(p.percent) }));
    autoUpdater.on("error", (error) => {
      console.error("update error", error);
      /* فشل الفحص في الخلفية (مثلاً لا يوجد إنترنت) لا يزعج المستخدم */
      if (state.status === "downloading") {
        set({ status: "error", message: "تعذّر تنزيل التحديث. تأكد من الإنترنت وحاول مرة أخرى، أو اتصل بالدعم 01222355769." });
      } else {
        set({ status: "idle" });
      }
    });

    ipcMain.handle(CHANNEL, () => state);
    ipcMain.handle("cash-you:update-download", async () => {
      if (!autoUpdater || state.status !== "available") return false;
      set({ status: "downloading", percent: 0, message: "" });
      try {
        await autoUpdater.downloadUpdate();
      } catch (error) {
        console.error("download failed", error);
      }
      return true;
    });
    ipcMain.handle("cash-you:update-install", () => {
      if (!autoUpdater || state.status !== "downloaded") return false;
      /* يغلق البرنامج ويشغّل المثبّت؛ before-quit يوقف قاعدة البيانات أولاً */
      autoUpdater.quitAndInstall(false, true);
      return true;
    });

    const check = () => {
      if (!autoUpdater) return;
      autoUpdater.checkForUpdates().catch(() => {});
    };
    setTimeout(check, FIRST_CHECK_DELAY_MS);
    timer = setInterval(check, CHECK_INTERVAL_MS);
  }

  function dispose() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { init, dispose };
}

module.exports = { createUpdateService };
