/**
 * تفضيلات الواجهة: الثيم والألوان، القوالب (الفاتورة/الخطوط/الأزرار)، الحركات،
 * القائمة الجانبية، شاشة الدخول، العناصر المخفية، وتوسيط النصوص.
 * تُحفظ على هذا الجهاز فقط في localStorage، وتُطبَّق كمتغيرات CSS وسمات على الصفحة.
 */

import type { CSSProperties } from "react";

export type ThemeId = "dark" | "light-blue" | "light-green" | "light-gold" | "light-gray";
export type ButtonRadius = "sharp" | "rounded" | "pill";
export type ButtonSize = "compact" | "normal" | "large";
export type InvoiceTemplate = "classic" | "modern" | "compact";
export type LineTemplate = "striped" | "bordered" | "minimal";
export type ButtonTemplate = "filled" | "outline" | "soft";
export type AnimSpeed = "fast" | "normal" | "slow";
/** ست حركات دخول للصفحات والقائمة */
export const ENTER_MOTIONS = [
  { id: "fade", label: "تلاشي" },
  { id: "slide", label: "انزلاق جانبي" },
  { id: "zoom", label: "تكبير" },
  { id: "drop", label: "هبوط من الأعلى" },
  { id: "bounce", label: "ارتداد" },
  { id: "flip", label: "قلب" },
] as const;
export type EnterMotion = (typeof ENTER_MOTIONS)[number]["id"];
/** ست حركات للأزرار عند المرور والضغط */
export const BUTTON_MOTIONS = [
  { id: "none", label: "بدون" },
  { id: "lift", label: "رفع" },
  { id: "press", label: "ضغط" },
  { id: "pulse", label: "نبض" },
  { id: "tilt", label: "ميل" },
  { id: "glow", label: "توهج" },
] as const;
export type ButtonMotion = (typeof BUTTON_MOTIONS)[number]["id"];
export type MenuItemHeight = "compact" | "normal" | "large";

/** خانات المبالغ الكبيرة في شاشة البيع والمستندات */
export const AMOUNT_TILES = [
  { key: "net", label: "المبلغ الصافي" },
  { key: "paid", label: "المدفوع" },
  { key: "rem", label: "المتبقي / الباقي للزبون" },
  { key: "prev", label: "الرصيد السابق" },
  { key: "after", label: "الرصيد بعد الفاتورة" },
] as const;
export type AmountKey = (typeof AMOUNT_TILES)[number]["key"];
export type TextAlign = "right" | "center" | "left";
export type AmountStyle = {
  bg: string; // لون الخانة
  text: string; // لون الأرقام
  label: string; // لون الاسم
  border: string; // لون الإطار
  width: number; // العرض بالبكسل
  height: number; // الارتفاع بالبكسل
  numSize: number; // حجم خط الرقم
  labelSize: number; // حجم خط الاسم
  numAlign: TextAlign; // محاذاة الرقم
  labelAlign: TextAlign; // محاذاة الاسم
};

const AMOUNT_BASE: Omit<AmountStyle, "bg" | "text" | "label" | "border"> = {
  width: 156,
  height: 56,
  numSize: 20,
  labelSize: 11,
  numAlign: "center",
  labelAlign: "center",
};

export const DEFAULT_AMOUNTS: Record<AmountKey, AmountStyle> = {
  net: { ...AMOUNT_BASE, bg: "#1e293b", text: "#ffffff", label: "#cbd5e1", border: "#020617" },
  paid: { ...AMOUNT_BASE, bg: "#fef08a", text: "#047857", label: "#334155", border: "#f59e0b" },
  rem: { ...AMOUNT_BASE, bg: "#fef9c3", text: "#ef4444", label: "#b91c1c", border: "#ef4444" },
  prev: { ...AMOUNT_BASE, bg: "#ffffff", text: "#1e293b", label: "#334155", border: "#cbd5e1" },
  after: { ...AMOUNT_BASE, bg: "#fef08a", text: "#0f172a", label: "#334155", border: "#f59e0b" },
};

