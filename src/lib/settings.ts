/**
 * إعدادات البرنامج القابلة للتخصيص (تُحفظ في جدول settings على الخادم).
 * كل الإعدادات اختيارية، والقيم الافتراضية في DEFAULT_SETTINGS.
 */

export type ThemeId = "light-amber" | "light-slate" | "light-emerald" | "light-rose" | "light-ocean" | "light-sand" | "light-violet" | "light-mono" | "dark-amber" | "dark-slate" | "dark-emerald" | "dark-ocean";

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
  {
    id: "light-violet",
    name: "بنفسجي",
    hint: "لمسة عصرية جريئة مع خلفية بيضاء",
    swatch: ["#8b5cf6", "#ede9fe", "#faf8ff"],
    vars: {
      paper: "#faf8ff", paper2: "#fdfcff", line: "#ddd6fe",
      ink: "#2e1065", inkSoft: "#5b21b6",
      accent: "#8b5cf6", accentSoft: "#ede9fe", accentText: "#ffffff",
      green: "#059669", red: "#dc2626",
      header: "#3b0764", headerText: "#ffffff", headerSoft: "#5b21b6",
    },
  },
  {
    id: "light-mono",
    name: "أبيض وأسود",
    hint: "تباين عالٍ للطباعة والقراءة السريعة",
    swatch: ["#0f172a", "#e2e8f0", "#ffffff"],
    vars: {
      paper: "#f8fafc", paper2: "#ffffff", line: "#cbd5e1",
      ink: "#000000", inkSoft: "#334155",
      accent: "#111827", accentSoft: "#e5e7eb", accentText: "#ffffff",
      green: "#15803d", red: "#b91c1c",
      header: "#000000", headerText: "#ffffff", headerSoft: "#374151",
    },
  },
  {
    id: "dark-amber",
    name: "ليلي — عنبري",
    hint: "وضع ليلي دافئ مريح للعين",
    swatch: ["#f59e0b", "#1e293b", "#0f172a"],
    vars: {
      paper: "#0f172a", paper2: "#1e293b", line: "#334155",
      ink: "#f1f5f9", inkSoft: "#cbd5e1",
      accent: "#f59e0b", accentSoft: "#78350f", accentText: "#0f172a",
      green: "#34d399", red: "#f87171",
      header: "#1e293b", headerText: "#f1f5f9", headerSoft: "#475569",
    },
  },
  {
    id: "dark-slate",
    name: "ليلي — رمادي",
    hint: "وضع ليلي هادئ محايد",
    swatch: ["#3b82f6", "#1e293b", "#0f172a"],
    vars: {
      paper: "#0f172a", paper2: "#1e293b", line: "#334155",
      ink: "#f1f5f9", inkSoft: "#cbd5e1",
      accent: "#3b82f6", accentSoft: "#1e3a5f", accentText: "#ffffff",
      green: "#34d399", red: "#f87171",
      header: "#1e293b", headerText: "#f1f5f9", headerSoft: "#475569",
    },
  },
  {
    id: "dark-emerald",
    name: "ليلي — زمردي",
    hint: "وضع ليلي أخضر مريح",
    swatch: ["#10b981", "#064e3b", "#022c22"],
    vars: {
      paper: "#022c22", paper2: "#064e3b", line: "#065f46",
      ink: "#ecfdf5", inkSoft: "#a7f3d0",
      accent: "#10b981", accentSoft: "#064e3b", accentText: "#022c22",
      green: "#34d399", red: "#f87171",
      header: "#064e3b", headerText: "#ecfdf5", headerSoft: "#065f46",
    },
  },
  {
    id: "dark-ocean",
    name: "ليلي — محيطي",
    hint: "وضع ليلي أزرق عميق",
    swatch: ["#06b6d4", "#164e63", "#083344"],
    vars: {
      paper: "#083344", paper2: "#164e63", line: "#155e75",
      ink: "#ecfeff", inkSoft: "#a5f3fc",
      accent: "#06b6d4", accentSoft: "#164e63", accentText: "#083344",
      green: "#34d399", red: "#f87171",
      header: "#164e63", headerText: "#ecfeff", headerSoft: "#155e75",
    },
  },
];

export const DEFAULT_THEME: ThemeId = "light-amber";

export const themeOf = (id: string | undefined | null): Theme =>
  THEMES.find((t) => t.id === id) ?? THEMES[0];

/* ============================ قوالب الخطوط ============================ */

