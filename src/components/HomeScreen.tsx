"use client";

import { useMemo } from "react";
import type { Bootstrap, InvoiceRow, ModuleKind } from "@/lib/types";
import { money, qtyText, shortStamp } from "@/lib/format";
import { IcoBox, IcoCart, IcoChart, IcoUsers, IcoWallet } from "@/components/icons";

const QUICK: { kind: ModuleKind; title: string; hint: string; color: string; icon: React.ReactNode }[] = [
  { kind: "invoice", title: "فاتورة مبيعات", hint: "بيع سريع بالباركود", color: "bg-gradient-to-bl from-amber-400 to-orange-600 text-ink-950 border-amber-700/30", icon: <IcoCart /> },
  { kind: "salesReturn", title: "مرتجع مبيعات", hint: "عكس المخزون والحساب", color: "bg-gradient-to-bl from-orange-400 to-red-500 text-white border-red-700/30", icon: <IcoCart /> },
  { kind: "purchase", title: "فاتورة مشتريات", hint: "توريد من الموردين", color: "bg-gradient-to-bl from-cyan-400 to-cyan-700 text-white border-cyan-800/30", icon: <IcoBox /> },
  { kind: "purchaseReturn", title: "مرتجع مشتريات", hint: "تسوية حساب المورد", color: "bg-gradient-to-bl from-violet-400 to-violet-700 text-white border-violet-800/30", icon: <IcoBox /> },
  { kind: "products", title: "الأصناف والمخازن", hint: "الأسعار وحدود المخزون", color: "bg-gradient-to-bl from-emerald-400 to-emerald-700 text-white border-emerald-800/30", icon: <IcoBox /> },
  { kind: "parties", title: "العملاء", hint: "كشوف حساب وسندات قبض", color: "bg-gradient-to-bl from-blue-400 to-blue-700 text-white border-blue-800/30", icon: <IcoUsers /> },
  { kind: "parties", title: "الموردون", hint: "أرصدة وسندات صرف", color: "bg-gradient-to-bl from-indigo-400 to-indigo-700 text-white border-indigo-800/30", icon: <IcoUsers /> },
  { kind: "inventory", title: "الجرد", hint: "مطابقة الرصيد الفعلي", color: "bg-gradient-to-bl from-lime-400 to-green-700 text-white border-green-800/30", icon: <IcoBox /> },
  { kind: "installments", title: "نظام التقسيط", hint: "الاستحقاقات والتحصيل", color: "bg-gradient-to-bl from-fuchsia-400 to-fuchsia-700 text-white border-fuchsia-800/30", icon: <IcoWallet /> },
  { kind: "expenses", title: "المصروفات", hint: "إيجار وكهرباء ورواتب", color: "bg-gradient-to-bl from-rose-400 to-rose-700 text-white border-rose-800/30", icon: <IcoWallet /> },
  { kind: "treasury", title: "الخزينة", hint: "وارد ومنصرف ووردية", color: "bg-gradient-to-bl from-teal-400 to-teal-700 text-white border-teal-800/30", icon: <IcoWallet /> },
  { kind: "reports", title: "التقارير والأرباح", hint: "تحليل النتائج والتحصيل", color: "bg-gradient-to-bl from-slate-500 to-ink-900 text-white border-black/30", icon: <IcoChart /> },
];

