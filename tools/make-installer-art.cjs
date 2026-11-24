#!/usr/bin/env node
"use strict";

/**
 * مولّد صور مثبت CASH YOU بأسلوب Windows 11 الداكن (BMP 24-bit).
 *
 *   node tools/make-installer-art.cjs
 *
 * يُنتج داخل assets/branding:
 *   - installer-header.bmp    (150×57)   شريط رأس صفحات المثبت الداخلية
 *   - installer-sidebar.bmp   (164×314)  اللوحة الجانبية لصفحتي الترحيب/النهاية
 *   - uninstaller-sidebar.bmp (164×314)  نفس اللوحة لصفحات إلغاء التثبيت
 *
 * الخصائص:
 *   - يستخدم الشعار الرسمي assets/branding/icon.png مباشرة (فك PNG بـ zlib،
 *     وإعادة تحجيمه بمتوسط مرجّح بالشفافية) فلا يوجد أي شعار مرسوم يدوياً.
 *   - كل الحواف والهالات ناعمة (تنعيم يدوي) لتحاكي زجاج/ظلال Windows 11.
 *   - لا يعتمد على أي مكتبة خارجية — Node فقط.
 */

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const OUT = path.join(__dirname, "..", "assets", "branding");
const LOGO = path.join(OUT, "icon.png");
fs.mkdirSync(OUT, { recursive: true });

/* ============================ لوحة ألوان Windows 11 Dark ============================ */
const C = {
  bgTop: [9, 15, 28],
  bgBottom: [18, 30, 54],
  surface: [23, 34, 58],
  border: [58, 76, 114],
  text: [237, 243, 255],
  muted: [151, 169, 203],
  faint: [96, 116, 154],
  amber: [251, 191, 36],
  amberDeep: [245, 158, 11],
  cyan: [34, 211, 238],
  violet: [167, 139, 250],
  blue: [59, 130, 246],
};

/* ============================ خط 5×7 للعناوين الإنجليزية ============================ */
const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ".": ["00000", "00000", "00000", "00000", "00000", "00110", "00110"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  " ": ["000", "000", "000", "000", "000", "000", "000"],
};
const glyph = (ch) => FONT[ch] ?? FONT[" "];
const textWidth = (s, scale) =>
  [...s].reduce((sum, ch) => sum + (glyph(ch)[0].length + 1) * scale, 0) - scale;

/* ============================ قراءة PNG (RGBA 8-bit) ============================ */
function readPng(file) {
  const buf = fs.readFileSync(file);
  let off = 8;
  let info = null;
  const idat = [];
  let palette = null;
  let trns = null;

  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      info = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }

  if (!info) throw new Error(`PNG غير صالح: ${file}`);
  if (info.depth !== 8 || info.interlace !== 0) {
    throw new Error("أداة الصور تدعم PNG بمعدل عمق 8-bit وغير متشابك فقط");
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[info.colorType];
  if (!channels) throw new Error(`نوع ألوان PNG غير مدعوم: ${info.colorType}`);

  const stride = info.width * channels;
  const out = Buffer.alloc(info.width * info.height * 4);

  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < info.height; y++) {
    const filter = raw[p++];
    const line = Buffer.from(raw.subarray(p, p + stride));
    p += stride;

    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      switch (filter) {
        case 1: line[i] = (line[i] + a) & 0xff; break;
        case 2: line[i] = (line[i] + b) & 0xff; break;
        case 3: line[i] = (line[i] + ((a + b) >> 1)) & 0xff; break;
        case 4: {
          const pa = Math.abs(b - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default: break;
      }
    }
    prev = line;

    for (let x = 0; x < info.width; x++) {
      const src = x * channels;
      const dst = (y * info.width + x) * 4;
      if (info.colorType === 6) {
        out[dst] = line[src];
        out[dst + 1] = line[src + 1];
        out[dst + 2] = line[src + 2];
        out[dst + 3] = line[src + 3];
      } else if (info.colorType === 2) {
        out[dst] = line[src];
        out[dst + 1] = line[src + 1];
        out[dst + 2] = line[src + 2];
        out[dst + 3] = 255;
      } else if (info.colorType === 0) {
        out[dst] = out[dst + 1] = out[dst + 2] = line[src];
        out[dst + 3] = 255;
      } else if (info.colorType === 4) {
        out[dst] = out[dst + 1] = out[dst + 2] = line[src];
        out[dst + 3] = line[src + 1];
      } else if (info.colorType === 3) {
        const idx = line[src];
        out[dst] = palette[idx * 3];
        out[dst + 1] = palette[idx * 3 + 1];
        out[dst + 2] = palette[idx * 3 + 2];
        out[dst + 3] = trns && idx < trns.length ? trns[idx] : 255;
      }
    }
  }

  return { width: info.width, height: info.height, data: out };
}

