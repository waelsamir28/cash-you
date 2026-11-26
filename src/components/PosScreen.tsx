"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Bootstrap, Product } from "@/lib/types";
import type { Draft, Totals } from "@/lib/draft";
import { lineTotal } from "@/lib/draft";
import { money, qtyText } from "@/lib/format";
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
};

export function PosScreen({
  data,
  draft,
  totals,
  actions,
  barcodeRef,
  saving,
  stamp,
}: {
  data: Bootstrap;
  draft: Draft;
  totals: Totals;
  actions: PosActions;
  barcodeRef: React.RefObject<HTMLInputElement | null>;
  saving: boolean;
  stamp: { date: string; time: string };
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
      className="flex-1 min-h-0 flex flex-col gap-1.5 p-1.5 bg-paper overflow-y-auto lg:overflow-hidden cy-scroll"
      dir="rtl"
    >
      {/* ============ لافتة العنوان ============ */}
      <div className="relative shrink-0 rounded-xl bg-ink-700 overflow-hidden shadow-[0_6px_18px_-8px_rgba(15,23,42,0.8)]">
        <div className="pointer-events-none absolute inset-0 cy-aurora opacity-90" />
        <div className="relative flex items-center gap-2 px-2 h-[46px]">
          {/* يمين: التاريخ + نقدي/آجل + شاشة الزبون */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hidden sm:flex flex-col leading-none px-2">
              <span className="text-[10px] text-slate-400 font-semibold">{stamp.date}</span>
              <span className="text-[12px] text-slate-100 font-bold cy-num mt-0.5">
                {stamp.time}
              </span>
            </div>
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
      </div>

      {/* ============ شريط العميل والباركود ============ */}
      <div className="shrink-0 rounded-xl bg-white border border-line shadow-sm px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
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
          </Field>

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

          <Field label="خصم %">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={draft.discountPercent}
              onChange={(e) =>
                actions.patch({
                  discountPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                })
              }
              className="w-14 bg-transparent outline-none text-center text-[13px] font-black text-cash-red cy-num h-full"
            />
          </Field>
        </div>
      </div>

      {/* ============ لافتة التعليمات ============ */}
      <div className="shrink-0 relative overflow-hidden rounded-lg bg-ink-600 h-[30px] grid place-items-center">
        <div className="pointer-events-none absolute inset-y-0 w-1/3 cy-marquee bg-gradient-to-l from-transparent via-white/10 to-transparent" />
        <p className="relative text-white text-[12px] sm:text-[13px] font-bold text-center px-2">
          امسح الباركود بالماسح الليزري في خانة الكود أو اضغط صنفاً من القائمة
        </p>
      </div>

      {/* ============ شريط التصنيفات ============ */}
      <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto cy-scroll pb-1">
        <CatChip
          active={draft.categoryId === "all"}
          onClick={() => actions.patch({ categoryId: "all", page: 0 })}
          className="bg-ink-800 text-white border-ink-900"
          dot="bg-amber-brand"
        >
          الكل
        </CatChip>
        {data.categories.map((c) => {
          const h = HUE[c.hue] ?? HUE.slate;
          return (
            <CatChip
              key={c.id}
              active={draft.categoryId === c.id}
              onClick={() => actions.patch({ categoryId: c.id, page: 0 })}
              className={h.chip}
              dot={h.dot}
            >
              {c.name}
            </CatChip>
          );
        })}
      </div>

      {/* ============ مساحة العمل ============ */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-1.5">
        {/* الجدول 60% */}
        <div className="flex-[3] min-h-[220px] lg:min-h-0 flex flex-col rounded-xl bg-white border border-line overflow-hidden shadow-sm">
          <div className="shrink-0 grid grid-cols-[38px_92px_74px_82px_74px_66px_1fr_78px] bg-ink-800 text-white text-[11.5px] font-black">
            {[
              "×",
              "الإجمالي",
              "خصم",
              "السعر",
              "الكمية",
              "الوحدة",
              "اسم الصنف",
              "الكود",
            ].map((h, i) => (
              <div
                key={h}
                className={`px-1.5 py-2 border-l border-white/10 last:border-l-0 ${
                  i === 6 ? "text-right" : "text-center"
                }`}
              >
                {h}
              </div>
            ))}
          </div>

          <div ref={gridRef} className="flex-1 min-h-0 overflow-y-auto cy-scroll">
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
                  className={`grid grid-cols-[38px_92px_74px_82px_74px_66px_1fr_78px] items-stretch text-[12.5px] border-b border-slate-200 ${
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
                    value={li.discount}
                    onCommit={(v) => actions.updateLine(li.uid, { discount: Math.max(0, v) })}
                    tone="text-cash-red"
                  />
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

          <div className="shrink-0 h-8 bg-paper border-t border-line flex items-center justify-between px-3 text-[11.5px] font-bold text-ink-700">
            <span>
              عدد الأسطر: <span className="cy-num text-ink-900">{draft.items.length}</span>
            </span>
            <span>
              إجمالي الكميات:{" "}
              <span className="cy-num text-ink-900">{qtyText(totals.count)}</span>
            </span>
            <span>
              الإجمالي قبل الخصم:{" "}
              <span className="cy-num text-ink-900">{money(totals.subtotal)}</span>
            </span>
            {draft.discountPercent > 0 && (
              <span className="text-cash-red">
                خصم {draft.discountPercent}% ={" "}
                <span className="cy-num">{money(totals.discountValue)}</span>
              </span>
            )}
          </div>
        </div>

        {/* شبكة اللمس 40% */}
        <div className="flex-[2] min-h-[260px] lg:min-h-0 flex flex-col rounded-xl bg-white border border-line overflow-hidden shadow-sm">
          <div className="shrink-0 h-8 px-3 flex items-center justify-between bg-paper border-b border-line">
            <span className="text-[11.5px] font-black text-ink-800">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-1.5">
                {slice.map((p) => {
                  const h = HUE[hueOf(p.categoryId)] ?? HUE.slate;
                  const out = p.stock <= 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => actions.addProduct(p)}
                      className={`group relative text-right rounded-xl border bg-white px-2 py-2 h-[74px] cy-press cy-focus overflow-hidden ${
                        out
                          ? "border-cash-red/40 opacity-70"
                          : "border-line hover:border-amber-brand hover:shadow-[0_8px_20px_-12px_rgba(245,158,11,0.9)]"
                      }`}
                    >
                      <span
                        className={`absolute top-0 bottom-0 right-0 w-1 ${h.dot} opacity-80`}
                      />
                      <span className="block text-[11.5px] font-bold leading-[1.35] text-ink-800 line-clamp-2 pr-1.5">
                        {p.name}
                      </span>
                      <span className="absolute bottom-1.5 right-2 left-2 flex items-center justify-between pr-0.5">
                        <span className="text-[12px] font-black text-cash-green-deep cy-num">
                          {money(p.price)}
                        </span>
                        <span
                          className={`text-[10px] font-bold cy-num ${
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

          <div className="shrink-0 h-10 bg-paper border-t border-line flex items-center justify-between px-2 gap-2">
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
        </div>
      </div>

      {/* ============ البطاقات المالية ============ */}
      <div className="shrink-0 grid grid-cols-3 gap-1.5">
        <div className="relative overflow-hidden rounded-xl bg-ink-800 border border-black/40 px-3 py-2 shadow-[0_10px_26px_-14px_rgba(15,23,42,1)]">
          <div className="pointer-events-none absolute inset-0 cy-aurora opacity-80" />
          <div className="relative flex items-baseline justify-between">
            <span className="text-[11.5px] font-black text-slate-400">المبلغ الصافي</span>
            <span className="text-[10px] font-bold text-cash-cyan cy-num">
              {qtyText(totals.count)} قطعة
            </span>
          </div>
          <div className="relative text-white font-black text-[26px] sm:text-[34px] leading-none cy-num mt-1 text-left">
            {money(totals.total)}
          </div>
        </div>

        <div className="rounded-xl bg-amber-soft border-2 border-amber-brand/70 px-3 py-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[11.5px] font-black text-amber-800">المدفوع</span>
            <button
              onClick={actions.payFull}
              className="text-[10px] font-black text-amber-900/70 hover:text-cash-red"
              title="دفع كامل (F12)"
            >
              دفع كامل F12
            </button>
          </div>
          <input
            value={draft.paidText}
            onChange={(e) => actions.patch({ paidText: e.target.value })}
            onFocus={(e) => e.currentTarget.select()}
            inputMode="decimal"
            aria-label="المدفوع"
            className="w-full bg-transparent outline-none text-cash-green-deep font-black text-[26px] sm:text-[34px] leading-none cy-num mt-1 text-left focus:bg-white/60 rounded"
          />
        </div>

        <div
          className={`rounded-xl border-2 px-3 py-2 transition-colors ${
            totals.remaining > 0
              ? "bg-amber-cream border-cash-red/60"
              : "bg-amber-cream border-cash-green/60"
          }`}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[11.5px] font-black text-amber-800">
              {totals.remaining < 0 ? "الباقي للزبون" : "المتبقي"}
            </span>
            <span
              className={`text-[10px] font-black ${
                totals.remaining > 0 ? "text-cash-red" : "text-cash-green-deep"
              }`}
            >
              {totals.remaining > 0 ? "غير مسدد" : "مسدد بالكامل"}
            </span>
          </div>
          <div
            className={`font-black text-[26px] sm:text-[34px] leading-none cy-num mt-1 text-left ${
              totals.remaining > 0 ? "text-cash-red" : "text-cash-green-deep"
            }`}
          >
            {money(Math.abs(totals.remaining))}
          </div>
        </div>
      </div>

      {/* ============ رصيد العميل ============ */}
      <div className="shrink-0 flex items-center justify-center gap-2 flex-wrap">
        <BalancePill label="الرصيد السابق" value={prevBalance} tone="slate" />
        <BalancePill label="الرصيد بعد الفاتورة" value={afterBalance} tone="amber" />
        <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">
          العميل: <span className="text-ink-800">{draft.customerName}</span> · طريقة الدفع:{" "}
          <span className="text-ink-800">{draft.paymentMethod}</span>
        </span>
      </div>

      {/* ============ مفاتيح الوظائف ============ */}
      <div className="shrink-0 grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        <FnKey onClick={actions.newInvoice} k="F4" tone="light">
          فاتورة جديدة
        </FnKey>
        <FnKey onClick={() => barcodeRef.current?.focus()} k="F3" tone="light">
          بحث بالكود
        </FnKey>
        <FnKey onClick={actions.openDiscount} k="F11" tone="red">
          خصم
        </FnKey>
        <FnKey onClick={actions.payFull} k="F12" tone="orange">
          دفع كامل
        </FnKey>
        <FnKey onClick={() => actions.save(true)} k="F10" tone="ink" busy={saving}>
          <span className="inline-flex items-center gap-1.5">
            <IcoPrint className="w-4 h-4" />
            حفظ وطباعة
          </span>
        </FnKey>
        <FnKey onClick={() => actions.save(false)} k="F5" tone="slate" busy={saving}>
          حفظ
        </FnKey>
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
      className={`flex items-center gap-1.5 h-9 rounded-xl bg-paper-2 border border-line px-2.5 focus-within:border-amber-brand focus-within:bg-white transition-colors ${
        grow ? "flex-1 min-w-[150px]" : ""
      }`}
    >
      <span className="text-[11px] font-black text-slate-500 whitespace-nowrap">{label}</span>
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
      className={`relative h-[52px] rounded-xl border cy-press cy-focus flex flex-col items-center justify-center gap-0.5 font-black text-[13px] shadow-[0_6px_16px_-10px_rgba(15,23,42,0.9)] disabled:opacity-60 ${
        FN_TONES[tone] ?? FN_TONES.light
      }`}
    >
      <span className="absolute top-1 right-2 text-[9.5px] font-mono opacity-70">{k}</span>
      {children}
    </button>
  );
}