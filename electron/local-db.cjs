/*
 * إدارة قاعدة البيانات المحلية لنسخة ويندوز.
 *
 * الفكرة:
 * كل من ياخد نسخة CASH YOU يجب أن يعمل فوراً بلا خطوات تثبيت:
 *  1) نبحث عن قاعدة محلية محفوظة على جهازه → نستخدمها.
 *  2) لا توجد → نشغّل PostgreSQL مدمج (مرفق مع البرنامج) على جهازه،
 *     ننشئ له قاعدة `cash_you` بكل جداولها، ونحفظ الرابط محلياً.
 *  3) PostgreSQL المدمج غير متاح (نسخة بلا مرفقات) → نبحث عن خادم
 *     PostgreSQL مثبّت على الجهاز (localhost) وننشئ عليه قاعدة `cash_you`.
 *
 * النتيجة: كل تثبيت مستقل تماماً — لا حساب مالك مشترك ولا بيانات مشتركة،
 * والمالك والكاشير يسجّلان دخولهما بأنفسهما، ثم يضيف العميل رابط
 * قاعدةه السحابية بنفسه من داخل البرنامج.
 */
const { app } = require("electron");
const { spawn } = require("node:child_process");
const { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } = require("node:fs");
const net = require("node:net");
const path = require("node:path");

/** اسم قاعدة العميل المحلية */
const LOCAL_DB_NAME = "cash_you";
/** مستخدم قاعدة البيانات المحلية */
const LOCAL_DB_USER = "cashyou";

/** نسخة PostgreSQL المدمجة التي نشغّلها (لإيقافها عند خروج التطبيق) */
let runningInstance = null;
/** pid لنسخة متبقية من تشغيل سابق نتولاها ثم نوقفها عند الخروج */
let adoptedPid = null;
/** هل شغّلنا الخادم عبر pg_ctl (ويندوز)؟ */
let startedWithPgCtl = false;
/** مجلد بيانات الخادم العامل حالياً */
let runningDataDir = null;

/** هل نحن على ويندوز؟ */
const isWindows = process.platform === "win32";

/** مجلد بيانات المستخدم */
function userDataDir() {
  try {
    return app.getPath("userData");
  } catch {
    return path.join(process.cwd(), "electron");
  }
}

/** مجلد مجلد بيانات PostgreSQL المدمج */
function embeddedDataDir() {
  return path.join(userDataDir(), "pgdata");
}

/**
 * ملف كلمة مرور القاعدة المحلية.
 *
 * تعيش مع مجلد بيانات العنقود نفسه — لأن كلمة المرور مرتبطة بعنقود
 * PostgreSQL: لو فُصلت بينهما لفقد العميل الوصول إلى بياناته. ويُكتب
 * نسخة أخرى في مجلد بيانات المستخدم (للتوافق مع الإصدارات السابقة).
 */
function localSecretPath() {
  return path.join(embeddedDataDir(), "cash-you-local.json");
}

/** النسخة القديمة في مجلد بيانات المستخدم */
function legacySecretPath() {
  return path.join(userDataDir(), "cash-you-local.json");
}

/** يقرأ كلمة المرور المحفوظة (أو يولّد واحدة جديدة) */
function localPassword() {
  for (const file of [localSecretPath(), legacySecretPath()]) {
    try {
      const json = JSON.parse(readFileSync(file, "utf8"));
      if (typeof json.password === "string" && json.password) return json.password;
    } catch {
      /* ملف غير موجود أو غير صالح */
    }
  }
  return `cy_${require("node:crypto").randomBytes(12).toString("hex")}`;
}

/**
 * يحفظ كلمة المرور على جهاز العميل.
 * تُكتب داخل مجلد العنقود **بعد** تهيئته — لأن `initdb` يرفض مجلداً غير فارغ.
 */
function saveLocalSecret(password) {
  const content = `${JSON.stringify({ password, createdAt: new Date().toISOString() }, null, 2)}\n`;
  for (const file of [localSecretPath(), legacySecretPath()]) {
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, content, "utf8");
    } catch {
      /* لا يهم — سنستخدم كلمة المرور في الذاكرة */
    }
  }
}

/** منفذ حر على الجهاز */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 5432;
      server.close(() => resolve(port));
    });
  });
}

/** هل PostgreSQL المدمج متاح في هذه الحزمة؟ */
function embeddedPostgresAvailable() {
  try {
    require.resolve("embedded-postgres");
    return true;
  } catch {
    return false;
  }
}

/**
 * يحمّل وحدة PostgreSQL المدمج.
 * الحزمة ESM فقط، فحمّلها بـ import الديناميكي (يعمل داخل CommonJS).
 */
