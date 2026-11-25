/*
 * تجهيز أصول نسخة ويندوز قبل البناء بـ electron-builder.
 *
 * ماذا يفعل؟
 *  1) يبني تطبيق Next.js بخاصية standalone فينتج .next/standalone
 *     وفيه خادم Next جاهز يعمل بـ `node server.js` — وهو ما يسمح لنسخة
 *     ويندوز بتشغيل «قاعدة بيانات محلية» على جهاز العميل نفسه.
 *  2) ينسخ الملفات الثابتة (.next/static و public) داخل مجلد standalone،
 *     لأن build standalone لا يضعها هناك تلقائياً.
 *  3) يزيل ملفات المصدر غير اللازمة من مجلد standalone لتقليل حجم المثبّت.
 *  4) ينقل node_modules إلى مجلد فرعي (app/) لأن electron-builder يستثني
 *     أي مجلد node_modules يقع في جذر المجلد المنسوخ.
 *
 * ملاحظة: البناء لا يتصل بقاعدة بيانات — لا تتطلب DATABASE_URL حقيقية.
 */
const { execFileSync } = require("node:child_process");
const { cpSync, existsSync, rmSync } = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const nextDir = path.join(root, ".next");
const standalone = path.join(nextDir, "standalone");

function log(msg) {
  process.stdout.write(`[desktop-assets] ${msg}\n`);
}

/* 1) بناء Next.js بخصائص standalone */
log("building Next.js (standalone)…");
execFileSync(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "build"], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    CASH_YOU_STANDALONE: "1",
    /* البناء لا يتصل بقاعدة بيانات — رابط شكلي يكفي */
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://build:build@127.0.0.1:5432/build?sslmode=disable",
  },
});

if (!existsSync(path.join(standalone, "server.js"))) {
  throw new Error("standalone build failed: .next/standalone/server.js is missing");
}

/* 2) نسخ الملفات الثابتة داخل standalone */
const staticSrc = path.join(nextDir, "static");
const staticDst = path.join(standalone, ".next", "static");
if (existsSync(staticSrc)) {
  rmSync(staticDst, { recursive: true, force: true });
  cpSync(staticSrc, staticDst, { recursive: true });
  log("copied .next/static");
}

const publicSrc = path.join(root, "public");
const publicDst = path.join(standalone, "public");
if (existsSync(publicSrc)) {
  rmSync(publicDst, { recursive: true, force: true });
  cpSync(publicSrc, publicDst, { recursive: true });
  log("copied public");
}

/* 3) تنظيف ملفات المصدر غير اللازمة من مجلد standalone */
for (const junk of [".git", ".github", "tools", "release", "docs"]) {
  rmSync(path.join(standalone, junk), { recursive: true, force: true });
}
for (const doc of ["DESKTOP_AND_OFFLINE.md", "NEON_SETUP.md", "README.md", "eslint.config.mjs", "drizzle.config.ts"]) {
  rmSync(path.join(standalone, doc), { force: true });
}
log("cleaned standalone bundle");

/*
 * 4) sanity check: node_modules يجب أن تكون في جذر الحزمة.
 *
 * Next يبحث عن التبعيات في node_modules بجوار server.js، ولا يجدها إن نُقلت
 * لمجلد فرعي. وelectron-builder يستثني مجلد node_modules الجذري عند النسخ،
 * لذلك يتكفّل hook "tools/copy-standalone.cjs" بنسخ الحزمة كاملة بعد البناء.
 */
if (!existsSync(path.join(standalone, "node_modules", "pg", "package.json"))) {
  throw new Error("standalone bundle is missing node_modules/pg — the local server would not start");
}

log("done — desktop assets ready");
