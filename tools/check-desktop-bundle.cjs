/*
 * فحص دقيق لأنماط electron-builder: هل تُضمَّن حزمة Next standalone كاملة
 * (بما فيها node_modules الخاصة بها) في ملف التثبيت؟
 *
 * نستخدم FileMatcher الحقيقي من app-builder-lib بدل التخمين.
 */
const path = require("node:path");
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
  "electron/preload.cjs",
  ".next/static/chunks/main.js",
  "public/desktop/icon.ico",
  "package.json",
];

/* حزمة standalone المنسوخة إلى resources عبر extraResources */
const resourceSamples = [
  "server.js",
  "package.json",
  "node_modules/pg/package.json",
  "node_modules/next/dist/server/next.js",
  "node_modules/pg-pool/index.js",
  ".next/static/chunks/main.js",
];

console.log("files:", JSON.stringify(pkg.build.files));
console.log("extraResources:", JSON.stringify(pkg.build.extraResources));
console.log("asarUnpack:", JSON.stringify(pkg.build.asarUnpack));

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
