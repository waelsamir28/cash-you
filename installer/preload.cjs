const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("installerAPI", {
  getDefaults: () => ipcRenderer.invoke("installer:defaults"),
  browseDir: (current) => ipcRenderer.invoke("installer:browse-dir", current),
  runInstall: (opts) => ipcRenderer.invoke("installer:run", opts),
  launchApp: (exePath) => ipcRenderer.invoke("installer:launch", exePath),
  minimize: () => ipcRenderer.send("installer:minimize"),
  close: () => ipcRenderer.send("installer:close"),
  onProgress: (cb) => {
    ipcRenderer.on("installer:progress", (_e, data) => cb(data));
  },
});
