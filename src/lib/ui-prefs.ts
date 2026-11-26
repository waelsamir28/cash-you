/**
 * تفضيلات الواجهة (الثيم، الألوان، شكل الأزرار، شكل الفاتورة المطبوعة).
 * تُحفظ على هذا الجهاز فقط في localStorage، وتُطبَّق كمتغيرات CSS على الصفحة.
 */

export type ThemeId = "dark" | "light-blue" | "light-green" | "light-gold" | "light-gray";
export type ButtonRadius = "sharp" | "rounded" | "pill";
export type ButtonSize = "compact" | "normal" | "large";

export type ReceiptPrefs = {
  paperWidth: 58 | 80;
  showLogo: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showDateTime: boolean;
  footerText: string;
};

export type UiPrefs = {
  theme: ThemeId;
  /** ألوان مخصّصة تتجاوز ألوان الثيم المختار */
  colors: {
    chrome: string; // الشريط الجانبي والعلوي والسفلي
    paper: string; // خلفية الشاشة
    accent: string; // اللون المميز (التبويب النشط والتنبيهات)
  };
  buttons: {
    radius: ButtonRadius;
    size: ButtonSize;
    save: string; // زر حفظ
    savePrint: string; // زر حفظ وطباعة
  };
  receipt: ReceiptPrefs;
  showWelcome: boolean;
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
  buttons: { radius: "rounded", size: "normal", save: "#10b981", savePrint: "#047857" },
  receipt: {
    paperWidth: 80,
    showLogo: true,
    showPhone: true,
    showAddress: true,
    showDateTime: true,
    footerText: "شكراً لزيارتكم — البضاعة المباعة ترد خلال 14 يوم",
  },
  showWelcome: true,
};

const STORAGE_KEY = "cash-you.ui-prefs.v1";

export function loadPrefs(): UiPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    return mergePrefs(parsed);
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

function mergePrefs(p: Partial<UiPrefs>): UiPrefs {
  return {
    ...DEFAULT_PREFS,
    ...p,
    colors: { ...DEFAULT_PREFS.colors, ...(p.colors ?? {}) },
    buttons: { ...DEFAULT_PREFS.buttons, ...(p.buttons ?? {}) },
    receipt: { ...DEFAULT_PREFS.receipt, ...(p.receipt ?? {}) },
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

const RADIUS: Record<ButtonRadius, string> = { sharp: "4px", rounded: "12px", pill: "999px" };
const FN_HEIGHT: Record<ButtonSize, string> = { compact: "44px", normal: "52px", large: "62px" };

/** يطبّق التفضيلات على الصفحة عبر متغيرات CSS */
export function applyPrefs(prefs: UiPrefs): void {
  const root = document.documentElement;
  const theme = THEMES.find((t) => t.id === prefs.theme) ?? THEMES[0];
  const chrome = prefs.colors.chrome || theme.chrome;
  const paper = prefs.colors.paper || theme.paper;
  const accent = prefs.colors.accent || theme.accent;
  const mode = isLightColor(chrome) ? "light" : "dark";

  root.dataset.mode = mode;
  root.style.setProperty("--color-paper", paper);
  root.style.setProperty("--color-amber-brand", accent);
  root.style.setProperty("--cy-chrome", chrome);
  root.style.setProperty("--cy-on-chrome", mode === "light" ? "#0f172a" : "#f8fafc");
  root.style.setProperty("--cy-on-chrome-muted", mode === "light" ? "#475569" : "#94a3b8");
  root.style.setProperty("--cy-btn-radius", RADIUS[prefs.buttons.radius]);
  root.style.setProperty("--cy-fn-h", FN_HEIGHT[prefs.buttons.size]);
  root.style.setProperty("--cy-save", prefs.buttons.save);
  root.style.setProperty("--cy-save-print", prefs.buttons.savePrint);
}
