/*
 * فحص الثنائيات الأصلية داخل الحزمة النهائية بعد electron-builder.
 *
 * يكمل `tools/test-asar-paths.cjs`:
 *  - هذا الملف يتحقق من أن electron-builder نفسه أخرج الثنائيات فعلياً إلى
 *    `resources/app.asar.unpacked` (أي أن glob الخاص بـ `asarUnpack` صحيح).
 *  - ويشغّل الكود المعبّأ **داخل الحزمة الحقيقية** عبر Electron المرفق
 *    (ELECTRON_RUN_AS_NODE) فيُهيّئ عنقود PostgreSQL حقيقياً ويتحقق من
 *    الترميز UTF8 ومن كتابة/قراءة نص عربي.
 *
 * التشغيل: node tools/test-packaged-postgres.cjs [مجلد الحزمة]
 * الافتراضي: release/win-unpacked على ويندوز، أو release/linux-unpacked.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

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
  process.exit(1);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

/**
 * يبحث عن ثنائي Electron الحقيقي داخل الحزمة.
 *
 * الملف الرئيسي اسمه من `productName` (هنا "CASH YOU.exe"). نستبعاد
 * المساعدين (elevate/notification_helper) لأن تشغيلها لا ينفّذ سكربتاً.
 */
function findElectronBinary(dir) {
  const SKIP = /^(setup|uninstall|elevate|notification_helper|crashpad|chrome_crashpad)/i;
  let entries = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const exeFiles = entries.filter((entry) => {
    if (!entry.toLowerCase().endsWith(".exe")) return false;
    if (SKIP.test(entry)) return false;
    try {
      return fs.statSync(path.join(dir, entry)).isFile();
    } catch {
      return false;
    }
  });
  if (exeFiles.length === 0) return null;

  /* نُفضّل ملفاً يحمل اسم المنتج، وإلا أول ملف غير مستبعد */
  const preferred = exeFiles.find((entry) => /cash\s*you/i.test(entry));
  return path.join(dir, preferred ?? exeFiles[0]);
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
  } else {
    const [pkgName, binaries] = mapping;
    const binDir = path.join(unpackedRoot, "node_modules", pkgName, "native", "bin");
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

    /* مكتبات التشغيل يجب أن تكون بجوار الثنائيات */
    const shareDir = path.join(unpackedRoot, "node_modules", pkgName, "native", "share");
    if (!fs.existsSync(shareDir)) fail(`مجلد share مفقود: ${shareDir}`);
    ok("مجلد share (ملفات الترميز/التهيئة) موجود خارج ASAR");

    /* الوحدة نفسها داخل ASAR لتُحمَّل */
    if (!fs.existsSync(path.join(appAsar, "node_modules", pkgName))) {
      fail(`وحدة ${pkgName} غير موجودة داخل app.asar — لن تُحمّل أصلاً`);
    }
    ok(`وحدة ${pkgName} قابلة للتحميل من داخل app.asar`);
  }

  /* 2) تشغيل الكود المعبّأ نفسه عبر Electron المرفق (بلا واجهة) */
  const electronBinary = findElectronBinary(unpackedDir);
  if (!electronBinary) {
    console.log("… لم أجد ثنائي Electron في الحزمة — تخطّي تشغيل الكود المعبّأ");
    return;
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "cy-packaged-"));
  const scriptFile = path.join(workDir, "run.cjs");
  const asarLocalDb = path.join(appAsar, "electron", "local-db.cjs");
  const asarPg = path.join(appAsar, "node_modules", "pg");

  fs.writeFileSync(
    scriptFile,
    `
/* هنا نعمل داخل Electron الحقيقي: resourcesPath يشير إلى مجلد resources */
console.log("PROBE resourcesPath:", process.resourcesPath);
console.log("PROBE platform:", process.platform, process.arch);

const localDb = require(${JSON.stringify(asarLocalDb)});
const { Client } = require(${JSON.stringify(asarPg)});

(async () => {
  const url = await localDb.startEmbeddedPostgres();
  if (!url) {
    const reason = typeof localDb.embeddedDatabaseError === "function"
      ? localDb.embeddedDatabaseError()
      : "(لا تفاصيل)";
    throw new Error("startEmbeddedPostgres أعاد null — السبب: " + reason);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const enc = await client.query("show server_encoding");
  if (enc.rows[0].server_encoding !== "UTF8") {
    throw new Error("ترميز الخادم ليس UTF8: " + enc.rows[0].server_encoding);
  }

  const text = "CASH YOU — وائل الجمال 01222355769";
  await client.query("create table if not exists packaged_probe (v text)");
  await client.query("insert into packaged_probe (v) values ($1)", [text]);
  const back = await client.query("select v from packaged_probe order by v desc limit 1");
  if (back.rows[0].v !== text) throw new Error("فشلت قراءة النص العربي بعد الكتابة");
  await client.end();

  await localDb.stopEmbeddedPostgres();
  console.log("PACKAGED_OK");
})().catch((err) => {
  console.error("PACKAGED_FAIL " + (err && err.message ? err.message : err));
  process.exit(1);
});
`,
    "utf8",
  );

  const result = spawnSync(electronBinary, [scriptFile], {
    cwd: workDir,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    encoding: "utf8",
    timeout: 300000,
  });

  const output = `${result.stdout || ""}\n${result.stderr || ""}`;

  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* تجاهل */
  }

  if (result.status !== 0 || !output.includes("PACKAGED_OK")) {
    const detail = output.trim().split(/\r?\n/).slice(-25).join("\n");
    fail(`فشل تشغيل PostgreSQL المدمج من الحزمة النهائية:\n${detail}`);
  }

  ok("تشغيل المدمج من داخل app.asar + UTF8 + قراءة عربية + إيقاف نظيف");
  console.log("\n✅ PostgreSQL المدمج يعمل من الحزمة النهائية كما يعمل عند العميل");
}

main().catch((err) => fail(err && err.stack ? err.stack : String(err)));
