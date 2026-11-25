/**
 * إعدادات البرنامج القابلة للتخصيص (تُحفظ في جدول settings على الخادم).
 * كل الإعدادات اختيارية، والقيم الافتراضية في DEFAULT_SETTINGS.
 */

export type ThemeId = "light-amber" | "light-slate" | "light-emerald" | "light-rose" | "light-ocean" | "light-sand";

export type Theme = {
  id: ThemeId;
  name: string;
  /** وصف قصير يظهر في بطاقة القالب */
  hint: string;
  /** لون المعاينة السريع (hex) */
  swatch: string[];
  /** ألوان الواجهة */
  vars: {
    paper: string;
    paper2: string;
    line: string;
    ink: string;
    inkSoft: string;
    accent: string;
    accentSoft: string;
    accentText: string;
    green: string;
    red: string;
    header: string;
    headerText: string;
    headerSoft: string;
  };
};

/** قوالب الثيمات — كلها فاتحة كما طُلب، وتختلف في اللون الأساسي والجو العام */
export const THEMES: Theme[] = [
  {
    id: "light-amber",
    name: "كاش يو — عنبري",
    hint: "الهوية الأصلية: عنبري دافئ على ورق فاتح",
    swatch: ["#f59e0b", "#fef08a", "#f1f5f9"],
    vars: {
      paper: "#f1f5f9", paper2: "#f8fafc", line: "#cbd5e1",
      ink: "#0f172a", inkSoft: "#334155",
      accent: "#f59e0b", accentSoft: "#fef08a", accentText: "#0f172a",
      green: "#10b981", red: "#ef4444",
      header: "#1e293b", headerText: "#ffffff", headerSoft: "#334155",
    },
  },
  {
    id: "light-slate",
    name: "رمادي هادئ",
    hint: "أزرق بارد محايد — مناسب للعمل الطويل",
    swatch: ["#3b82f6", "#dbeafe", "#f8fafc"],
    vars: {
      paper: "#f1f5f9", paper2: "#f8fafc", line: "#cbd5e1",
      ink: "#0f172a", inkSoft: "#334155",
      accent: "#3b82f6", accentSoft: "#dbeafe", accentText: "#ffffff",
      green: "#059669", red: "#dc2626",
      header: "#1e293b", headerText: "#ffffff", headerSoft: "#334155",
    },
  },
  {
    id: "light-emerald",
    name: "زمردي",
    hint: "أخضر مريح للعين مع لمسات دفترية",
    swatch: ["#10b981", "#d1fae5", "#f7fdf9"],
    vars: {
      paper: "#f2fbf6", paper2: "#f9fefb", line: "#bbf7d0",
      ink: "#052e21", inkSoft: "#166534",
      accent: "#10b981", accentSoft: "#d1fae5", accentText: "#052e21",
      green: "#059669", red: "#dc2626",
      header: "#064e3b", headerText: "#ffffff", headerSoft: "#065f46",
    },
  },
  {
    id: "light-rose",
    name: "وردي",
    hint: "دافئ وهادئ، لمسة أنيقة للمحلات",
    swatch: ["#f43f5e", "#ffe4e6", "#fff7f8"],
    vars: {
      paper: "#fff7f8", paper2: "#fffafb", line: "#fecdd3",
      ink: "#3f0d1a", inkSoft: "#9f1239",
      accent: "#f43f5e", accentSoft: "#ffe4e6", accentText: "#ffffff",
      green: "#059669", red: "#e11d48",
      header: "#881337", headerText: "#ffffff", headerSoft: "#9f1239",
    },
  },
  {
    id: "light-ocean",
    name: "محيطي",
    hint: "أزرق بحري ومساحات بيضاء مريحة",
    swatch: ["#0891b2", "#cffafe", "#f4fbfd"],
    vars: {
      paper: "#f4fbfd", paper2: "#fafdff", line: "#a5f3fc",
      ink: "#083344", inkSoft: "#155e75",
      accent: "#0891b2", accentSoft: "#cffafe", accentText: "#042f2e",
      green: "#059669", red: "#dc2626",
      header: "#164e63", headerText: "#ffffff", headerSoft: "#155e75",
    },
  },
  {
    id: "light-sand",
    name: "رملي",
    hint: "بيج كلاسيكي بملمس ورقي",
    swatch: ["#b45309", "#fef3c7", "#fdfaf5"],
    vars: {
      paper: "#fdfaf5", paper2: "#fffdf9", line: "#e7dccb",
      ink: "#3f2d18", inkSoft: "#6b4e2a",
      accent: "#b45309", accentSoft: "#fef3c7", accentText: "#3f2d18",
      green: "#15803d", red: "#b91c1c",
      header: "#3f2d18", headerText: "#fffdf9", headerSoft: "#6b4e2a",
    },
  },
];

export const DEFAULT_THEME: ThemeId = "light-amber";

