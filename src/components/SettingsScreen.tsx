"use client";

import { useCallback, useRef, useState } from "react";
import type { SessionUser } from "@/lib/types";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  THEMES,
  themeCssVars,
  themeOf,
  FN_BUTTONS_DEFAULT,
  type FnButton,
  type InvoicePaper,
  type ShopSettings,
} from "@/lib/settings";
import { IcoCheck, IcoPrint, IcoTrash, IcoUsers, IcoX } from "@/components/icons";
import { btnCls, Field, inputCls, ModuleShell, ModuleTitle, Panel } from "@/components/ModuleUI";

type TabId = "shop" | "theme" | "buttons" | "invoice";
const TABS: { id: TabId; label: string }[] = [
  { id: "shop", label: "بيانات المحل" },
  { id: "theme", label: "الثيمات" },
  { id: "buttons", label: "الأزرار" },
  { id: "invoice", label: "الفاتورة" },
];

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
  /** معاينة حية قبل الحفظ: يُطبِّق الثيم على البرنامج فوراً */
  onPreview?: (next: ShopSettings) => void;
}) {
  const [tab, setTab] = useState<TabId>("shop");
  const [form, setForm] = useState<ShopSettings>(mergeSettings(initial ?? DEFAULT_SETTINGS));
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const isOwner = user.role === "owner";

  const patch = useCallback(
    (p: Partial<ShopSettings>) => {
      setForm((f) => {
        const next = { ...f, ...p };
        /* معاينة فورية للثيم والألوان قبل الحفظ */
        if ("theme" in p) onPreview?.(next);
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
    patch({
      fnButtons: form.fnButtons.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)),
    });

  const renameButton = (id: FnButton["id"], label: string) =>
    patch({ fnButtons: form.fnButtons.map((b) => (b.id === id ? { ...b, label } : b)) });

  const theme = themeOf(form.theme);

  return (
    <ModuleShell>
      <ModuleTitle
        title="إعدادات البرنامج"
        subtitle="بيانات المحل والشعار · الثيمات والألوان · الأزرار · شكل الفاتورة"
        badge={isOwner ? "مالك" : "قراءة فقط"}
        actions={
          <>
            {dirty && <span className="rounded-lg bg-cash-red px-2 py-1 text-[10.5px] font-black text-white">تغييرات غير محفوظة</span>}
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
      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-white p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`h-9 px-4 rounded-lg text-[12px] font-black transition ${
              tab === t.id ? "bg-ink-800 text-white shadow" : "bg-paper-2 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => {
            setForm(mergeSettings(DEFAULT_SETTINGS));
            setDirty(true);
            notify("ok", "تمت استعادة القيم الافتراضية — اضغط «حفظ الإعدادات» للتثبيت");
          }}
          className={`${btnCls} mr-auto h-9 bg-slate-200 text-ink-800`}
        >
          استعادة الافتراضي
        </button>
      </div>

      <div className="mt-2 grid grid-cols-1 items-start gap-2 xl:grid-cols-[1fr_360px]">
        <div className="space-y-2">
          {tab === "shop" && (
            <Panel title="بيانات المحل" hint="تظهر في الفاتورة وشاشة الترحيب">
              <div className="grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2">
                <Field label="اسم المحل" className="sm:col-span-2">
                  <input value={form.shopName} onChange={(e) => patch({ shopName: e.target.value })} className={inputCls} placeholder="كاش يو للتجارة والتوريدات المكتبية" />
                </Field>
                <Field label="التليفون">
                  <input value={form.shopPhone} onChange={(e) => patch({ shopPhone: e.target.value })} className={`${inputCls} cy-num`} dir="ltr" placeholder="01222355769" />
                </Field>
                <Field label="العنوان">
                  <input value={form.shopAddress} onChange={(e) => patch({ shopAddress: e.target.value })} className={inputCls} placeholder="المدينة — الشارع" />
                </Field>
                <Field label="رسالة أسفل الفاتورة" className="sm:col-span-2">
                  <input value={form.invoiceFooter} onChange={(e) => patch({ invoiceFooter: e.target.value })} className={inputCls} />
                </Field>
              </div>
            </Panel>
          )}

          {tab === "shop" && (
            <Panel title="شعار المحل" hint="PNG أو JPG — أقل من 500 كيلوبايت">
              <div className="flex flex-wrap items-center gap-3 p-3">
                <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-line bg-paper-2">
                  {form.shopLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.shopLogo} alt="شعار المحل" className="h-full w-full object-contain p-1.5" />
                  ) : (
                    <span className="px-2 text-center text-[10.5px] font-bold text-slate-400">لا يوجد شعار</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => fileRef.current?.click()} className={`${btnCls} bg-ink-800 text-white`}>
                    اختيار صورة
                  </button>
                  {form.shopLogo && (
                    <button onClick={() => patch({ shopLogo: "" })} className={`${btnCls} flex items-center gap-1.5 bg-cash-red text-white`}>
                      <IcoTrash className="h-3.5 w-3.5" />
                      حذف الشعار
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
          )}

          {tab === "theme" && (
            <Panel title="قوالب الثيمات" hint={`${THEMES.length} قوالب فاتحة`}>
              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                {THEMES.map((t) => {
                  const active = form.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => patch({ theme: t.id })}
                      className={`group relative overflow-hidden rounded-xl border-2 p-3 text-right transition ${
                        active ? "border-cash-green bg-cash-green/5 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" : "border-line bg-white hover:border-ink-500"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex gap-1">
                          {t.swatch.map((c) => (
                            <span key={c} className="h-5 w-5 rounded-md border border-black/10" style={{ background: c }} />
                          ))}
                        </span>
                        <span className="flex-1 text-[12.5px] font-black text-ink-800">{t.name}</span>
                        {active && <span className="rounded bg-cash-green px-1.5 py-0.5 text-[9.5px] font-black text-white">مختار</span>}
                      </div>
                      <p className="mt-1.5 text-[10.5px] font-semibold text-slate-500">{t.hint}</p>
                      <span className="mt-2 block h-6 rounded-md" style={{ background: t.vars.header }} />
                    </button>
                  );
                })}
              </div>
            </Panel>
          )}

          {tab === "buttons" && (
            <Panel title="تخصيص أزرار شريط الوظائف" hint="إظهار/إخفاء وإعادة التسمية والترتيب">
              <div className="space-y-1.5 p-3">
                {form.fnButtons.map((b, i) => (
                  <div key={b.id} className="flex items-center gap-2 rounded-lg border border-line bg-white p-2">
                    <button
                      onClick={() => toggleButton(b.id)}
                      className={`h-7 w-12 shrink-0 rounded-full transition ${b.visible ? "bg-cash-green" : "bg-slate-300"}`}
                      aria-label={b.visible ? "إخفاء" : "إظهار"}
                      title={b.visible ? "إخفاء الزر" : "إظهار الزر"}
                    >
                      <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${b.visible ? "mr-0.5" : "mr-6"}`} />
                    </button>
                    <input
                      value={b.label}
                      onChange={(e) => renameButton(b.id, e.target.value)}
                      className={`${inputCls} h-8 flex-1 text-[12px]`}
                      aria-label={`اسم الزر ${b.id}`}
                    />
                    <span className="w-10 shrink-0 rounded bg-paper-2 py-0.5 text-center font-mono text-[10.5px] font-bold text-amber-800">
                      {b.shortcut}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => moveButton(i, -1)} disabled={i === 0} className="grid h-7 w-7 place-items-center rounded bg-slate-200 text-ink-700 disabled:opacity-30" aria-label="تحريك لأعلى">▲</button>
                      <button onClick={() => moveButton(i, 1)} disabled={i === form.fnButtons.length - 1} className="grid h-7 w-7 place-items-center rounded bg-slate-200 text-ink-700 disabled:opacity-30" aria-label="تحريك لأسفل">▼</button>
                    </div>
                  </div>
                ))}
                <p className="pt-1 text-[10.5px] font-semibold text-slate-500">
                  الزر المخفي يظل يعمل بالاختصار من لوحة المفاتيح — الإخفاء للواجهة فقط.
                </p>
              </div>
            </Panel>
          )}

          {tab === "invoice" && (
            <Panel title="شكل الفاتورة" hint="يُطبَّق على الإيصال المطبوع">
              <div className="space-y-3 p-3">
                <Field label="مقاس الورق">
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { id: "58mm", label: "58 مم" },
                      { id: "80mm", label: "80 مم" },
                      { id: "a5", label: "A5" },
                    ] as { id: InvoicePaper; label: string }[]).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => patch({ invoicePaper: p.id })}
                        className={`h-9 rounded-lg border text-[12px] font-black ${
                          form.invoicePaper === p.id ? "border-amber-brand bg-amber-soft text-amber-800" : "border-line bg-paper-2 text-slate-500"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </Field>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-paper-2 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={form.invoiceThanks}
                    onChange={(e) => patch({ invoiceThanks: e.target.checked })}
                    className="h-4 w-4 accent-cash-green"
                  />
                  <span className="text-[12px] font-bold text-ink-800">إظهار رسالة الشكر أسفل الفاتورة</span>
                </label>
                <Field label="رسالة أسفل الفاتورة">
                  <input value={form.invoiceFooter} onChange={(e) => patch({ invoiceFooter: e.target.value })} className={inputCls} />
                </Field>
              </div>
            </Panel>
          )}

          <Panel title="شاشة الترحيب" hint="تظهر بعد تسجيل الدخول">
            <div className="p-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-paper-2 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={form.welcomeEnabled}
                  onChange={(e) => patch({ welcomeEnabled: e.target.checked })}
                  className="h-4 w-4 accent-cash-green"
                />
                <span className="text-[12px] font-bold text-ink-800">إظهار شاشة الترحيب بالشعار عند تسجيل الدخول</span>
              </label>
            </div>
          </Panel>
        </div>

        {/* المعاينة الحية */}
        <div className="space-y-2 xl:sticky xl:top-2">
          <Panel title="معاينة حية" hint="تتغيّر مع كل تعديل">
            <div className="p-2">
              <div
                className="overflow-hidden rounded-xl border"
                style={{ borderColor: theme.vars.line, background: theme.vars.paper }}
              >
                <div className="flex items-center gap-2 px-2.5 py-2" style={{ background: theme.vars.header, color: theme.vars.headerText }}>
                  {form.shopLogo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.shopLogo} alt="" className="h-7 w-7 rounded object-contain bg-white/90 p-0.5" />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded bg-white/15 text-[10px] font-black">CY</span>
                  )}
                  <span className="flex-1 truncate text-[11.5px] font-black">{form.shopName || "اسم المحل"}</span>
                </div>
                <div className="space-y-1.5 p-2.5">
                  <div className="flex gap-1.5">
                    <span className="rounded px-2 py-1 text-[10px] font-black" style={{ background: theme.vars.accent, color: theme.vars.accentText }}>
                      إجمالي
                    </span>
                    <span className="rounded px-2 py-1 text-[10px] font-black" style={{ background: theme.vars.green, color: "#fff" }}>
                      حفظ
                    </span>
                    <span className="rounded px-2 py-1 text-[10px] font-black" style={{ background: theme.vars.red, color: "#fff" }}>
                      خصم
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
            <ul className="space-y-1.5 p-3 text-[11.5px] font-semibold text-slate-600">
              <li className="flex justify-between"><span>المحل</span><span className="truncate font-black text-ink-800">{form.shopName || "—"}</span></li>
              <li className="flex justify-between"><span>الشعار</span><span className="font-black text-ink-800">{form.shopLogo ? "مضبوط" : "غير مضبوط"}</span></li>
              <li className="flex justify-between"><span>الثيم</span><span className="font-black text-ink-800">{theme.name}</span></li>
              <li className="flex justify-between"><span>أزرار ظاهرة</span><span className="font-black text-ink-800 cy-num">{form.fnButtons.filter((b) => b.visible).length} / {form.fnButtons.length}</span></li>
              <li className="flex justify-between"><span>ورق الفاتورة</span><span className="font-black text-ink-800">{form.invoicePaper}</span></li>
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

          <p className="px-1 text-[10px] font-semibold leading-5 text-slate-500">
            <IcoUsers className="inline h-3 w-3" /> التعديل متاح للمالك فقط. كل التغييرات تُحفظ على الخادم وتظهر لكل المستخدمين.
          </p>
        </div>
      </div>

      {/* أدوات مساعدة داخلية */}
      <div className="hidden">
        <IcoPrint />
        <IcoX />
        {FN_BUTTONS_DEFAULT.length}
        <span style={themeCssVars(theme) as React.CSSProperties} />
      </div>
    </ModuleShell>
  );
}