export type FontId = "cairo" | "tajawal" | "noto" | "rubik" | "almarai" | "plex";

export type FontPreset = {
  id: FontId;
  name: string;
  hint: string;
  /** عائلة الخط بالكامل */
  stack: string;
  /** مقاس أساسي بالبكسل */
  size: number;
};

export const FONTS: FontPreset[] = [
  { id: "cairo", name: "القاهرة", hint: "الخط الافتراضي — واضح ومتوازن", stack: '"Cairo", "Segoe UI", sans-serif', size: 14 },
  { id: "tajawal", name: "تجوال", hint: "هندسي أنيق، مناسب للعناوين", stack: '"Tajawal", "Cairo", sans-serif', size: 14 },
  { id: "noto", name: "نوتو كوفي", hint: "كوفي عربي تقليدي واضح جداً", stack: '"Noto Kufi Arabic", "Cairo", sans-serif', size: 13 },
  { id: "rubik", name: "روبيك", hint: "عصري مستدير الحروف", stack: '"Rubik", "Cairo", sans-serif', size: 14 },
  { id: "almarai", name: "المراعي", hint: "مريح للأرقام والفواتير", stack: '"Almarai", "Cairo", sans-serif', size: 14 },
  { id: "plex", name: "IBM بلكس", hint: "خط تقني بأرقام ثابتة العرض", stack: '"IBM Plex Sans Arabic", "Cairo", sans-serif', size: 13 },
];

export const fontOf = (id: string | undefined | null): FontPreset =>
  FONTS.find((f) => f.id === id) ?? FONTS[0];

/* ============================ قوالب الأزرار ============================ */

export type ButtonStyleId = "rounded" | "soft" | "sharp" | "pill" | "raised" | "outline";

export type ButtonStyle = {
  id: ButtonStyleId;
  name: string;
  hint: string;
  /** خصائص CSS تُطبَّق على أزرار الوظائف */
  css: { radius: string; shadow: string; transform: string; borderWidth: string };
};

export const BUTTON_STYLES: ButtonStyle[] = [
  { id: "rounded", name: "مستدير الحواف", hint: "الافتراضي — زوايا ناعمة", css: { radius: "12px", shadow: "0 6px 16px -10px rgba(15,23,42,.9)", transform: "none", borderWidth: "2px" } },
  { id: "soft", name: "ناعم جداً", hint: "زوايا كبيرة وظل خفيف", css: { radius: "18px", shadow: "0 2px 8px -4px rgba(15,23,42,.35)", transform: "none", borderWidth: "1px" } },
  { id: "sharp", name: "حاد", hint: "زوايا قائمة بمظهر جدّي", css: { radius: "4px", shadow: "none", transform: "none", borderWidth: "2px" } },
  { id: "pill", name: "كبسولة", hint: "حواف دائرية بالكامل", css: { radius: "999px", shadow: "0 4px 12px -8px rgba(15,23,42,.8)", transform: "none", borderWidth: "2px" } },
  { id: "raised", name: "بارز", hint: "ظل عميق وحركة ضغط واضحة", css: { radius: "14px", shadow: "0 10px 22px -12px rgba(15,23,42,.95)", transform: "translateY(-1px)", borderWidth: "2px" } },
  { id: "outline", name: "محدّد", hint: "خلفية شفافة وإطار ملوّن", css: { radius: "10px", shadow: "none", transform: "none", borderWidth: "2px" } },
];

export const buttonStyleOf = (id: string | undefined | null): ButtonStyle =>
  BUTTON_STYLES.find((b) => b.id === id) ?? BUTTON_STYLES[0];

/* ============================ قوالب الفاتورة ============================ */

export type ReceiptStyleId = "classic" | "modern" | "minimal" | "bordered" | "dark-band" | "ticket";

export type ReceiptStyle = {
  id: ReceiptStyleId;
  name: string;
  hint: string;
};

export const RECEIPT_STYLES: ReceiptStyle[] = [
  { id: "classic", name: "كلاسيكي", hint: "شعار بالوسط وخطوط متقطعة" },
  { id: "modern", name: "عصري", hint: "شريط ملوّن أعلى الإيصال" },
  { id: "minimal", name: "بسيط", hint: "بدون إطارات — أرقام واضحة" },
  { id: "bordered", name: "مؤطّر", hint: "إطار كامل وقاعدة ملوّنة" },
  { id: "dark-band", name: "شريط داكن", hint: "رأس داكن بلون المحل" },
  { id: "ticket", name: "تذكرة", hint: "أسلوب تذكرة كاشير مع خطوط" },
];