/* ============================ تحجيم الشعار بالنصف (box filter) ============================ */
function resizeRGBA(img, size) {
  const { width: sw, height: sh, data } = img;
  const out = Buffer.alloc(size * size * 4);
  const rx = sw / size;
  const ry = sh / size;

  for (let y = 0; y < size; y++) {
    const y0 = Math.floor(y * ry);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * ry));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor(x * rx);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * rx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1 && sy < sh; sy++) {
        for (let sx = x0; sx < x1 && sx < sw; sx++) {
          const i = (sy * sw + sx) * 4;
          const alpha = data[i + 3] / 255;
          r += data[i] * alpha;
          g += data[i + 1] * alpha;
          b += data[i + 2] * alpha;
          a += alpha;
          n++;
        }
      }
      const d = (y * size + x) * 4;
      const w = a || 1;
      out[d] = Math.round(r / w);
      out[d + 1] = Math.round(g / w);
      out[d + 2] = Math.round(b / w);
      out[d + 3] = Math.round((a / n) * 255);
    }
  }
  return { width: size, height: size, data: out };
}

const LOGO_SRC = readPng(LOGO);
const logoCache = new Map();
const logo = (size) => {
  if (!logoCache.has(size)) logoCache.set(size, resizeRGBA(LOGO_SRC, size));
  return logoCache.get(size);
};

/* ============================ بنية الصورة + أدوات الرسم ============================ */
function canvas(w, h, top, bottom) {
  const px = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    const t = h === 1 ? 0 : y / (h - 1);
    const col = top.map((v, i) => Math.round(v + (bottom[i] - v) * t));
    for (let x = 0; x < w; x++) {
      const n = (y * w + x) * 3;
      px[n] = col[2];
      px[n + 1] = col[1];
      px[n + 2] = col[0];
    }
  }
  return { width: w, height: h, px };
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function blend(c, x, y, rgb, alpha) {
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
  const a = clamp01(alpha);
  if (a === 0) return;
  const i = (y * c.width + x) * 3;
  c.px[i] = Math.round(c.px[i] + (rgb[2] - c.px[i]) * a);
  c.px[i + 1] = Math.round(c.px[i + 1] + (rgb[1] - c.px[i + 1]) * a);
  c.px[i + 2] = Math.round(c.px[i + 2] + (rgb[0] - c.px[i + 2]) * a);
}

/** مستطيل بحواف دائرية ناعمة. */
function roundRect(c, x0, y0, w, h, r, rgb, alpha = 1) {
  const x1 = x0 + w;
  const y1 = y0 + h;
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  const inside = (px, py) => {
    if (px < x0 || py < y0 || px > x1 || py > y1) return false;
    const cx = px < x0 + rad ? x0 + rad : px > x1 - rad ? x1 - rad : px;
    const cy = py < y0 + rad ? y0 + rad : py > y1 - rad ? y1 - rad : py;
    return (px - cx) ** 2 + (py - cy) ** 2 <= rad * rad;
  };
  for (let y = Math.floor(y0) - 1; y <= Math.ceil(y1) + 1; y++) {
    for (let x = Math.floor(x0) - 1; x <= Math.ceil(x1); x++) {
      let hit = 0;
      for (let sy = 0; sy < 2; sy++)
        for (let sx = 0; sx < 2; sx++)
          if (inside(x + (sx + 0.5) / 2, y + (sy + 0.5) / 2)) hit++;
      if (hit) blend(c, x, y, rgb, (hit / 4) * alpha);
    }
  }
}

