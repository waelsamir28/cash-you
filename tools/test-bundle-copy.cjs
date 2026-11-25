/*
 * اختبار نسخ حزمة standalone عبر hook الـ packaging الحقيقي
 * (tools/copy-standalone.cjs) — يحاكي ما يحدث داخل الحزمة المبنية.
 */
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const hook = require("./copy-standalone.cjs").default;

(async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "cy-bundle-"));
  await hook({ appOutDir: outDir });

  const dest = path.join(outDir, "resources", "standalone");
  const checks = [
    "server.js",
    "package.json",
    "node_modules/pg/package.json",
    "node_modules/next/dist/server/next.js",
    "node_modules/pg-pool/index.js",
    ".next/static",
  ];

  console.log("\n[التحقق من contents]");
  let ok = true;
  for (const rel of checks) {
    const exists = fs.existsSync(path.join(dest, rel));
    console.log(`  ${exists ? "✓" : "✗"} ${rel}`);
    if (!exists) ok = false;
  }

  const sizeMb = Math.round(
    fs
      .readdirSync(dest, { recursive: true })
      .reduce((sum, entry) => {
        try {
          const st = fs.statSync(path.join(dest, entry));
          return st.isFile() ? sum + st.size : sum;
        } catch {
          return sum;
        }
      }, 0) / 1048576,
  );

  console.log(`\nحجم standalone المنسوخ: ${sizeMb} MB`);
  console.log(ok && sizeMb > 30 ? "✓ الحزمة كاملة" : "✗ الحزمة ناقصة");
  fs.rmSync(outDir, { recursive: true, force: true });
  process.exit(ok && sizeMb > 30 ? 0 : 1);
})().catch((err) => {
  console.error("✗ فشل:", err.message);
  process.exit(1);
});