export function HomeScreen({
  data,
  onNewInvoice,
  onOpenInvoice,
  onOpenModule,
  canOpen,
}: {
  data: Bootstrap;
  onNewInvoice: () => void;
  onOpenInvoice: (i: InvoiceRow) => void;
  onOpenModule: (kind: ModuleKind, title: string) => void;
  canOpen?: (kind: ModuleKind) => boolean;
}) {
  const stats = useMemo(() => {
    const total = data.invoices.reduce((s, i) => s + i.total, 0);
    const paid = data.invoices.reduce((s, i) => s + i.paid, 0);
    const due = data.invoices.reduce((s, i) => s + Math.max(0, i.remaining), 0);
    const count = data.invoices.length;
    return {
      total,
      paid,
      due,
      count,
      avg: count ? total / count : 0,
      cash: data.invoices.filter((i) => i.saleType === "نقدي").reduce((s, i) => s + i.total, 0),
    };
  }, [data.invoices]);

  const chart = useMemo(() => {
    const recent = [...data.invoices].slice(0, 12).reverse();
    const max = Math.max(1, ...recent.map((i) => i.total));
    return recent.map((i) => ({ ...i, h: Math.max(6, Math.round((i.total / max) * 100)) }));
  }, [data.invoices]);

  const lowStock = useMemo(
    () => [...data.products].sort((a, b) => a.stock - b.stock).slice(0, 6),
    [data.products],
  );

  const topDebtors = useMemo(
    () => data.customers.filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5),
    [data.customers],
  );

  return (
    <section className="flex-1 min-h-0 overflow-y-auto cy-scroll bg-paper p-2.5" dir="rtl">
      <div className="relative overflow-hidden rounded-2xl cy-mesh cy-grain border border-black/40 px-4 py-4 sm:px-6 sm:py-5">
        <div className="pointer-events-none absolute inset-0 cy-aurora opacity-90" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[240px]">
            <h1 className="text-white font-black text-[22px] sm:text-[28px] leading-tight">
              لوحة تحكم <span className="text-amber-brand">كاش يو</span>
            </h1>
            <p className="text-slate-300 text-[13px] font-bold mt-1">
              {data.shop.name} — نظام مبيعات ونقاط بيع متكامل بقاعدة بيانات محلية
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                onClick={onNewInvoice}
                className="h-10 px-4 rounded-xl bg-amber-brand text-ink-900 font-black cy-press hover:brightness-110 flex items-center gap-2 shadow-lg"
              >
                <IcoCart className="w-4 h-4" />
                فاتورة بيع سريع (F4)
              </button>
              <span className="h-10 px-4 rounded-xl bg-white/10 border border-white/15 text-slate-200 font-bold text-[12.5px] flex items-center gap-2">
                <IcoBox className="w-4 h-4 text-cash-cyan" />
                {data.products.length} صنف · {data.categories.length} تصنيف
              </span>
              <span className="h-10 px-4 rounded-xl bg-white/10 border border-white/15 text-slate-200 font-bold text-[12.5px] flex items-center gap-2">
                <IcoUsers className="w-4 h-4 text-cash-violet" />
                {data.customers.length} عميل
              </span>
            </div>
          </div>
          <div className="shrink-0 text-left">
            <div className="text-[11.5px] font-bold text-slate-400">إجمالي المبيعات المسجلة</div>
            <div className="text-white font-black text-[34px] sm:text-[42px] leading-none cy-num">
              {money(stats.total)}
            </div>
            <div className="text-[11.5px] font-bold text-cash-green mt-1">
              محصّل {money(stats.paid)} · متبقٍ {money(stats.due)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2.5">
        <Kpi label="مبيعات اليوم" value={money(data.summary.todaySales)} hint={`${data.invoices.length} فاتورة مسجلة`} tone="cyan" />
        <Kpi label="مشتريات اليوم" value={money(data.summary.todayPurchases)} hint="إجمالي فواتير التوريد" tone="ink" />
        <Kpi label="مصروفات اليوم" value={money(data.summary.todayExpenses)} hint="مخصومة من الخزينة" tone="red" />
        <Kpi label="صافي نقدية الخزينة" value={money(data.summary.treasury)} hint="وارد ناقص منصرف" tone="green" />
      </div>

      <div className="mt-2.5 rounded-2xl bg-white border border-line p-2.5 shadow-sm">
        <div className="flex items-center gap-2 px-1 pb-2.5">
          <span className="w-1.5 h-5 rounded-full bg-amber-brand" />
          <h2 className="text-[13px] font-black text-ink-800">الوصول السريع لجميع الوحدات</h2>
          <span className="mr-auto text-[11px] font-bold text-slate-500">افتح أي وحدة في تبويب مستقل</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
          {QUICK.filter((q) => !canOpen || canOpen(q.kind)).map((q) => (
            <button key={q.title} onClick={() => q.kind === "invoice" ? onNewInvoice() : onOpenModule(q.kind, q.title)} className={`group relative overflow-hidden rounded-xl border p-3 text-right min-h-[94px] cy-press cy-focus ${q.color}`}>
              <span className="absolute -left-5 -bottom-7 w-20 h-20 rounded-full bg-white/10 group-hover:scale-125 transition-transform" />
              <span className="relative w-9 h-9 rounded-lg bg-white/20 grid place-items-center mb-2">{q.icon}</span>
              <span className="relative block text-[12.5px] font-black leading-tight">{q.title}</span>
              <span className="relative block text-[10px] font-semibold opacity-75 mt-1">{q.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_1fr] gap-2.5 mt-2.5">
        {/* الفواتير الأخيرة */}
        <div className="rounded-2xl bg-white border border-line overflow-hidden shadow-sm">
          <Head title="آخر الفواتير" hint="اضغط على الفاتورة لعرض تفاصيلها" />
          <div className="grid grid-cols-[70px_1fr_96px_100px_100px_96px] bg-ink-800 text-white text-[11.5px] font-black">
            {["الرقم", "العميل", "النوع", "الإجمالي", "المدفوع", "التاريخ"].map((h) => (
              <div key={h} className="px-2 py-2 text-center border-l border-white/10 last:border-l-0">
                {h}
              </div>
            ))}
          </div>
          <div className="max-h-[320px] overflow-y-auto cy-scroll">
            {data.invoices.length === 0 ? (
              <p className="p-6 text-center text-[13px] text-slate-500 font-bold">
                لا توجد فواتير مسجلة بعد
              </p>
            ) : (
              data.invoices.map((i, idx) => (
                <button
                  key={i.id}
                  onClick={() => onOpenInvoice(i)}
                  className={`w-full grid grid-cols-[70px_1fr_96px_100px_100px_96px] text-[12.5px] border-b border-slate-200 text-right hover:bg-amber-50 transition-colors ${
                    idx % 2 ? "bg-paper-2" : "bg-white"
                  }`}
                >
                  <span className="px-2 py-2 text-center font-mono font-black text-amber-800">
                    {i.number}
                  </span>
                  <span className="px-2 py-2 font-bold text-ink-800 truncate">{i.customerName}</span>
                  <span className="px-2 py-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-black ${
                        i.saleType === "نقدي"
                          ? "bg-emerald-100 text-cash-green-deep"
                          : "bg-orange-100 text-cash-orange"
                      }`}
                    >
                      {i.saleType}
                    </span>
                  </span>
                  <span className="px-2 py-2 text-center font-black text-ink-900 cy-num">
                    {money(i.total)}
                  </span>
                  <span
                    className={`px-2 py-2 text-center font-bold cy-num ${
                      i.remaining > 0 ? "text-cash-red" : "text-cash-green-deep"
                    }`}
                  >
                    {money(i.paid)}
                  </span>
                  <span className="px-2 py-2 text-center text-slate-500 cy-num text-[11.5px]">
                    {shortStamp(i.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {/* رسم بياني */}
          <div className="rounded-2xl bg-white border border-line overflow-hidden shadow-sm">
            <Head title="حركة المبيعات" hint="آخر 12 فاتورة" icon={<IcoChart className="w-4 h-4" />} />
            <div className="p-3 flex items-end gap-1.5 h-[150px]">
              {chart.length === 0 ? (
                <p className="w-full text-center text-[12.5px] text-slate-500 font-bold">
                  لا توجد بيانات
                </p>
              ) : (
                chart.map((c) => (
                  <div key={c.id} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-[9.5px] font-black text-ink-700 opacity-0 group-hover:opacity-100 cy-num transition-opacity">
                      {money(c.total)}
                    </span>
                    <div
                      title={`فاتورة ${c.number} — ${money(c.total)}`}
                      className="w-full rounded-t-md transition-all duration-300 hover:brightness-110"
                      style={{
                        height: `${c.h}%`,
                        background:
                          c.remaining > 0
                            ? "linear-gradient(180deg,#f97316,#c2410c)"
                            : "linear-gradient(180deg,#22d3ee,#0e7490)",
                      }}
                    />
                    <span className="text-[9px] font-mono text-slate-400">{c.number}</span>
                  </div>
                ))
              )}
            </div>
            <div className="px-3 pb-2.5 flex items-center gap-3 text-[10.5px] font-bold text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-cash-cyan" /> مسددة
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-cash-orange" /> بها متبقٍ
              </span>
            </div>
          </div>

          {/* مخزون منخفض */}
          <div className="rounded-2xl bg-white border border-line overflow-hidden shadow-sm">
            <Head title="أصناف قاربت على النفاد" hint="أقل 6 أصناف رصيداً" icon={<IcoBox className="w-4 h-4" />} />
            <div className="p-2 space-y-1">
              {lowStock.map((p) => {
                const pct = Math.min(100, (p.stock / 60) * 100);
                return (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="w-[42%] truncate text-[12px] font-bold text-ink-800">{p.name}</span>
                    <span className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.max(4, pct)}%`,
                          background:
                            p.stock < 20
                              ? "linear-gradient(90deg,#ef4444,#b91c1c)"
                              : "linear-gradient(90deg,#f59e0b,#b45309)",
                        }}
                      />
                    </span>
                    <span className="w-10 text-left text-[11.5px] font-black text-ink-700 cy-num">
                      {qtyText(p.stock)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* مديونية */}
          <div className="rounded-2xl bg-white border border-line overflow-hidden shadow-sm">
            <Head title="أرصدة العملاء" hint="أعلى 5 مديونيات" icon={<IcoWallet className="w-4 h-4" />} />
            <div className="p-2 space-y-1">
              {topDebtors.length === 0 ? (
                <p className="p-3 text-center text-[12.5px] text-slate-500 font-bold">
                  لا توجد مديونيات على العملاء
                </p>
              ) : (
                topDebtors.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 rounded-lg bg-paper px-2.5 py-1.5"
                  >
                    <span className="w-6 h-6 rounded-full bg-cash-violet/15 text-cash-violet grid place-items-center text-[11px] font-black">
                      {c.name.slice(0, 1)}
                    </span>
                    <span className="flex-1 truncate text-[12px] font-bold text-ink-800">{c.name}</span>
                    <span className="text-[12.5px] font-black text-cash-red cy-num">
                      {money(c.balance)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Head({
  title,
  hint,
  icon,
}: {
  title: string;
  hint: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3 h-10 bg-paper border-b border-line">
      {icon && <span className="text-ink-600">{icon}</span>}
      <span className="text-[12.5px] font-black text-ink-800">{title}</span>
      <span className="mr-auto text-[11px] font-bold text-slate-500">{hint}</span>
    </div>
  );
}

const KPI_TONES = {
  ink: "from-ink-800 to-ink-900 text-white border-black/40",
  cyan: "from-cyan-500 to-cyan-700 text-white border-cyan-800/40",
  green: "from-emerald-500 to-emerald-700 text-white border-emerald-900/40",
  red: "from-cash-red to-red-700 text-white border-red-900/40",
} as const;

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: keyof typeof KPI_TONES;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-bl px-3.5 py-3 shadow-[0_10px_24px_-16px_rgba(2,6,23,0.9)] ${KPI_TONES[tone]}`}
    >
      <div className="pointer-events-none absolute -top-8 -left-8 w-24 h-24 rounded-full bg-white/10" />
      <div className="relative text-[11.5px] font-black opacity-80">{label}</div>
      <div className="relative text-[24px] font-black cy-num leading-tight mt-0.5">{value}</div>
      <div className="relative text-[10.5px] font-bold opacity-70">{hint}</div>
    </div>
  );
}