/** هالة دائرية ناعمة (Mica/Glow). */
function glow(c, cx, cy, radius, rgb, strength = 1, falloff = 1.6) {
  const r2 = radius * radius;
  const xs = Math.max(0, Math.floor(cx - radius));
  const xe = Math.min(c.width, Math.ceil(cx + radius));
  const ys = Math.max(0, Math.floor(cy - radius));
  const ye = Math.min(c.height, Math.ceil(cy + radius));
  for (let y = ys; y < ye; y++) {
    for (let x = xs; x < xe; x++) {
      const d2 = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2;
      if (d2 > r2) continue;
      const t = 1 - Math.sqrt(d2) / radius;
      blend(c, x, y, rgb, clamp01(Math.pow(t, falloff) * strength));
    }
  }
}

function line(c, x, y, len, rgb, alpha = 1, thickness = 1) {
  for (let t = 0; t < thickness; t++)
    for (let i = 0; i < len; i++) blend(c, x + i, y + t, rgb, alpha);
}

function text(c, str, x, y, scale, rgb, alpha = 1) {
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const g = glyph(ch);
    for (let row = 0; row < g.length; row++) {
      for (let col = 0; col < g[row].length; col++) {
        if (g[row][col] !== "1") continue;
        for (let sy = 0; sy < scale; sy++)
          for (let sx = 0; sx < scale; sx++)
            blend(c, cx + col * scale + sx, y + row * scale + sy, rgb, alpha);
      }
    }
    cx += (g[0].length + 1) * scale;
  }
}

/** يرسم الشعار الحقيقي (PNG) أعلى خلفية مع ظل ناعم خلفه. */
function drawLogo(c, x, y, size, shadow = true) {
  const art = logo(size);
  if (shadow) {
    /* ظل بيضاوي أسفل الشعار */
    const cx = x + size / 2;
    const cy = y + size * 0.86;
    glow(c, cx, cy, size * 0.52, [0, 0, 0], 0.42, 1.5);
  }
  for (let sy = 0; sy < size; sy++) {
    for (let sx = 0; sx < size; sx++) {
      const i = (sy * size + sx) * 4;
      const a = art.data[i + 3] / 255;
      if (!a) continue;
      /* الصورة مخزنة BGR داخل canvas — نحوّل هنا */
      blend(c, x + sx, y + sy, [art.data[i], art.data[i + 1], art.data[i + 2]], a);
    }
  }
}

/* ============================ حفظ BMP 24-bit ============================ */
function save(file, c) {
  const stride = Math.ceil((c.width * 3) / 4) * 4;
  const dataSize = stride * c.height;
  const b = Buffer.alloc(54 + dataSize);
  b.write("BM", 0);
  b.writeUInt32LE(b.length, 2);
  b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14);
  b.writeInt32LE(c.width, 18);
  b.writeInt32LE(c.height, 22);
  b.writeUInt16LE(1, 26);
  b.writeUInt16LE(24, 28);
  b.writeUInt32LE(dataSize, 34);
  for (let y = 0; y < c.height; y++) {
    const src = (c.height - 1 - y) * c.width * 3;
    c.px.copy(b, 54 + y * stride, src, src + c.width * 3);
  }
  fs.writeFileSync(path.join(OUT, file), b);
  return { file, width: c.width, height: c.height, bytes: b.length };
}

