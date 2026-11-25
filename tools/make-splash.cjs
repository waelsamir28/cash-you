#!/usr/bin/env node
/**
 * يولّد صورة شاشة التثبيت (صفحة ترحيب مثبّت NSIS) من نفس تصميم
 * شاشة فتح البرنامج (electron/splash.html).
 *
 * الناتج:
 *   assets/branding/splash-installer.png  — نسخة PNG (للمراجعة والتوثيق)
 *   assets/branding/splash-installer.bmp  — نسخة BMP (ما يحتاجه NSIS MUI)
 *
 * يعتمد على Chromium ( puppeteer-core + @sparticuz/chromium ) — وهما اختياريان.
 * إن لم يكونا مثبتين، ي informing المستخدم ولا يفشل البناء.
 *
 *   npm i -D puppeteer-core @sparticuz/chromium
 *   node tools/make-splash.cjs
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const htmlPath = path.join(root, "electron", "splash.html");
const outPng = path.join(root, "assets", "branding", "splash-installer.png");
const outBmp = path.join(root, "assets", "branding", "splash-installer.bmp");

/** مقاس صورة صفحة ترحيب MUI القياسية */
const WIDTH = 493;
const HEIGHT = 312;

/**
 * يكتب ملف BMP uncompressed (24 بت) من صورة PNG — بلا اعتماديات خارجية.
 * NSIS MUI يقبل BMP فقط لصفحة الترحيب.
 */
async function writeBmp(pngPath, bmpPath) {
  const sharp = require("sharp");
  const { data, info } = await sharp(pngPath)
    .flatten({ background: "#0b1220" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelSize = rowSize * height;
  const headerSize = 54;

  const header = Buffer.alloc(headerSize);
  header.write("BM", 0, "ascii");
  header.writeUInt32LE(headerSize + pixelSize, 2);
  header.writeUInt32LE(headerSize, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(pixelSize, 34);
  header.writeInt32LE(2835, 38);
  header.writeInt32LE(2835, 42);

  const pixels = Buffer.alloc(pixelSize);
  for (let y = 0; y < height; y += 1) {
    /* BMP ي stores الصفوف من الأسفل إلى الأعلى */
    const srcRow = height - 1 - y;
    let dst = y * rowSize;
    let src = srcRow * width * 3;
    for (let x = 0; x < width; x += 1) {
      pixels[dst] = data[src + 2]; /* B */
      pixels[dst + 1] = data[src + 1]; /* G */
      pixels[dst + 2] = data[src]; /* R */
      dst += 3;
      src += 3;
    }
  }

  fs.writeFileSync(bmpPath, Buffer.concat([header, pixels]));
}

async function main() {
  let chromium;
  let puppeteer;
  try {
    chromium = require("@sparticuz/chromium").default;
    puppeteer = require("puppeteer-core");
  } catch {
    console.log("… تخطّي توليد صورة التثبيت (Chromium غير مثبّت) — استخدم الأصول الموجودة");
    process.exit(0);
  }

  const browser = await puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
    defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 },
    executablePath: await chromium.executablePath(),
    headless: "shell",
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0", timeout: 60000 });
    /* ننتظر تحميل الخطوط العربية قبل اللقطة */
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      document.body.classList.add("static");
      const progress = document.getElementById("progress");
      if (progress) progress.classList.remove("on");
      /* نوقف الحركة في الصورة الثابتة */
      const logo = document.querySelector(".logo");
      if (logo) logo.style.animation = "none";
    });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: outPng });

    /* BMP كما يتطلّب NSIS MUI (24 بت) */
    await writeBmp(outPng, outBmp);

    console.log("✓ splash-installer.png + splash-installer.bmp");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("فشل توليد صورة التثبيت:", err && err.message ? err.message : err);
  process.exit(1);
});
