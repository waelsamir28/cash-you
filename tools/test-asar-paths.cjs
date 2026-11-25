/*
 * اختبار انحدار لخطأ الإصدار 1.3.0:
 *   spawn C:\Program Files\CASH YOU\resources\app.asar\node_modules\
 *   @embedded-postgres\windows-x64\native\bin\initdb.exe ENOENT
 *
 * لماذا لا يكفي `tools/test-embedded-postgres.cjs`؟
 * لأنه يشغّل الكود من `node_modules` في مجلد المشروع، ولا يوجد ASAR هناك
 * إطلاقاً — لذلك نجح بينما فشل الإصدار عند العميل.
 *
 * هذا الاختبار يبني بنية الحزمة النهائية على القرص:
 *   <work>/resources/app.asar/...                 ← الكود + الوحدات
 *   <work>/resources/app.asar.unpacked/...        ← ثنائيات PostgreSQL
 * أي أن `__dirname` للوحدة يصبح داخل `app.asar` تماماً كما بعد التغليف،
 * والثنائيات خارجها. ثم يشغّل `electron/local-db.cjs` من داخل `app.asar`
 * ويتحقق من:
 *   1) نجاح تهيئة العنقود وتشغيل الخادم (لا ENOENT).
 *   2) أن الترميز UTF8 (لا صفحة ترميز ويندوز).
 *   3) أن النص العربي يُكتب ويُقرأ كما هو.
 *   4) إغلاق الخادم بنظافة.
 *
 * التشغيل: node tools/test-asar-paths.cjs
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const pkg = require(path.join(root, "package.json"));

/** حزمة النظام الحالية */
const PLATFORM_PACKAGES = {
  "win32-x64": "@embedded-postgres/windows-x64",
  "linux-x64": "@embedded-postgres/linux-x64",
  "linux-arm64": "@embedded-postgres/linux-arm64",
  "darwin-x64": "@embedded-postgres/darwin-x64",
  "darwin-arm64": "@embedded-postgres/darwin-arm64",
};
const platformKey = `${process.platform}-${process.arch}`;
const platformPackage = PLATFORM_PACKAGES[platformKey];
if (!platformPackage) {
  console.log(`… منصة غير مدعومة في هذا الفحص (${platformKey}) — تخطّي`);
  process.exit(0);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), "cy-asar-"));
const resources = path.join(work, "resources");
const appAsar = path.join(resources, "app.asar");
const unpackedRoot = path.join(resources, "app.asar.unpacked");
const userData = path.join(work, "userData");

