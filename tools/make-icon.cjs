#!/usr/bin/env node
/**
 * يعيد توليد assets/branding/icon.ico (بكل الأحجام القياسية) من
 * assets/branding/icon.png — أيقونة برنامج CASH YOU وملف التثبيت.
 *
 *   node tools/make-icon.cjs
 *
 * يستخدم ImageMagick إن وُجد، وإلا يضع صورة PNG بمقاس 256×256 داخل حاوية ICO
 * (صيغة مدعومة على Windows Vista وما بعده) دون أي اعتماد خارجي.
 */
const { execFileSync } = require("node:child_process");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const source = path.join(root, "assets", "branding", "icon.png");
const target = path.join(root, "assets", "branding", "icon.ico");

if (!existsSync(source)) {
  console.error(`missing source icon: ${source}`);
  process.exit(1);
}

/** يجرّب ImageMagick (v7: magick ثم v6: convert) لإنتاج ICO متعدد الأحجام. */
function tryMagick() {
  const args = ["-background", "none"];
  for (const size of [256, 128, 64, 48, 32, 16]) {
    /* الأقواس يجب أن تكون وسائط منفصلة في ImageMagick */
    args.push("(", source, "-resize", `${size}x${size}`, ")");
  }
  args.push(target);

  for (const bin of ["magick", "convert"]) {
    try {
      execFileSync(bin, args, { stdio: "ignore" });
      return true;
    } catch {
      /* جرّب الأمر التالي */
    }
  }
  return false;
}

if (!tryMagick()) {
  /* بديل بدون أدوات خارجية: PNG 256×256 داخل حاوية ICO */
  const png = readFileSync(source);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0); // width 256
  entry.writeUInt8(0, 1); // height 256
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // payload size
  entry.writeUInt32LE(22, 12); // payload offset
  writeFileSync(target, Buffer.concat([header, entry, png]));
}

console.log(`icon.ico ready → ${path.relative(root, target)}`);
