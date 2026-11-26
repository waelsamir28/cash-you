"use client";

import { useEffect, useRef, useState } from "react";
import type { Bootstrap, SessionUser } from "@/lib/types";
import {
  AMOUNT_TILES,
  BUTTON_MOTIONS,
  DEFAULT_AMOUNTS,
  DEFAULT_PREFS,
  amountPreviewStyle,
  type AmountKey,
  type AmountStyle,
  type TextAlign,
  ENTER_MOTIONS,
  HIDE_ITEMS,
  THEMES,
  type AnimSpeed,
  type ButtonRadius,
  type ButtonSize,
  type ButtonTemplate,
  type InvoiceTemplate,
  type LineTemplate,
  type ThemeId,
  type UiPrefs,
} from "@/lib/ui-prefs";
import { IcoCheck, IcoLogo, IcoTrash } from "@/components/icons";

type Notify = (kind: "ok" | "warn" | "err" | "info", text: string) => void;
type Change = (next: UiPrefs) => void;

const TABS = [
  { id: "shop", label: "بيانات المحل" },
  { id: "theme", label: "الثيمات والألوان" },
  { id: "templates", label: "القوالب والحركات" },
  { id: "amounts", label: "خانات المبالغ" },
  { id: "menu", label: "القائمة" },
  { id: "login", label: "شاشة الدخول" },
  { id: "visibility", label: "الإظهار والإخفاء" },
  { id: "database", label: "قاعدة البيانات" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function SettingsScreen({
  data,
  prefs,
  onChange,
  refresh,
  notify,
  focus,
  user,
}: {
  data: Bootstrap;
  prefs: UiPrefs;
  onChange: Change;
  refresh: () => Promise<void>;
  notify: Notify;
  focus: { tab: string; nonce: number } | null;
  user: SessionUser | null;
}) {
  const [tab, setTab] = useState<TabId>(() => {
    const requested = TABS.find((t) => t.id === focus?.tab);
    return requested ? requested.id : "shop";
  });

  return (
    <section className="flex-1 min-h-0 flex flex-col bg-paper" dir="rtl">
      <header className="shrink-0 px-4 pt-3 pb-2 border-b border-line bg-white/70">
        <h1 className="text-[18px] font-black text-ink-900">الإعدادات</h1>
        <p className="text-[12px] font-bold text-slate-500">بيانات المحل والقاعدة تُحفظ في الخادم، والباقي يُحفظ على هذا الجهاز.</p>
        <nav className="mt-2 flex flex-wrap gap-1.5" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`cy-press cy-focus h-9 px-3.5 rounded-lg text-[12.5px] font-black transition-colors ${
                tab === t.id ? "bg-ink-800 text-white shadow-sm" : "bg-slate-200/70 text-ink-700 hover:bg-slate-300/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div key={tab} className="cy-page-in flex-1 min-h-0 overflow-y-auto cy-scroll p-4">
        <div className="mx-auto max-w-5xl grid gap-3 lg:grid-cols-2">
          {tab === "shop" && <ShopSection data={data} refresh={refresh} notify={notify} />}
          {tab === "theme" && (
            <>
              <ThemeSection prefs={prefs} onChange={onChange} />
              <ColorSection prefs={prefs} onChange={onChange} />
            </>
          )}
          {tab === "templates" && (
            <>
              <InvoiceTemplateSection prefs={prefs} onChange={onChange} />
              <LineTemplateSection prefs={prefs} onChange={onChange} />
              <ButtonTemplateSection prefs={prefs} onChange={onChange} />
              <AnimationSection prefs={prefs} onChange={onChange} />
            </>
          )}
          {tab === "amounts" && <AmountsSection prefs={prefs} onChange={onChange} />}
          {tab === "menu" && <MenuSection prefs={prefs} onChange={onChange} />}
          {tab === "login" && <LoginSection prefs={prefs} onChange={onChange} />}
          {tab === "visibility" && <VisibilitySection prefs={prefs} onChange={onChange} />}
          {tab === "database" && <DatabaseSection isOwner={user?.role === "owner"} notify={notify} />}
        </div>
      </div>
    </section>
  );
}

/* ---------------- بيانات المحل والشعار ---------------- */

function ShopSection({
  data,
  refresh,
  notify,
}: {
  data: Bootstrap;
  refresh: () => Promise<void>;
  notify: Notify;
}) {
  const [name, setName] = useState(data.shop.name);
  const [phone, setPhone] = useState(data.shop.phone);
  const [address, setAddress] = useState(data.shop.address ?? "");
  const [logo, setLogo] = useState(data.shop.logo ?? "");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("err", "اختر ملف صورة (PNG أو JPG أو WEBP)");
      return;
    }
    try {
      setLogo(await resizeToDataUrl(file, 320));
    } catch {
      notify("err", "تعذر قراءة الصورة، جرّب صورة أخرى");
    }
  };

  const save = async () => {
    if (!name.trim()) {
      notify("err", "اسم المحل مطلوب");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/shop", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address, logo }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "تعذر حفظ بيانات المحل");
      await refresh();
      notify("ok", "تم حفظ بيانات المحل");
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "تعذر حفظ بيانات المحل");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="بيانات المحل" subtitle="الاسم والتليفون والعنوان والشعار — تظهر في الفاتورة وشاشة الترحيب">
      <div className="flex items-center gap-3">
        <div className="w-24 h-24 shrink-0 rounded-2xl bg-white border border-line grid place-items-center overflow-hidden p-1.5">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="شعار المحل" className="max-w-full max-h-full object-contain" />
          ) : (
            <IcoLogo className="w-16 h-16" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pickLogo(e.target.files?.[0])} />
          <button
            onClick={() => fileRef.current?.click()}
            className="h-9 px-3 rounded-lg bg-ink-800 text-white text-[12.5px] font-black cy-press hover:bg-ink-900"
          >
            تغيير الشعار
          </button>
          {logo && (
            <button
              onClick={() => setLogo("")}
              className="h-9 px-3 rounded-lg bg-slate-200 text-ink-800 text-[12.5px] font-black cy-press hover:bg-cash-red hover:text-white flex items-center gap-1.5"
            >
              <IcoTrash className="w-3.5 h-3.5" />
              إزالة الشعار
            </button>
          )}
          <span className="text-[10.5px] font-bold text-slate-500">يُفضّل شعار مربع بخلفية شفافة</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
        <TextField label="اسم المحل" value={name} onChange={setName} />
        <TextField label="رقم التليفون" value={phone} onChange={setPhone} ltr />
        <TextField label="العنوان" value={address} onChange={setAddress} className="sm:col-span-2" />
      </div>

      <div className="flex justify-end mt-3">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="h-10 px-5 rounded-xl bg-cash-green text-white font-black cy-press hover:bg-cash-green-deep disabled:opacity-60"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ بيانات المحل"}
        </button>
      </div>
    </Card>
  );
}

/** يصغّر الصورة إلى أقصى ضلع محدد ويعيدها كـ data URL (PNG يحافظ على الشفافية) */
function resizeToDataUrl(file: File, maxSide: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("load"));
    };
    img.src = url;
  });
}


/* ---------------- الثيم والألوان ---------------- */

function ThemeSection({ prefs, onChange }: { prefs: UiPrefs; onChange: Change }) {
  const pick = (id: ThemeId) => {
    const t = THEMES.find((x) => x.id === id);
    if (!t) return;
    onChange({ ...prefs, theme: id, colors: { chrome: t.chrome, paper: t.paper, accent: t.accent } });
  };
  return (
    <Card title="الثيم" subtitle="الداكن هو الافتراضي، والفاتح متاح بعدة ألوان">
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((t) => {
          const active = prefs.theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              className={`cy-press cy-focus text-right rounded-xl border-2 p-2 bg-white transition ${
                active ? "border-amber-brand" : "border-line hover:border-slate-400"
              }`}
            >
              <div className="h-14 rounded-lg overflow-hidden border border-black/10 flex" style={{ background: t.paper }}>
                <div className="w-1/3 h-full" style={{ background: t.chrome }} />
                <div className="flex-1 p-1.5 flex flex-col justify-center gap-1">
                  <span className="h-1.5 w-2/3 rounded bg-white/90" />
                  <span className="h-1.5 w-1/2 rounded" style={{ background: t.accent }} />
                </div>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[12px] font-black text-ink-800">{t.label}</span>
                {active && <IcoCheck className="w-4 h-4 text-amber-brand" />}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function ColorSection({ prefs, onChange }: { prefs: UiPrefs; onChange: Change }) {
  const setColor = (key: keyof UiPrefs["colors"], value: string) =>
    onChange({ ...prefs, colors: { ...prefs.colors, [key]: value } });
  return (
    <Card title="الألوان" subtitle="تغيير الألوان يدوياً يتجاوز ألوان الثيم">
      <div className="grid gap-2">
        <ColorField label="لون الشريط العلوي والسفلي" value={prefs.colors.chrome} onChange={(v) => setColor("chrome", v)} />
        <ColorField label="لون خلفية الشاشة" value={prefs.colors.paper} onChange={(v) => setColor("paper", v)} />
        <ColorField label="اللون المميز" value={prefs.colors.accent} onChange={(v) => setColor("accent", v)} />
      </div>
      <button
        onClick={() => onChange({ ...prefs, colors: { ...DEFAULT_PREFS.colors }, theme: "dark" })}
        className="mt-3 h-9 px-3 rounded-lg bg-slate-200 text-ink-800 text-[12px] font-black cy-press hover:bg-slate-300"
      >
        استعادة ألوان الثيم الداكن
      </button>
    </Card>
  );
}

/* ---------------- القوالب والحركات ---------------- */

const INVOICE_TPLS: { value: InvoiceTemplate; label: string }[] = [
  { value: "classic", label: "كلاسيكي" },
  { value: "modern", label: "حديث" },
  { value: "compact", label: "مضغوط" },
];

function InvoiceTemplateSection({ prefs, onChange }: { prefs: UiPrefs; onChange: Change }) {
  const setTpl = (invoice: InvoiceTemplate) => onChange({ ...prefs, templates: { ...prefs.templates, invoice } });
  const setReceipt = (patch: Partial<UiPrefs["receipt"]>) => onChange({ ...prefs, receipt: { ...prefs.receipt, ...patch } });
  return (
    <Card title="قالب الفاتورة" subtitle="شكل الإيصال المطبوع والمعاينة قبل الحفظ">
      <div className="grid grid-cols-3 gap-2">
        {INVOICE_TPLS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTpl(t.value)}
            className={`cy-press rounded-xl border-2 p-2 bg-white text-center ${
              prefs.templates.invoice === t.value ? "border-amber-brand" : "border-line hover:border-slate-400"
            }`}
          >
            <div className={`mx-auto w-16 h-20 rounded bg-white border border-slate-300 p-1 flex flex-col gap-0.5 ${t.value === "compact" ? "text-[5px]" : ""}`}>
              {t.value === "modern" ? (
                <span className="h-3 rounded-sm bg-ink-800" />
              ) : (
                <span className={`h-1.5 w-2/3 mx-auto rounded ${t.value === "classic" ? "bg-slate-400" : "bg-slate-300"}`} />
              )}
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="h-1 rounded bg-slate-200" />
              ))}
            </div>
            <span className="mt-1.5 block text-[12px] font-black text-ink-800">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Segmented<"58" | "80">
          label="عرض الورق"
          value={String(prefs.receipt.paperWidth) as "58" | "80"}
          onChange={(v) => setReceipt({ paperWidth: v === "58" ? 58 : 80 })}
          options={[
            { value: "58", label: "58 مم" },
            { value: "80", label: "80 مم" },
          ]}
        />
        <Toggle label="إظهار الشعار" checked={prefs.receipt.showLogo} onChange={(v) => setReceipt({ showLogo: v })} />
        <Toggle label="إظهار التليفون" checked={prefs.receipt.showPhone} onChange={(v) => setReceipt({ showPhone: v })} />
        <Toggle label="إظهار العنوان" checked={prefs.receipt.showAddress} onChange={(v) => setReceipt({ showAddress: v })} />
        <Toggle label="إظهار التاريخ والوقت" checked={prefs.receipt.showDateTime} onChange={(v) => setReceipt({ showDateTime: v })} />
      </div>
      <label className="mt-3 flex flex-col gap-1">
        <span className="text-[11px] font-black text-slate-500">نص أسفل الفاتورة</span>
        <input
          value={prefs.receipt.footerText}
          onChange={(e) => setReceipt({ footerText: e.target.value })}
          className="h-9 rounded-lg border border-line bg-paper-2 px-2.5 text-[13px] font-bold text-ink-900 outline-none focus:border-amber-brand focus:bg-white"
        />
      </label>
    </Card>
  );
}

const LINE_TPLS: { value: LineTemplate; label: string }[] = [
  { value: "striped", label: "مخطط بالتبادل" },
  { value: "bordered", label: "بإطارات" },
  { value: "minimal", label: "بسيط" },
];

function LineTemplateSection({ prefs, onChange }: { prefs: UiPrefs; onChange: Change }) {
  const setTpl = (lines: LineTemplate) => onChange({ ...prefs, templates: { ...prefs.templates, lines } });
  return (
    <Card title="قالب الخطوط" subtitle="شكل صفوف جدول الأصناف في شاشة البيع">
      <div className="grid grid-cols-3 gap-2">
        {LINE_TPLS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTpl(t.value)}
            className={`cy-press rounded-xl border-2 p-2 bg-white ${
              prefs.templates.lines === t.value ? "border-amber-brand" : "border-line hover:border-slate-400"
            }`}
          >
            <div className="rounded border border-slate-200 overflow-hidden">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-3 ${
                    t.value === "striped" && i % 2 === 1 ? "bg-slate-100" : "bg-white"
                  } ${t.value === "bordered" ? "border-b border-slate-400" : "border-b border-dashed border-slate-200"}`}
                />
              ))}
            </div>
            <span className="mt-1.5 block text-[12px] font-black text-ink-800">{t.label}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