async function loadEmbeddedPostgres() {
  try {
    const mod = await import("embedded-postgres");
    return mod.default ?? mod.EmbeddedPostgres ?? null;
  } catch {
    return null;
  }
}

/**
 * مسارات ثنائيات PostgreSQL المدمج حسب النظام.
 * (نفس منطق حزمة `embedded-postgres` — نحتاج `pg_ctl` تحديداً على ويندوز.)
 */
async function embeddedBinaries() {
  const map = {
    "win32-x64": "@embedded-postgres/windows-x64",
    "linux-x64": "@embedded-postgres/linux-x64",
    "linux-arm64": "@embedded-postgres/linux-arm64",
    "linux-arm": "@embedded-postgres/linux-arm",
    "linux-ia32": "@embedded-postgres/linux-ia32",
    "linux-ppc64": "@embedded-postgres/linux-ppc64",
    "darwin-x64": "@embedded-postgres/darwin-x64",
    "darwin-arm64": "@embedded-postgres/darwin-arm64",
  };
  const key = `${process.platform}-${process.arch}`;
  const pkg = map[key];
  if (!pkg) return null;
  try {
    const mod = await import(pkg);
    const binDir = path.dirname(mod.postgres || "");
    if (!mod.postgres || !existsSync(binDir)) return null;
    return { postgres: mod.postgres, initdb: mod.initdb, pgCtl: mod.pg_ctl, binDir };
  } catch {
    return null;
  }
}

/** ينفّذ أمراً ويعيد مخرجاته (يرمي خطأً واضحاً عند الفشل) */
function runCommand(command, args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    /*
     * ننتظر حدث `exit` (خروج العملية) لا `close` (إغلاق المخرجات) — لأن
     * الخادم الذي يشغّله `pg_ctl` قد يبقي على مقابض المخرجات مفتوحة،
     * فيتأخر `close` إلى ما لا نهاية.
     */
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    let settled = false;
    child.stdout?.on("data", (buf) => {
      out += buf.toString();
    });
    child.stderr?.on("data", (buf) => {
      err += buf.toString();
    });
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(reject, new Error(`انتهت مهلة الأمر: ${path.basename(command)}`));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      finish(reject, error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        finish(resolve, { out, err });
        return;
      }
      finish(
        reject,
        new Error(
          `فشل ${path.basename(command)} (رمز ${code}): ${(err || out).trim().slice(-800)}`,
        ),
      );
    });
  });
}

/** آخر أسطر سجل الخادم (لإ diagnosing الفشل) */
function tailServerLog(databaseDir, lines = 12) {
  try {
    const content = readFileSync(path.join(databaseDir, "server.log"), "utf8");
    return content.split(/\r?\n/).filter(Boolean).slice(-lines).join("\n");
  } catch {
    return "";
  }
}

/**
 * تشغيل الخادم عبر `pg_ctl` — **ضروري على ويندوز**:
 * `postgres.exe` يرفض العمل داخل جلسة إدارية ("Execution of PostgreSQL by a user
 * with administrative permissions is not permitted")، بينما `pg_ctl` يشغّله
 * بتوكن محدود فيعمل حتى مع صلاحيات المدير.
 */
async function startWithPgCtl(binaries, databaseDir, port, adminUrl) {
  const pgCtl = binaries.pgCtl;
  if (!pgCtl || !existsSync(pgCtl)) throw new Error("pg_ctl غير متوفر");
  const logFile = path.join(databaseDir, "server.log");
  try {
    await runCommand(
      pgCtl,
      [
        "-D",
        databaseDir,
        "-l",
        logFile,
        "-o",
        `-p ${port} -h 127.0.0.1`,
        "-w",
        "-t",
        "60",
        "start",
      ],
      60000,
    );
  } catch (err) {
    /*
     * `pg_ctl` قد لا يُنهي عمليته حتى لو اشتغل الخادم — فالحكم الحقيقي
     * هو: هل الخادم يستجيب؟ إن كان يعمل نعتبر المهمة ناجحة.
     */
    if (!(await canConnect(adminUrl, 5000))) {
      const log = tailServerLog(databaseDir);
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`${message}${log ? `\nسجل الخادم:\n${log}` : ""}`);
    }
  }
  if (!(await canConnect(adminUrl, 8000))) {
    const log = tailServerLog(databaseDir);
    throw new Error(
      `لم يستجب الخادم المحلي${log ? `\nسجل الخادم:\n${log}` : ""}`,
    );
  }
}

/** إيقاف الخادم عبر `pg_ctl` (أرخص من القتل القسري) */
async function stopWithPgCtl(binaries, databaseDir) {
  if (!binaries?.pgCtl || !existsSync(binaries.pgCtl)) return;
  try {
    await runCommand(
      binaries.pgCtl,
      ["-D", databaseDir, "stop", "-m", "fast", "-w", "-t", "30"],
      60000,
    );
  } catch {
    /* الخادم قد يكون متوقفاً أصلاً */
  }
}

