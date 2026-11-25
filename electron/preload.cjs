const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cashYou", Object.freeze({
  getDeviceCode: () => ipcRenderer.invoke("cash-you:get-device-code"),
  getActivationRecord: () => ipcRenderer.invoke("cash-you:get-activation-record"),
  saveActivationRecord: (record) => ipcRenderer.invoke("cash-you:save-activation-record", record),

  /* ---------- إعداد قاعدة البيانات (محلياً على جهاز العميل) ---------- */
  getDbConfig: () => ipcRenderer.invoke("cash-you:get-db-config"),
  saveDbConfig: (config) => ipcRenderer.invoke("cash-you:save-db-config", config),
  testDbConnection: (config) => ipcRenderer.invoke("cash-you:test-db-connection", config),

  /* ---------- مزامنة القاعدة المحلية مع السحابية (من جهاز العميل) ---------- */
  syncDatabases: (config) => ipcRenderer.invoke("cash-you:sync-databases", config),
}));
