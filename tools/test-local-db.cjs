/*
 * اختبار «القاعدة المحلية التلقائية» لنسخة ويندوز.
 *
 * ماذا يتحقق؟
 *  1) تشغيل PostgreSQL المدمج على جهاز العميل وإنشاء قاعدة `cash_you` تلقائياً.
 *  2) فتح البرنامج عليها ينشئ كل جداوله بلا أي إعداد يدوي.
 *  3) المالك والكاشير يسجّلان دخولهما بأنفسهما داخل قاعدتهم.
 *  4) استقلال كل تثبيت عن غيره: لا حساب مالك مشترك ولا بيانات مشتركة.
 *  5) إنشاء قاعدة مفقودة على رابط يعطيه العميل.
 *
 * التشغيل: node tools/build-desktop-assets.cjs ثم node tools/test-local-db.cjs
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "cy-local-db-"));

/* electron/local-db.cjs يعتمد على electron — نوفّر بديلاً بسيطاً */
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getPath: () => userData } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const localDb = require("../electron/local-db.cjs");
Module._load = originalLoad;

const { startLocalServer, stopLocalServer, hasLocalServer } = require("../electron/local-server.cjs");

/** ينشئ نسخة مستقلة من وحدة إدارة القاعدة المحلية (تثبيت آخر) */
function loadForDir(dir) {
  const Module2 = require("node:module");
  const original = Module2._load;
  Module2._load = function (request, parent, isMain) {
    if (request === "electron") return { app: { getPath: () => dir } };
    return original.call(this, request, parent, isMain);
  };
  delete require.cache[require.resolve("../electron/local-db.cjs")];
  const mod = require("../electron/local-db.cjs");
  Module2._load = original;
  return mod;
}

async function main() {
  /* ---------- 1) PostgreSQL المدمج ---------- */
  const url = await localDb.startEmbeddedPostgres();
  assert.ok(url, "PostgreSQL المدمج يجب أن يعمل");
  console.log("✓ قاعدة بيانات محلية تلقائية:", url.replace(/:[^:@]+@/, ":••••@"));

  /* ---------- 2) فتح البرنامج ينشئ الجداول ---------- */
  assert.ok(hasLocalServer(), "حزمة الخادم المحلي غير موجودة — شغّل tools/build-desktop-assets.cjs");
  const appUrl = await startLocalServer(url);
  assert.ok(appUrl, "الخادم المحلي لم يبدأ");
  const health = await fetch(`${appUrl}/api/health`).then((r) => r.json());
  assert.equal(health.ok, true, "الخادم المحلي لا يعمل");
  const boot = await fetch(`${appUrl}/api/bootstrap`);
  assert.equal(boot.status, 200, "البرنامج لم يستطع قراءة البيانات");
  console.log("✓ البرنامج فتح على القاعدة المحلية المولّدة تلقائياً");

  const { Client } = require("pg");
  const client = new Client({ connectionString: url });
  await client.connect();
  const tables = await client.query(
    `select count(*)::int as c from information_schema.tables where table_schema = 'public'`,
  );
  assert.ok(tables.rows[0].c >= 20, `المفروض إنشاء كل الجداول (${tables.rows[0].c})`);
  console.log("✓ عدد الجداول المنشأة تلقائياً:", tables.rows[0].c);

  /* ---------- 3) المالك يسجّل نفسه ---------- */
  const registered = await fetch(`${appUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "owner_x", fullName: "مالك المتجر", password: "123456" }),
  });
  const regJson = await registered.json();
  assert.equal(registered.status, 200, `فشل تسجيل المالك: ${JSON.stringify(regJson)}`);
  assert.equal(regJson.user.role, "owner", "أول حساب يصبح مالكاً");
  console.log("✓ المالك يسجّل نفسه: ", regJson.user.username);

  /* ---------- 4) استقلال كل تثبيت ---------- */
  const other = fs.mkdtempSync(path.join(os.tmpdir(), "cy-local-db2-"));
  const localDb2 = loadForDir(other);
  const url2 = await localDb2.startEmbeddedPostgres();
  assert.ok(url2 && url2 !== url, "كل تثبيت يحصل على قاعدة مستقلة");
  const client2 = new Client({ connectionString: url2 });
  await client2.connect();
  const secondTables = await client2.query(
    `select count(*)::int as c from information_schema.tables where table_schema = 'public' and table_name = 'app_users'`,
  );
  assert.equal(secondTables.rows[0].c, 0, "قاعدة التثبيت الثاني فارغة تماماً");
  const firstUsers = await client.query(`select count(*)::int as c from app_users`);
  assert.equal(firstUsers.rows[0].c, 1, "قاعدة العميل الأول تحتفظ بحسابه فقط");
  console.log("✓ كل تثبيت له قاعدة وحسابات مستقلة — لا مالك مشترك");
  await client2.end();

  /* ---------- 5) إنشاء قاعدة مفقودة على رابط يعطيه العميل ---------- */
  const admin = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
  });
  await admin.connect();
  await admin.query("drop database if exists cash_you_auto with (force)");
  await admin.end();
  const created = await localDb.ensureDatabaseExists(
    "postgresql://postgres:postgres@127.0.0.1:5432/cash_you_auto",
  );
  assert.equal(created.ok, true, `فشل إنشاء قاعدة العميل: ${created.message}`);
  const check = new Client({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/cash_you_auto",
  });
  await check.connect();
  const ready = await check.query("select 1 as ok");
  assert.equal(ready.rows[0].ok, 1, "القاعدة المنشأة قابلة للاستخدام");
  await check.end();
  console.log("✓ قاعدة العميل تُنشأ تلقائياً على الرابط الذي يضيفه العميل");

  await client.end();
  stopLocalServer();
  console.log("\n✅ كل اختبارات القاعدة المحلية التلقائية نجحت");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ فشل الاختبار:", err.message);
  console.error(err.stack);
  stopLocalServer();
  process.exit(1);
});
