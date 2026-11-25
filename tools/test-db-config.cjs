/*
 * اختبار وحدة جسر قاعدة البيانات (electron/db-config.cjs) بدون تشغيل Electron.
 * نحاكي واجهة electron ونتحقق من: القراءة، الحفظ، واختبار الاتصال.
 */
const Module = require("node:module");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");

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

const { registerDbHandlers } = require("../electron/db-config.cjs");
registerDbHandlers();

(async () => {
  const url = "postgresql://waelsamir:secret123@localhost:5432/final_test";
  const show = (label, v) => console.log(`${label}: ${JSON.stringify(v)}`);

  show("1) GET قبل الحفظ", await handlers["cash-you:get-db-config"]());
  show("2) حفظ", await handlers["cash-you:save-db-config"](null, { mode: "local", url }));
  show("3) GET بعد الحفظ", await handlers["cash-you:get-db-config"]());
  show("4) اختبار صحيح", await handlers["cash-you:test-db-connection"](null, { url }));
  show("5) منفذ خطأ", await handlers["cash-you:test-db-connection"](null, { url: url.replace("5432", "9999") }));
  show("6) صيغة خطأ", await handlers["cash-you:test-db-connection"](null, { url: "mysql://x" }));
  show("7) قاعدة غير موجودة", await handlers["cash-you:test-db-connection"](null, { url: url.replace("final_test", "no_such_db") }));
  show("8) حفظ برابط فارغ", await handlers["cash-you:save-db-config"](null, { mode: "cloud", url: "" }));
  console.log("9) الملف المحفوظ:", fs.readFileSync(path.join(tmpUser, "cash-you-db.json"), "utf8").trim());
})();
