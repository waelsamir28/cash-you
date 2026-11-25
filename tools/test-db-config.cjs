/*
 * اختبار جسر قاعدة البيانات (electron/db-config.cjs) بدون تشغيل Electron.
 *
 * نتحقق من:
 *  1) قراءة الإعداد المحفوظ على جهاز العميل.
 *  2) الحفظ على جهاز العميل (وليس في ملف مشترك بين العملاء).
 *  3) اختبار الاتصال من جهاز العميل نفسه.
 *  4) فصل رابط القاعدة المحلية عن الرابط السحابي (حفظ أحدهما لا يمسّ الآخر).
 *  5) عزل التثبيتات: ما يحفظه عميل لا يراه عميل آخر — ولا يُقرأ من
 *     ملف التطبيق المشترك (app-config.json).
 */
const Module = require("node:module");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const assert = require("node:assert/strict");

const tmpUser = fs.mkdtempSync(path.join(os.tmpdir(), "cy-userdata-"));
const handlers = {};
const origLoad = Module._load;
Module._load = function (request) {
  if (request === "electron") {
    return {
      app: { getPath: () => tmpUser },
      ipcMain: { handle: (name, fn) => { handlers[name] = fn; } },
      shell: { openExternal: async () => true },
    };
  }
  return origLoad.apply(this, arguments);
};

const { registerDbHandlers, readLocalDbConfig, writeLocalDbConfig } = require("../electron/db-config.cjs");
registerDbHandlers();

/** يحمّل وحدة الجسر لمجلد مستخدم آخر (تثبيت آخر) */
function loadForDir(dir) {
  const Module2 = require("node:module");
  const original = Module2._load;
  const localHandlers = {};
  Module2._load = function (request) {
    if (request === "electron") {
      return {
        app: { getPath: () => dir },
        ipcMain: { handle: (name, fn) => { localHandlers[name] = fn; } },
        shell: { openExternal: async () => true },
      };
    }
    return original.apply(this, arguments);
  };
  delete require.cache[require.resolve("../electron/db-config.cjs")];
  const mod = require("../electron/db-config.cjs");
  mod.registerDbHandlers();
  Module2._load = original;
  return { handlers: localHandlers, mod };
}

(async () => {
  const url = "postgresql://waelsamir:secret123@localhost:5432/final_test";
  const show = (label, v) => console.log(`${label}: ${JSON.stringify(v)}`);

  show("1) GET قبل الحفظ", await handlers["cash-you:get-db-config"]());
  show("2) حفظ محلي", await handlers["cash-you:save-db-config"](null, { mode: "local", url }));
  show("3) GET بعد الحفظ", await handlers["cash-you:get-db-config"]());
  show("4) اختبار صحيح", await handlers["cash-you:test-db-connection"](null, { url }));
  show("5) منفذ خطأ", await handlers["cash-you:test-db-connection"](null, { url: url.replace("5432", "9999") }));
  show("6) صيغة خطأ", await handlers["cash-you:test-db-connection"](null, { url: "mysql://x" }));
  show("7) قاعدة غير موجودة", await handlers["cash-you:test-db-connection"](null, { url: url.replace("final_test", "no_such_db") }));
  show("8) حفظ برابط فارغ", await handlers["cash-you:save-db-config"](null, { mode: "cloud", url: "" }));

  /* ---------- 9) فصل المحلي عن السحابي ---------- */
  const cloudUrl = "postgresql://client:secret@cloud-host:5432/client_db?sslmode=require";
  await handlers["cash-you:save-db-config"](null, { mode: "cloud", url: cloudUrl });
  const afterCloud = await handlers["cash-you:get-db-config"]();
  assert.equal(afterCloud.hasLocalDb, true, "حفظ رابط سحابي لم يمسّ رابط القاعدة المحلية");
  assert.equal(afterCloud.hasCloudDb, true, "الرابط السحابي لم يُحفظ");
  assert.equal(afterCloud.localMasked.includes("••••"), true, "الرابط المحلي يظهر مخفياً");
  assert.equal(afterCloud.cloudMasked.includes("••••"), true, "الرابط السحابي يظهر مخفياً");
  console.log("9) فصل المحلي عن السحابي: ✓");

  /* ---------- 9b) الرابط المحلي لا يختلط بالسحابي ---------- */
  /*
   * بعد حفظ رابط سحابي ثم إعادة كتابة الرابط المحلي (كما يفعل البرنامج
   * عند تشغيل القاعدة المدمجة) يجب أن يبقى كل رابط في مكانه:
   * الوضع المحلي ⇒ الرابط المحلي، والوضع السحابي ⇒ الرابط السحابي.
   */
  const embeddedUrl = "postgresql://cashyou:secret@127.0.0.1:45491/cash_you";
  writeLocalDbConfig({ mode: "local", url: embeddedUrl });
  const afterLocal = readLocalDbConfig();
  assert.equal(afterLocal.mode, "local", "الوضع يجب أن يبقى محلياً");
  assert.equal(afterLocal.url, embeddedUrl, "الوضع المحلي يشير إلى رابط سحابي — خطأ خطير");
  assert.equal(afterLocal.cloudUrl, cloudUrl, "الرابط السحابي ضاع عند الحفظ المحلي");
  assert.equal(afterLocal.localUrl, embeddedUrl, "الرابط المحلي غير صحيح");
  const state = await handlers["cash-you:get-db-config"]();
  assert.equal(state.hasCloudDb, true, "الرابط السحابي لم يعد محفوظاً");
  assert.equal(state.hasLocalDb, true, "الرابط المحلي لم يعد محفوظاً");
  assert.equal(state.mode, "cloud", "الواجهة تعرض الاتصال المحفوظ (السحابي) للعميل");
  console.log("9b) الوضع لا يختلط بين المحلي والسحابي: ✓");

  /* ---------- 10) عزل التثبيتات ---------- */
  const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), "cy-userdata2-"));
  const other = loadForDir(otherDir);
  const otherState = await other.handlers["cash-you:get-db-config"]();
  assert.equal(otherState.saved, false, "تثبيت آخر رأى رابط العميل الأول!");
  assert.equal(otherState.hasCloudDb, false, "تثبيت آخر رأى الرابط السحابي!");
  assert.equal(otherState.hasLocalDb, false, "تثبيت آخر رأى القاعدة المحلية!");
  console.log("10) عزل التثبيتات: ✓ — لا رابط مشترك بين عميلين");

  /* ---------- 11) الملف المشترك لا يُقرأ ---------- */
  const sharedConfig = path.join(__dirname, "..", "electron", "app-config.json");
  const shared = JSON.parse(fs.readFileSync(sharedConfig, "utf8"));
  assert.equal(typeof shared.dbUrl, "undefined", "الملف المشترك يحتوي رابط قاعدة — خطر تسريب");
  assert.equal(typeof shared.dbMode, "undefined", "الملف المشترك يحتوي وضع قاعدة — خطر تسريب");
  console.log("11) الملف المشترك لا يحمل إعدادات قاعدة: ✓");

  console.log("12) الملف المحفوظ على جهاز العميل:\n" + fs.readFileSync(path.join(tmpUser, "cash-you-db.json"), "utf8").trim());
  console.log("\n✅ كل اختبارات جسر قاعدة البيانات نجحت");
  process.exit(0);
})().catch((err) => {
  console.error("❌ فشل الاختبار:", err.message);
  process.exit(1);
});