export type ReceiptPrefs = {
  paperWidth: 58 | 80;
  showLogo: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showDateTime: boolean;
  footerText: string;
};

/** العناصر التي يمكن إخفاؤها من أنحاء البرنامج */
export const HIDE_ITEMS = [
  { key: "search", label: "أيقونة البحث العام", group: "الشريط العلوي" },
  { key: "sound", label: "زر الصوت", group: "الشريط العلوي" },
  { key: "fullscreen", label: "زر ملء الشاشة", group: "الشريط العلوي" },
  { key: "menu", label: "زر القائمة", group: "الشريط العلوي" },
  { key: "date", label: "التاريخ", group: "الفوتر" },
  { key: "time", label: "الوقت", group: "الفوتر" },
  { key: "user", label: "اسم المستخدم", group: "الفوتر" },
  { key: "support", label: "رقم الدعم الفني", group: "الفوتر" },
  { key: "status", label: "حالة الاتصال", group: "الفوتر" },
  { key: "trial", label: "حالة التفعيل", group: "الفوتر" },
  { key: "welcome", label: "شاشة الترحيب", group: "عام" },
  { key: "customerScreen", label: "زر شاشة الزبون", group: "شاشة البيع" },
  { key: "categories", label: "قائمة التصنيفات", group: "شاشة البيع" },
  { key: "balances", label: "خانات الرصيد السابق والبعد", group: "شاشة البيع" },
  { key: "fnKeys", label: "أزرار الوظائف السفلية", group: "شاشة البيع" },
  { key: "stock", label: "رصيد الصنف على البطاقة", group: "شاشة البيع" },
  { key: "tableTotals", label: "إجماليات جدول الأصناف", group: "شاشة البيع" },
] as const;
export type HideKey = (typeof HIDE_ITEMS)[number]["key"];

/** إعدادات نافذة «المبلغ المدفوع أكبر من المطلوب» (البيع والمشتريات) */
export type OverpayMode = "ask" | "change" | "credit";
export type OverpayChoice = "change" | "credit";
export type OverpayPrefs = {
  mode: OverpayMode; // ask: تعرض النافذة، change/credit: تُطبَّق مباشرة بدون سؤال
  title: string;
  showPreviousBalance: boolean;
  showChange: boolean; // إظهار زر تسليم الباقي
  showCredit: boolean; // إظهار زر التنزيل على الحساب
  changeLabel: string;
  changeHint: string;
  creditLabel: string;
  creditHint: string; // يمكن استخدام {name} لاسم الطرف
  defaultChoice: OverpayChoice; // الزر المحدد افتراضياً (Enter يختاره)
};

export type UiPrefs = {
  theme: ThemeId;
  /** ألوان مخصّصة تتجاوز ألوان الثيم المختار */
  colors: {
    chrome: string; // الشريط العلوي والسفلي
    paper: string; // خلفية الشاشة
    accent: string; // اللون المميز
  };
  buttons: {
    radius: ButtonRadius;
    size: ButtonSize;
    save: string; // زر حفظ
    savePrint: string; // زر حفظ وطباعة
    template: ButtonTemplate;
    base: string; // اللون الأساسي للزر
    hover: string; // لون المرور
    press: string; // لون الضغط
    text: string; // لون الكلام على الزر
  };
  templates: {
    invoice: InvoiceTemplate;
    lines: LineTemplate;
  };
  anim: {
    enabled: boolean;
    speed: AnimSpeed;
    page: EnterMotion; // حركة انتقال الصفحات
    menu: EnterMotion; // حركة فتح القائمة
    button: ButtonMotion; // حركة الأزرار
  };
  menu: {
    bg: string; // لون القائمة العائمة
    text: string; // لون الكلام فيها
    button: string; // لون الأزرار فيها
    opacity: number; // شفافية القائمة 40–100
    width: number; // عرض القائمة بالبكسل
    itemHeight: MenuItemHeight;
    icons: boolean; // إظهار الأيقونات (تكون على الشمال والكلام في المنتصف)
    radius: number; // انحناء الأزرار بالبكسل
  };
  login: {
    title: string;
    subtitle: string;
    bg: string;
    accent: string;
    showLogo: boolean;
  };
  hidden: Partial<Record<HideKey, boolean>>;
  centerText: boolean;
  receipt: ReceiptPrefs;
  showWelcome: boolean;
  amounts: Record<AmountKey, AmountStyle>;
  overpay: OverpayPrefs;
  lock: { idleMinutes: number }; // 0 = مُعطَّل
  /** ميزان الباركود: باركود EAN-13 يبدأ بالبادئة ويحمل كود الصنف والوزن أو السعر */
  scale: ScalePrefs;
};

