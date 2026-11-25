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
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const net = require("node:net");
const path = require("node:path");

/** اسم قاعدة العميل المحلية */
const LOCAL_DB_NAME = "cash_you";
/** مستخدم قاعدة البيانات المحلية */
const LOCAL_DB_USER = "cashyou";

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

/** ملف يحفظ كلمة مرور القاعدة المحلية */
function localSecretPath() {
  return path.join(userDataDir(), "cash-you-local.json");
}

/** يقرأ/ينشئ كلمة مرور عشوائية ويحفظها على جهاز العميل */
function localPassword() {
  try {
    const json = JSON.parse(readFileSync(localSecretPath(), "utf8"));
    if (typeof json.password === "string" && json.password) return json.password;
  } catch {
    /* ملف جديد */
  }
  const password = `cy_${require("node:crypto").randomBytes(12).toString("hex")}`;
  try {
    mkdirSync(path.dirname(localSecretPath()), { recursive: true });
    writeFileSync(
      localSecretPath(),
      `${JSON.stringify({ password, createdAt: new Date().toISOString() }, null, 2)}\n`,
      "utf8",
    );
  } catch {
    /* لا يهم — سنستخدم كلمة المرور في الذاكرة */
  }
  return password;
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
 * يشغّل PostgreSQL المدمج على جهاز العميل وينشئ قاعدة `cash_you`.
 * يعيد رابط الاتصال أو null إن تعذّر.
 */
async function startEmbeddedPostgres() {
  if (!embeddedPostgresAvailable()) return null;
  const EmbeddedPostgres = await loadEmbeddedPostgres();
  if (!EmbeddedPostgres) return null;

  const password = localPassword();
  const port = await freePort();
  const databaseDir = embeddedDataDir();

  try {
    mkdirSync(databaseDir, { recursive: true });
  } catch {
    return null;
  }

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
    await instance.start();
    await instance.createDatabase(LOCAL_DB_NAME).catch(() => undefined);
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
  startEmbeddedPostgres,
  useInstalledPostgres,
};
