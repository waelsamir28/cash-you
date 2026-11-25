/*
 * فحص الثنائيات الأصلية داخل الحزمة النهائية بعد electron-builder.
 *
 * ماذا يتحقق؟
 *  1) أن electron-builder أخرج ثنائيات PostgreSQL فعلياً إلى
 *     `resources/app.asar.unpacked` (أي أن glob الخاص بـ `asarUnpack` صحيح).
 *  2) أن الكود المعبّأ **داخل app.asar الحقيقي** يستطيع تشغيل PostgreSQL
 *     وتهيئته، مع ترميز UTF8 وقراءة نص عربي.
 *
 * لماذا نفكّ ASAR بدل تشغيل الحزمة كما هي؟
 * لأن تشغيل الكود داخل Electron الحقيقي يتطلب نافذة/دورة حياة تطبيق كاملة
 * (و`require("electron")` غير متاح تحت ELECTRON_RUN_AS_NODE). فنستخرج محتوى
 * `app.asar` إلى مجلد مؤقت ونضع بجواره الثنائيات من `app.asar.unpacked` —
 * وهذا يعيد إنتاج الظرف الذي فشل فيه الإصدار 1.3.0 بدقة: الكود في مجلد
 * «حزمة» والثنائيات في مجلد «unpacked» منفصل.
 *
 * التشغيل: node tools/test-packaged-postgres.cjs [مجلد الحزمة]
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");

/** مجلد الحزمة غير المضغوطة */
function resolveUnpackedDir() {
  const fromArg = process.argv[2];
  if (fromArg) return path.resolve(fromArg);
  const candidates = ["win-unpacked", "linux-unpacked", "mac", "mac-arm64"];
  for (const name of candidates) {
    const dir = path.join(root, "release", name);
    if (fs.existsSync(dir)) return dir;
  }
  return path.join(root, "release", "win-unpacked");
}

const unpackedDir = resolveUnpackedDir();
const resourcesDir = path.join(unpackedDir, "resources");
const appAsar = path.join(resourcesDir, "app.asar");
const unpackedRoot = path.join(resourcesDir, "app.asar.unpacked");

const PLATFORM_PACKAGES = {
  "win32-x64": ["@embedded-postgres/windows-x64", ["initdb.exe", "pg_ctl.exe", "postgres.exe"]],
  "linux-x64": ["@embedded-postgres/linux-x64", ["initdb", "pg_ctl", "postgres"]],
  "linux-arm64": ["@embedded-postgres/linux-arm64", ["initdb", "pg_ctl", "postgres"]],
  "darwin-x64": ["@embedded-postgres/darwin-x64", ["initdb", "pg_ctl", "postgres"]],
  "darwin-arm64": ["@embedded-postgres/darwin-arm64", ["initdb", "pg_ctl", "postgres"]],
};

function fail(message) {
  console.error(`\n✗ ${message}`);
  /*
   * نُخرج السبب كتعليق على GitHub Actions حتى يظهر في صفحة التشغيل دون
   * الحاجة لتنزيل السجلات (فشل هذه الخطوة يمنع نشر ملف التثبيت).
   */
  if (process.env.GITHUB_ACTIONS === "true") {
    const flat = String(message).replace(/\r?\n/g, " | ").slice(0, 1200);
    console.log(`::error title=Packaged PostgreSQL::${flat.replace(/%/g, "%25")}`);
  }
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

/** نسخ شجرة مع الحفاظ على الأذونات والروابط */
function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isSymbolicLink()) {
      try {
        fs.symlinkSync(fs.readlinkSync(from), to);
      } catch {
        /* منصة لا تسمح بالروابط */
      }
    } else if (entry.isDirectory()) {
      copyTree(from, to);
    } else {
      fs.copyFileSync(from, to);
      try {
        fs.chmodSync(to, fs.statSync(from).mode);
      } catch {
        /* تجاهل */
      }
    }
  }
}

