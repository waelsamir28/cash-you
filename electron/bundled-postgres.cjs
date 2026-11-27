/* ============================================================================
 *  قاعدة PostgreSQL المدمجة مع مثبّت CASH YOU
 *
 *  • الملفات الثنائية تُنسخ داخل مجلد البرنامج الذي اختاره المستخدم (resources/postgres).
 *  • بيانات المبيعات تُحفظ في مجلد ثابت داخل بيانات المستخدم: %APPDATA%\CASH YOU\pgdata
 *    حتى لا تُحذف عند التحديث أو إعادة التثبيت.
 *  • الخادم يستمع على 127.0.0.1 فقط، والمصادقة SCRAM بكلمة مرور عشوائية تُحفظ مشفّرة
 *    بواسطة Windows (safeStorage / DPAPI) في ملف db-secret.bin.
 *
 *  هذا الملف لا يستورد Electron مباشرة، بل يستقبل دوال التشفير والمسارات من الخارج،
 *  لذلك يمكن اختباره بسهولة بـ Node العادي.
 * ========================================================================== */
const { execFileSync, spawnSync } = require("node:child_process");
const { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");

const PG_PORT = 54329;
const PG_SUPERUSER = "cyadmin";
const PG_DATABASE = "cashyou";
const READY_MARKER = "cashyou.ready";

const exe = (name) => (process.platform === "win32" ? `${name}.exe` : name);

function lastLines(text, count = 6) {
  return String(text || "").trim().split(/\r?\n/).slice(-count).join("\n");
}

/**
 * @param {{
 *   bundleDir: string,   // مجلد الملفات الثنائية (يحتوي bin و share)
 *   dataDir: string,     // مجلد بيانات الخادم (PGDATA)
 *   secretFile: string,  // ملف كلمة المرور المشفّرة
 *   logDir: string,      // مجلد سجل الخادم
 *   protect: (text: string) => Buffer,
 *   unprotect: (buf: Buffer) => string,
 * }} options
 */
function createBundledPostgres(options) {
  const { bundleDir, dataDir, secretFile, logDir, protect, unprotect } = options;
  const bin = (name) => path.join(bundleDir, "bin", exe(name));
  const shareDir = [path.join(bundleDir, "share"), path.join(bundleDir, "share", "postgresql")].find((d) =>
    existsSync(path.join(d, "postgres.bki")),
  );
  const logFile = path.join(logDir, "postgres.log");

  function isAvailable() {
    return ["initdb", "pg_ctl", "postgres"].every((n) => existsSync(bin(n))) && Boolean(shareDir);
  }

  function isRunning() {
    if (!existsSync(path.join(dataDir, "PG_VERSION"))) return false;
    const r = spawnSync(bin("pg_ctl"), ["status", "-D", dataDir], { windowsHide: true, stdio: "ignore" });
    return r.status === 0;
  }

  function readPassword() {
    return unprotect(readFileSync(secretFile));
  }

  function createPassword() {
    const password = randomBytes(24).toString("base64url");
    mkdirSync(path.dirname(secretFile), { recursive: true });
    writeFileSync(secretFile, protect(password));
    return password;
  }

  function initCluster(password) {
    mkdirSync(dataDir, { recursive: true });
    const pwFile = path.join(path.dirname(secretFile), "pg-initpw.tmp");
    writeFileSync(pwFile, password);
    try {
      execFileSync(
        bin("initdb"),
        [
          "-D", dataDir,
          "-U", PG_SUPERUSER,
          "--pwfile", pwFile,
          "--auth-local=scram-sha-256",
          "--auth-host=scram-sha-256",
          "--encoding=UTF8",
          "--locale=C",
          "-L", shareDir,
        ],
        { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
      );
    } catch (error) {
      rmSync(dataDir, { recursive: true, force: true });
      throw new Error(`تعذر إنشاء قاعدة البيانات: ${lastLines(error.stderr || error.message)}`);
    } finally {
      rmSync(pwFile, { force: true });
    }
  }

  function startServer() {
    if (isRunning()) return;
    mkdirSync(logDir, { recursive: true });
    try {
      execFileSync(
        bin("pg_ctl"),
        ["start", "-D", dataDir, "-l", logFile, "-w", "-t", "60", "-o", `-p ${PG_PORT} -c listen_addresses=127.0.0.1`],
        { windowsHide: true, stdio: "ignore" },
      );
    } catch {
      throw new Error(`تعذر تشغيل خادم قاعدة البيانات على المنفذ ${PG_PORT}. راجع السجل: ${logFile}`);
    }
  }

  function stopServer() {
    if (!isRunning()) return;
    spawnSync(bin("pg_ctl"), ["stop", "-D", dataDir, "-m", "fast", "-w", "-t", "30"], {
      windowsHide: true,
      stdio: "ignore",
    });
  }

  /* إنشاء قاعدة الكاش يو عبر الوضع الفردي لـ PostgreSQL (لا يحتاج عميل psql) */
  function createDatabase() {
    const sql = `CREATE DATABASE ${PG_DATABASE} ENCODING 'UTF8' TEMPLATE template0;\n`;
    try {
      execFileSync(bin("postgres"), ["--single", "-D", dataDir, "postgres"], {
        input: sql,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf8",
      });
    } catch (error) {
      const text = `${error.stdout || ""}${error.stderr || ""}`;
      if (!/already exists/i.test(text)) {
        throw new Error(`تعذر إنشاء قاعدة ${PG_DATABASE}: ${lastLines(text || error.message)}`);
      }
    }
    writeFileSync(path.join(dataDir, READY_MARKER), new Date().toISOString());
  }

  function connectionUrl(password) {
    return `postgres://${PG_SUPERUSER}:${encodeURIComponent(password)}@127.0.0.1:${PG_PORT}/${PG_DATABASE}`;
  }

  /**
   * يجهّز القاعدة كاملة ويشغّلها ثم يعيد رابط الاتصال.
   * آمنة للاستدعاء المتكرر: لا تعيد الإنشاء إن كانت موجودة.
   */
  function ensure() {
    if (!isAvailable()) throw new Error("ملفات قاعدة البيانات المدمجة غير موجودة في مجلد البرنامج");

    const initialized = existsSync(path.join(dataDir, "PG_VERSION"));
    let password;
    if (initialized) {
      if (!existsSync(secretFile)) {
        throw new Error("مفتاح قاعدة البيانات مفقود. تواصل مع الدعم الفني: 01222355769");
      }
      password = readPassword();
    } else {
      password = createPassword();
      initCluster(password);
    }

    if (!existsSync(path.join(dataDir, READY_MARKER))) {
      stopServer();
      createDatabase();
    }

    startServer();
    return connectionUrl(password);
  }

  return { isAvailable, isRunning, ensure, stop: stopServer, logFile };
}

module.exports = { createBundledPostgres, PG_PORT, PG_DATABASE };
