const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cashYou", Object.freeze({
  getDeviceCode: () => ipcRenderer.invoke("cash-you:get-device-code"),
  getActivationRecord: () => ipcRenderer.invoke("cash-you:get-activation-record"),
  saveActivationRecord: (record) => ipcRenderer.invoke("cash-you:save-activation-record", record),
  exportPdf: (payload) => ipcRenderer.invoke("cash-you:export-pdf", payload),
}));

/* حالة التحديث التلقائي: تُرسل من main.cjs وتُستدعى من الواجهة */
const updateListeners = new Set();
ipcRenderer.on("cash-you:update-state", (_event, state) => {
  updateListeners.forEach((listener) => listener(state));
});

contextBridge.exposeInMainWorld("cashYouUpdates", Object.freeze({
  getState: () => ipcRenderer.invoke("cash-you:update-state"),
  download: () => ipcRenderer.invoke("cash-you:update-download"),
  install: () => ipcRenderer.invoke("cash-you:update-install"),
  subscribe: (listener) => {
    updateListeners.add(listener);
    return () => updateListeners.delete(listener);
  },
}));