export const receiptStyleOf = (id: string | undefined | null): ReceiptStyle =>
  RECEIPT_STYLES.find((r) => r.id === id) ?? RECEIPT_STYLES[0];

/* ============================ حركات الأزرار ============================ */

export type MotionId = "none" | "lift" | "press" | "glow" | "bounce" | "shine";

/* ============================ حركة انتقال الصفحات ============================ */

export type PageMotionId = "slide" | "fade" | "zoom" | "none";

export type PageMotion = { id: PageMotionId; name: string; hint: string };

export const PAGE_MOTIONS: PageMotion[] = [
  { id: "slide", name: "انزلاق", hint: "الأكثر سلاسة — يدخل من الجانب" },
  { id: "fade", name: "تلاشي", hint: "الأخف والأسرع" },
  { id: "zoom", name: "تكبير", hint: "نمو خفيف من المركز" },
  { id: "none", name: "بدون", hint: "بدون أي حركة" },
];

export const pageMotionOf = (id: string | undefined | null): PageMotion =>
  PAGE_MOTIONS.find((m) => m.id === id) ?? PAGE_MOTIONS[0];

/* ============================ ألوان القائمة المنسدلة ============================ */

export type MenuPaletteId = "dark" | "light" | "amber" | "emerald" | "navy" | "custom";

export type MenuPalette = {
  id: MenuPaletteId;
  name: string;
  /** خلفية القائمة */
  bg: string;
  /** لون الكلام */
  text: string;
  /** لون التمييز عند المرور */
  hover: string;
  /** لون الأيقونة النشطة */
  accent: string;
};

export const MENU_PALETTES: MenuPalette[] = [
  { id: "dark", name: "داكن كلاسيكي", bg: "#1e293b", text: "#ffffff", hover: "#334155", accent: "#f59e0b" },
  { id: "light", name: "فاتح ناصع", bg: "#ffffff", text: "#0f172a", hover: "#f1f5f9", accent: "#f59e0b" },
  { id: "amber", name: "عنبري دافئ", bg: "#78350f", text: "#fef3c7", hover: "#92400e", accent: "#fbbf24" },
  { id: "emerald", name: "زمردي", bg: "#064e3b", text: "#d1fae5", hover: "#065f46", accent: "#34d399" },
  { id: "navy", name: "كحلي عميق", bg: "#0c1a38", text: "#dbeafe", hover: "#152c56", accent: "#60a5fa" },
  { id: "custom", name: "ألوان حرة", bg: "#1e293b", text: "#ffffff", hover: "#334155", accent: "#f59e0b" },
];

export const menuPaletteOf = (id: string | undefined | null): MenuPalette =>
  MENU_PALETTES.find((m) => m.id === id) ?? MENU_PALETTES[0];

/* ============================ شاشة الدخول ============================ */

export type LoginPartId =
  | "brand"
  | "logo"
  | "tagline"
  | "welcomeMessage"
  | "features"
  | "trialInfo"
  | "bgGlow"
  | "footerNote";

export type LoginPart = { id: LoginPartId; name: string; hint: string };

export const LOGIN_PARTS: LoginPart[] = [
  { id: "logo", name: "الشعار", hint: "شعار البرنامج في جانب الهوية" },
  { id: "brand", name: "اسم البرنامج", hint: "CASH YOU · POS" },
  { id: "tagline", name: "العنوان التعريفي", hint: "نظام نقاط البيع المتكامل" },
  { id: "welcomeMessage", name: "رسالة الترحيب", hint: "النص أسفل العنوان" },
  { id: "features", name: "قائمة الميزات", hint: "الفاصلة الجانبية للميزات" },
  { id: "trialInfo", name: "معلومات النسخة التجريبية", hint: "١٥ يوم وحدود الاستخدام" },
  { id: "bgGlow", name: "تأثير الخلفية المضيء", hint: "الدوائر الملوّنة الخلفية" },
  { id: "footerNote", name: "سطر أسفل الشاشة", hint: "حقوق الملكية" },
];

export type LoginBgId = "mesh" | "aurora" | "solid" | "gradient" | "image";

export const LOGIN_BGS: { id: LoginBgId; name: string }[] = [
  { id: "mesh", name: "شبكي متدرّج" },
  { id: "aurora", name: "شفق ملوّن" },
  { id: "gradient", name: "تدرّج لوني" },
  { id: "solid", name: "لون واحد" },
  { id: "image", name: "صورة مرفوعة" },
];

