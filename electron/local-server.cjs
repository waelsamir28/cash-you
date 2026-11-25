/*
 * تشغيل خادم Next.js محلياً داخل نسخة ويندوز.
 *
 * لماذا؟
 * نسخة الويندوز تفتح الموقع المنشور على الإنترنت، فبيانات العميل كلها تذهب
 * إلى قاعدة بيانات السيرفر البعيد. ومع ذلك يطلب العميل «قاعدة محلية» على جهازه
 * نفسه — وهذا لا يتحقق إلا بتشغيل خادم Next محلياً يستخدم DATABASE_URL محلياً.
 *
 * كيف يعمل؟
 *  - يُبنى Next.js بخاصية standalone فتصبح هناك نسخة جاهزة تُشغَّل بـ node server.js.
 *  - عند وجود إعداد قاعدة بيانات محفوظ على جهاز العميل، نشغّل هذه النسخة محلياً
 *    على منفذ محلي، ونفتح التطبيق عليها بدل الموقع البعيد.
 *  - إن لم يوجد إعداد (أو تعذّر التشغيل) نعود للموقع البعيد كالمعتاد.
 *
 * ملاحظة: هذا الملف يعمل داخل عملية Electron الرئيسية (Node.js) فقط.
 */
const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");

/** العملية الجارية للخادم المحلي (لإيقافها عند خروج التطبيق) */
let currentChild = null;

/** منفذ محلي عشوائي لتفادي تعارض المنافذ */
function pickPort() {
  return 34000 + Math.floor(Math.random() * 1000);
}

/** مجلد بناء Next standalone داخل حزمة التطبيق */
function standaloneDir() {
  const roots = [
    path.join(__dirname, "..", ".next", "standalone"),
    path.join(process.resourcesPath || "", "app.asar", ".next", "standalone"),
    path.join(process.resourcesPath || "", "app.asar.unpacked", ".next", "standalone"),
  ];
  for (const dir of roots) {
    if (existsSync(path.join(dir, "server.js"))) return dir;
  }
  return null;
}

/** هل النسخة المضمّنة من الخادم المحلي موجودة؟ */
function hasLocalServer() {
  return standaloneDir() !== null;
}

/** فحص جاهزية الخادم عبر /api/health */
function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 30000);
  return new Promise((resolve) => {
    const attempt = () => {
      if (Date.now() > deadline) {
        resolve(false);
        return;
      }
      const req = http.get({ host: "127.0.0.1", port, path: "/api/health", timeout: 2000 }, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on("error", () => {
        setTimeout(attempt, 400);
      });
      req.on("timeout", () => {
        req.destroy();
        setTimeout(attempt, 400);
      });
    };
    attempt();
  });
}

/**
 * تشغيل الخادم المحلي على منفذ عشوائي مع رابط قاعدة البيانات المختار.
 * يعيد رابط الموقع المحلي عند النجاح، أو null عند التعذّر.
 */
async function startLocalServer(databaseUrl) {
  const dir = standaloneDir();
  if (!dir) return null;

  const port = pickPort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: dir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: databaseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (buf) => {
    process.stdout.write(`[local-server] ${buf.toString()}`);
  });
  child.stderr?.on("data", (buf) => {
    process.stderr.write(`[local-server] ${buf.toString()}`);
  });
  child.on("exit", (code) => {
    process.stdout.write(`[local-server] exited with code ${code}\n`);
  });

  const ready = await waitForHealth(port);
  if (!ready) {
    child.kill();
    return null;
  }
  currentChild = child;
  return `http://127.0.0.1:${port}`;
}

/** إيقاف الخادم المحلي (يُستدعى عند خروج التطبيق) */
function stopLocalServer() {
  if (currentChild && !currentChild.killed) {
    currentChild.kill();
    currentChild = null;
  }
}

module.exports = { startLocalServer, hasLocalServer, stopLocalServer };
