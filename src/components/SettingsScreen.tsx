"use client";

import { useCallback, useRef, useState } from "react";
import type { SessionUser } from "@/lib/types";
import {
  BUTTON_STYLES,
  DEFAULT_SETTINGS,
  FONTS,
  MOTIONS,
  RECEIPT_STYLES,
  THEMES,
  UI_PARTS,
  FN_BUTTONS_DEFAULT,
  LOGIN_BGS,
  LOGIN_PARTS,
  MENU_PALETTES,
  PAGE_MOTIONS,
  menuColors,
  pageMotionOf,
  fontOf,
  mergeSettings,
  themeOf,
  type FnButton,
  type InvoicePaper,
  type ShopSettings,
  type LoginPartId,
  type UiPartId,
} from "@/lib/settings";
import { IcoCheck, IcoLock, IcoMenu, IcoPalette, IcoPrint, IcoSliders, IcoTrash, IcoX } from "@/components/icons";
import { btnCls, Field, inputCls, ModuleShell, ModuleTitle, Panel } from "@/components/ModuleUI";

type TabId = "shop" | "theme" | "font" | "buttons" | "invoice" | "login" | "menu" | "visibility";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "shop", label: "بيانات المحل", icon: <IcoCheck className="h-3.5 w-3.5" /> },
  { id: "theme", label: "الثيمات", icon: <IcoPalette className="h-3.5 w-3.5" /> },
  { id: "font", label: "الخطوط والحركة", icon: <IcoSliders className="h-3.5 w-3.5" /> },
  { id: "buttons", label: "الأزرار", icon: <IcoSliders className="h-3.5 w-3.5" /> },
  { id: "invoice", label: "الفاتورة", icon: <IcoPrint className="h-3.5 w-3.5" /> },
  { id: "login", label: "شاشة الدخول", icon: <IcoLock className="h-3.5 w-3.5" /> },
  { id: "menu", label: "القائمة والحركة", icon: <IcoMenu className="h-3.5 w-3.5" /> },
  { id: "visibility", label: "إخفاء العناصر", icon: <IcoX className="h-3.5 w-3.5" /> },
];