/**
 * يقرأ معلومات postmaster.pid (المنفذ و pid) لمجلد بيانات PostgreSQL.
 */
function readPostmasterInfo(databaseDir) {
  try {
    const raw = readFileSync(path.join(databaseDir, "postmaster.pid"), "utf8");
    const lines = raw.split(/\r?\n/);
    const pid = Number.parseInt(lines[0], 10);
    const port = Number.parseInt(lines[3], 10);
    if (!Number.isFinite(pid) || !Number.isFinite(port)) return null;
    return { pid, port };
  } catch {
    return null;
  }
}

/** هل العملية ما زالت حيّة؟ */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    /* EPERM = العملية موجودة لكن ليس لنا صلاحية الإشارة إليها */
    return Boolean(err && err.code === "EPERM");
  }
}

/** هل تعمل نسخة PostgreSQL المدمجة حالياً على مجلد بياناتنا؟ */
function hasRunningEmbeddedInstance() {
  const info = readPostmasterInfo(embeddedDataDir());
  return Boolean(info && isProcessAlive(info.pid));
}

/** هل يمكن الاتصال بهذا الرابط؟ */
async function canConnect(url, timeout = 4000) {
  let Client;
  try {
    Client = require("pg").Client;
  } catch {
    return false;
  }
  const client = new Client({ connectionString: url, connectionTimeoutMillis: timeout });
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * يوقف PostgreSQL المدمج (سواء الذي شغّلناه أو نسخة متبقية من تشغيل سابق).
 * يُستدعى عند إغلاق التطبيق حتى لا يبقى خادم يعمل في خلفية الجهاز.
 */
async function stopEmbeddedPostgres() {
  const instance = runningInstance;
  runningInstance = null;
  if (instance) {
    try {
      await instance.stop();
    } catch {
      /* تجاهل — سنغلقها بالـ pid أدناه إن لزم */
    }
  }

  const dataDir = runningDataDir;
  runningDataDir = null;
  if (startedWithPgCtl && dataDir) {
    startedWithPgCtl = false;
    const binaries = await embeddedBinaries();
    await stopWithPgCtl(binaries, dataDir);
  }

  const pid = adoptedPid;
  adoptedPid = null;
  if (pid && isProcessAlive(pid)) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* تجاهل */
    }
  }
}

/**
 * يشغّل PostgreSQL المدمج على جهاز العميل وينشئ قاعدة `cash_you`.
 * يعيد رابط الاتصال أو null إن تعذّر.
 */