export type MotionPreset = { id: MotionId; name: string; hint: string };

export const MOTIONS: MotionPreset[] = [
  { id: "none", name: "بدون حركة", hint: "أداء أسرع، بلا تأثيرات" },
  { id: "lift", name: "ارتفاع", hint: "الزر يرتفع قليلاً عند المرور" },
  { id: "press", name: "ضغط", hint: "ينغرز عند الضغط — الافتراضي" },
  { id: "glow", name: "توهّج", hint: "هالة ملوّنة حول الزر" },
  { id: "bounce", name: "نطّ", hint: "حركة مرنة سريعة" },
  { id: "shine", name: "لمعة", hint: "لمعة تمر على الزر" },
];

export const motionOf = (id: string | undefined | null): MotionPreset =>
  MOTIONS.find((m) => m.id === id) ?? MOTIONS[2];

/* ============================ إخفاء عناصر الواجهة ============================ */

export type UiPartId =
  | "topBarDate"
  | "topBarTitle"
  | "marquee"
  | "categoryBar"
  | "productGrid"
  | "tableFooter"
  | "rail"
  | "tabStrip"
  | "footer"
  | "welcomeLogo"
  | "statusBadge";

export type UiPart = { id: UiPartId; name: string; hint: string };

export const UI_PARTS: UiPart[] = [
  { id: "topBarTitle", name: "عنوان الشاشة العلوي", hint: "اسم تبويب الفاتورة أعلى الصفحة" },
  { id: "topBarDate", name: "التاريخ والساعة العلويان", hint: "يظهران في الفوتر دائماً" },
  { id: "marquee", name: "شريط التعليمات المتحرك", hint: "«امسح الباركود...»" },
  { id: "categoryBar", name: "قائمة التصنيفات", hint: "القائمة المنسدلة أعلى الجدول" },
  { id: "productGrid", name: "شبكة كروت الأصناف", hint: "القائمة السريعة بجانب الجدول" },
  { id: "tableFooter", name: "إجمالي أسفل الجدول", hint: "عدد الأسطر وإجمالي الكميات" },
  { id: "rail", name: "زر قائمة الوحدات", hint: "زر ☰ بجانب تبويب «الرئيسية»" },
  { id: "tabStrip", name: "شريط التبويبات", hint: "تبويبات الفواتير المفتوحة" },
  { id: "footer", name: "الفوتر السفلي", hint: "معلومات المستخدم والتاريخ" },
  { id: "statusBadge", name: "شارة حالة النظام والتفعيل", hint: "«النظام متصل» وحالة الترخيص" },
  { id: "welcomeLogo", name: "شعار شاشة الترحيب", hint: "إخفاؤه يجعل الترحيب نصياً" },
];

export const defaultUi = (): Record<UiPartId, boolean> =>
  UI_PARTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {} as Record<UiPartId, boolean>);

/* ============================ أزرار شريط الوظائف ============================ */

export type FnButtonId = "newInvoice" | "payFull" | "savePrint" | "save" | "suspend";

export type FnButton = { id: FnButtonId; label: string; visible: boolean; shortcut: string };

export const FN_BUTTONS_DEFAULT: FnButton[] = [
  { id: "newInvoice", label: "فاتورة جديدة", visible: true, shortcut: "F4" },
  { id: "payFull", label: "دفع كامل", visible: true, shortcut: "F12" },
  { id: "savePrint", label: "حفظ وطباعة", visible: true, shortcut: "F10" },
  { id: "save", label: "حفظ", visible: true, shortcut: "F5" },
  { id: "suspend", label: "تعليق الفاتورة", visible: true, shortcut: "Ctrl+D" },
];

/** كل عناصر شاشة الدخول ظاهرة افتراضياً */
export function defaultLoginParts(): Record<LoginPartId, boolean> {
  return LOGIN_PARTS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {} as Record<LoginPartId, boolean>);
}

export type InvoicePaper = "80mm" | "58mm" | "a5";

