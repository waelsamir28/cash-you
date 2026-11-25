/**
 * اختبار عزل المستأجرين: كل عميل على قاعدة مستقلة.
 *
 * التشغيل:
 *   CASH_YOU_TENANT_MODE=1 node tools/test-tenant-isolation.cjs
 *
 * متطلبات: خادم PostgreSQL يعمل، وقاعدة `tenant_test` بنفس المخطط.
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

/* يحلّ اختصار المسارات @/ داخل الشيفرة المترجمة */
const compiled = path.join(__dirname, "..", ".next-test");
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request.startsWith("@/")) request = path.join(compiled, request.slice(2));
  return resolveFilename.call(this, request, ...args);
};

const { Client } = require("pg");
const { execFileSync } = require("node:child_process");

/* يترجم وحدات TypeScript إن لم تكن مترجمة بعد */
function buildModules() {
  const marker = path.join(compiled, "db", "tenant-pool.js");
  if (require("node:fs").existsSync(marker)) return;
  console.log("… ترجمة وحدات المستأجرين");
  execFileSync(
    "npx",
    ["tsc", "-p", path.join(__dirname, "tsconfig.tenant-test.json")],
    { cwd: path.join(__dirname, ".."), stdio: "inherit" },
  );
}

const BASE = process.env.TENANT_TEST_BASE ?? "postgresql://postgres:postgres@127.0.0.1:5432/tenant_test";

async function main() {
  buildModules();

  const admin = new Client({ connectionString: BASE });
  await admin.connect();

  /* قاعدة نظيفة */
  await admin.query("drop schema if exists public cascade");
  await admin.query("create schema public");

  process.env.DATABASE_URL = BASE;
  process.env.CASH_YOU_TENANT_MODE = "1";
  /* نعطّل إنشاء قواعد جديدة إلا إذا طُلب صراحة (للتوافق مع أي خادم) */
  if (!process.env.CASH_YOU_TENANT_UNIT) process.env.CASH_YOU_TENANT_UNIT = "schema";
  const expectedKind = process.env.CASH_YOU_TENANT_UNIT === "database" ? "database" : "schema";

  /* نحمّل الوحدات بعد ضبط البيئة */
  const { provisionTenantUnit } = require("../.next-test/db/tenant-pool.js");
  const { ensureDatabaseSchema } = require("../.next-test/lib/ensure-schema.js");
  const { getTenantDb } = require("../.next-test/db/tenant-pool.js");
  const { runWithTenant } = require("../.next-test/db/tenant-context.js");
  const { listTenants, findTenantByKey } = require("../.next-test/db/tenant-registry.js");

  /* ---------- 1) تهيئة قاعدة لوحة التحكم ---------- */
  const control = new Client({ connectionString: BASE });
  await control.connect();
  await control.query(
    `create table if not exists "tenants" (
      "id" serial primary key,
      "tenant_key" text not null,
      "unit_kind" text not null default 'database',
      "unit_name" text not null,
      "db_url" text,
      "status" text not null default 'active',
      "created_at" timestamp default now() not null,
      "last_seen_at" timestamp default now() not null
    )`,
  );
  await control.query(`create unique index if not exists tenants_key on "tenants" ("tenant_key")`);

  /* ---------- 2) provision مستأجرين ---------- */
  const a = await provisionTenantUnit();
  const b = await provisionTenantUnit();
  console.log("tenant A:", a.kind, a.name);
  console.log("tenant B:", b.kind, b.name);
  assert.notEqual(a.key, b.key, "كل مستأجر له مفتاح مختلف");
  assert.notEqual(a.name, b.name, "كل مستأجر له وحدة عزل مختلفة");
  assert.equal(a.kind, expectedKind, "نوع وحدة العزل مطابق المطلوب");
  assert.equal(b.kind, expectedKind, "نوع وحدة العزل مطابق المطلوب");

  /* السجل يحفظهما */
  const tenants = await listTenants();
  assert.ok(tenants.length >= 2, "السجل يجب أن يحفظ المستأجرين");

  /* ---------- 3) إنشاء المخطط داخل كل وحدة ---------- */
  for (const t of [a, b]) {
    const ctx = { tenant: t, db: getTenantDb(t) };
    await runWithTenant(ctx, async () => {
      await ensureDatabaseSchema();
    });
  }

  /* ---------- 4) البيانات لا تختلط ---------- */
  const dbA = getTenantDb(a);
  const dbB = getTenantDb(b);

  await runWithTenant({ tenant: a, db: dbA }, async () => {
    await dbA.execute(`insert into "categories" (name) values ('تصنيف A')`);
  });
  await runWithTenant({ tenant: b, db: dbB }, async () => {
    await dbB.execute(`insert into "categories" (name) values ('تصنيف B')`);
  });

  const rowsA = await runWithTenant({ tenant: a, db: dbA }, async () => {
    const res = await dbA.execute(`select name from "categories"`);
    return res.rows.map((r) => r.name);
  });
  const rowsB = await runWithTenant({ tenant: b, db: dbB }, async () => {
    const res = await dbB.execute(`select name from "categories"`);
    return res.rows.map((r) => r.name);
  });

  assert.deepEqual(rowsA, ["تصنيف A"], "قاعدة العميل A تحتوي بياناته فقط");
  assert.deepEqual(rowsB, ["تصنيف B"], "قاعدة العميل B تحتوي بياناته فقط");
  console.log("✓ عزل البيانات بين العملاء");

  /* ---------- 5) البحث بالمفتاح ---------- */
  const found = await findTenantByKey(a.key);
  assert.ok(found, "يجب能找到 المستأجر بمفتاحه");
  assert.equal(found.name, a.name);
  console.log("✓ سجل المستأجرين يعمل");

  /* ---------- 6) المخطط موجود داخل كل وحدة ---------- */
  const check = await control.query(
    `select table_schema from information_schema.tables where table_name = 'categories' order by table_schema`,
  );
  if (expectedKind === "schema") {
    const schemas = check.rows.map((r) => r.table_schema);
    assert.ok(schemas.includes(a.name), "جدول التصنيفات يجب أن يوجد داخل مخطط العميل A");
    assert.ok(schemas.includes(b.name), "جدول التصنيفات يجب أن يوجد داخل مخطط العميل B");
    console.log("✓ المخططات منفصلة:", schemas.join(", "));
  } else {
    /* قواعد مستقلة: كل عميل في قاعدة منفصلة تماماً */
    const dbs = await admin.query(
      `select datname from pg_database where datname like 'cash_you_%' order by datname`,
    );
    const names = dbs.rows.map((r) => r.datname);
    assert.ok(names.includes(a.name), "قاعدة العميل A يجب أن تكون موجودة");
    assert.ok(names.includes(b.name), "قاعدة العميل B يجب أن تكون موجودة");
    console.log("✓ قواعد مستقلة:", names.join(", "));
  }

  await control.end();
  await admin.end();
  console.log("\n✅ كل اختبارات عزل المستأجرين نجحت");
}

main().catch((err) => {
  console.error("❌ فشل الاختبار:", err.message);
  console.error(err.stack);
  process.exit(1);
});
