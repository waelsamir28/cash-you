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
      try {
        process.kill(existing.pid, "SIGTERM");
      } catch {
        /* تجاهل */
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

  const instance = new EmbeddedPostgres({
    databaseDir,
    user: LOCAL_DB_USER,
    password,
    port,
    persistent: true,
    /* initdb لا يقبل التشغيل كـ root */
    onLog: () => undefined,
    onError: () => undefined,
  });

  try {
    /* تهيئة العنقود مرة واحدة فقط */
    if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
      await instance.initialise();
    }
    /* كلمة المرور تُحفظ بعد التهيئة (initdb يتطلب مجلداً فارغاً) */
    saveLocalSecret(password);
    await instance.start();
    await instance.createDatabase(LOCAL_DB_NAME).catch(() => undefined);
    runningInstance = instance;
  } catch (err) {
    process.stdout.write(
      `[local-db] تعذّر تشغيل PostgreSQL المدمج: ${err && err.message ? err.message : err}\n`,
    );
    return null;
  }

  return `postgresql://${LOCAL_DB_USER}:${password}@127.0.0.1:${port}/${LOCAL_DB_NAME}`;
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
