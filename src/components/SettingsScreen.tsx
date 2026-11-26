"use client";

import { useRef, useState } from "react";
import type { Bootstrap } from "@/lib/types";
import { THEMES, DEFAULT_PREFS, type ButtonRadius, type ButtonSize, type UiPrefs, type ThemeId } from "@/lib/ui-prefs";
import { IcoCheck, IcoLogo, IcoTrash } from "@/components/icons";

type Notify = (kind: "ok" | "warn" | "err" | "info", text: string) => void;

export function SettingsScreen({
  data,
  prefs,
  onChange,
  refresh,
  notify,
}: {
  data: Bootstrap;
  prefs: UiPrefs;
  onChange: (next: UiPrefs) => void;
  refresh: () => Promise<void>;
  notify: Notify;
}) {
  return (
    <section className="flex-1 min-h-0 overflow-y-auto cy-scroll bg-paper p-3 sm:p-4" dir="rtl">
      <div className="mx-auto max-w-5xl">
        <header className="mb-3">
          <h1 className="text-[18px] font-black text-ink-900">الإعدادات</h1>
          <p className="text-[12px] font-bold text-slate-500">
            بيانات المحل تُحفظ في قاعدة البيانات، أما الثيم والألوان وشكل الفاتورة فتُحفظ على هذا الجهاز.
          </p>
        </header>

        <div className="grid gap-3 lg:grid-cols-2">
          <ShopSection data={data} refresh={refresh} notify={notify} />
          <ThemeSection prefs={prefs} onChange={onChange} />
          <ColorSection prefs={prefs} onChange={onChange} />
          <ButtonSection prefs={prefs} onChange={onChange} />
          <ReceiptSection prefs={prefs} onChange={onChange} />
          <GeneralSection prefs={prefs} onChange={onChange} />
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

/* ---------------- الثيم ---------------- */

function ThemeSection({ prefs, onChange }: { prefs: UiPrefs; onChange: (p: UiPrefs) => void }) {
  const pick = (id: ThemeId) => {
    const t = THEMES.find((x) => x.id === id) ?? THEMES[0];
    onChange({ ...prefs, theme: id, colors: { chrome: t.chrome, paper: t.paper, accent: t.accent } });
  };
  return (
    <Card title="الثيم" subtitle="اختر قالباً جاهزاً — داكن أو فاتح — ثم عدّل الألوان من القسم التالي">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {THEMES.map((t) => {
          const active = prefs.theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => pick(t.id)}
              className={`text-right rounded-xl border-2 p-2 cy-press transition ${
                active ? "border-amber-brand shadow-[0_8px_18px_-10px_rgba(245,158,11,.9)]" : "border-line hover:border-ink-500"
              }`}
            >
              <div className="h-14 rounded-lg overflow-hidden border border-black/10 flex" style={{ background: t.paper }}>
                <span className="w-1/3 h-full" style={{ background: t.chrome }} />
                <span className="flex-1 flex flex-col justify-center gap-1 px-1.5">
                  <span className="h-1.5 w-3/4 rounded-full bg-white" />
                  <span className="h-1.5 w-1/2 rounded-full" style={{ background: t.accent }} />
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <span className="text-[12px] font-black text-ink-800 truncate">{t.label}</span>
                {active && <IcoCheck className="w-4 h-4 text-amber-600" />}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------------- الألوان ---------------- */

function ColorSection({ prefs, onChange }: { prefs: UiPrefs; onChange: (p: UiPrefs) => void }) {
  const setColor = (key: keyof UiPrefs["colors"], value: string) =>
    onChange({ ...prefs, colors: { ...prefs.colors, [key]: value } });
  return (
    <Card title="الألوان" subtitle="تغيير الألوان يتم فوراً على الشاشة">
      <div className="grid sm:grid-cols-3 gap-2">
        <ColorField label="لون الشريط" value={prefs.colors.chrome} onChange={(v) => setColor("chrome", v)} />
        <ColorField label="لون الخلفية" value={prefs.colors.paper} onChange={(v) => setColor("paper", v)} />
        <ColorField label="اللون المميز" value={prefs.colors.accent} onChange={(v) => setColor("accent", v)} />
      </div>
      <div className="flex justify-end mt-3">
        <button
          onClick={() => onChange({ ...prefs, colors: { ...DEFAULT_PREFS.colors } })}
          className="h-9 px-3 rounded-lg bg-slate-200 text-ink-800 text-[12px] font-black cy-press hover:bg-slate-300"
        >
          استعادة ألوان الثيم الداكن
        </button>
      </div>
    </Card>
  );
}

/* ---------------- الأزرار ---------------- */

function ButtonSection({ prefs, onChange }: { prefs: UiPrefs; onChange: (p: UiPrefs) => void }) {
  const setBtn = (patch: Partial<UiPrefs["buttons"]>) => onChange({ ...prefs, buttons: { ...prefs.buttons, ...patch } });
  return (
    <Card title="الأزرار" subtitle="شكل وحجم أزرار الحفظ والدفع في شاشة البيع">
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
      <div className="grid sm:grid-cols-2 gap-2 mt-2">
        <ColorField label="لون زر حفظ" value={prefs.buttons.save} onChange={(v) => setBtn({ save: v })} />
        <ColorField label="لون زر حفظ وطباعة" value={prefs.buttons.savePrint} onChange={(v) => setBtn({ savePrint: v })} />
      </div>
      <div className="flex justify-end mt-3">
        <button
          onClick={() => onChange({ ...prefs, buttons: { ...DEFAULT_PREFS.buttons } })}
          className="h-9 px-3 rounded-lg bg-slate-200 text-ink-800 text-[12px] font-black cy-press hover:bg-slate-300"
        >
          استعادة الأزرار الافتراضية
        </button>
      </div>
    </Card>
  );
}

/* ---------------- شكل الفاتورة ---------------- */

function ReceiptSection({ prefs, onChange }: { prefs: UiPrefs; onChange: (p: UiPrefs) => void }) {
  const set = (patch: Partial<UiPrefs["receipt"]>) => onChange({ ...prefs, receipt: { ...prefs.receipt, ...patch } });
  return (
    <Card title="شكل الفاتورة المطبوعة" subtitle="يظهر في معاينة الإيصال قبل الطباعة">
      <Segmented<"58" | "80">
        label="عرض الورق"
        value={String(prefs.receipt.paperWidth) as "58" | "80"}
        onChange={(v) => set({ paperWidth: v === "58" ? 58 : 80 })}
        options={[
          { value: "58", label: "58 مم" },
          { value: "80", label: "80 مم" },
        ]}
      />
      <div className="grid sm:grid-cols-2 gap-1.5 mt-2">
        <Toggle label="إظهار الشعار" checked={prefs.receipt.showLogo} onChange={(v) => set({ showLogo: v })} />
        <Toggle label="إظهار التليفون" checked={prefs.receipt.showPhone} onChange={(v) => set({ showPhone: v })} />
        <Toggle label="إظهار العنوان" checked={prefs.receipt.showAddress} onChange={(v) => set({ showAddress: v })} />
        <Toggle label="إظهار التاريخ والوقت" checked={prefs.receipt.showDateTime} onChange={(v) => set({ showDateTime: v })} />
      </div>
      <TextField
        label="نص أسفل الفاتورة"
        value={prefs.receipt.footerText}
        onChange={(v) => set({ footerText: v })}
        className="mt-2"
      />
    </Card>
  );
}

/* ---------------- عام ---------------- */

function GeneralSection({ prefs, onChange }: { prefs: UiPrefs; onChange: (p: UiPrefs) => void }) {
  return (
    <Card title="عام" subtitle="سلوك الواجهة على هذا الجهاز">
      <Toggle
        label="إظهار شاشة الترحيب بعد تسجيل الدخول (بشعار المحل)"
        checked={prefs.showWelcome}
        onChange={(v) => onChange({ ...prefs, showWelcome: v })}
      />
    </Card>
  );
}

/* ---------------- عناصر مساعدة ---------------- */

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
