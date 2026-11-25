/**
 * اختبار محرك المزامنة بين قاعدة محلية وأخرى سحابية.
 *
 * التشغيل:
 *   node tools/test-db-sync.cjs
 *
 * متطلبات: خادم PostgreSQL يعمل، وقاعدتان `sync_local` و`sync_cloud` بنفس المخطط.
 */
const assert = require("node:assert/strict");
const { Client } = require("pg");
const syncModule = require("../electron/db-sync.cjs");
const { syncDatabases } = syncModule;

const LOCAL = process.env.SYNC_LOCAL_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/sync_local";
const CLOUD = process.env.SYNC_CLOUD_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/sync_cloud";

const TABLES = [
  "app_users",
  "categories",
  "customers",
  "expenses",
  "installment_plans",
  "installments",
  "invoice_items",
  "invoices",
  "payment_methods",
  "products",
  "purchase_items",
  "purchases",
  "return_items",
  "returns",
  "settings",
  "shifts",
  "suppliers",
  "treasury_movements",
  "vouchers",
];

async function client(url) {
  const c = new Client({ connectionString: url });
  await c.connect();
  return c;
}

async function wipe(c) {
  await c.query("TRUNCATE " + TABLES.join(", ") + " RESTART IDENTITY CASCADE");
}

async function main() {
  const local = await client(LOCAL);
  const cloud = await client(CLOUD);

  await wipe(local);
  await wipe(cloud);

  /* ---------- بيانات أساسية ---------- */
  await local.query(`INSERT INTO categories (name, hue, sort_order) VALUES ('مشروبات','cyan',1)`);
  await local.query(`INSERT INTO categories (name, hue, sort_order) VALUES ('أطعمة','red',2)`);
  await local.query(
    `INSERT INTO products (code, name, category_id, unit, price, wholesale_price, cost, stock, min_stock_limit, sort_order)
     VALUES ('P-1','عصير',1,'زجاجة',25,20,15,10,2,1)`,
  );
  await local.query(
    `INSERT INTO customers (name, phone, address, opening_balance, balance, created_at)
     VALUES ('أحمد','0100','شارع',0,0, now())`,
  );
  await local.query(
    `INSERT INTO suppliers (name, phone, address, opening_balance, balance, created_at)
     VALUES ('مورد','0111','شارع',0,0, now())`,
  );
  await local.query(`INSERT INTO payment_methods (name) VALUES ('نقدي')`);

  /* فاتورة محلية */
  await local.query(
    `INSERT INTO invoices (number, customer_id, customer_name, payment_method, sale_type, subtotal, total, paid, remaining, items_count, user_name, created_at)
     VALUES (1001, (SELECT id FROM customers WHERE name='أحمد'), 'أحمد', 'نقدي', 'نقدي', 25, 25, 25, 0, 1, 'م. وائل', now())`,
  );
  await local.query(
    `INSERT INTO invoice_items (invoice_id, product_id, code, name, unit, qty, price, discount, total)
     SELECT i.id, p.id, p.code, p.name, p.unit, 1, p.price, 0, p.price
     FROM invoices i, products p WHERE i.number = 1001 AND p.code = 'P-1'`,
  );

  /* فاتورة سحابية (نفس الرقمKANشي = تعارض مفتاح عمل مقصود) */
  await cloud.query(`INSERT INTO categories (name, hue, sort_order) VALUES ('حلويات','pink',3)`);
  await cloud.query(
    `INSERT INTO products (code, name, category_id, unit, price, wholesale_price, cost, stock, min_stock_limit, sort_order)
     VALUES ('P-2','كيك',1,'قطعة',40,30,25,7,2,2)`,
  );
  await cloud.query(
    `INSERT INTO invoices (number, customer_name, payment_method, sale_type, subtotal, total, paid, remaining, items_count, user_name, created_at)
     VALUES (2002, 'عميل سحابي', 'نقدي', 'نقدي', 40, 40, 40, 0, 1, 'سحابي', now())`,
  );

  /* ---------- 1) المزامنة ثنائية الاتجاه ---------- */
  const r1 = await syncDatabases(local, cloud, "both");
  console.log("report(both):", JSON.stringify(r1, null, 2));
  assert.equal(r1.ok, true, "المزامنة الثنائية يجب أن تنجح");
  assert.ok(r1.pushed > 0, "يجب نسخ سجلات إلى السحابية");
  assert.ok(r1.pulled > 0, "يجب نسخ سجلات إلى القاعدة المحلية");
  assert.equal(r1.copied, r1.pushed + r1.pulled, "الإجمالي = مجموع الاتجاهين");
  assert.ok(
    r1.details.every((d) => d.direction === "push" || d.direction === "pull"),
    "كل جدول يجب أن يحمل اتجاهه",
  );

  const catLocal = await local.query("SELECT name FROM categories ORDER BY name");
  const catCloud = await cloud.query("SELECT name FROM categories ORDER BY name");
  assert.deepEqual(
    catLocal.rows.map((r) => r.name),
    catCloud.rows.map((r) => r.name),
    "التصنيفات يجب أن تتطابق بعد المزامنة",
  );

  const invLocal = await local.query("SELECT number FROM invoices ORDER BY number");
  const invCloud = await cloud.query("SELECT number FROM invoices ORDER BY number");
  assert.deepEqual(
    invLocal.rows.map((r) => r.number),
    [1001, 2002],
    "كل الفواتير يجب أن تكون موجودة في الطرفين",
  );
  assert.deepEqual(
    invCloud.rows.map((r) => r.number),
    [1001, 2002],
    "كل الفواتير يجب أن تكون موجودة في الطرفين",
  );

  /* ---------- 2) ربط المفاتيح الأجنبية صحيح ---------- */
  const itemsCloud = await cloud.query(
    `SELECT ii.code, i.number FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id`,
  );
  assert.equal(itemsCloud.rowCount, 1, "بنود الفاتورة يجب أن تنتقل للطرف الآخر");
  assert.equal(itemsCloud.rows[0].number, 1001, "بنود الفاتورة يجب أن ترتبط بالفاتورة الصحيحة");

  const custCloud = await cloud.query(
    `SELECT c.name FROM invoices i JOIN customers c ON c.id = i.customer_id WHERE i.number = 1001`,
  );
  assert.equal(custCloud.rowCount, 1, "الفاتورة يجب أن remain مرتبطة بالعميل الصحيح");

  /* ---------- 3) المزامنة المتكررة لا تكرّر السجلات ---------- */
  const r2 = await syncDatabases(local, cloud, "both");
  console.log("report(both again):", r2.copied, r2.message);
  assert.equal(r2.copied, 0, "المزامنة المتكررة يجب ألا تنسخ شيئاً");
  const invCount = await cloud.query("SELECT count(*)::int c FROM invoices");
  assert.equal(invCount.rows[0].c, 2, "لا تكرار في الفواتير");

  /* ---------- 4) الدفع فقط ---------- */
  await local.query(
    `INSERT INTO products (code, name, category_id, unit, price, wholesale_price, cost, stock, min_stock_limit, sort_order)
     VALUES ('P-3','شاي',1,'علبة',30,25,20,3,1,3)`,
  );
  const r3 = await syncDatabases(local, cloud, "push");
  console.log("report(push):", r3.pushed, r3.pulled, r3.message);
  assert.ok(r3.pushed > 0, "الدفع يجب أن ينسخ إلى السحابية");
  assert.equal(r3.pulled, 0, "الدفع لا يجب أن ينسخ إلى المحلية");
  const prodCloud = await cloud.query("SELECT name FROM products WHERE code='P-3'");
  assert.equal(prodCloud.rowCount, 1, "المنتج المحلي يجب أن يصل للسحابة");

  /* ---------- 5) السحب فقط ---------- */
  await cloud.query(
    `INSERT INTO products (code, name, category_id, unit, price, wholesale_price, cost, stock, min_stock_limit, sort_order)
     VALUES ('P-4','مياه',1,'زجاجة',10,8,6,20,2,4)`,
  );
  const r4 = await syncDatabases(local, cloud, "pull");
  console.log("report(pull):", r4.pushed, r4.pulled, r4.message);
  assert.ok(r4.pulled > 0, "السحب يجب أن ينسخ إلى المحلية");
  assert.equal(r4.pushed, 0, "السحب لا يجب أن ينسخ إلى السحابية");
  const prodLocal = await local.query("SELECT name FROM products WHERE code='P-4'");
  assert.equal(prodLocal.rowCount, 1, "المنتج السحابي يجب أن يصل للقاعدة المحلية");

  /* ---------- 6) الأحدث يفوز ---------- */
  await cloud.query(
    `UPDATE invoices SET total = 999, created_at = now() - interval '2 hours' WHERE number = 1001`,
  );
  await local.query(
    `UPDATE invoices SET total = 111, created_at = now() + interval '1 hour' WHERE number = 1001`,
  );
  const r5 = await syncDatabases(local, cloud, "push");
  console.log("report(push newest):", r5.pushed, r5.message);
  const after = await cloud.query("SELECT total FROM invoices WHERE number = 1001");
  assert.equal(Number(after.rows[0].total), 111, "السجل الأحدث محلياً يجب أن يغلب");

  /* ---------- 7) لا حذف ---------- */
  const before = await cloud.query("SELECT count(*)::int c FROM products");
  await syncDatabases(local, cloud, "push");
  const afterCount = await cloud.query("SELECT count(*)::int c FROM products");
  assert.equal(afterCount.rows[0].c, before.rows[0].c, "المزامنة لا تحذف أي سجل");

  /* ---------- 8) الإعدادات والمستخدمون تُنسخ دائماً ---------- */
  await local.query(
    `INSERT INTO settings (key, value) VALUES ('shop_name','محلي') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  );
  await local.query(
    `INSERT INTO app_users (username, full_name, password_hash, role, created_at)
     VALUES ('owner','المالك','hash1','owner', now())`,
  );
  const r6 = await syncDatabases(local, cloud, "push");
  const setting = await cloud.query("SELECT value FROM settings WHERE key='shop_name'");
  assert.equal(setting.rows[0]?.value, "محلي", "الإعدادات يجب أن تنتقل");
  const user = await cloud.query("SELECT username FROM app_users WHERE username='owner'");
  assert.equal(user.rowCount, 1, "المستخدمون يجب أن ينتقلوا");
  console.log("report(settings/users):", r6.pushed);

  /* ---------- 9) حماية هوية العميل: لا نسخ حسابات بين عملاء ---------- */
  /* البصمة: القاعدة المحلية تخصّ العميل "أ" والسحابية تخصّ العميل "ب" */
  await local.query(
    `INSERT INTO settings (key, value) VALUES ('customer.identity','client_a')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  );
  await cloud.query(
    `INSERT INTO settings (key, value) VALUES ('customer.identity','client_b')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  );

  const identity = await syncModule.checkCustomerIdentity(local, cloud);
  assert.equal(identity.ok, false, "اختلاف البصمة يجب أن يمنع المزامنة");
  assert.match(identity.reason || "", /عملاء مختلفين/, "سبب الرفض يجب أن يوضّح الفرق");
  console.log("✓ المزامنة مرفوضة بين عملاء مختلفين:", identity.reason);

  /* حساب عميل آخر في السحابة يجب ألا ينتقل إلى قاعدة العميل "أ" */
  await cloud.query(
    `INSERT INTO app_users (username, full_name, password_hash, role, created_at)
     VALUES ('other_client','عميل آخر','hash2','owner', now())
     ON CONFLICT (username) DO NOTHING`,
  );
  await cloud.query(
    `INSERT INTO settings (key, value) VALUES ('secret_of_b','قيمة سرية')
     ON CONFLICT (key) DO NOTHING`,
  );
  const blockedReport = await syncModule.syncByUrl(LOCAL, CLOUD, "both");
  assert.equal(blockedReport.ok, false, "المزامنة الكاملة يجب أن تُرفض");
  const leakedUser = await local.query("SELECT username FROM app_users WHERE username='other_client'");
  assert.equal(leakedUser.rowCount, 0, "حساب عميل آخر لا ينتقل بين العملاء");
  const leakedSetting = await local.query("SELECT value FROM settings WHERE key='secret_of_b'");
  assert.equal(leakedSetting.rowCount, 0, "إعدادات عميل آخر لا تنتقل بين العملاء");
  console.log("✓ لا تسريب لحسابات أو إعدادات عميل آخر");

  /* ---------- 10) البصمة نفسها → المزامنة مسموحة ---------- */
  await cloud.query(
    `INSERT INTO settings (key, value) VALUES ('customer.identity','client_a')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
  );
  const sameIdentity = await syncModule.checkCustomerIdentity(local, cloud);
  assert.equal(sameIdentity.ok, true, "تطابق البصمة يسمح بالمزامنة");
  const okReport = await syncModule.syncByUrl(LOCAL, CLOUD, "both");
  assert.equal(okReport.ok, true, "المزامنة بين قاعدتين للعميل نفسه تنجح");
  console.log("✓ المزامنة مسموحة لنفس العميل:", okReport.message);

  /* ---------- 11) قاعدة محلية جديدة تتبنّى بصمة العميل ---------- */
  const fresh = await client(process.env.SYNC_FRESH_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/sync_fresh");
  await wipe(fresh);
  const freshIdentity = await syncModule.checkCustomerIdentity(fresh, cloud);
  assert.equal(freshIdentity.ok, true, "قاعدة جديدة بلا بصمة مقبولة");
  await syncModule.syncByUrl(
    process.env.SYNC_FRESH_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/sync_fresh",
    CLOUD,
    "both",
  );
  const stamped = await fresh.query("SELECT value FROM settings WHERE key='customer.identity'");
  assert.equal(stamped.rows[0]?.value, "client_a", "القاعدة الجديدة تتبنّى بصمة العميل");
  console.log("✓ قاعدة العميل الجديدة تتبنّى بصمته عند أول مزامنة");
  await fresh.end();

  console.log("\n✅ كل اختبارات المزامنة نجحت");
  await local.end();
  await cloud.end();
}

main().catch(async (err) => {
  console.error("❌ فشل الاختبار:", err.message);
  console.error(err.stack);
  process.exit(1);
});
