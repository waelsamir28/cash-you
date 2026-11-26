"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Bootstrap, Product } from "@/lib/types";
import type { Draft, Totals } from "@/lib/draft";
import { lineTotal } from "@/lib/draft";
import { money, qtyText } from "@/lib/format";
import { show, type ShopSettings } from "@/lib/settings";
import { CameraBarcodeModal } from "./Overlays";
import {
  IcoBarcode,
  IcoChevronLeft,
  IcoChevronRight,
  IcoMonitor,
  IcoPlus,
  IcoPrint,
  IcoSearch,
  IcoTrash,
  IcoWallet,
  IcoX,
} from "@/components/icons";

const HUE: Record<string, { chip: string; dot: string }> = {
  amber: { chip: "bg-amber-500 text-ink-900 border-amber-600", dot: "bg-amber-500" },
  emerald: { chip: "bg-emerald-500 text-white border-emerald-700", dot: "bg-emerald-500" },
  cyan: { chip: "bg-cyan-500 text-ink-900 border-cyan-700", dot: "bg-cyan-500" },
  rose: { chip: "bg-rose-500 text-white border-rose-700", dot: "bg-rose-500" },
  violet: { chip: "bg-violet-500 text-white border-violet-700", dot: "bg-violet-500" },
  orange: { chip: "bg-orange-500 text-white border-orange-700", dot: "bg-orange-500" },
  sky: { chip: "bg-sky-500 text-white border-sky-700", dot: "bg-sky-500" },
  slate: { chip: "bg-ink-700 text-white border-ink-900", dot: "bg-ink-700" },
};

const PAGE_SIZE = 24;

export type PosActions = {
  patch: (p: Partial<Draft>) => void;
  addProduct: (p: Product, qty?: number) => void;
  addByCode: (code: string) => boolean;
  updateLine: (uid: string, p: Partial<{ qty: number; price: number; discount: number }>) => void;
  removeLine: (uid: string) => void;
  save: (print: boolean) => void;
  newInvoice: () => void;
  payFull: () => void;
  openDiscount: () => void;
  openCustomerScreen: () => void;
  quickAddCustomer: () => void;
  quickAddPayment: () => void;
  suspend: () => void;
};