async function startEmbeddedPostgres() {
  if (!embeddedPostgresAvailable()) return null;
  const EmbeddedPostgres = await loadEmbeddedPostgres();
  if (!EmbeddedPostgres) return null;

  const binaries = await embeddedBinaries();
  if (!binaries) return null;

  const password = localPassword();
  const databaseDir = embeddedDataDir();

  try {
    mkdirSync(databaseDir, { recursive: true });
  } catch {
    return null;
  }

  /*
   * إن كان هناك خادم من تشغيل سابق:
   *  - ما زال يعمل → نستخدمه على نفس البيانات (بلا فقد لأي حساب).
   *  - لم يعد يعمل → ننظّف ملف postmaster.pid ونبدأ خادماً جديداً بمنفذ جديد.
   */
  const existing = readPostmasterInfo(databaseDir);
  if (existing) {
    if (isProcessAlive(existing.pid)) {
      const reuseUrl = `postgresql://${LOCAL_DB_USER}:${password}@127.0.0.1:${existing.port}/${LOCAL_DB_NAME}`;
      if (await canConnect(reuseUrl)) {
        adoptedPid = existing.pid;
        await ensureDatabaseExists(reuseUrl);
        process.stdout.write(
          `[local-db] reusing the running local database on port ${existing.port}\n`,
        );
        return reuseUrl;
      }
      /* خادم سابق لا يمكن استخدامه → نغلقه ونبدأ من جديد */
      if (isWindows) {
        await stopWithPgCtl(binaries, databaseDir);
      } else {
        try {
          process.kill(existing.pid, "SIGTERM");
        } catch {
          /* تجاهل */
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    try {
      unlinkSync(path.join(databaseDir, "postmaster.pid"));
    } catch {
      /* ملف غير موجود — لا بأس */
    }
  }

  const port = await freePort();

  try {
    /* تهيئة العنقود مرة واحدة فقط */
    if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
      const setup = new EmbeddedPostgres({
        databaseDir,
        user: LOCAL_DB_USER,
        password,
        port,
        persistent: true,
        onLog: () => undefined,
        onError: () => undefined,
      });
      await setup.initialise();
    }
    /* كلمة المرور تُحفظ بعد التهيئة (initdb يتطلب مجلداً فارغاً) */
    saveLocalSecret(password);

    if (isWindows) {
      /*
       * على ويندوز نشغّل الخادم عبر `pg_ctl` لا عبر `postgres.exe` مباشرة:
       * الأخير يرفض العمل داخل جلسة إدارية ("Execution of PostgreSQL by a user
       * with administrative permissions is not permitted") — وهو شائع جداً
       * عند العملاء. أما `pg_ctl` فيشغّله بتوكن محدود فيعمل دائماً.
       */
      await startWithPgCtl(
        binaries,
        databaseDir,
        port,
        `postgresql://${LOCAL_DB_USER}:${password}@127.0.0.1:${port}/postgres`,
      );
      startedWithPgCtl = true;
      runningDataDir = databaseDir;
    } else {
      const instance = new EmbeddedPostgres({
        databaseDir,
        user: LOCAL_DB_USER,
        password,
        port,
        persistent: true,
        onLog: () => undefined,
        onError: () => undefined,
      });
      await instance.start();
      runningInstance = instance;
      runningDataDir = databaseDir;
    }

    /* إنشاء قاعدة العميل (إن لم تكن موجودة) */
    const url = `postgresql://${LOCAL_DB_USER}:${password}@127.0.0.1:${port}/${LOCAL_DB_NAME}`;
    await ensureDatabaseExists(url);
    return url;
  } catch (err) {
    process.stdout.write(
      `[local-db] تعذّر تشغيل PostgreSQL المدمج: ${err && err.message ? err.message : err}\n`,
    );
    return null;
  }
}

/** خوادم PostgreSQL المحلية الشائعة على جهاز العميل */
const LOCAL_SERVERS = [
  { host: "127.0.0.1", port: 5432, user: "postgres", password: "postgres" },
  { host: "127.0.0.1", port: 5432, user: "postgres", password: "password" },
  { host: "localhost", port: 5432, user: "postgres", password: "postgres" },
  { host: "127.0.0.1", port: 5433, user: "postgres", password: "postgres" },
];

/**
 * يبحث عن خادم PostgreSQL مثبّت على الجهاز وينشئ عليه قاعدة `cash_you`.
 * يعيد رابط الاتصال أو null.
 */
async function useInstalledPostgres() {
  let Client;
  try {
    Client = require("pg").Client;
  } catch {
    return null;
  }

  for (const server of LOCAL_SERVERS) {
    const adminUrl = `postgresql://${server.user}:${server.password}@${server.host}:${server.port}/postgres`;
    const client = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 3000 });
    try {
      await client.connect();
      const exists = await client.query("select 1 from pg_database where datname = $1", [
        LOCAL_DB_NAME,
      ]);
      if (!exists.rowCount) {
        await client.query(`create database "${LOCAL_DB_NAME}"`);
      }
      await client.end();
      return `postgresql://${server.user}:${server.password}@${server.host}:${server.port}/${LOCAL_DB_NAME}`;
    } catch {
      await client.end().catch(() => undefined);
    }
  }
  return null;
}

/**
 * يضمن وجود قاعدة البيانات (ينشئها إن لم تكن موجودة).
 * يعمل على أي رابط قاعدة: يربط بقاعدة `postgres` الصيانة ويُنشئ القاعدة.
 */
async function ensureDatabaseExists(url) {
  let Client;
  try {
    Client = require("pg").Client;
  } catch {
    return { ok: true, message: "تم" };
  }
  try {
    const target = new URL(url);
    const dbName = target.pathname.replace(/^\//, "");
    if (!dbName) return { ok: true, message: "تم" };

    const admin = new URL(url);
    admin.pathname = "/postgres";
    const client = new Client({ connectionString: admin.toString(), connectionTimeoutMillis: 8000 });
    await client.connect();
    const exists = await client.query("select 1 from pg_database where datname = $1", [dbName]);
    if (!exists.rowCount) {
      await client.query(`create database "${dbName.replace(/"/g, '""')}"`);
      await client.end();
      return { ok: true, message: `تم إنشاء قاعدة البيانات «${dbName}»` };
    }
    await client.end();
    return { ok: true, message: "قاعدة البيانات موجودة" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذر إنشاء قاعدة البيانات";
    return { ok: false, message };
  }
}

module.exports = {
  LOCAL_DB_NAME,
  localPassword,
  ensureDatabaseExists,
  hasRunningEmbeddedInstance,
  startEmbeddedPostgres,
  stopEmbeddedPostgres,
  useInstalledPostgres,
};