/** بطاقة اختيار قالب — تُستخدم لكل أنواع القوالب */
function PickCard({
  active,
  title,
  hint,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  hint?: string;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border-2 p-2.5 text-center transition ${
        active
          ? "border-cash-green bg-cash-green/5 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]"
          : "border-line bg-white hover:border-ink-500"
      }`}
    >
      {active && (
        <span className="absolute left-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-cash-green text-white">
          <IcoCheck className="h-2.5 w-2.5" />
        </span>
      )}
      {children}
      <div className="mt-1 text-[12px] font-black text-ink-800">{title}</div>
      {hint && <p className="mt-0.5 text-[9.5px] font-semibold leading-3.5 text-slate-500">{hint}</p>}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-paper-2 px-2.5 py-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-cash-green"
      />
      <span className="flex-1">
        <span className="block text-[11.5px] font-black text-ink-800">{label}</span>
        {hint && <span className="block text-[9.5px] font-semibold text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

export function SettingsScreen({
  user,
  initial,
  notify,
  onSaved,
  onPreview,
}: {
  user: SessionUser;
  initial?: ShopSettings;
  notify: (kind: "ok" | "err", message: string) => void;
  onSaved: (next: ShopSettings) => void;
  /** معاينة حية قبل الحفظ: تُطبِّق المظهر على البرنامج فوراً */
  onPreview?: (next: ShopSettings) => void;
}) {
  const [tab, setTab] = useState<TabId>("shop");
  const [form, setForm] = useState<ShopSettings>(mergeSettings(initial ?? DEFAULT_SETTINGS));
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const loginBgRef = useRef<HTMLInputElement | null>(null);
  const isOwner = user.role === "owner";

  const patch = useCallback(
    (p: Partial<ShopSettings>) => {
      setForm((f) => {
        const next = { ...f, ...p };
        /* معاينة فورية للمظهر قبل الحفظ */
        onPreview?.(next);
        return next;
      });
      setDirty(true);
    },
    [onPreview],
  );

  const pickLogo = (file: File) => {
    if (!file.type.startsWith("image/")) {
      notify("err", "الملف المختار ليس صورة");
      return;
    }
    if (file.size > 500 * 1024) {
      notify("err", "حجم الصورة أكبر من 500 كيلوبايت — اختر صورة أصغر");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      patch({ shopLogo: String(reader.result ?? "") });
      notify("ok", "تم اختيار الشعار — اضغط «حفظ الإعدادات» للتثبيت");
    };
    reader.onerror = () => notify("err", "تعذر قراءة الصورة");
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (busy) return;
    if (!isOwner) {
      notify("err", "تعديل الإعدادات متاح للمالك فقط");
      return;
    }
    if (!form.shopName.trim()) {
      notify("err", "اسم المحل مطلوب");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as { ok?: boolean; settings?: ShopSettings; error?: string };
      if (!res.ok || !json.ok || !json.settings) throw new Error(json.error ?? "تعذر حفظ الإعدادات");
      setForm(mergeSettings(json.settings));
      setDirty(false);
      onSaved(json.settings);
      notify("ok", "تم حفظ الإعدادات وتطبيقها على البرنامج");
    } catch (error) {
      notify("err", error instanceof Error ? error.message : "تعذر حفظ الإعدادات");
    } finally {
      setBusy(false);
    }
  };

  const moveButton = (index: number, dir: -1 | 1) => {
    const list = [...form.fnButtons];
    const next = index + dir;
    if (next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
    patch({ fnButtons: list });
  };

  const toggleButton = (id: FnButton["id"]) =>
    patch({ fnButtons: form.fnButtons.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)) });

  const renameButton = (id: FnButton["id"], label: string) =>
    patch({ fnButtons: form.fnButtons.map((b) => (b.id === id ? { ...b, label } : b)) });

  const togglePart = (id: UiPartId) =>
    patch({ ui: { ...form.ui, [id]: form.ui[id] === false } });

  const toggleLoginPart = (id: LoginPartId) =>
    patch({ loginParts: { ...form.loginParts, [id]: form.loginParts[id] === false } });

  const pickLoginBg = (file: File) => {
    if (!file.type.startsWith("image/")) return notify("err", "الملف المختار ليس صورة");
    if (file.size > 800 * 1024) return notify("err", "حجم الصورة أكبر من 800 كيلوبايت");
    const reader = new FileReader();
    reader.onload = () => patch({ loginBgImage: String(reader.result ?? ""), loginBg: "image" });
    reader.onerror = () => notify("err", "تعذر قراءة الصورة");
    reader.readAsDataURL(file);
  };

  const theme = themeOf(form.theme);
  const font = fontOf(form.font);

  return (
    <ModuleShell>
      <ModuleTitle
        title="إعدادات البرنامج"
        subtitle="المحل والشعار · الثيمات · الخطوط والحركة · الأزرار · الفاتورة · إخفاء العناصر"
        badge={isOwner ? "مالك" : "قراءة فقط"}
        actions={
          <>
            {dirty && <span className="rounded-lg bg-cash-red px-2 py-1 text-[10.5px] font-black text-white">غير محفوظ</span>}
            <button
              onClick={() => void save()}
              disabled={busy || !isOwner}
              className={`${btnCls} flex items-center gap-1.5 bg-cash-green text-white`}
            >
              <IcoCheck />
              {busy ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
            </button>
          </>
        }
      />

      {/* التبويبات */}
      <div className="mt-2 flex flex-wrap items-center gap-1 rounded-xl border border-line bg-white p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex h-8 items-center gap-1 rounded-lg px-3 text-[11.5px] font-black transition ${
              tab === t.id ? "bg-ink-800 text-white shadow" : "bg-paper-2 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
        <button
          onClick={() => {
            patch({ ...DEFAULT_SETTINGS });
            notify("ok", "تمت استعادة القيم الافتراضية — اضغط «حفظ الإعدادات» للتثبيت");
          }}
          className={`${btnCls} mr-auto h-8 bg-slate-200 text-ink-800`}
        >
          استعادة الافتراضي
        </button>
      </div>

      <div className="mt-2 grid grid-cols-1 items-start gap-2 xl:grid-cols-[1fr_340px]">
        <div className="space-y-2">
          {/* ==================== بيانات المحل ==================== */}
          {tab === "shop" && (
            <>
              <Panel title="بيانات المحل" hint="تظهر في الفاتورة وشاشة الترحيب">
                <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                  <Field label="اسم المحل" className="sm:col-span-2">
                    <input
                      value={form.shopName}
                      onChange={(e) => patch({ shopName: e.target.value })}
                      className={inputCls}
                      placeholder="كاش يو للتجارة والتوريدات المكتبية"
                    />
                  </Field>
                  <Field label="التليفون">
                    <input
                      value={form.shopPhone}
                      onChange={(e) => patch({ shopPhone: e.target.value })}
                      className={`${inputCls} cy-num`}
                      placeholder="01222355769"
                    />
                  </Field>
                  <Field label="العنوان">
                    <input
                      value={form.shopAddress}
                      onChange={(e) => patch({ shopAddress: e.target.value })}
                      className={inputCls}
                      placeholder="المدينة — الشارع"
                    />
                  </Field>
                </div>
              </Panel>

              <Panel title="شعار المحل" hint="PNG أو JPG — أقل من 500 كيلوبايت">
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-paper-2">
                    {form.shopLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.shopLogo} alt="شعار المحل" className="h-full w-full object-contain p-1" />
                    ) : (
                      <span className="px-2 text-center text-[10px] font-bold text-slate-400">لا يوجد شعار</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => fileRef.current?.click()} className={`${btnCls} bg-ink-800 text-white`}>
                      اختيار صورة
                    </button>
                    {form.shopLogo && (
                      <button
                        onClick={() => patch({ shopLogo: "" })}
                        className={`${btnCls} flex items-center gap-1.5 bg-cash-red text-white`}
                      >
                        <IcoTrash className="h-3.5 w-3.5" />
                        حذف
                      </button>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) pickLogo(f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>
                </div>
              </Panel>

              <Panel title="شاشة الترحيب" hint="تظهر بعد تسجيل الدخول">
                <div className="p-3">
                  <Toggle
                    checked={form.welcomeEnabled}
                    onChange={(v) => patch({ welcomeEnabled: v })}
                    label="إظهار شاشة الترحيب عند تسجيل الدخول"
                    hint="شعار المحل + اسمه + زر الصوت"
                  />
                </div>
              </Panel>
            </>
          )}

          {/* ==================== الثيمات ==================== */}
          {tab === "theme" && (
            <>
              <Panel title="قوالب الثيمات" hint={`${THEMES.length} قوالب فاتحة — تُطبَّق فوراً`}>
                <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
                  {THEMES.map((t) => (
                    <PickCard
                      key={t.id}
                      active={form.theme === t.id}
                      title={t.name}
                      hint={t.hint}
                      onClick={() => patch({ theme: t.id })}
                    >
                      <span className="flex justify-center gap-1">
                        {t.swatch.map((c) => (
                          <span key={c} className="h-5 w-5 rounded-md border border-black/10" style={{ background: c }} />
                        ))}
                      </span>
                      <span className="mt-1.5 block h-4 rounded" style={{ background: t.vars.header }} />
                      <span className="mt-1 block h-2 rounded" style={{ background: t.vars.accent }} />
                    </PickCard>
                  ))}
                </div>
              </Panel>

              <Panel title="توسيط النصوص" hint="يُطبَّق على البرنامج بالكامل">
                <div className="p-3">
                  <Toggle
                    checked={form.centerText}
                    onChange={(v) => patch({ centerText: v })}
                    label="توسيط كل نصوص البرنامج"
                    hint="إيقافه يُعيد النصوص لليمين"
                  />
                </div>
              </Panel>
            </>
          )}

          {/* ==================== الخطوط والحركة ==================== */}
          {tab === "font" && (
            <>
              <Panel title="قوالب الخطوط" hint={`${FONTS.length} خطوط عربية جاهزة`}>
                <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                  {FONTS.map((f) => (
                    <PickCard key={f.id} active={form.font === f.id} title={f.name} hint={f.hint} onClick={() => patch({ font: f.id })}>
                      <span className="block text-[19px] font-black leading-tight text-ink-800" style={{ fontFamily: f.stack }}>
                        أبجد 1234
                      </span>
                    </PickCard>
                  ))}
                </div>
              </Panel>

              <Panel title="حجم الخط" hint={`${form.fontSize} بكسل`}>
                <div className="p-3">
                  <input
                    type="range"
                    min={11}
                    max={20}
                    step={1}
                    value={form.fontSize}
                    onChange={(e) => patch({ fontSize: Number(e.target.value) })}
                    className="w-full accent-cash-green"
                    aria-label="حجم الخط"
                  />
                  <div className="mt-1.5 flex justify-between text-[9.5px] font-bold text-slate-500">
                    <span>صغير</span>
                    <span className="cy-num font-black text-ink-800">{form.fontSize}px</span>
                    <span>كبير</span>
                  </div>
                </div>
              </Panel>

              <Panel title="قوالب الأزرار" hint="شكل أزرار الوظائف">
                <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                  {BUTTON_STYLES.map((b) => (
                    <PickCard key={b.id} active={form.buttonStyle === b.id} title={b.name} hint={b.hint} onClick={() => patch({ buttonStyle: b.id })}>
                      <span
                        className="mx-auto block h-7 w-16 border-2 border-ink-800 bg-cash-green"
                        style={{ borderRadius: b.css.radius, boxShadow: b.css.shadow }}
                      />
                    </PickCard>
                  ))}
                </div>
              </Panel>

              <Panel title="حركات الأزرار" hint="تأثير عند المرور والضغط">
                <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                  {MOTIONS.map((m) => (
                    <PickCard key={m.id} active={form.motion === m.id} title={m.name} hint={m.hint} onClick={() => patch({ motion: m.id })}>
                      <span className="mx-auto mt-1 block h-6 w-14 rounded-lg bg-ink-700" />
                    </PickCard>
                  ))}
                </div>
              </Panel>
            </>
          )}

          {/* ==================== الأزرار ==================== */}
          {tab === "buttons" && (
            <Panel title="تخصيص أزرار شريط الوظائف" hint="إظهار/إخفاء وإعادة التسمية والترتيب">
              <div className="space-y-1.5 p-3">
                {form.fnButtons.map((b, i) => (
                  <div key={b.id} className="flex items-center gap-2 rounded-lg border border-line bg-white p-1.5">
                    <button
                      onClick={() => toggleButton(b.id)}
                      className={`h-6 w-11 shrink-0 rounded-full transition ${b.visible ? "bg-cash-green" : "bg-slate-300"}`}
                      aria-label={b.visible ? "إخفاء" : "إظهار"}
                      title={b.visible ? "إخفاء الزر" : "إظهار الزر"}
                    >
                      <span className={`block h-4 w-4 rounded-full bg-white shadow transition ${b.visible ? "mr-0.5" : "mr-6"}`} />
                    </button>
                    <input
                      value={b.label}
                      onChange={(e) => renameButton(b.id, e.target.value)}
                      className={`${inputCls} h-8 flex-1 text-[12px]`}
                      aria-label={`اسم الزر ${b.id}`}
                    />
                    <span className="w-9 shrink-0 rounded bg-paper-2 py-0.5 text-center font-mono text-[10px] font-bold text-amber-800">
                      {b.shortcut}
                    </span>
                    <div className="flex shrink-0 gap-0.5">
                      <button onClick={() => moveButton(i, -1)} disabled={i === 0} className="grid h-7 w-6 place-items-center rounded bg-slate-200 text-ink-700 disabled:opacity-30" aria-label="تحريك لأعلى">▲</button>
                      <button onClick={() => moveButton(i, 1)} disabled={i === form.fnButtons.length - 1} className="grid h-7 w-6 place-items-center rounded bg-slate-200 text-ink-700 disabled:opacity-30" aria-label="تحريك لأسفل">▼</button>
                    </div>
                  </div>
                ))}
                <p className="pt-1 text-[10px] font-semibold text-slate-500">
                  الزر المخفي يظل يعمل بالاختصار من لوحة المفاتيح — الإخفاء للواجهة فقط.
                </p>
              </div>
            </Panel>
          )}

          {/* ==================== الفاتورة ==================== */}
          {tab === "invoice" && (
            <>
              <Panel title="قالب الفاتورة" hint="شكل الإيصال المطبوع">
                <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                  {RECEIPT_STYLES.map((r) => (
                    <PickCard key={r.id} active={form.receiptStyle === r.id} title={r.name} hint={r.hint} onClick={() => patch({ receiptStyle: r.id })}>
                      <span className="mx-auto block w-14 overflow-hidden rounded border border-slate-300 bg-white">
                        <span className="block h-2" style={{ background: r.id === "modern" || r.id === "dark-band" ? theme.vars.accent : "#94a3b8" }} />
                        <span className="block h-0.5 w-8 bg-slate-300 mx-auto mt-1" />
                        <span className="block h-0.5 w-10 bg-slate-200 mx-auto mt-0.5" />
                        <span className="block h-0.5 w-7 bg-slate-300 mx-auto mt-0.5 mb-1" />
                      </span>
                    </PickCard>
                  ))}
                </div>
              </Panel>

              <Panel title="مقاس الورق" hint="حسب طابعة الكاشير">
                <div className="grid grid-cols-3 gap-1.5 p-3">
                  {([
                    { id: "58mm", label: "58 مم" },
                    { id: "80mm", label: "80 مم" },
                    { id: "a5", label: "A5" },
                  ] as { id: InvoicePaper; label: string }[]).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => patch({ invoicePaper: p.id })}
                      className={`h-9 rounded-lg border text-[12px] font-black ${
                        form.invoicePaper === p.id
                          ? "border-amber-brand bg-amber-soft text-amber-800"
                          : "border-line bg-paper-2 text-slate-500"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title="تذييل الفاتورة">
                <div className="space-y-2 p-3">
                  <Toggle
                    checked={form.invoiceThanks}
                    onChange={(v) => patch({ invoiceThanks: v })}
                    label="إظهار رسالة الشكر أسفل الفاتورة"
                  />
                  <Field label="نص الرسالة">
                    <input value={form.invoiceFooter} onChange={(e) => patch({ invoiceFooter: e.target.value })} className={inputCls} />
                  </Field>
                </div>
              </Panel>
            </>
          )}

          {/* ==================== شاشة الدخول ==================== */}
          {tab === "login" && (
            <>
              <Panel title="نصوص شاشة الدخول" hint="تظهر على الشاشة الأولى قبل تسجيل الدخول">
                <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                  <Field label="اسم البرنامج" className="sm:col-span-2">
                    <input
                      value={form.loginTitle}
                      onChange={(e) => patch({ loginTitle: e.target.value })}
                      className={inputCls}
                      placeholder="CASH YOU · POS"
                    />
                  </Field>
                  <Field label="العنوان التعريفي" className="sm:col-span-2">
                    <input
                      value={form.loginTagline}
                      onChange={(e) => patch({ loginTagline: e.target.value })}
                      className={inputCls}
                      placeholder="نظام نقاط البيع المتكامل"
                    />
                  </Field>
                  <Field label="رسالة الترحيب" className="sm:col-span-2">
                    <textarea
                      value={form.loginMessage}
                      onChange={(e) => patch({ loginMessage: e.target.value })}
                      rows={2}
                      className={`${inputCls} h-auto resize-none py-1.5`}
                    />
                  </Field>
                </div>
              </Panel>

              <Panel title="خلفية شاشة الدخول">
                <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                  {LOGIN_BGS.map((b) => (
                    <PickCard
                      key={b.id}
                      active={form.loginBg === b.id}
                      title={b.name}
                      onClick={() => patch({ loginBg: b.id })}
                    >
                      <span className="mx-auto block h-8 w-full overflow-hidden rounded-md border border-white/10">
                        {b.id === "image" && form.loginBgImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={form.loginBgImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span
                            className="block h-full w-full"
                            style={{
                              background:
                                b.id === "mesh"
                                  ? "linear-gradient(135deg,#0f172a,#1e293b 60%,#334155)"
                                  : b.id === "aurora"
                                    ? "linear-gradient(135deg,#0891b2,#8b5cf6 60%,#0f172a)"
                                    : b.id === "gradient"
                                      ? `linear-gradient(135deg,${form.loginBgColor},#0f172a)`
                                      : b.id === "solid"
                                        ? form.loginBgColor
                                        : "repeating-linear-gradient(45deg,#1e293b,#1e293b 6px,#334155 6px,#334155 12px)",
                            }}
                          />
                        )}
                      </span>
                    </PickCard>
                  ))}
                </div>
                {form.loginBg === "solid" && (
                  <div className="px-3 pb-3">
                    <Field label="لون الخلفية">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={form.loginBgColor}
                          onChange={(e) => patch({ loginBgColor: e.target.value })}
                          className="h-9 w-14 cursor-pointer rounded border border-line bg-white p-0.5"
                          aria-label="لون الخلفية"
                        />
                        <input
                          value={form.loginBgColor}
                          onChange={(e) => patch({ loginBgColor: e.target.value })}
                          dir="ltr"
                          className={`${inputCls} flex-1 font-mono text-[11px]`}
                        />
                      </div>
                    </Field>
                  </div>
                )}
                {form.loginBg === "image" && (
                  <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
                    <button onClick={() => loginBgRef.current?.click()} className={`${btnCls} bg-ink-800 text-white`}>
                      اختيار صورة خلفية
                    </button>
                    {form.loginBgImage && (
                      <button
                        onClick={() => patch({ loginBgImage: "", loginBg: "mesh" })}
                        className={`${btnCls} flex items-center gap-1.5 bg-cash-red text-white`}
                      >
                        <IcoTrash className="h-3.5 w-3.5" />
                        حذف
                      </button>
                    )}
                    <input
                      ref={loginBgRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) pickLoginBg(f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>
                )}
              </Panel>

              <Panel title="إظهار/إخفاء عناصر شاشة الدخول" hint={`${Object.values(form.loginParts).filter(Boolean).length} / ${LOGIN_PARTS.length} ظاهر`}>
                <div className="grid grid-cols-1 gap-1.5 p-3 sm:grid-cols-2">
                  {LOGIN_PARTS.map((p) => (
                    <Toggle
                      key={p.id}
                      checked={form.loginParts[p.id] !== false}
                      onChange={() => toggleLoginPart(p.id)}
                      label={p.name}
                      hint={p.hint}
                    />
                  ))}
                </div>
              </Panel>
            </>
          )}

          {/* ==================== القائمة والحركة ==================== */}
          {tab === "menu" && (
            <>
              <Panel title="ألوان القائمة المنسدلة" hint="القائمة التي تفتح من زر ☰ بجانب الرئيسية">
                <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
                  {MENU_PALETTES.filter((p) => p.id !== "custom").map((p) => (
                    <PickCard
                      key={p.id}
                      active={form.menuPalette === p.id}
                      title={p.name}
                      onClick={() => patch({ menuPalette: p.id })}
                    >
                      <span
                        className="mx-auto block w-full rounded-md px-1.5 py-1 text-center text-[9px] font-black"
                        style={{ background: p.bg, color: p.text }}
                      >
                        وحدة تجريبية
                      </span>
                    </PickCard>
                  ))}
                </div>
              </Panel>

              <Panel title="ألوان حرة" hint="اختر لون القائمة ولون الكلام بنفسك">
                <div className="space-y-2 p-3">
                  <Toggle
                    checked={form.menuPalette === "custom"}
                    onChange={(v) => patch({ menuPalette: v ? "custom" : "dark" })}
                    label="استخدام ألوان مخصصة"
                    hint="يتجاوز القوالب الجاهزة أعلاه"
                  />
                  <div className={`grid grid-cols-1 gap-2 sm:grid-cols-3 ${form.menuPalette === "custom" ? "" : "opacity-50"}`}>
                    {([
                      { k: "menuBg" as const, label: "لون القائمة" },
                      { k: "menuText" as const, label: "لون الكلام" },
                      { k: "menuAccent" as const, label: "لون التمييز" },
                    ]).map((c) => (
                      <Field key={c.k} label={c.label}>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={form[c.k]}
                            onChange={(e) => patch({ [c.k]: e.target.value, menuPalette: "custom" })}
                            className="h-9 w-12 shrink-0 cursor-pointer rounded border border-line bg-white p-0.5"
                            aria-label={c.label}
                          />
                          <input
                            value={form[c.k]}
                            onChange={(e) => patch({ [c.k]: e.target.value, menuPalette: "custom" })}
                            dir="ltr"
                            className={`${inputCls} font-mono text-[10.5px]`}
                          />
                        </div>
                      </Field>
                    ))}
                  </div>
                  <Toggle
                    checked={form.menuShowLabels}
                    onChange={(v) => patch({ menuShowLabels: v })}
                    label="إظهار أسماء الوحدات بجانب الأيقونات"
                    hint="إيقافه يعرض أيقونات فقط"
                  />
                </div>
              </Panel>

              <Panel title="حركة انتقال الصفحات" hint="تأثير عند فتح أي صفحة جديدة">
                <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
                  {PAGE_MOTIONS.map((m) => (
                    <PickCard
                      key={m.id}
                      active={form.pageMotion === m.id}
                      title={m.name}
                      hint={m.hint}
                      onClick={() => patch({ pageMotion: m.id })}
                    >
                      <span className="mx-auto mt-1 block h-6 w-10 rounded border-2 border-ink-700 bg-paper-2" />
                    </PickCard>
                  ))}
                </div>
              </Panel>
            </>
          )}

          {/* ==================== إخفاء العناصر ==================== */}
          {tab === "visibility" && (
            <Panel title="إخفاء عناصر من الواجهة" hint={`${Object.values(form.ui).filter(Boolean).length} / ${UI_PARTS.length} ظاهر`}>
              <div className="grid grid-cols-1 gap-1.5 p-3 sm:grid-cols-2">
                {UI_PARTS.map((p) => (
                  <Toggle
                    key={p.id}
                    checked={form.ui[p.id] !== false}
                    onChange={() => togglePart(p.id)}
                    label={p.name}
                    hint={p.hint}
                  />
                ))}
                <p className="col-span-full pt-1 text-[10px] font-semibold text-slate-500">
                  إخفاء العنصر يخفي شكله فقط — الوظيفة تظل تعمل بالاختصارات.
                </p>
              </div>
            </Panel>
          )}
        </div>

        {/* ==================== المعاينة الحية ==================== */}
        <div className="space-y-2 xl:sticky xl:top-2">
          <Panel title="معاينة حية" hint="تتغيّر مع كل تعديل">
            <div className="p-2">
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: theme.vars.line, background: theme.vars.paper }}>
                <div className="flex items-center gap-2 px-2.5 py-2" style={{ background: theme.vars.header, color: theme.vars.headerText }}>
                  {form.shopLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.shopLogo} alt="" className="h-6 w-6 rounded bg-white/90 object-contain p-0.5" />
                  ) : (
                    <span className="grid h-6 w-6 place-items-center rounded bg-white/15 text-[9px] font-black">CY</span>
                  )}
                  <span className="flex-1 truncate text-[11px] font-black" style={{ fontFamily: font.stack }}>
                    {form.shopName || "اسم المحل"}
                  </span>
                </div>
                <div className="space-y-1.5 p-2.5" style={{ fontFamily: font.stack, fontSize: form.fontSize }}>
                  <div className="flex justify-center gap-1.5">
                    <span
                      className="px-2 py-1 text-[10px] font-black"
                      style={{ background: theme.vars.accent, color: theme.vars.accentText, borderRadius: "6px" }}
                    >
                      إجمالي
                    </span>
                    <span className="px-2 py-1 text-[10px] font-black text-white" style={{ background: theme.vars.green, borderRadius: "6px" }}>
                      حفظ
                    </span>
                    <span className="px-2 py-1 text-[10px] font-black text-white" style={{ background: theme.vars.headerSoft, borderRadius: "6px" }}>
                      طباعة
                    </span>
                  </div>
                  <div className="rounded border p-1.5" style={{ borderColor: theme.vars.line, background: theme.vars.paper2 }}>
                    <div className="flex justify-between text-[10px] font-bold" style={{ color: theme.vars.ink }}>
                      <span>صنف تجريبي</span>
                      <span className="cy-num">25.00</span>
                    </div>
                  </div>
                </div>
                <div className="border-t px-2.5 py-1.5 text-center text-[9px] font-bold" style={{ borderColor: theme.vars.line, color: theme.vars.inkSoft }}>
                  {form.invoiceThanks ? form.invoiceFooter : ""}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="ملخص">
            <ul className="space-y-1 p-3 text-[11px] font-semibold text-slate-600">
              <li className="flex justify-between gap-2"><span>المحل</span><span className="truncate font-black text-ink-800">{form.shopName || "—"}</span></li>
              <li className="flex justify-between gap-2"><span>الثيم</span><span className="font-black text-ink-800">{theme.name}</span></li>
              <li className="flex justify-between gap-2"><span>الخط</span><span className="font-black text-ink-800">{font.name} · {form.fontSize}px</span></li>
              <li className="flex justify-between gap-2"><span>قالب الأزرار</span><span className="font-black text-ink-800">{BUTTON_STYLES.find((b) => b.id === form.buttonStyle)?.name}</span></li>
              <li className="flex justify-between gap-2"><span>الحركة</span><span className="font-black text-ink-800">{MOTIONS.find((m) => m.id === form.motion)?.name}</span></li>
              <li className="flex justify-between gap-2"><span>قالب الفاتورة</span><span className="font-black text-ink-800">{RECEIPT_STYLES.find((r) => r.id === form.receiptStyle)?.name}</span></li>
              <li className="flex justify-between gap-2"><span>ورق الفاتورة</span><span className="font-black text-ink-800">{form.invoicePaper}</span></li>
              <li className="flex justify-between gap-2"><span>عناصر ظاهرة</span><span className="cy-num font-black text-ink-800">{Object.values(form.ui).filter(Boolean).length} / {UI_PARTS.length}</span></li>
            </ul>
          </Panel>

          {dirty && (
            <button
              onClick={() => void save()}
              disabled={busy || !isOwner}
              className={`${btnCls} flex w-full items-center justify-center gap-2 bg-cash-green text-white`}
            >
              <IcoCheck />
              حفظ الإعدادات
            </button>
          )}

          <p className="px-1 text-[10px] font-semibold leading-4 text-slate-500">
            التعديل متاح للمالك فقط · كل التغييرات تُحفظ على الخادم وتظهر لكل المستخدمين
          </p>

          <p className="hidden">{FN_BUTTONS_DEFAULT.length}</p>
        </div>
      </div>
    </ModuleShell>
  );
}