export type ScalePrefs = {
  enabled: boolean;
  prefix: string; // البادئة (عادة "2")
  mode: "weight" | "price"; // وزن بالجرام، أو سعر بالجنيه
};

type ThemePreset = { id: ThemeId; label: string; mode: "dark" | "light"; chrome: string; paper: string; accent: string };

export const THEMES: ThemePreset[] = [
  { id: "dark", label: "داكن (الافتراضي)", mode: "dark", chrome: "#1e293b", paper: "#f1f5f9", accent: "#f59e0b" },
  { id: "light-blue", label: "أزرق فاتح", mode: "light", chrome: "#dbeafe", paper: "#eff6ff", accent: "#3b82f6" },
  { id: "light-green", label: "أخضر فاتح", mode: "light", chrome: "#dcfce7", paper: "#f0fdf4", accent: "#22c55e" },
  { id: "light-gold", label: "ذهبي فاتح", mode: "light", chrome: "#fef3c7", paper: "#fffbeb", accent: "#f59e0b" },
  { id: "light-gray", label: "رمادي فاتح", mode: "light", chrome: "#f1f5f9", paper: "#f8fafc", accent: "#64748b" },
];

export const DEFAULT_PREFS: UiPrefs = {
  theme: "dark",
  colors: { chrome: "#1e293b", paper: "#f1f5f9", accent: "#f59e0b" },
  buttons: {
    radius: "rounded",
    size: "normal",
    save: "#10b981",
    savePrint: "#047857",
    template: "filled",
    base: "#1e293b",
    hover: "#334155",
    press: "#0f172a",
    text: "#ffffff",
  },
  templates: { invoice: "classic", lines: "striped" },
  anim: { enabled: true, speed: "normal", page: "fade", menu: "slide", button: "lift" },
  menu: { bg: "#1e293b", text: "#f8fafc", button: "#334155", opacity: 96, width: 260, itemHeight: "normal", icons: true, radius: 8 },
  login: {
    title: "كاش يو — نقاط البيع",
    subtitle: "نظام كاشير سريع للمحلات والتوريدات",
    bg: "#0f172a",
    accent: "#22d3ee",
    showLogo: true,
  },
  hidden: {},
  centerText: true,
  receipt: {
    paperWidth: 80,
    showLogo: true,
    showPhone: true,
    showAddress: true,
    showDateTime: true,
    footerText: "شكراً لزيارتكم — البضاعة المباعة ترد خلال 14 يوم",
  },
  showWelcome: true,
  amounts: DEFAULT_AMOUNTS,
  overpay: {
    mode: "ask",
    title: "المبلغ المدفوع أكبر من المطلوب",
    showPreviousBalance: true,
    showChange: true,
    showCredit: true,
    changeLabel: "تسليم الباقي",
    changeHint: "يُعطى نقداً الآن",
    creditLabel: "تنزيل من الحساب",
    creditHint: "يُضاف رصيداً دائناً لـ {name}",
    defaultChoice: "change",
  },
  lock: { idleMinutes: 0 },
  scale: { enabled: false, prefix: "2", mode: "weight" },
};

const STORAGE_KEY = "cash-you.ui-prefs.v1";

