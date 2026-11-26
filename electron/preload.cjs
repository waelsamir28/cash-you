const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cashYou", Object.freeze({
  getDeviceCode: () => ipcRenderer.invoke("cash-you:get-device-code"),
  getActivationRecord: () => ipcRenderer.invoke("cash-you:get-activation-record"),
  saveActivationRecord: (record) => ipcRenderer.invoke("cash-you:save-activation-record", record),
}));