const BUTTON_TPLS: { value: ButtonTemplate; label: string }[] = [
  { value: "filled", label: "ممتلئ" },
  { value: "outline", label: "بإطار" },
  { value: "soft", label: "ناعم" },
];

function ButtonTemplateSection({ prefs, onChange }: { prefs: UiPrefs; onChange: Change }) {
  const setBtn = (patch: Partial<UiPrefs["buttons"]>) => onChange({ ...prefs, buttons: { ...prefs.buttons, ...patch } });
  return (
    <Card title="قالب الأزرار" subtitle="شكل أزرار الوظائف وأزرار الحفظ والإجراءات">
      <div className="grid grid-cols-3 gap-2">
        {BUTTON_TPLS.map((t) => (
          <button
            key={t.value}
            onClick={() => setBtn({ template: t.value })}
            className={`cy-press rounded-xl border-2 p-2 bg-white flex flex-col items-center gap-1.5 ${
              prefs.buttons.template === t.value ? "border-amber-brand" : "border-line hover:border-slate-400"
            }`}
          >
            <span
              className={`cy-btn h-8 w-full rounded-lg text-[11px] font-black grid place-items-center ${
                t.value === "filled" ? "bg-ink-800 text-white" : t.value === "outline" ? "bg-white border-2 border-ink-800 text-ink-800" : "bg-slate-200 text-ink-800"
              }`}
            >
              نموذج
            </span>
            <span className="text-[12px] font-black text-ink-800">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        <Segmented<ButtonRadius>
          label="شكل الزر"
          value={prefs.buttons.radius}
          onChange={(v) => setBtn({ radius: v })}
          options={[
            { value: "sharp", label: "حاد" },
            { value: "rounded", label: "منحني" },
            { value: "pill", label: "دائري" },
          ]}
        />
        <Segmented<ButtonSize>
          label="حجم الزر"
          value={prefs.buttons.size}
          onChange={(v) => setBtn({ size: v })}
          options={[
            { value: "compact", label: "صغير" },
            { value: "normal", label: "متوسط" },
            { value: "large", label: "كبير" },
          ]}
        />
        <ColorField label="اللون الأساسي للزر" value={prefs.buttons.base} onChange={(v) => setBtn({ base: v })} />
        <ColorField label="لون المرور (Hover)" value={prefs.buttons.hover} onChange={(v) => setBtn({ hover: v })} />
        <ColorField label="لون الضغط (Press)" value={prefs.buttons.press} onChange={(v) => setBtn({ press: v })} />
        <ColorField label="لون الكلام على الزر" value={prefs.buttons.text} onChange={(v) => setBtn({ text: v })} />
        <ColorField label="لون زر حفظ" value={prefs.buttons.save} onChange={(v) => setBtn({ save: v })} />
        <ColorField label="لون زر حفظ وطباعة" value={prefs.buttons.savePrint} onChange={(v) => setBtn({ savePrint: v })} />
      </div>
    </Card>
  );
}

const SPEEDS: { value: AnimSpeed; label: string }[] = [
  { value: "fast", label: "سريعة" },
  { value: "normal", label: "عادية" },
  { value: "slow", label: "بطيئة" },
];

function MotionPicker<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly { id: T; label: string }[];
}) {
  return (
    <div className="mt-2">
      <p className="text-[12px] font-black text-ink-700 mb-1">{label}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`cy-press h-9 rounded-lg text-[12px] font-black border-2 ${
              value === o.id ? "border-amber-brand bg-amber-soft text-ink-900" : "border-line bg-white text-ink-700 hover:border-slate-400"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AnimationSection({ prefs, onChange }: { prefs: UiPrefs; onChange: Change }) {
  const setAnim = (patch: Partial<UiPrefs["anim"]>) => onChange({ ...prefs, anim: { ...prefs.anim, ...patch } });
  return (
    <Card title="الحركات" subtitle="انتقال الصفحات وحركة الأزرار (القائمة لها تحكم منفصل)">
      <Toggle label="تفعيل الحركات" checked={prefs.anim.enabled} onChange={(v) => setAnim({ enabled: v })} />
      <div className="mt-2">
        <Segmented<AnimSpeed> label="السرعة" value={prefs.anim.speed} onChange={(v) => setAnim({ speed: v })} options={SPEEDS} />
      </div>
      <MotionPicker label="حركة انتقال الصفحات" value={prefs.anim.page} options={ENTER_MOTIONS} onChange={(v) => setAnim({ page: v })} />
      <MotionPicker label="حركة الأزرار" value={prefs.anim.button} options={BUTTON_MOTIONS} onChange={(v) => setAnim({ button: v })} />
    </Card>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 mt-2">
      <span className="flex items-center justify-between text-[12px] font-black text-ink-700">
        <span>{label}</span>
        <span className="cy-num text-ink-900">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-500"
      />
    </label>
  );
}

/* ---------------- خانات المبالغ الكبيرة ---------------- */

const TEXT_ALIGNS: { value: TextAlign; label: string }[] = [
  { value: "right", label: "يمين" },
  { value: "center", label: "وسط" },
  { value: "left", label: "شمال" },
];

function AmountsSection({ prefs, onChange }: { prefs: UiPrefs; onChange: Change }) {
  const [key, setKey] = useState<AmountKey>("net");
  const cur = prefs.amounts[key];
  const setCur = (patch: Partial<AmountStyle>) =>
    onChange({ ...prefs, amounts: { ...prefs.amounts, [key]: { ...cur, ...patch } } });
  const curLabel = AMOUNT_TILES.find((t) => t.key === key)?.label ?? "";
  return (
    <Card title="خانات المبالغ الكبيرة" subtitle="اضغط على الخانة لتعديلها — الألوان والمقاس والمحاذاة وحجم الخط">
      <div className="flex flex-wrap items-stretch justify-center gap-2 rounded-xl bg-paper p-3">
        {AMOUNT_TILES.map((t) => {
          const a = prefs.amounts[t.key];
          const selected = t.key === key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setKey(t.key)}
              aria-pressed={selected}
              className={`relative rounded-xl border-2 px-2 py-1.5 flex flex-col justify-center shadow-sm cy-press overflow-hidden ${
                selected ? "ring-2 ring-amber-brand ring-offset-2 ring-offset-paper" : ""
              }`}
              style={{ ...amountPreviewStyle(a), maxWidth: "100%" }}
            >
              <span
                className="block w-full leading-none font-black truncate"
                style={{ fontSize: a.labelSize, color: a.label, textAlign: a.labelAlign }}
              >
                {t.label}
              </span>
              <span
                className="block w-full mt-1 leading-none font-black cy-num"
                style={{ fontSize: a.numSize, textAlign: a.numAlign }}
              >
                1,250.00
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[12px] font-black text-ink-900">تعديل: {curLabel}</p>
      <div className="mt-2 grid gap-2">
        <ColorField label="لون الخانة" value={cur.bg} onChange={(v) => setCur({ bg: v })} />
        <ColorField label="لون الأرقام" value={cur.text} onChange={(v) => setCur({ text: v })} />
        <ColorField label="لون الاسم" value={cur.label} onChange={(v) => setCur({ label: v })} />
        <ColorField label="لون الإطار" value={cur.border} onChange={(v) => setCur({ border: v })} />
      </div>
      <Slider label="عرض الخانة" value={cur.width} min={120} max={300} unit="px" onChange={(v) => setCur({ width: v })} />
      <Slider label="ارتفاع الخانة" value={cur.height} min={40} max={100} unit="px" onChange={(v) => setCur({ height: v })} />
      <Slider label="حجم خط الرقم" value={cur.numSize} min={12} max={40} unit="px" onChange={(v) => setCur({ numSize: v })} />
      <Slider label="حجم خط الاسم" value={cur.labelSize} min={8} max={18} unit="px" onChange={(v) => setCur({ labelSize: v })} />
      <div className="mt-2 grid gap-1">
        <Segmented<TextAlign>
          label="محاذاة الرقم"
          value={cur.numAlign}
          onChange={(v) => setCur({ numAlign: v })}
          options={TEXT_ALIGNS}
        />
        <Segmented<TextAlign>
          label="محاذاة الاسم"
          value={cur.labelAlign}
          onChange={(v) => setCur({ labelAlign: v })}
          options={TEXT_ALIGNS}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setCur({ ...DEFAULT_AMOUNTS[key] })}
          className="h-9 px-3 rounded-lg bg-slate-200 text-ink-800 text-[12px] font-black cy-press hover:bg-slate-300"
        >
          استعادة هذه الخانة
        </button>
        <button
          onClick={() => onChange({ ...prefs, amounts: DEFAULT_AMOUNTS })}
          className="h-9 px-3 rounded-lg bg-slate-200 text-ink-800 text-[12px] font-black cy-press hover:bg-slate-300"
        >
          استعادة كل الخانات
        </button>
      </div>
    </Card>
  );
}

/* ---------------- القائمة ---------------- */

const ITEM_HEIGHTS: { value: "compact" | "normal" | "large"; label: string }[] = [
  { value: "compact", label: "صغيرة" },
  { value: "normal", label: "متوسطة" },
  { value: "large", label: "كبيرة" },
];

function MenuSection({ prefs, onChange }: { prefs: UiPrefs; onChange: Change }) {
  const setMenu = (patch: Partial<UiPrefs["menu"]>) => onChange({ ...prefs, menu: { ...prefs.menu, ...patch } });
  const setAnim = (patch: Partial<UiPrefs["anim"]>) => onChange({ ...prefs, anim: { ...prefs.anim, ...patch } });
  const m = prefs.menu;
  return (
    <>
      <Card title="القائمة الرئيسية" subtitle="زر «القائمة» بجانب تبويب الرئيسية، والضغط بره القائمة يقفلها">
        <div
          className="rounded-xl p-3 border border-black/10"
          style={{ background: `color-mix(in srgb, ${m.bg} ${m.opacity}%, transparent)`, color: m.text, width: m.width, maxWidth: "100%" }}
        >
          <p className="text-[11px] font-black opacity-80 mb-2">معاينة</p>
          {["الرئيسية", "فاتورة مبيعات", "الإعدادات"].map((label) => (
            <div
              key={label}
              className="px-2 mb-1.5 flex items-center text-[12.5px] font-bold"
              style={{ background: m.button, color: m.text, borderRadius: m.radius, minHeight: m.itemHeight === "compact" ? 34 : m.itemHeight === "large" ? 48 : 40 }}
            >
              <span className="w-6" />
              <span className="flex-1 text-center">{label}</span>
              {m.icons && <span className="w-6 text-center opacity-90">●</span>}
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2">
          <ColorField label="لون خلفية القائمة" value={m.bg} onChange={(v) => setMenu({ bg: v })} />
          <ColorField label="لون الكلام" value={m.text} onChange={(v) => setMenu({ text: v })} />
          <ColorField label="لون الأزرار" value={m.button} onChange={(v) => setMenu({ button: v })} />
          <Toggle label="إظهار الأيقونات (على الشمال)" checked={m.icons} onChange={(v) => setMenu({ icons: v })} />
        </div>
        <Slider label="شفافية القائمة" value={m.opacity} min={40} max={100} unit="%" onChange={(v) => setMenu({ opacity: v })} />
        <Slider label="عرض القائمة" value={m.width} min={200} max={360} unit="px" onChange={(v) => setMenu({ width: v })} />
        <Slider label="انحناء الأزرار" value={m.radius} min={0} max={20} unit="px" onChange={(v) => setMenu({ radius: v })} />
        <div className="mt-2">
          <Segmented<"compact" | "normal" | "large">
            label="ارتفاع الزر"
            value={m.itemHeight}
            onChange={(v) => setMenu({ itemHeight: v })}
            options={ITEM_HEIGHTS}
          />
        </div>
        <MotionPicker label="حركة فتح القائمة" value={prefs.anim.menu} options={ENTER_MOTIONS} onChange={(v) => setAnim({ menu: v })} />
        <button
          onClick={() => setMenu({ ...DEFAULT_PREFS.menu })}
          className="mt-3 h-9 px-3 rounded-lg bg-slate-200 text-ink-800 text-[12px] font-black cy-press hover:bg-slate-300"
        >
          استعادة إعدادات القائمة الافتراضية
        </button>
      </Card>
    </>
  );
}

/* ---------------- شاشة الدخول ---------------- */

function LoginSection({ prefs, onChange }: { prefs: UiPrefs; onChange: Change }) {
  const setLogin = (patch: Partial<UiPrefs["login"]>) => onChange({ ...prefs, login: { ...prefs.login, ...patch } });
  return (
    <Card title="شاشة الدخول" subtitle="تظهر قبل تسجيل الدخول على هذا الجهاز">
      <div className="rounded-xl p-4 text-center" style={{ background: prefs.login.bg }}>
        {prefs.login.showLogo && <IcoLogo className="mx-auto h-12 w-12 rounded-xl" />}
        <p className="mt-2 text-[15px] font-black text-white">{prefs.login.title || "—"}</p>
        <p className="text-[11.5px] font-bold" style={{ color: prefs.login.accent }}>
          {prefs.login.subtitle}
        </p>
      </div>
      <div className="mt-3 grid gap-2">
        <TextField label="عنوان شاشة الدخول" value={prefs.login.title} onChange={(v) => setLogin({ title: v })} />
        <TextField label="الوصف تحت العنوان" value={prefs.login.subtitle} onChange={(v) => setLogin({ subtitle: v })} />
        <ColorField label="لون الخلفية" value={prefs.login.bg} onChange={(v) => setLogin({ bg: v })} />
        <ColorField label="لون التمييز" value={prefs.login.accent} onChange={(v) => setLogin({ accent: v })} />
        <Toggle label="إظهار الشعار" checked={prefs.login.showLogo} onChange={(v) => setLogin({ showLogo: v })} />
      </div>
    </Card>
  );
}

/* ---------------- الإظهار والإخفاء ---------------- */

function VisibilitySection({ prefs, onChange }: { prefs: UiPrefs; onChange: Change }) {
  const setHidden = (key: (typeof HIDE_ITEMS)[number]["key"], hide: boolean) =>
    onChange({ ...prefs, hidden: { ...prefs.hidden, [key]: hide } });
  const groups = Array.from(new Set(HIDE_ITEMS.map((h) => h.group)));
  return (
    <Card title="إظهار وإخفاء العناصر" subtitle="اختر ما تريد إخفاءه من أنحاء البرنامج">
      <div className="grid gap-3">
        <Toggle label="توسيط النصوص في البرنامج كله" checked={prefs.centerText} onChange={(v) => onChange({ ...prefs, centerText: v })} />
        {groups.map((g) => (
          <div key={g}>
            <p className="text-[11px] font-black text-slate-500 mb-1">{g}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {HIDE_ITEMS.filter((h) => h.group === g).map((h) => (
                <Toggle
                  key={h.key}
                  label={h.label}
                  checked={!prefs.hidden[h.key]}
                  onChange={(show) => setHidden(h.key, !show)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange({ ...prefs, hidden: {} })}
        className="mt-3 h-9 px-3 rounded-lg bg-slate-200 text-ink-800 text-[12px] font-black cy-press hover:bg-slate-300"
      >
        إظهار كل العناصر
      </button>
    </Card>
  );
}

/* ---------------- قاعدة البيانات ---------------- */

type DbState = { saved: { mode: "cloud" | "local"; maskedUrl: string } | null; active: { maskedUrl: string; source: string } | null };

function DatabaseSection({ isOwner, notify }: { isOwner: boolean; notify: Notify }) {
  const [mode, setMode] = useState<"cloud" | "local">("cloud");
  const [url, setUrl] = useState("");
  const [state, setState] = useState<DbState | null>(null);
  const [busy, setBusy] = useState(false);
  const [testMsg, setTestMsg] = useState("");

  useEffect(() => {
    if (!isOwner) return;
    void fetch("/api/db-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((json: DbState) => {
        setState(json);
        if (json.saved) setMode(json.saved.mode);
      })
      .catch(() => undefined);
  }, [isOwner]);

  if (!isOwner) {
    return (
      <Card title="قاعدة البيانات" subtitle="للمالك فقط">
        <p className="text-[12px] font-bold text-amber-800 bg-amber-50 rounded-lg px-3 py-2">إعدادات قاعدة البيانات متاحة لحساب المالك فقط.</p>
      </Card>
    );
  }

  const test = async () => {
    setBusy(true);
    setTestMsg("");
    try {
      const res = await fetch("/api/db-config/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; version?: string };
      if (json.ok) {
        setTestMsg(`تم الاتصال بنجاح — ${json.version ?? ""}`);
        notify("ok", "الاتصال بقاعدة البيانات ناجح");
      } else {
        setTestMsg(json.error ?? "تعذر الاتصال");
        notify("err", json.error ?? "تعذر الاتصال");
      }
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/db-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, url }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "تعذر حفظ الرابط");
      setUrl("");
      notify("ok", "تم حفظ الرابط — أعد تشغيل البرنامج ليتم تطبيقه");
      setState((prev) => ({ active: prev?.active ?? null, saved: { mode, maskedUrl: "تم الحفظ — يُطبَّق بعد إعادة التشغيل" } }));
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "تعذر حفظ الرابط");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="ربط قاعدة البيانات" subtitle="اختر نوع الربط ثم الصق الرابط (postgres://...)">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            { value: "cloud", label: "قاعدة سحابية", desc: "رابط خادم على الإنترنت" },
            { value: "local", label: "قاعدة محلية", desc: "على نفس الجهاز (localhost)" },
          ] as const
        ).map((o) => (
          <button
            key={o.value}
            onClick={() => setMode(o.value)}
            className={`cy-press text-right rounded-xl border-2 p-3 bg-white ${
              mode === o.value ? "border-amber-brand" : "border-line hover:border-slate-400"
            }`}
          >
            <span className="block text-[13px] font-black text-ink-900">{o.label}</span>
            <span className="block text-[11px] font-bold text-slate-500 mt-0.5">{o.desc}</span>
          </button>
        ))}
      </div>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-[11px] font-black text-slate-500">رابط الاتصال</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          dir="ltr"
          placeholder={mode === "cloud" ? "postgres://user:password@host:5432/dbname" : "postgres://user:password@127.0.0.1:5432/cashyou"}
          className="h-10 rounded-lg border border-line bg-paper-2 px-2.5 font-mono text-[12.5px] text-ink-900 outline-none focus:border-amber-brand focus:bg-white"
        />
      </label>
      {testMsg && <p className="mt-2 text-[12px] font-bold text-ink-700">{testMsg}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => void test()}
          disabled={busy || !url.trim()}
          className="h-10 px-4 rounded-lg bg-slate-200 text-ink-800 text-[12.5px] font-black cy-press hover:bg-slate-300 disabled:opacity-50"
        >
          اختبار الاتصال
        </button>
        <button
          onClick={() => void save()}
          disabled={busy || !url.trim()}
          className="cy-btn h-10 px-4 rounded-lg bg-ink-800 text-white text-[12.5px] font-black cy-press hover:bg-ink-900 disabled:opacity-50"
        >
          حفظ الرابط
        </button>
      </div>

      <div className="mt-4 rounded-lg bg-paper-2 border border-line p-3 text-[11.5px] font-bold text-ink-700 space-y-1">
        <p>
          الرابط الحالي: <span dir="ltr" className="font-mono text-ink-900">{state?.active?.maskedUrl ?? "—"}</span>
          {state?.active && <span className="text-slate-500"> ({state.active.source === "file" ? "من الإعدادات" : "من متغير البيئة"})</span>}
        </p>
        {state?.saved && (
          <p className="text-amber-800">
            محفوظ للتشغيل القادم: <span dir="ltr" className="font-mono">{state.saved.maskedUrl}</span>
          </p>
        )}
        <p className="text-slate-500">الربط الجديد يُطبَّق بعد إعادة تشغيل البرنامج.</p>
      </div>
    </Card>
  );
}

/* ---------------- الاستخدام المشترك ---------------- */

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-line shadow-sm p-3.5">
      <h2 className="text-[14px] font-black text-ink-900">{title}</h2>
      {subtitle && <p className="text-[11.5px] font-bold text-slate-500 mt-0.5 mb-2.5">{subtitle}</p>}
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  ltr,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  ltr?: boolean;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-black text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={ltr ? "ltr" : "rtl"}
        className="h-9 rounded-lg border border-line bg-paper-2 px-2.5 text-[13px] font-bold text-ink-900 outline-none focus:border-amber-brand focus:bg-white"
      />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper-2 px-2.5 h-10">
      <span className="text-[12px] font-black text-ink-700">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-slate-500 uppercase">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-7 rounded cursor-pointer border border-line bg-white p-0.5"
        />
      </span>
    </label>
  );
}

function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between gap-2 mt-2 first:mt-0">
      <span className="text-[12px] font-black text-ink-700">{label}</span>
      <div className="inline-flex rounded-lg bg-slate-200 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`h-8 px-3 rounded-md text-[12px] font-black cy-press ${
              value === o.value ? "bg-white text-ink-900 shadow-sm" : "text-slate-600 hover:text-ink-900"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper-2 px-2.5 h-10 text-right cy-press"
    >
      <span className="text-[12px] font-bold text-ink-700">{label}</span>
      <span className={`relative w-9 h-5 rounded-full transition-colors ${checked ? "bg-cash-green" : "bg-slate-300"}`}>
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "right-0.5" : "right-[18px]"}`}
        />
      </span>
    </button>
  );
}
