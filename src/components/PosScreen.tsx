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

/* ---------- مقاسات ثابتة لجدول الأصناف: 12 صنفاً ظاهرة بالكامل ---------- */
const ROW_H = 25; // ارتفاع السطر بالبكسل (يكفي 12 صنفاً في الشاشات 768 بكسل)
const VISIBLE_ROWS = 12;
const HEAD_H = 32;
const FOOT_H = 32;


/* ترتيب الأعمدة (يُستخدم في الرأس والسطر بنفس القيم) */
const COLS = "38px 100px 96px 118px 72px 1fr 100px";

const PAGE_SIZE = 24;

export type PosActions = {
  patch: (p: Partial<Draft>) => void;
  addProduct: (p: Product, qty?: number) => void;
  addByCode: (code: string) => boolean;
  updateLine: (uid: string, p: Partial<{ qty: number; price: number }>) => void;
  removeLine: (uid: string) => void;
  save: (print: boolean) => void;
  newInvoice: () => void;
  payFull: () => void;
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
}: {
  data: Bootstrap;
  draft: Draft;
  totals: Totals;
  actions: PosActions;
  barcodeRef: React.RefObject<HTMLInputElement | null>;
  saving: boolean;
}) {
  const [code, setCode] = useState("");
  const gridRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const term = draft.query.trim().toLowerCase();
    return data.products.filter((p) => {
      const okCat = draft.categoryId === "all" || p.categoryId === draft.categoryId;
      const okTerm = term === "" || p.name.toLowerCase().includes(term) || p.code.includes(term);
      return okCat && okTerm;
    });
  }, [data.products, draft.categoryId, draft.query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(draft.page, pages - 1);
  const slice = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const catOf = (productId: number | null) => {
    const p = data.products.find((x) => x.id === productId);
    return data.categories.find((c) => c.id === p?.categoryId);
  };

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const last = el.querySelector<HTMLElement>("[data-last='1']");
    last?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [draft.lastAddedUid]);

  const prevBalance = data.customers.find((c) => c.id === draft.customerId)?.balance ?? 0;
  const afterBalance = Math.round((prevBalance + totals.remaining) * 100) / 100;

  const submitCode = () => {
    const v = code.trim();
    if (!v) return;
    actions.addByCode(v);
    setCode("");
  };

  return (
    <section
      className="flex-1 min-h-0 flex flex-col gap-1.5 p-1.5 bg-paper overflow-hidden"
      dir="rtl"
    >
      {/* ============ لافتة العنوان ============ */}
      <div className="relative shrink-0 rounded-xl bg-ink-700 overflow-hidden shadow-[0_6px_18px_-8px_rgba(15,23,42,0.8)]">
        <div className="pointer-events-none absolute inset-0 cy-aurora opacity-90" />
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 h-[44px]">
          <div className="flex items-center gap-1.5 justify-self-start">
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
              className="cy-h-customerScreen h-8 px-2.5 rounded-lg bg-ink-800 border border-white/15 text-slate-100 text-[12px] font-bold cy-press cy-focus flex items-center gap-1.5 hover:border-cash-cyan/70 hover:text-cash-cyan"
            >
              <IcoMonitor className="w-4 h-4" />
              <span className="hidden md:inline">شاشة الزبون</span>
            </button>
          </div>

          <h1 className="text-center text-white font-black text-[16px] sm:text-[18px] tracking-wide drop-shadow">
            فاتورة بيع سريع
          </h1>

          <div className="justify-self-end flex items-center gap-1.5">
            <span className="text-[10.5px] text-slate-400 font-bold hidden sm:inline">رقم الفاتورة</span>
            <span className="min-w-[66px] h-8 px-3 grid place-items-center rounded-lg bg-amber-soft border-2 border-amber-brand text-ink-900 font-black text-[15px] cy-num shadow-[0_0_16px_-4px_rgba(245,158,11,0.8)]">
              {draft.number}
            </span>
          </div>
        </div>
      </div>

      {/* ============ شريط العميل والباركود والبحث ============ */}
      <div className="shrink-0 rounded-xl bg-white border border-line shadow-sm px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Field label="العميل" grow>
            <select
              value={draft.customerId ?? ""}
              onChange={(e) => {
                const id = e.target.value === "" ? null : Number(e.target.value);
                const c = data.customers.find((x) => x.id === id);
                actions.patch({ customerId: id, customerName: c?.name ?? "عميل نقدي" });
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
        </div>
      </div>

      {/* ============ مساحة العمل: الفاتورة + قائمة الأصناف ============ */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-1.5">
        {/* جدول أصناف الفاتورة — يتسع لـ 12 صنفاً */}
        <div
          className="flex-[3] min-h-0 flex flex-col rounded-xl bg-white border border-line overflow-hidden shadow-sm"
        >
          <div
            className="shrink-0 grid bg-ink-800 text-white text-[12px] font-black"
            style={{ gridTemplateColumns: COLS, height: HEAD_H }}
          >
            {["×", "الإجمالي", "السعر", "الكمية", "الوحدة", "اسم الصنف", "الكود"].map((h, i) => (
              <div
                key={h}
                className="flex items-center justify-center px-1.5 border-l border-white/10 last:border-l-0"
              >
                {h}
              </div>
            ))}
          </div>

          <div ref={gridRef} className="flex-1 min-h-0 overflow-y-auto cy-scroll">
            {draft.items.length === 0 ? (
              <div className="h-full grid place-items-center p-6 text-center">
                <div>
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 grid place-items-center text-slate-400 mb-2">
                    <IcoBarcode className="w-6 h-6" />
                  </div>
                  <p className="text-[13.5px] font-bold text-ink-700">لا توجد أصناف في الفاتورة بعد</p>
                  <p className="text-[12px] text-slate-500 mt-1">
                    امسح باركود الصنف أو اختر صنفاً من القائمة على اليمين
                  </p>
                </div>
              </div>
            ) : (
              draft.items.map((li, idx) => {
                const cat = catOf(li.productId);
                const h = HUE[cat?.hue ?? "slate"] ?? HUE.slate;
                const isLast = draft.lastAddedUid === li.uid;
                return (
                  <div
                    key={li.uid}
                    data-last={isLast ? "1" : "0"}
                    className={`cy-row grid items-stretch text-[12.5px] border-b border-slate-200 transition-colors hover:bg-amber-50/70 ${
                      isLast ? "cy-flash" : idx % 2 === 0 ? "bg-white" : "bg-paper-2"
                    }`}
                    style={{ gridTemplateColumns: COLS, height: ROW_H }}
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
                        onClick={() => actions.updateLine(li.uid, { qty: Math.max(0.01, li.qty - 1) })}
                        className="w-5 h-6 grid place-items-center rounded text-slate-500 hover:bg-ink-800 hover:text-white text-[13px] font-black"
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
                        className="w-5 h-6 grid place-items-center rounded text-slate-500 hover:bg-ink-800 hover:text-white text-[13px] font-black"
                        aria-label="زيادة"
                      >
                        +
                      </button>
                    </div>
                    <div className="grid place-items-center text-[11.5px] text-slate-600 border-l border-slate-200">
                      {li.unit}
                    </div>
                    <div className="cy-box px-2 font-bold text-ink-800 truncate border-l border-slate-200 flex items-center justify-center gap-1.5">
                      <span className={`w-1.5 h-4 rounded-full shrink-0 ${h.dot}`} />
                      <span className="truncate">{li.name}</span>
                    </div>
                    <div className="grid place-items-center font-mono text-[11.5px] text-amber-800 bg-amber-50/70">
                      {li.code}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div
            className="cy-h-tableTotals shrink-0 bg-paper border-t border-line flex items-center justify-between px-3 text-[11.5px] font-bold text-ink-700"
            style={{ height: FOOT_H }}
          >
            <span>
              عدد الأسطر: <span className="cy-num text-ink-900">{draft.items.length}</span>
            </span>
            <span>
              إجمالي الكميات: <span className="cy-num text-ink-900">{qtyText(totals.count)}</span>
            </span>
            <span>
              الإجمالي: <span className="cy-num text-ink-900">{money(totals.subtotal)}</span>
            </span>
          </div>
        </div>

        {/* قائمة الأصناف (اللمس) */}
        <div
          className="flex-[2] min-h-0 flex flex-col rounded-xl bg-white border border-line overflow-hidden shadow-sm"
        >
          <div
            className="shrink-0 px-2 flex items-center justify-between gap-2 bg-paper border-b border-line"
            style={{ height: HEAD_H }}
          >
            <span className="text-[12px] font-black text-ink-800 whitespace-nowrap">الأصناف</span>
            <select
              value={draft.categoryId}
              onChange={(e) =>
                actions.patch({
                  categoryId: e.target.value === "all" ? "all" : Number(e.target.value),
                  page: 0,
                })
              }
              aria-label="التصنيف"
              className="cy-h-categories flex-1 min-w-0 max-w-[220px] h-7 rounded-lg border border-line bg-white px-2 text-[12px] font-bold text-ink-800 outline-none focus:border-amber-brand"
            >
              <option value="all">كل التصنيفات</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <span className="text-[11px] font-bold text-slate-500 cy-num whitespace-nowrap">{filtered.length} صنف</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto cy-scroll p-1.5">
            {slice.length === 0 ? (
              <div className="h-full grid place-items-center text-[12.5px] text-slate-500 font-bold">
                لا توجد أصناف مطابقة
              </div>
            ) : (
              <div className="grid grid-cols-3 xl:grid-cols-4 gap-1">
                {slice.map((p) => {
                  const h = HUE[data.categories.find((c) => c.id === p.categoryId)?.hue ?? "slate"] ?? HUE.slate;
                  const out = p.stock <= 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => actions.addProduct(p)}
                      title={p.name}
                      className={`group relative text-right rounded-lg border bg-white px-1.5 pt-1.5 pb-1 h-[58px] cy-press cy-focus overflow-hidden flex flex-col justify-between ${
                        out
                          ? "border-cash-red/40 opacity-70"
                          : "border-line hover:border-amber-brand hover:shadow-[0_6px_16px_-10px_rgba(245,158,11,0.9)]"
                      }`}
                    >
                      <span className={`absolute top-0 bottom-0 right-0 w-0.5 ${h.dot} opacity-80`} />
                      <span className="block text-[11px] font-bold leading-[1.3] text-ink-800 line-clamp-2 pr-1">
                        {p.name}
                      </span>
                      <span className="flex items-center justify-between gap-1 pr-1">
                        <span className="text-[11.5px] font-black text-cash-green-deep cy-num">{money(p.price)}</span>
                        <span className={`cy-h-stock text-[9.5px] font-bold cy-num ${out ? "text-cash-red" : "text-slate-400"}`}>
                          {out ? "نفد" : qtyText(p.stock)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 bg-paper border-t border-line flex items-center justify-between px-2 gap-2" style={{ height: FOOT_H }}>
            <PagerBtn disabled={page === 0} onClick={() => actions.patch({ page: Math.max(0, page - 1) })}>
              <IcoChevronRight className="w-3.5 h-3.5" />
              السابق
            </PagerBtn>
            <span className="text-[11.5px] font-black text-ink-800 cy-num">
              {page + 1} / {pages}
            </span>
            <PagerBtn disabled={page >= pages - 1} onClick={() => actions.patch({ page: Math.min(pages - 1, page + 1) })}>
              التالي
              <IcoChevronLeft className="w-3.5 h-3.5" />
            </PagerBtn>
          </div>
        </div>
      </div>

      {/* ============ خانات المبالغ: مقاس موحد، والأرقام في المنتصف ============ */}
      <div className="shrink-0 flex flex-wrap items-stretch justify-center gap-1.5">
        <AmountTile label="المبلغ الصافي" tone="dark">
          {money(totals.total)}
        </AmountTile>

        <AmountTile label="المدفوع" tone="amber">
          <input
            value={draft.paidText}
            onChange={(e) => actions.patch({ paidText: e.target.value })}
            onFocus={(e) => e.currentTarget.select()}
            inputMode="decimal"
            aria-label="المدفوع"
            className="w-full bg-transparent outline-none text-center text-cash-green-deep font-black text-[20px] leading-none cy-num focus:bg-white/60 rounded"
          />
        </AmountTile>

        <AmountTile label={totals.remaining < 0 ? "الباقي للزبون" : "المتبقي"} tone={totals.remaining > 0 ? "red" : "green"}>
          {money(Math.abs(totals.remaining))}
        </AmountTile>

        <div className="cy-h-balances flex flex-wrap gap-1.5">
          <AmountTile label="الرصيد السابق" tone="slate">
            {money(prevBalance)}
          </AmountTile>

          <AmountTile label="الرصيد بعد الفاتورة" tone="amber">
            {money(afterBalance)}
          </AmountTile>
        </div>
      </div>

      <div className="shrink-0 text-center text-[11px] font-bold text-slate-500">
        العميل: <span className="text-ink-800">{draft.customerName}</span> · طريقة الدفع:{" "}
        <span className="text-ink-800">{draft.paymentMethod}</span> · نوع البيع:{" "}
        <span className="text-ink-800">{draft.saleType}</span>
      </div>

      {/* ============ مفاتيح الوظائف ============ */}
      <div className="cy-h-fnKeys shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <FnKey onClick={actions.newInvoice} k="F4" tone="light">
          فاتورة جديدة
        </FnKey>
        <FnKey onClick={actions.payFull} k="F12" tone="orange">
          دفع كامل
        </FnKey>
        <FnKey onClick={() => actions.save(false)} k="F5" tone="save" busy={saving}>
          حفظ
        </FnKey>
        <FnKey onClick={() => actions.save(true)} k="F10" tone="savePrint" busy={saving}>
          <span className="inline-flex items-center gap-1.5">
            <IcoPrint className="w-4 h-4" />
            حفظ وطباعة
          </span>
        </FnKey>
      </div>
    </section>
  );
}

/* ---------------- عناصر مساعدة ---------------- */

const TILE_TONES: Record<string, string> = {
  dark: "bg-ink-800 text-white border-black/40",
  amber: "bg-amber-soft text-ink-900 border-amber-brand/70",
  red: "bg-amber-cream text-cash-red border-cash-red/60",
  green: "bg-amber-cream text-cash-green-deep border-cash-green/60",
  slate: "bg-white text-ink-800 border-line",
};

function AmountTile({
  label,
  tone,
  children,
}: {
  label: string;
  tone: keyof typeof TILE_TONES;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative w-[156px] h-[56px] rounded-xl border-2 px-2 py-1.5 flex flex-col items-center justify-center text-center shadow-sm ${TILE_TONES[tone]}`}
    >
      <span className={`text-[11px] font-black leading-none ${tone === "dark" ? "text-slate-300" : "opacity-80"}`}>
        {label}
      </span>
      <div className="w-full mt-1 text-center font-black text-[20px] leading-none cy-num">{children}</div>
    </div>
  );
}

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

const FN_TONES: Record<string, string> = {
  light: "bg-slate-200 text-ink-800 border-slate-300 hover:bg-slate-300",
  orange: "bg-cash-orange text-white border-orange-700 hover:brightness-110",
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
  tone: "light" | "orange" | "save" | "savePrint";
  busy?: boolean;
}) {
  // زرا الحفظ يستخدمان لونين أخضرين من الإعدادات (درجتان مختلفتان)
  const custom =
    tone === "save"
      ? { background: "var(--cy-save)", borderColor: "var(--cy-save)" }
      : tone === "savePrint"
        ? { background: "var(--cy-save-print)", borderColor: "var(--cy-save-print)" }
        : undefined;
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={custom}
      className={`cy-fn ${custom ? "" : "cy-btn"} relative border cy-press cy-focus flex flex-col items-center justify-center gap-0.5 font-black text-[13.5px] shadow-[0_6px_16px_-10px_rgba(15,23,42,0.9)] disabled:opacity-60 hover:brightness-110 ${
        custom ? "text-white" : (FN_TONES[tone] ?? "")
      }`}
    >
      <span className="absolute top-1 right-2 text-[9.5px] font-mono opacity-70">{k}</span>
      {children}
    </button>
  );
}
