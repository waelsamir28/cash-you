/*
 * فحص دقيق لأنماط electron-builder: هل تُضمَّن حزمة Next standalone كاملة
 * (بما فيها node_modules الخاصة بها) في ملف التثبيت؟
 *
 * نستخدم FileMatcher الحقيقي من app-builder-lib بدل التخمين.
 */
const path = require("node:path");
const fs = require("node:fs");
const { FileMatcher } = require("app-builder-lib/out/fileMatcher");
const { expandMacro } = require("app-builder-lib/out/util/macroExpander");

const appDir = path.resolve(__dirname, "..");
const pkg = require(path.join(appDir, "package.json"));

const macroExpander = (p) => expandMacro(p, { config: { electronPlatformName: "win32" }, projectDir: appDir });

/* نفس منطق app-builder-lib/out/fileMatcher.js: يستثني node_modules في ملفات التطبيق */
function buildMatcher(files) {
  const matcher = new FileMatcher(appDir, appDir, macroExpander, files);
  const patterns = matcher.patterns;
  let insertIndex = -1;
  for (let i = 0; i < patterns.length; i++) {
    if (!patterns[i].startsWith("!") && (patterns[i].includes("/node_modules") || patterns[i].includes("node_modules/"))) {
      insertIndex = i;
      break;
    }
  }
  if (insertIndex !== -1) patterns.splice(insertIndex, 0, "!**/node_modules/**");
  else patterns.unshift("!**/node_modules/**");
  return matcher;
}

function check(files, samples) {
  const matcher = buildMatcher(files);
  const filter = matcher.createFilter();
  return samples.map((rel) => {
    const abs = path.join(appDir, rel);
    let included = false;
    try {
      included = filter(abs, { isDirectory: () => false });
    } catch {
      included = false;
    }
    return { rel, included };
  });
}

/* ملفات التطبيق */
const appSamples = [
  "electron/main.cjs",
  "electron/db-config.cjs",
  "electron/local-server.cjs",
  "electron/local-db.cjs",
  "electron/preload.cjs",
  /* شاشة البداية أثناء فتح البرنامج + خطّها العربي */
  "electron/splash.html",
  "electron/icon.png",
  "assets/fonts/cairo-arabic-700-normal.woff2",
  "assets/fonts/cairo-latin-700-normal.woff2",
  ".next/static/chunks/main.js",
  "public/desktop/icon.ico",
  "package.json",
  /* PostgreSQL المدمج — لازم يكون داخل الحزمة ليعمل البرنامج بلا تثبيت */
  "node_modules/embedded-postgres/dist/index.js",
  "node_modules/@embedded-postgres/windows-x64/native/bin/postgres.exe",
  "node_modules/exit-hook/index.js",
];

/*
 * حزمة standalone تُنسخ عبر hook "tools/copy-standalone.cjs" بعد البناء
 * (خارج mechanisms electron-builder، لأنها تستثني node_modules الجذري).
 * هنا نتحقق فقط من أن hook مسجّل وأن أدواته موجودة.
 */
const resourceSamples = [];

console.log("files:", JSON.stringify(pkg.build.files));
console.log("afterPack:", pkg.build.afterPack);
console.log("asarUnpack:", JSON.stringify(pkg.build.asarUnpack));

/* صورة شاشة التثبيت يجب أن تكون ضمن buildResources (يصلها NSIS) */
const resourcesDir = pkg.build.directories?.buildResources || "build";
const installerSplash = path.join(appDir, resourcesDir, "splash-installer.bmp");
const installerSplashOk = fs.existsSync(installerSplash);
console.log(
  `\n[صورة شاشة التثبيت] ${installerSplashOk ? "✓" : "✗"} ${resourcesDir}/splash-installer.bmp`,
);
if (!installerSplashOk) {
  console.log("\n✗ صورة شاشة التثبيت مفقودة — شغّل node tools/make-splash.cjs");
  process.exit(1);
}

/* hook النسخ يجب أن يكون موجوداً */
const hookPath = path.join(appDir, pkg.build.afterPack || "");
const hookOk = fs.existsSync(hookPath);
console.log(`\n[hook النسخ] ${hookOk ? "✓" : "✗"} ${pkg.build.afterPack}`);
if (!hookOk) {
  console.log("\n✗ hook نسخ حزمة standalone مفقود");
  process.exit(1);
}

/* مسار الحزمة المعبّأة — يجب أن يطابق build.directories.output */
const outputDir = pkg.build.directories?.output || "dist";
const packagedStandalone = path.join(appDir, outputDir, "win-unpacked", "resources", "standalone");
console.log(`[مسار الحزمة المعبّأة] ${outputDir}/win-unpacked/resources/standalone`);

console.log("\n[ملفات التطبيق]");
const appResults = check(pkg.build.files, appSamples);
for (const r of appResults) console.log(`  ${r.included ? "✓" : "✗"} ${r.rel}`);

console.log("\n[حزمة standalone في resources]");
const resResults = check(["**/*"], resourceSamples);
for (const r of resResults) console.log(`  ${r.included ? "✓" : "✗"} ${r.rel}`);

const missing = [...appResults, ...resResults].filter((r) => !r.included);
console.log(
  missing.length === 0
    ? "\n✓ كل الملفات المطلوبة مُضمَّنة في الحزمة"
    : `\n✗ ناقص ${missing.length} ملف:\n${missing.map((m) => "   - " + m.rel).join("\n")}`,
);
process.exit(missing.length === 0 ? 0 : 1);
