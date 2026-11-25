/*
 * hook لـ electron-builder: نسخ حزمة Next standalone كاملة إلى مجلد resources.
 *
 * لماذا لا نستخدم extraResources؟
 * electron-builder يستثني أي مجلد باسم node_modules يقع في جذر المجلد المنسوخ
 * (انظر app-builder-lib/out/util/filter.js):
 *     if (relative === "node_modules") return false;
 * فكانت الحزمة تُنسخ ناقصة (5 ميجابايت بدل 72) — والخادم المحلي لن يعمل.
 *
 * الحل: ننسخ الحزمة بأنفسنا بعد اكتمال البناء مباشرة إلى
 * <win-unpacked>/resources/standalone — بدون أي فلترة.
 *
 * هذا الـ hook يعمل على كل الأنظمة (win/mac/linux).
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

/** نسخ مجلد بصرامة (بدون روابط رمزية) */
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dst);
    } else if (entry.isSymbolicLink()) {
      const real = fs.realpathSync(src);
      if (fs.statSync(real).isDirectory()) {
        copyDir(real, dst);
      } else {
        fs.copyFileSync(real, dst);
      }
    } else {
      fs.copyFileSync(src, dst);
    }
  }
}

exports.default = async function afterPack(context) {
  if (!fs.existsSync(path.join(standalone, "server.js"))) {
    throw new Error(
      "[desktop] standalone build is missing (.next/standalone/server.js). Run: npm run desktop:build",
    );
  }

  const outDir = context.appOutDir;
  const resourcesDir = path.join(outDir, "resources");
  const dest = path.join(resourcesDir, "standalone");

  fs.rmSync(dest, { recursive: true, force: true });
  copyDir(standalone, dest);

  /* تأكيد أن التبعيات نُسخت فعلاً (هي ما يجعل الخادم يعمل) */
  const required = [
    path.join(dest, "server.js"),
    path.join(dest, "node_modules", "pg", "package.json"),
    path.join(dest, "node_modules", "next", "dist", "server", "next.js"),
  ];
  for (const file of required) {
    if (!fs.existsSync(file)) {
      throw new Error(`[desktop] incomplete standalone bundle — missing: ${file}`);
    }
  }

  const sizeMb = Math.round(
    required.reduce((sum) => sum, 0) +
      fs
        .readdirSync(dest, { recursive: true })
        .reduce((sum, entry) => {
          try {
            const st = fs.statSync(path.join(dest, entry));
            return st.isFile() ? sum + st.size : sum;
          } catch {
            return sum;
          }
        }, 0) /
        1048576,
  );

  process.stdout.write(`[desktop] standalone bundle copied to ${dest} (${sizeMb} MB)\n`);
  if (sizeMb < 30) {
    throw new Error(`[desktop] standalone bundle looks incomplete (${sizeMb} MB)`);
  }
};