export type ShopSettings = {
  /** اسم المحل كما يظهر في الفاتورة والترحيب */
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  /** شعار المحل: data-URL (base64) أو رابط */
  shopLogo: string;
  /** خلفية الشاشة الرئيسية: data-URL (base64) أو رابط */
  homeBgImage: string;
  /** إعدادات محرر قوالب الفاتورة */
  receiptEditor: {
    showLogo: boolean;
    showPhone: boolean;
    showAddress: boolean;
    showQr: boolean;
    watermark: string;
    accentColor: string;
    fontSize: number;
    marginMm: number;
  };
  /** رسالة أسفل الفاتورة */
  invoiceFooter: string;
  /** إظهار سطر «شكراً لتعاملكم معنا» */
  invoiceThanks: boolean;
  /** مقاس ورق الفاتورة */
  invoicePaper: InvoicePaper;
  /** قالب الثيم */
  theme: ThemeId;
  /** قالب الخط */
  font: FontId;
  /** حجم الخط الأساسي بالبكسل */
  fontSize: number;
  /** قالب شكل الأزرار */
  buttonStyle: ButtonStyleId;
  /** حركة الأزرار */
  motion: MotionId;
  /** قالب شكل الفاتورة */
  receiptStyle: ReceiptStyleId;
  /** توسيط كل نصوص البرنامج */
  centerText: boolean;
  /** إظهار/إخفاء عناصر من الواجهة */
  ui: Record<UiPartId, boolean>;
  /** أزرار شريط الوظائف */
  fnButtons: FnButton[];
  /** إظهار شاشة الترحيب عند تسجيل الدخول */
  welcomeEnabled: boolean;

  /* ---------- حركة انتقال الصفحات ---------- */
  pageMotion: PageMotionId;

  /* ---------- القائمة المنسدلة ---------- */
  menuPalette: MenuPaletteId;
  menuBg: string;
  menuText: string;
  menuAccent: string;
  /** إظهار الأسماء بجانب الأيقونات في القائمة */
  menuShowLabels: boolean;

  /* ---------- شاشة الدخول ---------- */
  /** نص اسم البرنامج على شاشة الدخول */
  loginTitle: string;
  /** العنوان التعريفي أسفل الاسم */
  loginTagline: string;
  /** رسالة الترحيب */
  loginMessage: string;
  /** خلفية شاشة الدخول */
  loginBg: LoginBgId;
  /** صورة الخلفية (data-URL) حين يكون loginBg = image */
  loginBgImage: string;
  /** لون الخلفية حين يكون loginBg = solid */
  loginBgColor: string;
  /** عناصر شاشة الدخول الظاهرة */
  loginParts: Record<LoginPartId, boolean>;
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
  font: "cairo",
  fontSize: 14,
  buttonStyle: "rounded",
  motion: "press",
  receiptStyle: "classic",
  centerText: true,
  ui: defaultUi(),
  fnButtons: FN_BUTTONS_DEFAULT,
  welcomeEnabled: true,

  pageMotion: "slide",

  menuPalette: "dark",
  menuBg: "#1e293b",
  menuText: "#ffffff",
  menuAccent: "#f59e0b",
  menuShowLabels: true,

  loginTitle: "CASH YOU · POS",
  loginTagline: "نظام نقاط البيع المتكامل",
  loginMessage: "أدر مبيعاتك ومخزونك وحساباتك من شاشة واحدة — بسرعة ودقة.",
  loginBg: "mesh",
  loginBgImage: "",
  homeBgImage: "",
  receiptEditor: {
    showLogo: true,
    showPhone: true,
    showAddress: true,
    showQr: false,
    watermark: "",
    accentColor: "#0f172a",
    fontSize: 12,
    marginMm: 4,
  },
  loginBgColor: "#0b1220",
  loginParts: defaultLoginParts(),
};