export function loadPrefs(): UiPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return mergePrefs(JSON.parse(raw) as Partial<UiPrefs>);
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: UiPrefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* التخزين غير متاح — نكتفي بالتطبيق في الجلسة الحالية */
  }
}

export function mergePrefs(p: Partial<UiPrefs>): UiPrefs {
  return {
    ...DEFAULT_PREFS,
    ...p,
    colors: { ...DEFAULT_PREFS.colors, ...(p.colors ?? {}) },
    buttons: { ...DEFAULT_PREFS.buttons, ...(p.buttons ?? {}) },
    templates: { ...DEFAULT_PREFS.templates, ...(p.templates ?? {}) },
    anim: { ...DEFAULT_PREFS.anim, ...(p.anim ?? {}) },
    menu: { ...DEFAULT_PREFS.menu, ...(p.menu ?? {}) },
    login: { ...DEFAULT_PREFS.login, ...(p.login ?? {}) },
    hidden: { ...(p.hidden ?? {}) },
    receipt: { ...DEFAULT_PREFS.receipt, ...(p.receipt ?? {}) },
    amounts: mergeAmounts(p.amounts),
    overpay: mergeOverpay(p.overpay),
    lock: { idleMinutes: [0, 5, 10, 15, 30].includes(Number(p.lock?.idleMinutes)) ? Number(p.lock?.idleMinutes) : 0 },
    scale: mergeScale(p.scale),
  };
}

function mergeScale(src: Partial<ScalePrefs> | undefined): ScalePrefs {
  const out: ScalePrefs = { ...DEFAULT_PREFS.scale, ...(src ?? {}) };
  out.prefix = String(out.prefix ?? "").replace(/\D/g, "").slice(0, 2);
  if (!out.prefix) out.prefix = "2";
  if (out.mode !== "weight" && out.mode !== "price") out.mode = "weight";
  out.enabled = Boolean(out.enabled);
  return out;
}

function mergeOverpay(src: Partial<OverpayPrefs> | undefined): OverpayPrefs {
  const out: OverpayPrefs = { ...DEFAULT_PREFS.overpay, ...(src ?? {}) };
  if (!["ask", "change", "credit"].includes(out.mode)) out.mode = "ask";
  if (!out.showChange && !out.showCredit) out.showChange = true; // لازم يبقى زر واحد على الأقل
  if (!["change", "credit"].includes(out.defaultChoice)) out.defaultChoice = "change";
  return out;
}

/** نص يظهر في النافذة مع استبدال {name} باسم الطرف */
export function overpayText(text: string, name: string): string {
  return text.replace(/\{name\}/g, name || "العميل");
}

function mergeAmounts(src: Partial<Record<AmountKey, Partial<AmountStyle>>> | undefined): Record<AmountKey, AmountStyle> {
  const out = { ...DEFAULT_AMOUNTS };
  for (const t of AMOUNT_TILES) out[t.key] = { ...DEFAULT_AMOUNTS[t.key], ...(src?.[t.key] ?? {}) };
  return out;
}

/** نمط الخانة كـ CSS مباشر (يُستخدم في المعاينة داخل الإعدادات) */
export function amountPreviewStyle(s: AmountStyle): CSSProperties {
  return {
    width: s.width,
    height: s.height,
    background: s.bg,
    color: s.text,
    borderColor: s.border,
  };
}