/* ============================ 1) شريط رأس 150×57 ============================ */
function makeHeader() {
  const c = canvas(150, 57, [10, 17, 31], [14, 24, 43]);

  glow(c, 132, 2, 52, C.blue, 0.28, 2.1);
  glow(c, 4, 56, 42, C.violet, 0.16, 2.2);
  glow(c, 74, 57, 40, C.amber, 0.06, 2.2);

  drawLogo(c, 12, 8, 40);

  text(c, "CASH", 60, 15, 2, C.text);
  text(c, "YOU", 60 + textWidth("CASH ", 2), 15, 2, C.amber);
  text(c, "POINT OF SALE", 60, 35, 1, C.muted, 0.95);

  line(c, 60, 47, 52, C.cyan, 0.85, 1);
  line(c, 116, 47, 22, C.border, 0.9, 1);

  return save("installer-header.bmp", c);
}

/* ============================ 2) اللوحة الجانبية 164×314 ============================ */
function makeSidebar(file) {
  const W = 164;
  const H = 314;
  const c = canvas(W, H, C.bgTop, C.bgBottom);

  /* طبقة Mica: هالات واسعة ناعمة */
  glow(c, 156, 26, 118, C.blue, 0.34, 2.0);
  glow(c, 4, 132, 96, C.violet, 0.18, 2.2);
  glow(c, 86, 296, 128, C.cyan, 0.14, 2.3);
  glow(c, 18, 6, 64, C.amber, 0.12, 2.2);

  /* خط ضوء رفيع أعلى اللوحة (ستايل Win11) */
  line(c, 0, 0, W, C.cyan, 0.16, 1);
  line(c, 0, 1, W, C.border, 0.1, 1);

  /* الشعار الرسمي */
  drawLogo(c, 47, 20, 70);

  /* العنوان */
  const w1 = textWidth("CASH YOU", 2);
  text(c, "CASH YOU", Math.round((W - w1) / 2), 102, 2, C.text);
  const w2 = textWidth("POINT OF SALE", 1);
  text(c, "POINT OF SALE", Math.round((W - w2) / 2), 124, 1, C.muted, 0.95);

  /* شريط ذهبي وسط العنوان */
  line(c, Math.round(W / 2) - 22, 138, 44, C.amber, 0.95, 2);

  /* بطاقة معلومات زجاجية */
  roundRect(c, 14, 152, W - 28, 106, 14, C.surface, 0.75);
  roundRect(c, 14, 152, W - 28, 106, 14, C.border, 0.9);
  roundRect(c, 15, 153, W - 30, 104, 13, C.bgTop, 0.38);

  /* صفوف: مفتاح يميناً وقيمة يساراً */
  const rows = [
    ["VERSION", "1.0"],
    ["PLATFORM", "WIN 11"],
    ["MODE", "OFFLINE"],
  ];
  const left = 14 + 14;
  const right = W - 14 - 14;
  rows.forEach(([k, v], idx) => {
    const y = 164 + idx * 22;
    text(c, k, left, y, 1, C.faint, 0.95);
    text(c, v, right - textWidth(v, 1), y, 1, C.text, 0.98);
  });

  /* شارات صغيرة أسفل البطاقة */
  const badgeY = 232;
  roundRect(c, 28, badgeY, 52, 14, 7, C.amber, 0.92);
  text(c, "SALES", 28 + Math.round((52 - textWidth("SALES", 1)) / 2), badgeY + 4, 1, [32, 24, 5], 1);
  roundRect(c, 88, badgeY, 46, 14, 7, C.border, 0.85);
  text(c, "POS", 88 + Math.round((46 - textWidth("POS", 1)) / 2), badgeY + 4, 1, C.text, 0.95);

  /* تذييل */
  line(c, 14, 278, W - 28, C.border, 0.5, 1);
  text(c, "CASH YOU", 14, 286, 1, C.muted, 0.85);
  text(c, "2026", W - 14 - textWidth("2026", 1), 286, 1, C.faint, 0.8);

  return save(file, c);
}

/* ============================ التشغيل ============================ */
const results = [makeHeader(), makeSidebar("installer-sidebar.bmp"), makeSidebar("uninstaller-sidebar.bmp")];
for (const r of results) {
  console.log(`✓ ${r.file}  ${r.width}×${r.height}  (${(r.bytes / 1024).toFixed(1)} KB)`);
}
