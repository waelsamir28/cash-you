/* ============================================================================
 *  يجلب ملفات PostgreSQL الثنائية لنظام Windows x64 من حزمة npm الرسمية
 *  @embedded-postgres/windows-x64 ويضعها في vendor/postgres (غير مرفوعة إلى Git).
 *  يُستدعى من سكربت desktop:dist قبل بناء المثبّت.
 * ========================================================================== */
const { execFileSync } = require("node:child_process");
const { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const VERSION = "18.7.0-beta.19";
const PACKAGE = `@embedded-postgres/windows-x64@${VERSION}`;
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "vendor", "postgres");
const MARKER = path.join(OUT, ".version");

if (existsSync(MARKER) && readFileSync(MARKER, "utf8").trim() === VERSION && existsSync(path.join(OUT, "bin", "initdb.exe"))) {
  console.log(`PostgreSQL ${VERSION} موجود بالفعل في vendor/postgres`);
  process.exit(0);
}

const shell = process.platform === "win32";
const tmp = mkdtempSync(path.join(os.tmpdir(), "cy-pg-"));
try {
  const packed = execFileSync("npm", ["pack", PACKAGE, "--pack-destination", tmp], { encoding: "utf8", shell }).trim().split(/\r?\n/).pop();
  execFileSync("tar", ["-xzf", path.join(tmp, packed), "-C", tmp], { stdio: "inherit", shell });
  const native = path.join(tmp, "package", "native");
  if (!existsSync(path.join(native, "bin", "initdb.exe"))) throw new Error("حزمة PostgreSQL لا تحتوي initdb.exe");

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(path.join(native, "bin"), path.join(OUT, "bin"), { recursive: true });
  cpSync(path.join(native, "share"), path.join(OUT, "share"), { recursive: true });
  writeFileSync(MARKER, VERSION);
  console.log(`تم تجهيز PostgreSQL ${VERSION} في vendor/postgres`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