export const themeOf = (id: string | undefined | null): Theme =>
  THEMES.find((t) => t.id === id) ?? THEMES[0];

/** زر من أزرار شريط الوظائف يمكن إظهاره/إخفاؤه وترتيبه */
export type FnButtonId = "newInvoice" | "codeSearch" | "payFull" | "savePrint" | "save";

export type FnButton = { id: FnButtonId; label: string; visible: boolean; shortcut: string };

export const FN_BUTTONS_DEFAULT: FnButton[] = [
  { id: "newInvoice", label: "فاتورة جديدة", visible: true, shortcut: "F4" },
  { id: "codeSearch", label: "بحث بالكود", visible: true, shortcut: "F3" },
  { id: "payFull", label: "دفع كامل", visible: true, shortcut: "F12" },
  { id: "savePrint", label: "حفظ وطباعة", visible: true, shortcut: "F10" },
  { id: "save", label: "حفظ", visible: true, shortcut: "F5" },
];

export type InvoicePaper = "80mm" | "58mm" | "a5";

export type ShopSettings = {
  /** اسم المحل كما يظهر في الفاتورة والترحيب */
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  /** شعار المحل: data-URL (base64) أو رابط */
  shopLogo: string;
  /** رسالة أسفل الفاتورة */
  invoiceFooter: string;
  /** إظهار سطر «شكراً لتعاملكم معنا» */
  invoiceThanks: boolean;
  /** مقاس ورق الفاتورة */
  invoicePaper: InvoicePaper;
  /** قالب الثيم */
  theme: ThemeId;
  /** أزرار شريط الوظائف */
  fnButtons: FnButton[];
  /** إظهار شاشة الترحيب عند تسجيل الدخول */
  welcomeEnabled: boolean;
};

export const DEFAULT_SETTINGS: ShopSettings = {
  shopName: "كاش يو للتجارة والتوريدات المكتبية",
  shopPhone: "01222355769",
  shopAddress: "",
  shopLogo: "",
  invoiceFooter: "شكراً لتعاملكم معنا · تمنياتنا لكم بيوم سعيد",
  invoiceThanks: true,
  invoicePaper: "80mm",
  theme: DEFAULT_THEME,
  fnButtons: FN_BUTTONS_DEFAULT,
  welcomeEnabled: true,
};

/** دمج الإعدادات القادمة من الخادم مع الافتراضية (تحمّل القيم الناقصة) */
export function mergeSettings(raw: unknown): ShopSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  const r = raw as Partial<ShopSettings>;
  const buttons = Array.isArray(r.fnButtons) && r.fnButtons.length
    ? r.fnButtons.filter((b) => b && typeof b.id === "string").map((b) => ({
        id: b.id as FnButtonId,
        label: typeof b.label === "string" && b.label.trim() ? b.label : FN_BUTTONS_DEFAULT.find((d) => d.id === b.id)?.label ?? b.id,
        visible: b.visible !== false,
        shortcut: typeof b.shortcut === "string" ? b.shortcut : FN_BUTTONS_DEFAULT.find((d) => d.id === b.id)?.shortcut ?? "",
      }))
    : FN_BUTTONS_DEFAULT;
  return {
    ...DEFAULT_SETTINGS,
    ...r,
    shopName: (r.shopName ?? DEFAULT_SETTINGS.shopName).trim() || DEFAULT_SETTINGS.shopName,
    shopPhone: r.shopPhone ?? DEFAULT_SETTINGS.shopPhone,
    shopAddress: r.shopAddress ?? DEFAULT_SETTINGS.shopAddress,
    shopLogo: r.shopLogo ?? DEFAULT_SETTINGS.shopLogo,
    invoiceFooter: r.invoiceFooter ?? DEFAULT_SETTINGS.invoiceFooter,
    invoiceThanks: r.invoiceThanks !== false,
    invoicePaper: r.invoicePaper === "58mm" || r.invoicePaper === "a5" ? r.invoicePaper : "80mm",
    theme: themeOf(r.theme).id,
    fnButtons: buttons,
    welcomeEnabled: r.welcomeEnabled !== false,
  };
}

/** تحويل الثيم إلى متغيرات CSS تُطبَّق على جذر الواجهة */
export function themeCssVars(theme: Theme): Record<string, string> {
  const v = theme.vars;
  return {
    "--cy-paper": v.paper,
    "--cy-paper-2": v.paper2,
    "--cy-line": v.line,
    "--cy-ink": v.ink,
    "--cy-ink-soft": v.inkSoft,
    "--cy-accent": v.accent,
    "--cy-accent-soft": v.accentSoft,
    "--cy-accent-text": v.accentText,
    "--cy-green": v.green,
    "--cy-red": v.red,
    "--cy-header": v.header,
    "--cy-header-text": v.headerText,
    "--cy-header-soft": v.headerSoft,
  };
}