/** دمج الإعدادات القادمة من الخادم مع الافتراضية (تحمّل القيم الناقصة) */
export function mergeSettings(raw: unknown): ShopSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS, ui: defaultUi(), fnButtons: [...FN_BUTTONS_DEFAULT] };
  const r = raw as Partial<ShopSettings>;
  const buttons = Array.isArray(r.fnButtons) && r.fnButtons.length
    ? r.fnButtons.filter((b) => b && typeof b.id === "string").map((b) => ({
        id: b.id as FnButtonId,
        label: typeof b.label === "string" && b.label.trim() ? b.label : FN_BUTTONS_DEFAULT.find((d) => d.id === b.id)?.label ?? b.id,
        visible: b.visible !== false,
        shortcut: typeof b.shortcut === "string" ? b.shortcut : FN_BUTTONS_DEFAULT.find((d) => d.id === b.id)?.shortcut ?? "",
      }))
    : [...FN_BUTTONS_DEFAULT];
  const base = defaultUi();
  const uiIn = (r.ui ?? {}) as Partial<Record<UiPartId, boolean>>;
  const ui = UI_PARTS.reduce((acc, p) => {
    acc[p.id] = typeof uiIn[p.id] === "boolean" ? (uiIn[p.id] as boolean) : base[p.id];
    return acc;
  }, {} as Record<UiPartId, boolean>);
  const size = Number(r.fontSize);
  const loginIn = (r.loginParts ?? {}) as Partial<Record<LoginPartId, boolean>>;
  const loginBase = defaultLoginParts();
  const loginParts = LOGIN_PARTS.reduce((acc, p) => {
    acc[p.id] = typeof loginIn[p.id] === "boolean" ? (loginIn[p.id] as boolean) : loginBase[p.id];
    return acc;
  }, {} as Record<LoginPartId, boolean>);
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
    font: fontOf(r.font).id,
    fontSize: Number.isFinite(size) && size >= 11 && size <= 20 ? size : DEFAULT_SETTINGS.fontSize,
    buttonStyle: buttonStyleOf(r.buttonStyle).id,
    motion: motionOf(r.motion).id,
    receiptStyle: receiptStyleOf(r.receiptStyle).id,
    centerText: r.centerText !== false,
    ui,
    fnButtons: buttons,
    welcomeEnabled: r.welcomeEnabled !== false,

    pageMotion: pageMotionOf(r.pageMotion).id,

    menuPalette: menuPaletteOf(r.menuPalette).id,
    menuBg: r.menuBg ?? DEFAULT_SETTINGS.menuBg,
    menuText: r.menuText ?? DEFAULT_SETTINGS.menuText,
    menuAccent: r.menuAccent ?? DEFAULT_SETTINGS.menuAccent,
    menuShowLabels: r.menuShowLabels !== false,

    loginTitle: r.loginTitle ?? DEFAULT_SETTINGS.loginTitle,
    loginTagline: r.loginTagline ?? DEFAULT_SETTINGS.loginTagline,
    loginMessage: r.loginMessage ?? DEFAULT_SETTINGS.loginMessage,
    loginBg: LOGIN_BGS.some((b) => b.id === r.loginBg) ? (r.loginBg as LoginBgId) : DEFAULT_SETTINGS.loginBg,
    loginBgImage: r.loginBgImage ?? "",
    loginBgColor: r.loginBgColor || DEFAULT_SETTINGS.loginBgColor,
    loginParts,
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

/** متغيرات CSS للخط وحجمه وقوالب الأزرار والحركة والتوسيط */
export function appearanceCssVars(s: ShopSettings): Record<string, string> {
  const f = fontOf(s.font);
  const b = buttonStyleOf(s.buttonStyle);
  return {
    "--cy-font": f.stack,
    "--cy-font-size": `${s.fontSize}px`,
    "--cy-btn-radius": b.css.radius,
    "--cy-btn-shadow": b.css.shadow,
    "--cy-btn-lift": b.css.transform,
    "--cy-btn-border": b.css.borderWidth,
    "--cy-align": s.centerText ? "center" : "right",
  };
}

/** لون القائمة الفعلي: قالب جاهز أو ألوان حرة */
export function menuColors(s: ShopSettings): { bg: string; text: string; accent: string } {
  if (s.menuPalette === "custom") {
    return { bg: s.menuBg, text: s.menuText, accent: s.menuAccent };
  }
  const p = menuPaletteOf(s.menuPalette);
  return { bg: p.bg, text: p.text, accent: p.accent };
}

/** كل متغيرات المظهر في مكان واحد — تُمرَّر لـ style على جذر التطبيق */
export function appCssVars(s: ShopSettings): Record<string, string> {
  const menu = menuColors(s);
  return {
    ...themeCssVars(themeOf(s.theme)),
    ...appearanceCssVars(s),
    "--cy-motion": s.motion,
    "--cy-menu-bg": menu.bg,
    "--cy-menu-text": menu.text,
    "--cy-menu-accent": menu.accent,
  };
}

/** هل عنصر شاشة الدخول ظاهر؟ */
export const showLogin = (s: ShopSettings, part: LoginPartId): boolean =>
  s.loginParts?.[part] !== false;

/** هل العنصر ظاهر؟ (مع افتراض الظهور عند غياب القيمة) */
export const show = (s: ShopSettings, part: UiPartId): boolean => s.ui?.[part] !== false;
