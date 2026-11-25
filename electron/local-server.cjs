/*
 * تشغيل خادم Next.js محلياً داخل نسخة ويندوز.
 *
 * لماذا؟
 * كل عميل ياخد نسخة CASH YOU يجب أن يعمل على بياناته الخاصة. لذلك لم تعد
 * النسخة تفتح الموقع المنشور على الإنترنت، بل تشغّل خادم Next المرفق داخل
 * الحزمة على منفذ محلي، ويشير إلى قاعدة بيانات العميل نفسها عبر DATABASE_URL.
 *
 * كيف يعمل؟
 *  - يُبنى Next.js بخاصية standalone فتصبح هناك نسخة جاهزة تُشغَّل بـ node server.js.
 *  - نشغّل هذه النسخة على منفذ محلي عشوائي، ونفتح التطبيق عليها.
 *  - الخادم يستمع على 127.0.0.1 فقط — لا يمكن لأحد خارج جهاز العميل الوصول إليه.
 *
 * ملاحظة: هذا الملف يعمل داخل عملية Electron الرئيسية (Node.js) فقط.
 */
const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

/** العملية الجارية للخادم المحلي (لإيقافها عند خروج التطبيق) */
let currentChild = null;

/** يبحث عن منفذ محلي حرّ (لتفادي تعارض المنافذ مع برامج أخرى) */
function pickPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 34000;
      server.close(() => resolve(port));
    });
  });
}

/**
 * مجلد بناء Next standalone داخل حزمة التطبيق.
 *
 * في النسخة المعبّأة تُنسخ الحزمة إلى مجلد resources (خارج app.asar) لأن
 * Next يحتاج ملفات حقيقية على القرص، ولأن electron-builder يستثني node_modules
 * من محتويات app.asar.
 */
function standaloneDir() {
  const resources = process.resourcesPath || "";
  const roots = [
    /* النسخة المعبّأة: resources/standalone */
    path.join(resources, "standalone"),
    /* احتياط: داخل app.asar.unpacked */
    path.join(resources, "app.asar.unpacked", ".next", "standalone"),
    /* احتياط: داخل app.asar */
    path.join(resources, "app.asar", ".next", "standalone"),
    /* التطوير المحلي: من مجلد المشروع */
    path.join(__dirname, "..", ".next", "standalone"),
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

  const port = await pickPort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: dir,
    env: {
      ...process.env,
      /* في النسخة المعبّأة process.execPath هو Electron نفسه وليس Node.
         هذا المتغير يجعله يعمل كـ Node عادي لتشغيل خادم Next. */
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: databaseUrl,
      /* قاعدة واحدة على جهاز العميل نفسه — لا حاجة لعزل مستأجرين هنا،
         والعزل المتعدد مفعّل افتراضياً على النسخ السحابية. */
      CASH_YOU_TENANT_MODE: "0",
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
