/**
 * CASH YOU — Custom Self-Extracting Electron GUI Installer
 * نافذة بدون إطار (Frameless) بنمط Windows 11 Wizard / Stepper
 */
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

let win = null;

function defaultInstallDir() {
  const localAppData = process.env.LOCALAPPDATA || path.join(app.getPath("home"), "AppData", "Local");
  return path.join(localAppData, "Programs", "CASH YOU");
}

function payloadArchivePath() {
  const candidates = [
    path.join(process.resourcesPath || "", "payload.7z"),
    path.join(__dirname, "payload.7z"),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || candidates[0];
}

function sevenZipBinary() {
  const candidates = [
    path.join(process.resourcesPath || "", "7za.exe"),
    path.join(__dirname, "bin", "7za.exe"),
    "7z",
  ];
  return candidates.find((p) => p === "7z" || fs.existsSync(p)) || "7z";
}

function createWindow() {
  win = new BrowserWindow({
    width: 880,
    height: 600,
    frame: false,
    resizable: false,
    maximizable: false,
    transparent: false,
    backgroundColor: "#0b1220",
    title: "تثبيت CASH YOU",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());

ipcMain.handle("installer:defaults", () => ({
  installDir: defaultInstallDir(),
  version: app.getVersion() || "1.4.1",
}));

ipcMain.handle("installer:browse-dir", async (_e, current) => {
  const res = await dialog.showOpenDialog(win, {
    title: "اختر مجلد التثبيت",
    defaultPath: current || defaultInstallDir(),
    properties: ["openDirectory", "createDirectory"],
  });
  return res.canceled ? null : res.filePaths[0];
});

ipcMain.on("installer:minimize", () => win?.minimize());
ipcMain.on("installer:close", () => app.quit());

ipcMain.handle("installer:run", async (_e, opts) => {
  const targetDir = opts.installDir || defaultInstallDir();
  const archive = payloadArchivePath();
  const sz = sevenZipBinary();

  const sendProgress = (pct, status) => {
    win?.webContents.send("installer:progress", { pct, status });
  };

  fs.mkdirSync(targetDir, { recursive: true });
  sendProgress(5, "جاري تهيئة مجلد التثبيت...");

  if (!fs.existsSync(archive)) {
    throw new Error("ملف الحزمة المضغوطة (payload.7z) غير موجود.");
  }

  await new Promise((resolve, reject) => {
    const child = spawn(sz, ["x", archive, `-o${targetDir}`, "-y", "-bsp1"], {
      windowsHide: true,
    });

    let lastPct = 10;
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      const m = text.match(/(\d{1,3})%/);
      if (m) {
        const p = Math.min(90, Math.max(10, Math.round(Number(m[1]) * 0.8 + 10)));
        if (p > lastPct) {
          lastPct = p;
          sendProgress(p, `جاري استخراج ملفات البرنامج... (${m[1]}%)`);
        }
      }
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`فشل فك الضغط (رمز الخروج: ${code})`));
    });
  });

  sendProgress(92, "جاري إنشاء الاختصارات...");
  const exePath = path.join(targetDir, "CASH YOU.exe");

  if (process.platform === "win32" && fs.existsSync(exePath)) {
    const psCommands = [];
    if (opts.desktopShortcut) {
      psCommands.push(
        `$s=(New-Object -COM WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\\CASH YOU.lnk');$s.TargetPath='${exePath}';$s.WorkingDirectory='${targetDir}';$s.Save();`,
      );
    }
    if (opts.startMenuShortcut) {
      psCommands.push(
        `$sm=[Environment]::GetFolderPath('Programs')+'\\CASH YOU';New-Item -ItemType Directory -Force -Path $sm|Out-Null;$s=(New-Object -COM WScript.Shell).CreateShortcut($sm+'\\CASH YOU.lnk');$s.TargetPath='${exePath}';$s.WorkingDirectory='${targetDir}';$s.Save();`,
      );
    }
    if (opts.autoStart) {
      psCommands.push(
        `Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'CASH YOU' -Value '"${exePath}"';`,
      );
    }
    if (psCommands.length > 0) {
      await new Promise((resolve) => {
        execFile("powershell.exe", ["-NoProfile", "-Command", psCommands.join(" ")], { windowsHide: true }, () => resolve());
      });
    }
  }

  sendProgress(100, "تم التثبيت بنجاح!");
  return { ok: true, exePath };
});

ipcMain.handle("installer:launch", (_e, exePath) => {
  if (exePath && fs.existsSync(exePath)) {
    shell.openPath(exePath);
  }
  app.quit();
});