async function main() {
  if (!fs.existsSync(appAsar)) fail(`لم أجد الحزمة: ${appAsar}`);
  if (!fs.existsSync(unpackedRoot)) {
    fail(
      `لم أجد ${unpackedRoot}\n` +
        `  أي أن electron-builder لم يُخرج الثنائيات من ASAR — تحقّق من build.asarUnpack.`,
    );
  }
  ok(`الحزمة موجودة: ${path.relative(root, appAsar)}`);

  /* 1) الثنائيات الأصلية على القرص خارج ASAR */
  const key = `${process.platform}-${process.arch}`;
  const mapping = PLATFORM_PACKAGES[key];
  if (!mapping) {
    console.log(`… منصة غير معروفة (${key}) — تخطّي فحص الثنائيات`);
    return;
  }
  const [pkgName, binaries] = mapping;
  const platformRoot = path.join(unpackedRoot, "node_modules", pkgName);
  const binDir = path.join(platformRoot, "native", "bin");

  for (const name of binaries) {
    const file = path.join(binDir, name);
    if (!fs.existsSync(file)) {
      fail(
        `الثنائي مفقود من الحزمة خارج ASAR:\n  ${file}\n` +
          `  electron-builder يجب أن يضع ملفات @embedded-postgres في app.asar.unpacked.`,
      );
    }
    const size = fs.statSync(file).size;
    if (size < 1024) fail(`${name} صغير بشكل غير منطقي (${size} بايت)`);
  }
  ok(`كل ثنائيات PostgreSQL على القرص: ${binaries.join(", ")}`);

  const shareDir = path.join(platformRoot, "native", "share");
  if (!fs.existsSync(shareDir)) fail(`مجلد share مفقود: ${shareDir}`);
  ok("مجلد share (ملفات الترميز/التهيئة) موجود خارج ASAR");

  /* مكتبات التشغيل يجب أن تكون بجوار الثنائيات (DLLs على ويندوز) */
  const dlls = fs.readdirSync(binDir).filter((f) => f.toLowerCase().endsWith(".dll"));
  if (process.platform === "win32") {
    if (dlls.length < 5) fail(`عدد DLLs غير منطقي في bin: ${dlls.length}`);
    ok(`${dlls.length} مكتبة DLL بجوار الثنائيات`);
  }
  const libDir = path.join(platformRoot, "native", "lib");
  if (!fs.existsSync(libDir)) fail(`مجلد lib مفقود: ${libDir}`);
  ok("مجلد lib موجود خارج ASAR");

  /* 2) نفكّ app.asar ونشغّل الكود المعبّأ بجوار الثنائيات */
  let asar;
  try {
    asar = require("@electron/asar");
  } catch {
    fail("الحزمة @electron/asar غير متاحة — لا يمكن فحص محتوى app.asar");
  }

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "cy-packaged-"));
  const extracted = path.join(work, "app");
  try {
    asar.extractAll(appAsar, extracted);
  } catch (err) {
    fail(`تعذّر فك app.asar: ${err && err.message ? err.message : err}`);
  }
  ok(`فُكّ app.asar (${fs.readdirSync(extracted).length} عنصراً)`);

  const localDbFile = path.join(extracted, "electron", "local-db.cjs");
  if (!fs.existsSync(localDbFile)) fail(`electron/local-db.cjs مفقود داخل app.asar`);
  if (!fs.existsSync(path.join(extracted, "node_modules", "pg"))) {
    fail("node_modules/pg مفقود داخل app.asar");
  }
  ok("الكود ووحدات pg موجودة داخل app.asar");

  /*
   * نضع الثنائيات في موضع «unpacked» بجوار مجلد الكود، بنفس الترتيب الذي
   * يتوقعه الكود بعد التغليف: <resources>/app.asar.unpacked/...
   */
  const fakeResources = path.join(work, "resources");
  fs.mkdirSync(fakeResources, { recursive: true });
  fs.renameSync(extracted, path.join(fakeResources, "app.asar"));
  copyTree(unpackedRoot, path.join(fakeResources, "app.asar.unpacked"));

  const asarDir = path.join(fakeResources, "app.asar");
  const userData = path.join(work, "userData");
  fs.mkdirSync(userData, { recursive: true });

  /* نحاكي `electron.app.getPath` — الكود يحتاج electron، ونوفّر بديلاً بسيطاً */
  const Module = require("node:module");
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "electron") return { app: { getPath: () => userData } };
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    const localDb = require(path.join(asarDir, "electron", "local-db.cjs"));
    const { Client } = require(path.join(asarDir, "node_modules", "pg"));

    const url = await localDb.startEmbeddedPostgres();
    if (!url) {
      const reason =
        typeof localDb.embeddedDatabaseError === "function"
          ? localDb.embeddedDatabaseError()
          : "(لا تفاصيل)";
      throw new Error(`startEmbeddedPostgres أعاد null — السبب: ${reason}`);
    }
    ok(`تشغيل PostgreSQL من الحزمة: ${url.replace(/:[^:@]+@/, ":••••@")}`);

    const client = new Client({ connectionString: url });
    await client.connect();
    const enc = await client.query("show server_encoding");
    if (enc.rows[0].server_encoding !== "UTF8") {
      throw new Error(`ترميز الخادم ليس UTF8: ${enc.rows[0].server_encoding}`);
    }
    const text = "CASH YOU — وائل الجمال 01222355769";
    await client.query("create table if not exists packaged_probe (v text)");
    await client.query("insert into packaged_probe (v) values ($1)", [text]);
    const back = await client.query("select v from packaged_probe order by v desc limit 1");
    if (back.rows[0].v !== text) throw new Error("فشلت قراءة النص العربي بعد الكتابة");
    await client.end();
    ok("server_encoding=UTF8 والنص العربي سليم");

    await localDb.stopEmbeddedPostgres();
    ok("إيقاف الخادم بنظافة");
  } finally {
    Module._load = originalLoad;
    try {
      fs.rmSync(work, { recursive: true, force: true });
    } catch {
      /* قد تكون ملفات الخادم مقفلة لحظياً على ويندوز */
    }
  }

  console.log("\n✅ PostgreSQL المدمج يعمل من الحزمة النهائية كما يعمل عند العميل");
  /* خروج صريح: أي مقبض مفتوح متبقٍّ قد يُعلّق العملية */
  process.exit(0);
}

main().catch((err) => fail(err && err.message ? err.message : String(err)));
