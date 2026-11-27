/* ============================================================================
 *  تشغيل خادم CASH YOU المحلي (Next standalone) داخل تطبيق سطح المكتب
 *  يعمل بوضع Node عبر ELECTRON_RUN_AS_NODE، ويستمع على 127.0.0.1 فقط.
 * ========================================================================== */
const { spawn } = require("node:child_process");
const { createWriteStream, existsSync, mkdirSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");

function waitForHttp(url, { timeoutMs = 90_000, isAlive }) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (!isAlive()) return reject(new Error("توقف خادم التطبيق أثناء التشغيل"));
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) return reject(new Error("انتهت مهلة تشغيل خادم التطبيق"));
        setTimeout(attempt, 400);
      });
      req.setTimeout(3000, () => req.destroy());
    };
    attempt();
  });
}

/**
 * @param {{ serverDir: string, cwd: string, env: Record<string,string>, port: number, logFile: string }} options
 */
async function startLocalServer({ serverDir, cwd, env, port, logFile }) {
  const entry = path.join(serverDir, "server.js");
  if (!existsSync(entry)) throw new Error("ملفات خادم التطبيق غير موجودة في مجلد البرنامج");

  mkdirSync(path.dirname(logFile), { recursive: true });
  mkdirSync(cwd, { recursive: true });
  const log = createWriteStream(logFile, { flags: "a" });

  const child = spawn(process.execPath, [entry], {
    cwd,
    env: {
      ...process.env,
      ...env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });

  let alive = true;
  child.on("exit", () => {
    alive = false;
  });

  const url = `http://127.0.0.1:${port}`;
  await waitForHttp(url, { isAlive: () => alive });

  return {
    url,
    stop() {
      if (alive) child.kill();
      log.end();
    },
  };
}

module.exports = { startLocalServer };
