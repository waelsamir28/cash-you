/*
 * فحص سريع لـ PostgreSQL المدمج المرفق مع نسخة ويندوز.
 *
 * الهدف: التأكد أن القاعدة المدمجة تعمل فعلاً على نظام ويندوز — تهيئة،
 * تشغيل، إنشاء قاعدة، وكتابة وقراءة بيانات — قبل أن نطمئن أن العميل
 * ستفتح له البرنامج قاعدة محلية بلا أي تثبيت.
 *
 * التشغيل: node tools/test-embedded-postgres.cjs
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "cy-embedded-"));
const user = "cashyou";
const password = "cy_test_password";
const database = "cash_you";
let port = 40000 + Math.floor(Math.random() * 10000);

async function main() {
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  assert.ok(EmbeddedPostgres, "embedded-postgres غير متاح");

  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user,
    password,
    port,
    persistent: true,
    autoRehydrateSymlinks: true,
    onLog: () => undefined,
    onError: () => undefined,
  });

  /* تهيئة العنقود */
  await instance.initialise();
  assert.ok(fs.existsSync(path.join(dataDir, "PG_VERSION")), "لم تُنشأ نسخة العنقود");
  console.log("✓ تهيئة عنقود PostgreSQL المدمج");

  /* التشغيل */
  await instance.start();
  console.log("✓ تشغيل PostgreSQL المدمج على المنفذ", port);

  /* إنشاء قاعدة العميل */
  await instance.createDatabase(database);
  console.log("✓ إنشاء قاعدة", database);

  /* كتابة وقراءة */
  const { Client } = require("pg");
  const client = new Client({
    host: "127.0.0.1",
    port,
    user,
    password,
    database,
  });
  await client.connect();
  await client.query("create table smoke_test (id serial primary key, label text)");
  await client.query("insert into smoke_test (label) values ($1)", ["ok"]);
  const rows = await client.query("select label from smoke_test");
  assert.equal(rows.rows[0].label, "ok", "القراءة من القاعدة المدمجة فشلت");
  await client.end();
  console.log("✓ كتابة وقراءة بيانات في القاعدة المدمجة");

  /* الإيقاف */
  await instance.stop();
  console.log("✓ إيقاف PostgreSQL المدمج");

  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log("\n✅ PostgreSQL المدمج يعمل بشكل صحيح");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ فشل فحص PostgreSQL المدمج:", err && err.message ? err.message : err);
  try {
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch {
    /* تجاهل */
  }
  process.exit(1);
});