/** هل اللون فاتح؟ تُستخدم لتحديد وضع الألوان (فاتح/داكن) */
export function isLightColor(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

const RADIUS: Record<ButtonRadius, string> = { sharp: "4px", rounded: "8px", pill: "999px" };
const FN_HEIGHT: Record<ButtonSize, string> = { compact: "40px", normal: "46px", large: "56px" };
const ANIM_MS: Record<AnimSpeed, string> = { fast: "140ms", normal: "240ms", slow: "420ms" };
const ITEM_H: Record<MenuItemHeight, string> = { compact: "34px", normal: "40px", large: "48px" };

/** يطبّق التفضيلات على الصفحة عبر متغيرات CSS وسمات على عنصر <html> */
export function applyPrefs(prefs: UiPrefs): void {
  const root = document.documentElement;
  const theme = THEMES.find((t) => t.id === prefs.theme) ?? THEMES[0];
  const chrome = prefs.colors.chrome || theme.chrome;
  const paper = prefs.colors.paper || theme.paper;
  const accent = prefs.colors.accent || theme.accent;
  const mode = isLightColor(chrome) ? "light" : "dark";

  root.dataset.mode = mode;
  root.dataset.tplInvoice = prefs.templates.invoice;
  root.dataset.tplLines = prefs.templates.lines;
  root.dataset.tplButtons = prefs.buttons.template;
  root.dataset.anim = prefs.anim.enabled ? "on" : "off";
  root.dataset.btnMotion = prefs.anim.button;
  root.dataset.center = prefs.centerText ? "1" : "0";
  root.dataset.hide = HIDE_ITEMS.filter((h) => prefs.hidden[h.key]).map((h) => h.key).join(" ");

  root.style.setProperty("--color-paper", paper);
  root.style.setProperty("--color-amber-brand", accent);
  root.style.setProperty("--cy-chrome", chrome);
  root.style.setProperty("--cy-on-chrome", mode === "light" ? "#0f172a" : "#f8fafc");
  root.style.setProperty("--cy-on-chrome-muted", mode === "light" ? "#475569" : "#94a3b8");
  root.style.setProperty("--cy-btn-radius", RADIUS[prefs.buttons.radius]);
  root.style.setProperty("--cy-fn-h", FN_HEIGHT[prefs.buttons.size]);
  root.style.setProperty("--cy-save", prefs.buttons.save);
  root.style.setProperty("--cy-save-print", prefs.buttons.savePrint);
  root.style.setProperty("--cy-menu-bg", prefs.menu.bg);
  root.style.setProperty("--cy-menu-text", prefs.menu.text);
  root.style.setProperty("--cy-menu-btn", prefs.menu.button);
  root.style.setProperty("--cy-menu-opacity", String(Math.min(100, Math.max(40, prefs.menu.opacity))));
  root.style.setProperty("--cy-menu-width", `${prefs.menu.width}px`);
  root.style.setProperty("--cy-menu-item-h", ITEM_H[prefs.menu.itemHeight]);
  root.style.setProperty("--cy-menu-radius", `${prefs.menu.radius}px`);
  root.style.setProperty("--cy-page-anim", `cy-m-${prefs.anim.page}`);
  root.style.setProperty("--cy-menu-anim", `cy-m-${prefs.anim.menu}`);
  root.style.setProperty("--cy-btn-base", prefs.buttons.base);
  root.style.setProperty("--cy-btn-hover", prefs.buttons.hover);
  root.style.setProperty("--cy-btn-press", prefs.buttons.press);
  root.style.setProperty("--cy-btn-text", prefs.buttons.text);
  root.style.setProperty("--cy-anim-dur", ANIM_MS[prefs.anim.speed]);
  root.style.setProperty("--cy-btn-accent", accent);
  root.style.setProperty("--cy-login-bg", prefs.login.bg);
  for (const t of AMOUNT_TILES) {
    const a = prefs.amounts[t.key];
    const k = `--cy-amt-${t.key}`;
    root.style.setProperty(`${k}-bg`, a.bg);
    root.style.setProperty(`${k}-text`, a.text);
    root.style.setProperty(`${k}-label`, a.label);
    root.style.setProperty(`${k}-border`, a.border);
    root.style.setProperty(`${k}-w`, `${a.width}px`);
    root.style.setProperty(`${k}-h`, `${a.height}px`);
    root.style.setProperty(`${k}-num`, `${a.numSize}px`);
    root.style.setProperty(`${k}-lbl`, `${a.labelSize}px`);
    root.style.setProperty(`${k}-na`, a.numAlign);
    root.style.setProperty(`${k}-la`, a.labelAlign);
  }
  root.style.setProperty("--cy-login-accent", prefs.login.accent);
}
