/* ============================================================================
 *  يبني نسخة الخادم المستقلة (standalone) التي يشغّلها تطبيق سطح المكتب محلياً،
 *  ثم يجمع معها الملفات الثابتة وملفات الترحيل في desktop-server/.
 * ========================================================================== */
const { execFileSync } = require("node:child_process");
const { cpSync, existsSync, mkdirSync, readdirSync, rmSync } = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "desktop-server");
const shell = process.platform === "win32";

execFileSync("npx", ["next", "build"], {
  cwd: ROOT,
  stdio: "inherit",
  shell,
  env: {
    ...process.env,
    CASH_YOU_DESKTOP_BUILD: "1",
    DATABASE_URL: process.env.DATABASE_URL || "postgres://build:build@127.0.0.1:5432/build",
  },
});

const standalone = path.join(ROOT, ".next", "standalone");
if (!existsSync(path.join(standalone, "server.js"))) throw new Error("لم يُنتج Next خادم standalone");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/* ننسخ ملفات التشغيل فقط؛ لا نسخ إعدادات التطوير المحلية (مثل .cash-you أو ملفات .env) */
for (const name of ["server.js", "package.json", "node_modules", ".next"]) {
  cpSync(path.join(standalone, name), path.join(OUT, name), { recursive: true });
}
cpSync(path.join(ROOT, ".next", "static"), path.join(OUT, ".next", "static"), { recursive: true });
if (existsSync(path.join(ROOT, "public"))) cpSync(path.join(ROOT, "public"), path.join(OUT, "public"), { recursive: true });
cpSync(path.join(ROOT, "drizzle"), path.join(OUT, "drizzle"), { recursive: true });

/* فحص أمان: لا يُسمح بوجود إعدادات محلية أو أسرار داخل الحزمة */
const leaked = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === ".cash-you" || /^\.env/.test(entry.name) || entry.name === "db-config.json" || entry.name === "backup-config.json") {
      leaked.push(full);
    } else if (entry.isDirectory()) {
      walk(full);
    }
  }
};
walk(OUT);
if (leaked.length) throw new Error(`ملفات محلية حساسة داخل desktop-server: ${leaked.join(", ")}`);
console.log("تم تجهيز desktop-server");