export function PosScreen({
  data,
  draft,
  totals,
  actions,
  barcodeRef,
  saving,
  stamp,
  settings,
}: {
  data: Bootstrap;
  draft: Draft;
  totals: Totals;
  actions: PosActions;
  barcodeRef: React.RefObject<HTMLInputElement | null>;
  saving: boolean;
  stamp: { date: string; time: string };
  settings: ShopSettings;
}) {
  const [code, setCode] = useState("");
  const gridRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const term = draft.query.trim().toLowerCase();
    return data.products.filter((p) => {
      const okCat = draft.categoryId === "all" || p.categoryId === draft.categoryId;
      const okTerm =
        term === "" || p.name.toLowerCase().includes(term) || p.code.includes(term);
      return okCat && okTerm;
    });
  }, [data.products, draft.categoryId, draft.query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(draft.page, pages - 1);
  const [showCamera, setShowCamera] = useState(false);
  const slice = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const hueOf = (catId: number) =>
    data.categories.find((c) => c.id === catId)?.hue ?? "slate";

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const last = el.querySelector<HTMLElement>("[data-last='1']");
    last?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [draft.lastAddedUid]);

  const prevBalance =
    data.customers.find((c) => c.id === draft.customerId)?.balance ?? 0;
  const afterBalance = Math.round((prevBalance + totals.remaining) * 100) / 100;

  const submitCode = () => {
    const v = code.trim();
    if (!v) return;
    actions.addByCode(v);
    setCode("");
  };

  return (
    <section
      className="flex-1 min-h-0 flex flex-col gap-1 overflow-hidden p-1"
      style={{ background: "var(--cy-paper)" }}
      dir="rtl"
    >
      {/* ============ لافتة العنوان ============ */}
      {show(settings, "topBarTitle") && <div className="relative shrink-0 rounded-xl overflow-hidden shadow-[0_6px_18px_-8px_rgba(15,23,42,0.8)]" style={{ background: "var(--cy-header)" }}>
        <div className="pointer-events-none absolute inset-0 cy-aurora opacity-90" />
        <div className="relative flex items-center gap-2 px-2 h-[38px]">
          {/* يمين: التاريخ + نقدي/آجل + شاشة الزبون */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                const next = draft.saleType === "نقدي" ? "آجل" : draft.saleType === "آجل" ? "تقسيط" : "نقدي";
                actions.patch({ saleType: next });
              }}
              className={`h-8 px-3 rounded-lg text-[12.5px] font-black cy-press cy-focus border flex items-center gap-1.5 ${
                draft.saleType === "نقدي"
                  ? "bg-cash-green border-emerald-700 text-white"
                  : draft.saleType === "آجل"
                    ? "bg-cash-orange border-orange-700 text-white"
                    : "bg-cash-violet border-violet-800 text-white"
              }`}
              title="تبديل نوع البيع"
            >
              <span className="w-4 h-4 rounded-full bg-white/25 grid place-items-center text-[9px]">
                {draft.saleType === "نقدي" ? "✓" : draft.saleType === "آجل" ? "آ" : "ت"}
              </span>
              {draft.saleType}
            </button>
            <button
              onClick={actions.openCustomerScreen}
              className="h-8 px-2.5 rounded-lg bg-ink-800 border border-white/15 text-slate-100 text-[12px] font-bold cy-press cy-focus flex items-center gap-1.5 hover:border-cash-cyan/70 hover:text-cash-cyan"
            >
              <IcoMonitor className="w-4 h-4" />
              <span className="hidden md:inline">شاشة الزبون</span>
            </button>
          </div>

          <h1 className="flex-1 text-center text-white font-black text-[15px] sm:text-[18px] tracking-wide drop-shadow">
            فاتورة بيع سريع
          </h1>

          {/* يسار: رقم الفاتورة */}
          <div className="shrink-0 flex items-center gap-1.5">
            <span className="text-[10.5px] text-slate-400 font-bold hidden sm:inline">
              رقم الفاتورة
            </span>
            <span className="min-w-[62px] h-8 px-3 grid place-items-center rounded-lg bg-amber-soft border-2 border-amber-brand text-ink-900 font-black text-[15px] cy-num shadow-[0_0_16px_-4px_rgba(245,158,11,0.8)]">
              {draft.number}
            </span>
          </div>
        </div>
      </div>}

      {/* ============ شريط العميل والباركود ============ */}
      <div className="shrink-0 rounded-lg bg-white border border-line shadow-sm px-1.5 py-1">
        <div className="flex flex-wrap items-center gap-1">
          <Field label="العميل" grow>
            <select
              value={draft.customerId ?? ""}
              onChange={(e) => {
                const id = e.target.value === "" ? null : Number(e.target.value);
                const c = data.customers.find((x) => x.id === id);
                actions.patch({
                  customerId: id,
                  customerName: c?.name ?? "عميل نقدي",
                });
              }}
              className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] font-bold text-ink-800 h-full"
            >
              <option value="">عميل نقدي</option>
              {data.customers
                .filter((c) => c.name !== "عميل نقدي")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <MiniAdd onClick={actions.quickAddCustomer} title="إضافة عميل جديد" />
          </Field>

          <Field label="الكود / الباركود" icon={<IcoBarcode className="w-4 h-4 text-amber-600" />} grow>
            <input
              ref={barcodeRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitCode();
                }
              }}
              onBlur={submitCode}
              placeholder="امسح الباركود ثم Enter"
              inputMode="numeric"
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-mono font-bold text-ink-900 placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal h-full"
            />
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              title="مسح بالكاميرا"
              className="h-7 px-2 rounded bg-ink-800 hover:bg-ink-900 text-white text-[11px] font-black shrink-0"
            >
              📷
            </button>
          </Field>
          {showCamera && (
            <CameraBarcodeModal
              onDetected={(c) => actions.addByCode(c)}
              onClose={() => setShowCamera(false)}
            />
          )}

          <Field label="بحث الصنف" icon={<IcoSearch className="w-4 h-4 text-slate-400" />} grow>
            <input
              value={draft.query}
              onChange={(e) => actions.patch({ query: e.target.value, page: 0 })}
              placeholder="اسم الصنف..."
              className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] text-ink-900 placeholder:text-slate-400 h-full"
            />
            {draft.query && (
              <button
                onClick={() => actions.patch({ query: "", page: 0 })}
                className="text-slate-400 hover:text-cash-red"
                aria-label="مسح"
              >
                <IcoX className="w-3.5 h-3.5" />
              </button>
            )}
          </Field>

          <Field label="طريقة الدفع" icon={<IcoWallet className="w-4 h-4 text-cash-violet" />}>
            <select
              value={draft.paymentMethod}
              onChange={(e) => actions.patch({ paymentMethod: e.target.value })}
              className="bg-transparent outline-none text-[12.5px] font-bold text-ink-800 h-full"
            >
              {data.paymentMethods.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
            <MiniAdd onClick={actions.quickAddPayment} title="إضافة طريقة دفع" />
          </Field>

        </div>
      </div>

      {/* ============ لافتة التعليمات ============ */}
      {show(settings, "marquee") && <div className="shrink-0 relative overflow-hidden rounded-lg bg-ink-600 h-[24px] grid place-items-center">
        <div className="pointer-events-none absolute inset-y-0 w-1/3 cy-marquee bg-gradient-to-l from-transparent via-white/10 to-transparent" />
        <p className="relative text-white text-[10.5px] sm:text-[11.5px] font-bold text-center px-2">
          امسح الباركود بالماسح الليزري في خانة الكود أو اضغط صنفاً من القائمة
        </p>
      </div>}

      {/* ============ التصنيفات: قائمة منسدلة ============ */}
      {show(settings, "categoryBar") && <div className="shrink-0 flex items-center gap-1.5 flex-wrap">
        <label className="flex items-center gap-1 h-8 rounded-lg bg-white border border-line px-2 shadow-sm">
          <span className="text-[10.5px] font-black text-slate-500 whitespace-nowrap">التصنيف</span>
          <select
            value={draft.categoryId === "all" ? "all" : String(draft.categoryId)}
            onChange={(e) => {
              const v = e.target.value;
              actions.patch({ categoryId: v === "all" ? "all" : Number(v), page: 0 });
            }}
            className="bg-transparent outline-none text-[11.5px] font-black text-ink-800 min-w-[130px] cursor-pointer"
          >
            <option value="all">كل التصنيفات ({data.products.length})</option>
            {data.categories.map((c) => {
              const count = data.products.filter((p) => p.categoryId === c.id).length;
              return (
                <option key={c.id} value={c.id}>
                  {c.name} ({count})
                </option>
              );
            })}
          </select>
        </label>

        {draft.categoryId !== "all" && (
          <button
            onClick={() => actions.patch({ categoryId: "all", page: 0 })}
            className="h-9 px-2.5 rounded-lg bg-slate-200 text-[11.5px] font-bold text-ink-700 hover:bg-slate-300"
            title="عرض كل التصنيفات"
          >
            × إلغاء الفلتر
          </button>
        )}
      </div>}

      {/* ============ مساحة العمل ============ */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-1 overflow-hidden">
        {/* الجدول 60% — هو الوحيد الذي يتمرر */}
        <div className="flex-[3] min-h-0 flex flex-col rounded-xl bg-white border border-line overflow-hidden shadow-sm">
          <div className="shrink-0 grid grid-cols-[34px_92px_80px_74px_64px_1fr_78px] text-[10.5px] font-black" style={{ background: "var(--cy-header)", color: "var(--cy-header-text)" }}>
            {[
              "×",
              "الإجمالي",
              "السعر",
              "الكمية",
              "الوحدة",
              "اسم الصنف",
              "الكود",
            ].map((h, i) => (
              <div
                key={h}
                className={`px-1 py-1 border-l border-white/10 last:border-l-0 ${
                  i === 6 ? "text-right" : "text-center"
                }`}
              >
                {h}
              </div>
            ))}
          </div>

          <div
            ref={gridRef}
            className="flex-1 min-h-0 overflow-y-auto cy-scroll"
          >
            {draft.items.length === 0 ? (
              <div className="h-full grid place-items-center p-6 text-center">
                <div>
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 grid place-items-center text-slate-400 mb-3">
                    <IcoBarcode className="w-7 h-7" />
                  </div>
                  <p className="text-[13.5px] font-bold text-ink-700">
                    لا توجد أصناف في الفاتورة بعد
                  </p>
                  <p className="text-[12px] text-slate-500 mt-1">
                    امسح باركود الصنف أو اضغط على أي صنف من قائمة اللمس على اليسار
                  </p>
                </div>
              </div>
            ) : (
              draft.items.map((li, idx) => (
                <div
                  key={li.uid}
                  data-last={draft.lastAddedUid === li.uid ? "1" : "0"}
                  className={`grid grid-cols-[34px_92px_80px_74px_64px_1fr_78px] items-stretch h-[34px] text-[11.5px] border-b border-slate-200 ${
                    draft.lastAddedUid === li.uid
                      ? "cy-flash"
                      : idx % 2 === 0
                        ? "bg-white"
                        : "bg-paper-2"
                  } hover:bg-amber-50/70 transition-colors`}
                >
                  <button
                    onClick={() => actions.removeLine(li.uid)}
                    className="grid place-items-center text-slate-400 hover:text-white hover:bg-cash-red transition-colors border-l border-slate-200"
                    title="حذف السطر"
                    aria-label={`حذف ${li.name}`}
                  >
                    <IcoTrash className="w-3.5 h-3.5" />
                  </button>
                  <div className="grid place-items-center font-black text-ink-900 cy-num border-l border-slate-200 bg-slate-50/60">
                    {money(lineTotal(li))}
                  </div>
                  <CellInput
                    value={li.price}
                    onCommit={(v) => actions.updateLine(li.uid, { price: Math.max(0, v) })}
                    tone="text-ink-800"
                  />
                  <div className="flex items-center justify-center gap-0.5 border-l border-slate-200">
                    <button
                      onClick={() =>
                        actions.updateLine(li.uid, { qty: Math.max(0.01, li.qty - 1) })
                      }
                      className="w-4 h-6 grid place-items-center rounded text-slate-500 hover:bg-ink-800 hover:text-white text-[13px] font-black"
                      aria-label="إنقاص"
                    >
                      −
                    </button>
                    <input
                      value={qtyText(li.qty)}
                      onChange={(e) => {
                        const v = Number.parseFloat(e.target.value.replace(/[^\d.]/g, ""));
                        actions.updateLine(li.uid, { qty: Number.isFinite(v) ? v : 0 });
                      }}
                      className="w-9 text-center bg-transparent outline-none font-black text-ink-900 cy-num focus:bg-amber-100 rounded"
                    />
                    <button
                      onClick={() => actions.updateLine(li.uid, { qty: li.qty + 1 })}
                      className="w-4 h-6 grid place-items-center rounded text-slate-500 hover:bg-ink-800 hover:text-white text-[13px] font-black"
                      aria-label="زيادة"
                    >
                      +
                    </button>
                  </div>
                  <div className="grid place-items-center text-[11.5px] text-slate-600 border-l border-slate-200">
                    {li.unit}
                  </div>
                  <div className="px-2 py-1.5 font-bold text-ink-800 truncate border-l border-slate-200 flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-5 rounded-full shrink-0 ${
                        (HUE[hueOf(data.products.find((p) => p.id === li.productId)?.categoryId ?? 0)] ??
                          HUE.slate).dot
                      }`}
                    />
                    {li.name}
                  </div>
                  <div className="grid place-items-center font-mono text-[11.5px] text-amber-800 bg-amber-50/70">
                    {li.code}
                  </div>
                </div>
              ))
            )}
          </div>

          {show(settings, "tableFooter") && <div className="shrink-0 h-7 bg-paper border-t border-line flex items-center justify-between px-2 text-[10.5px] font-bold text-ink-700">
            <span>
              عدد الأسطر: <span className="cy-num text-ink-900">{draft.items.length}</span>
            </span>
            <span>
              إجمالي الكميات:{" "}
              <span className="cy-num text-ink-900">{qtyText(totals.count)}</span>
            </span>
            <span>
              الإجمالي:{" "}
              <span className="cy-num text-ink-900">{money(totals.subtotal)}</span>
            </span>
          </div>}
        </div>

        {/* شبكة اللمس 40% */}
        {show(settings, "productGrid") && <div className="flex-[2] min-h-0 flex flex-col rounded-xl bg-white border border-line overflow-hidden shadow-sm">
          <div className="shrink-0 h-[22px] px-2 flex items-center justify-between bg-paper border-b border-line">
            <span className="text-[10.5px] font-black text-ink-800">
              قائمة الأصناف — اضغط للإضافة
            </span>
            <span className="text-[11px] font-bold text-slate-500 cy-num">
              {filtered.length} صنف
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto cy-scroll p-1.5">
            {slice.length === 0 ? (
              <div className="h-full grid place-items-center text-[12.5px] text-slate-500 font-bold">
                لا توجد أصناف مطابقة
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1">
                {slice.map((p) => {
                  const h = HUE[hueOf(p.categoryId)] ?? HUE.slate;
                  const out = p.stock <= 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => actions.addProduct(p)}
                      className={`group relative text-right rounded-lg border bg-white px-1.5 py-1 h-[56px] cy-press cy-focus overflow-hidden ${
                        out
                          ? "border-cash-red/40 opacity-70"
                          : "border-line hover:border-amber-brand hover:shadow-[0_8px_20px_-12px_rgba(245,158,11,0.9)]"
                      }`}
                    >
                      <span
                        className={`absolute top-0 bottom-0 right-0 w-0.5 ${h.dot} opacity-80`}
                      />
                      <span className="block text-[10.5px] font-bold leading-[1.3] text-ink-800 line-clamp-2 pr-1">
                        {p.name}
                      </span>
                      <span className="absolute bottom-1 right-1.5 left-1.5 flex items-center justify-between">
                        <span className="text-[10.5px] font-black text-cash-green-deep cy-num">
                          {money(p.price)}
                        </span>
                        <span
                          className={`text-[9px] font-bold cy-num ${
                            out ? "text-cash-red" : "text-slate-400"
                          }`}
                        >
                          {out ? "نفد" : qtyText(p.stock)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 h-7 bg-paper border-t border-line flex items-center justify-between px-2 gap-1">
            <PagerBtn
              disabled={page === 0}
              onClick={() => actions.patch({ page: Math.max(0, page - 1) })}
            >
              <IcoChevronRight className="w-3.5 h-3.5" />
              السابق
            </PagerBtn>
            <span className="text-[11.5px] font-black text-ink-800 cy-num">
              {page + 1} / {pages} - {filtered.length} صنف
            </span>
            <PagerBtn
              disabled={page >= pages - 1}
              onClick={() => actions.patch({ page: Math.min(pages - 1, page + 1) })}
            >
              التالي
              <IcoChevronLeft className="w-3.5 h-3.5" />
            </PagerBtn>
          </div>
        </div>}
      </div>

      {/* ============ البطاقات المالية (مقاسات موحّدة) ============ */}
      <div className="shrink-0 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
        <MoneyCard label="المبلغ الصافي" value={money(totals.total)} tone="ink" hint={`${qtyText(totals.count)} قطعة`} />
        <MoneyCard
          label="المدفوع"
          value={draft.paidText}
          tone="amber"
          editable
          onInput={(v) => actions.patch({ paidText: v })}
          action={
            <button
              onClick={actions.payFull}
              className="text-[8px] font-black text-amber-900/70 hover:text-cash-red"
              title="دفع كامل (F12)"
            >
              دفع كامل F12
            </button>
          }
        />
        <MoneyCard
          label={totals.remaining < 0 ? "الباقي للزبون" : "المتبقي"}
          value={money(Math.abs(totals.remaining))}
          tone={totals.remaining > 0 ? "red" : totals.remaining < 0 ? "amber" : "green"}
          hint={
            totals.remaining > 0
              ? "غير مسدد"
              : totals.remaining < 0
                ? "يُسلَّم أو يُخصم"
                : "مسدد بالكامل"
          }
        />
        <MoneyCard label="الرصيد السابق" value={money(prevBalance)} tone="slate" />
        <MoneyCard label="الرصيد بعد الفاتورة" value={money(afterBalance)} tone="cyan" />
      </div>

      {/* ============ مفاتيح الوظائف ============ */}
      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {settings.fnButtons
          .filter((b) => b.visible)
          .map((b) => {
            const onSave = b.id === "save" || b.id === "savePrint";
            const icon =
              b.id === "savePrint" || b.id === "save" ? <IcoPrint className="h-4 w-4" /> : undefined;
            return (
              <FnKey
                key={b.id}
                onClick={() => {
                  if (b.id === "newInvoice") actions.newInvoice();
                  else if (b.id === "payFull") actions.payFull();
                  else if (b.id === "savePrint") actions.save(true);
                  else if (b.id === "save") actions.save(false);
                  else if (b.id === "suspend") actions.suspend();
                }}
                k={b.shortcut}
                tone={
                  b.id === "newInvoice"
                    ? "light"
                    : b.id === "payFull"
                      ? "orange"
                      : b.id === "savePrint"
                        ? "savePrint"
                        : "save"
                }
                busy={onSave ? saving : undefined}
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  {icon}
                  {b.label}
                </span>
              </FnKey>
            );
          })}
      </div>

    </section>
  );
}

/* ---------------- عناصر مساعدة ---------------- */

function Field({
  label,
  children,
  icon,
  grow,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-1 h-[30px] rounded-lg bg-paper-2 border border-line px-2 focus-within:border-amber-brand focus-within:bg-white transition-colors ${
        grow ? "flex-1 min-w-[150px]" : ""
      }`}
    >
      <span className="text-[10px] font-black text-slate-500 whitespace-nowrap">{label}</span>
      {icon}
      {children}
    </label>
  );
}

function MiniAdd({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="w-6 h-6 shrink-0 grid place-items-center rounded-lg bg-cash-green text-white cy-press hover:bg-cash-green-deep"
    >
      <IcoPlus className="w-3.5 h-3.5" />
    </button>
  );
}

function CellInput({
  value,
  onCommit,
  tone,
}: {
  value: number;
  onCommit: (v: number) => void;
  tone: string;
}) {
  const [txt, setTxt] = useState(String(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    // Keep the draft input in sync with its controlled value when it is not being edited.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!focus) setTxt(String(value));
  }, [value, focus]);
  return (
    <input
      value={txt}
      onFocus={(e) => {
        setFocus(true);
        e.currentTarget.select();
      }}
      onBlur={() => {
        setFocus(false);
        const v = Number.parseFloat(txt.replace(/[^\d.]/g, ""));
        onCommit(Number.isFinite(v) ? v : 0);
      }}
      onChange={(e) => setTxt(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={`w-full text-center bg-transparent outline-none font-bold cy-num border-l border-slate-200 focus:bg-amber-100 ${tone}`}
    />
  );
}

function CatChip({
  children,
  active,
  onClick,
  className,
  dot,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  className: string;
  dot: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 h-8 px-3.5 rounded-full text-[12px] font-black border cy-press cy-focus flex items-center gap-1.5 whitespace-nowrap transition-all ${
        active
          ? `${className} shadow-[0_6px_16px_-8px_rgba(15,23,42,0.9)] scale-[1.03]`
          : "bg-white text-ink-700 border-line hover:border-ink-500"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white/80" : dot}`} />
      {children}
    </button>
  );
}

function PagerBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-7 px-3 rounded-lg bg-ink-800 text-white text-[11.5px] font-bold cy-press cy-focus flex items-center gap-1 disabled:opacity-35 disabled:cursor-not-allowed hover:bg-ink-700"
    >
      {children}
    </button>
  );
}

/**
 * بطاقة مالية موحّدة: نفس العرض والارتفاع وحجم الخط في كل البطاقات،
 * والرقم متوسط داخل الخانة.
 */
const MONEY_TONES = {
  ink: "bg-ink-800 border-black/40 text-white",
  amber: "bg-amber-soft border-amber-brand/70 text-amber-900",
  red: "bg-amber-cream border-cash-red/60 text-cash-red",
  green: "bg-amber-cream border-cash-green/60 text-cash-green-deep",
  slate: "bg-slate-100 border-line text-ink-800",
  cyan: "bg-cyan-50 border-cyan-300 text-cyan-900",
} as const;

/** بطاقة مالية موحّدة — تُستخدم في شاشة المبيعات والمشتريات */
export function MoneyCard({
  label,
  value,
  tone,
  hint,
  action,
  editable,
  onInput,
}: {
  label: string;
  value: string;
  tone: keyof typeof MONEY_TONES;
  hint?: string;
  action?: React.ReactNode;
  editable?: boolean;
  onInput?: (v: string) => void;
}) {
  return (
    <div className={`relative overflow-hidden rounded-lg border-2 px-1.5 py-1 h-[50px] flex flex-col justify-between ${MONEY_TONES[tone]}`}>
      <div className="flex items-baseline justify-between gap-1">
        <span className="truncate text-[9.5px] font-black opacity-80">{label}</span>
        {action ?? (hint ? <span className="shrink-0 text-[8.5px] font-bold opacity-70 cy-num">{hint}</span> : null)}
      </div>
      {editable ? (
        <input
          value={value}
          onChange={(e) => onInput?.(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          inputMode="decimal"
          aria-label={label}
          className="w-full bg-transparent text-center text-[15px] font-black leading-none cy-num outline-none focus:bg-white/60 rounded"
        />
      ) : (
        <div className="w-full text-center text-[15px] font-black leading-none cy-num truncate">{value}</div>
      )}
    </div>
  );
}

function BalancePill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "amber";
}) {
  return (
    <span
      className={`h-7 px-3 rounded-full flex items-center gap-1.5 text-[11.5px] font-bold border ${
        tone === "slate"
          ? "bg-ink-800 text-slate-200 border-black/40"
          : "bg-amber-soft text-amber-900 border-amber-brand/70"
      }`}
    >
      {label}:<span className="cy-num font-black">{money(value)}</span>
    </span>
  );
}

const FN_TONES: Record<string, string> = {
  light: "bg-slate-200 text-ink-800 border-slate-300 hover:bg-slate-300",
  red: "bg-cash-red text-white border-red-700 hover:brightness-110",
  orange: "bg-cash-orange text-white border-orange-700 hover:brightness-110",
  ink: "bg-ink-800 text-white border-black/50 hover:bg-ink-900",
  slate: "bg-ink-700 text-white border-ink-900 hover:bg-ink-600",
  /* زر الحفظ: أخضر فاتح */
  save: "bg-cash-green text-white border-emerald-700 hover:brightness-110",
  /* زر حفظ وطباعة: أخضر غامق */
  savePrint: "bg-cash-green-deep text-white border-emerald-900 hover:brightness-110",
};

function FnKey({
  children,
  k,
  onClick,
  tone,
  busy,
}: {
  children: React.ReactNode;
  k: string;
  onClick: () => void;
  tone: keyof typeof FN_TONES | string;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`cy-fnkey relative h-[40px] border cy-press cy-focus flex flex-col items-center justify-center gap-0 font-black text-[12px] disabled:opacity-60 ${
        FN_TONES[tone] ?? FN_TONES.light
      }`}
    >
      <span className="absolute top-1 right-2 text-[9.5px] font-mono opacity-70">{k}</span>
      {children}
    </button>
  );
}