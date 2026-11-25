/*
 * فحص قاعدة البيانات المحلية المدمجة — يعمل على ويندوز ولينكس.
 *
 * الهدف: التأكد أن ما يعمله العميل فعلاً عند أول تشغيل:
 *  - تشغيل PostgreSQL المدمج تلقائياً (عبر pg_ctl على ويندوز — لأن
 *    postgres.exe يرفض العمل داخل جلسة إدارية).
 *  - إنشاء قاعدة `cash_you` تلقائياً.
 *  - قراءة وكتابة بيانات فيها.
 *  - إيقاف الخادم بشكل نظيف.
 *
 * التشغيل: node tools/test-embedded-postgres.cjs
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const userData = fs.mkdtempSync(path.join(os.tmpdir(), "cy-embedded-"));

/* electron/local-db.cjs يعتمد على electron — نوفّر بديلاً بسيطاً */
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron") {
    return { app: { getPath: () => userData } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const localDb = require("../electron/local-db.cjs");
Module._load = originalLoad;

async function main() {
  const url = await localDb.startEmbeddedPostgres();
  assert.ok(url, "PostgreSQL المدمج يجب أن يعمل — تأكد من وجود الحزمة على هذا النظام");
  console.log("✓ تشغيل PostgreSQL المدمج:", url.replace(/:[^:@]+@/, ":••••@"));

  /* قاعدة العميل أُنشئت تلقائياً */
  const { Client } = require("pg");
  const client = new Client({ connectionString: url });
  await client.connect();
  const databases = await client.query("select current_database() as name");
  assert.equal(databases.rows[0].name, "cash_you", "قاعدة cash_you لم تُنشأ");

  /* كتابة وقراءة */
  await client.query("create table if not exists smoke_test (id serial primary key, label text)");
  await client.query("insert into smoke_test (label) values ($1)", ["ok"]);
  const rows = await client.query("select label from smoke_test order by id desc limit 1");
  assert.equal(rows.rows[0].label, "ok", "القراءة من القاعدة المدمجة فشلت");
  await client.end();
  console.log("✓ إنشاء قاعدة cash_you + كتابة وقراءة بيانات");

  /* إيقاف نظيف */
  await localDb.stopEmbeddedPostgres();
  console.log("✓ إيقاف PostgreSQL المدمج");

  fs.rmSync(userData, { recursive: true, force: true });
  console.log("\n✅ PostgreSQL المدمج يعمل بشكل صحيح");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ فشل فحص PostgreSQL المدمج:", err && err.message ? err.message : err);
  if (err && err.stack) console.error(err.stack);
  try {
    fs.rmSync(userData, { recursive: true, force: true });
  } catch {
    /* تجاهل */
  }
  process.exit(1);
});