/** وحدات pg المطلوبة وقت التشغيل — مستخرجة من build.files نفسها */
function pgPackageNames() {
  const names = new Set();
  for (const pattern of pkg.build.files) {
    const match = pattern.match(/^node_modules\/((?:@[^/]+\/)?[^/*]+)/);
    if (!match) continue;
    const name = match[1];
    if (name === "embedded-postgres" || name.startsWith("@embedded-postgres")) continue;
    if (name === "exit-hook") continue;
    names.add(name);
  }
  return [...names];
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(from), to);
    else if (entry.isDirectory()) copyDir(from, to);
    else {
      fs.copyFileSync(from, to);
      fs.chmodSync(to, fs.statSync(from).mode);
    }
  }
}

function cleanup() {
  try {
    fs.rmSync(work, { recursive: true, force: true });
  } catch {
    /* تجاهل */
  }
}

async function main() {
  /* 1) بناء بنية الحزمة كما يفعل electron-builder */
  copyDir(path.join(root, "electron"), path.join(appAsar, "electron"));
  fs.copyFileSync(path.join(root, "package.json"), path.join(appAsar, "package.json"));

  for (const dep of pgPackageNames()) {
    const src = path.join(root, "node_modules", dep);
    if (!fs.existsSync(src)) {
      throw new Error(
        `الحزمة «${dep}» مذكورة في build.files لكنها غير مثبتة — شغّل npm ci`,
      );
    }
    copyDir(src, path.join(appAsar, "node_modules", dep));
  }

  /* الثنائيات الأصلية خارج ASAR — كما يفعل asarUnpack */
  const srcPackage = path.join(root, "node_modules", platformPackage);
  if (!fs.existsSync(srcPackage)) {
    throw new Error(
      `حزمة PostgreSQL لمنصتك غير مثبتة: ${platformPackage}\n` +
        `  على ويندوز تُثبَّت تلقائياً؛ على لينكس/ماك ثبّتها كاعتمادية اختيارية.`,
    );
  }
  copyDir(path.join(srcPackage, "dist"), path.join(appAsar, "node_modules", platformPackage, "dist"));
  fs.copyFileSync(
    path.join(srcPackage, "package.json"),
    path.join(appAsar, "node_modules", platformPackage, "package.json"),
  );
  /*
   * كما وجدنا في الحزمة الفعلية على ويندوز: الحزمة تُوضع كاملة (مع dist)
   * في app.asar.unpacked، ولا تبقى نسخة قابلة للتحميل داخل app.asar.
   * الكود يجب أن يعمل بهذا الشكل، فلا يعتمد إطلاقاً على استيراد الوحدة.
   */
  copyDir(
    path.join(srcPackage, "native"),
    path.join(unpackedRoot, "node_modules", platformPackage, "native"),
  );

  /* 2) المسار الذي تحسبه الوحدة داخل app.asar يجب ألا يكون موجوداً */
  const moduleDir = path.join(appAsar, "node_modules", platformPackage, "dist");
  const binaryName = process.platform === "win32" ? "initdb.exe" : "initdb";
  const binaryInAsar = path.resolve(moduleDir, "..", "native", "bin", binaryName);
  const binaryUnpacked = path.resolve(
    unpackedRoot,
    "node_modules",
    platformPackage,
    "native",
    "bin",
    binaryName,
  );

  console.log(`  مسار الوحدة داخل ASAR : ${path.relative(work, binaryInAsar)}`);
  console.log(`  الثنائي الحقيقي       : ${path.relative(work, binaryUnpacked)}`);

  assert.equal(
    fs.existsSync(binaryInAsar),
    false,
    "المسار داخل app.asar يجب ألا يكون ملفاً قابلاً للتنفيذ — هذا هو أصل العطل",
  );
  assert.equal(fs.existsSync(binaryUnpacked), true, "الثنائي الحقيقي يجب أن يكون خارج ASAR");
  console.log(`✓ الثنائي موجود بالتنسيق الصحيح: ${binaryName} خارج app.asar`);

  /* 3) تحميل الوحدات من داخل app.asar (كما يفعل Electron) */
  const Client = require(path.join(appAsar, "node_modules", "pg")).Client;
  console.log("✓ وحدات pg محمّلة من داخل app.asar");

  /* 4) تشغيل local-db.cjs من داخل app.asar */
  fs.mkdirSync(userData, { recursive: true });
  const Module = require("node:module");
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "electron") return { app: { getPath: () => userData } };
    return originalLoad.call(this, request, parent, isMain);
  };
  const localDb = require(path.join(appAsar, "electron", "local-db.cjs"));

  const url = await localDb.startEmbeddedPostgres();
  assert.ok(url, "تعذّر تشغيل PostgreSQL المدمج من داخل app.asar — هذا هو عطل 1.3.0 نفسه");
  console.log(`✓ تشغيل PostgreSQL من داخل app.asar: ${url.replace(/:[^:@]+@/, ":••••@")}`);

  /* 5) الترميز والنص العربي */
  const client = new Client({ connectionString: url });
  await client.connect();
  const encoding = await client.query("show server_encoding");
  assert.equal(
    encoding.rows[0].server_encoding,
    "UTF8",
    "ترميز الخادم ليس UTF8 — PostgreSQL 19 يرفض UTF8 مع لغات ويندوز التقليدية",
  );
  const arabic = "وائل الجمال — CASH YOU 01222355769";
  await client.query("create table if not exists asar_probe (v text)");
  await client.query("insert into asar_probe (v) values ($1)", [arabic]);
  const stored = await client.query("select v from asar_probe order by v desc limit 1");
  assert.equal(stored.rows[0].v, arabic, "النص العربي لم يُقرأ كما كُتب");
  await client.end();
  console.log("✓ server_encoding=UTF8 والنص العربي سليم");

  /* 6) إيقاف نظيف */
  await localDb.stopEmbeddedPostgres();
  Module._load = originalLoad;
  console.log("✓ إيقاف الخادم بنظافة");

  cleanup();
  console.log("\n✅ مسارات app.asar سليمة — خطأ initdb ENOENT لن يعود");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ فشل فحص مسارات app.asar:", err && err.message ? err.message : err);
  if (err && err.stack && process.env.CI) console.error(err.stack);
  cleanup();
  process.exit(1);
});
