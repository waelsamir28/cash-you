"use client";

import { useMemo, useState } from "react";
import type { Bootstrap } from "@/lib/types";
import { money, shortStamp } from "@/lib/format";
import { sfxError, sfxSave } from "@/lib/sound";
import { IcoChart, IcoCheck, IcoPrint, IcoWallet } from "@/components/icons";
import { btnCls, Empty, Field, inputCls, ModuleShell, ModuleTitle, MoneyCard, Panel, PrintDocumentModal, type PrintDoc } from "@/components/ModuleUI";

type Common = { data: Bootstrap; refresh: () => Promise<void>; notify: (kind: "ok" | "err" | "warn" | "info", text: string) => void };
const today = () => new Date().toISOString().slice(0, 10);

export function InstallmentsScreen({ data, refresh, notify }: Common) {
  const [filter, setFilter] = useState<"all" | "due" | "late" | "paid">("all");
  const [query, setQuery] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [doc, setDoc] = useState<PrintDoc | null>(null);
  const now = today();
  const rows = useMemo(() => data.installments.filter((d) => {
    const status = d.status === "مدفوع" ? "paid" : d.dueDate < now ? "late" : d.dueDate === now ? "due" : "future";
    return (filter === "all" || filter === status) && (!query || d.customerName.includes(query) || String(d.invoiceNumber).includes(query));
  }), [data.installments, filter, query, now]);
  const plan = data.installmentPlans.find((p) => p.id === selectedPlan);
  const late = data.installments.filter((d) => d.status !== "مدفوع" && d.dueDate < now).reduce((s, d) => s + d.amount, 0);
  const due = data.installments.filter((d) => d.status !== "مدفوع" && d.dueDate === now).reduce((s, d) => s + d.amount, 0);
  const collected = data.installments.filter((d) => d.status === "مدفوع").reduce((s, d) => s + d.amount, 0);

  const collect = async (id: number) => {
    const d = data.installments.find((x) => x.id === id);
    if (!d || !window.confirm(`تأكيد تحصيل القسط رقم ${d.sequence} بمبلغ ${money(d.amount)} من ${d.customerName}؟`)) return;
    const res = await fetch("/api/installments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const json = await res.json();
    if (!res.ok) { notify("err", json.error); sfxError(); return; }
    await refresh();
    setDoc({ title: "إيصال تحصيل قسط", number: json.reference, party: d.customerName, date: shortStamp(new Date().toISOString()), amount: d.amount, lines: [{ label: "فاتورة التقسيط", value: String(d.invoiceNumber) }, { label: "رقم القسط", value: String(d.sequence) }, { label: "تاريخ الاستحقاق", value: d.dueDate }], notes: "تم إضافة المبلغ إلى الخزينة وخصمه من رصيد العميل" });
    notify("ok", "تم تحصيل القسط وتسجيله في الخزينة"); sfxSave();
  };

  return <ModuleShell>
    <ModuleTitle title="نظام التقسيط وتحصيل الأقساط" subtitle="متابعة الاستحقاقات والضامنين والتحصيل النقدي" badge={`${data.summary.dueInstallments} قسط مستحق`} />
    <div className="grid grid-cols-3 gap-2 mt-2"><MoneyCard label="أقساط متأخرة" value={late} tone="red" /><MoneyCard label="أقساط تستحق اليوم" value={due} tone="amber" /><MoneyCard label="إجمالي المحصل" value={collected} tone="green" /></div>
    <Panel title="جدول الأقساط" hint="الأصفر: اليوم · الأحمر: متأخر · الأخضر: مدفوع" className="mt-2">
      <div className="p-2 flex flex-wrap gap-2 border-b border-line"><input value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputCls} max-w-sm`} placeholder="بحث باسم العميل أو رقم الفاتورة..." /><div className="flex gap-1">{(["all", "late", "due", "paid"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`${btnCls} h-9 ${filter === f ? "bg-ink-800 text-white" : "bg-slate-200 text-ink-700"}`}>{({ all: "الكل", late: "متأخر", due: "اليوم", paid: "مدفوع" })[f]}</button>)}</div></div>
      <div className="overflow-auto cy-scroll max-h-[470px]"><table className="w-full text-[12px]"><thead className="bg-ink-800 text-white sticky top-0"><tr>{["تحصيل", "بيانات التعاقد", "الحالة", "تاريخ السداد", "القيمة", "الاستحقاق", "القسط", "الفاتورة", "العميل"].map((h) => <th key={h} className="px-2 py-2.5 border-l border-white/10 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{rows.map((d) => { const lateRow = d.status !== "مدفوع" && d.dueDate < now; const dueRow = d.status !== "مدفوع" && d.dueDate === now; return <tr key={d.id} className={`border-b ${d.status === "مدفوع" ? "bg-emerald-100" : lateRow ? "bg-red-200 text-red-950" : dueRow ? "bg-amber-soft" : "bg-white"}`}><td className="p-1.5 text-center">{d.status === "مدفوع" ? <span className="text-cash-green-deep font-black inline-flex items-center gap-1"><IcoCheck /> تم</span> : <button onClick={() => void collect(d.id)} className="h-8 px-3 rounded-lg bg-ink-800 text-white font-black text-[11px] cy-press">تحصيل القسط</button>}</td><td className="text-center"><button onClick={() => setSelectedPlan(d.planId)} className="h-8 px-3 rounded-lg bg-cash-violet text-white font-bold text-[11px]">التعاقد والضامن</button></td><td className="text-center font-black">{d.status === "مدفوع" ? "مدفوع" : lateRow ? "متأخر" : dueRow ? "مستحق اليوم" : "قادم"}</td><td className="text-center cy-num">{d.paidAt ? shortStamp(d.paidAt) : "—"}</td><td className="text-center font-black cy-num">{money(d.amount)}</td><td className="text-center cy-num font-bold">{d.dueDate}</td><td className="text-center cy-num">{d.sequence}</td><td className="text-center cy-num">{d.invoiceNumber}</td><td className="px-2 font-bold">{d.customerName}</td></tr>; })}</tbody></table>{!rows.length && <Empty text="لا توجد أقساط في هذا العرض" />}</div>
    </Panel>
    {plan && <div className="fixed inset-0 z-[80] bg-ink-950/70 grid place-items-center p-3" dir="rtl" onClick={(e) => e.target === e.currentTarget && setSelectedPlan(null)}><div className="w-full max-w-lg rounded-2xl bg-white overflow-hidden cy-pop"><div className="bg-ink-800 text-white px-4 py-3 font-black">تعاقد تقسيط فاتورة {plan.invoiceNumber}</div><div className="p-4 grid grid-cols-2 gap-2 text-[12.5px]">{[["العميل", plan.customerName], ["أصل التقسيط", money(plan.principal)], ["المقدم", money(plan.downPayment)], ["نسبة الربح", `${plan.interestRate}% = ${money(plan.interestValue)}`], ["عدد الأقساط", `${plan.months} شهر`], ["القسط الشهري", money(plan.monthlyAmount)], ["أول استحقاق", plan.firstDueDate], ["اسم الضامن", plan.guarantorName || "—"], ["تليفون الضامن", plan.guarantorPhone || "—"]].map(([k, v]) => <div key={k} className="rounded-lg bg-paper px-3 py-2 flex justify-between gap-2"><span className="font-bold text-slate-500">{k}</span><b className="cy-num text-left">{v}</b></div>)}</div><button onClick={() => setSelectedPlan(null)} className={`${btnCls} m-4 mt-0 w-[calc(100%-32px)] bg-ink-800 text-white`}>إغلاق</button></div></div>}
    {doc && <PrintDocumentModal doc={doc} shop={data.shop} onClose={() => setDoc(null)} />}
  </ModuleShell>;
}

export function ExpensesScreen({ data, refresh, notify }: Common) {
  const [category, setCategory] = useState("إيجار");
  const [amount, setAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [doc, setDoc] = useState<PrintDoc | null>(null);
  const save = async () => {
    const res = await fetch("/api/treasury", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, amount: Number(amount), notes }) });
    const json = await res.json();
    if (!res.ok) { notify("err", json.error); sfxError(); return; }
    setDoc({ title: "سند مصروفات", number: String(json.number), party: category, date: shortStamp(new Date().toISOString()), amount: Number(amount), notes });
    setAmount("0"); setNotes(""); await refresh(); notify("ok", "تم تسجيل المصروف وخصمه من الخزينة"); sfxSave();
  };
  const totals = data.expenses.reduce<Record<string, number>>((a, e) => ({ ...a, [e.category]: (a[e.category] ?? 0) + e.amount }), {});
  return <ModuleShell><ModuleTitle title="المصروفات اليومية" subtitle="تسجيل الإيجار والكهرباء والرواتب والنثريات مع الخصم الفوري من الخزينة" badge={`اليوم ${money(data.summary.todayExpenses)}`} />
    <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-2 mt-2 items-start"><Panel title="تسجيل مصروف جديد"><div className="p-3 space-y-3"><Field label="نوع المصروف"><select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>{["إيجار", "كهرباء", "رواتب", "نثريات", "صيانة", "مواصلات", "أخرى"].map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="القيمة"><input autoFocus type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} text-[22px] cy-num`} /></Field><Field label="البيان"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} h-20 py-2`} placeholder="تفاصيل المصروف" /></Field><button onClick={() => void save()} className={`${btnCls} w-full bg-cash-red text-white`}>حفظ وصرف من الخزينة</button><div className="pt-2 border-t border-line"><h3 className="font-black text-[12px] mb-2">إجمالي حسب النوع</h3>{Object.entries(totals).map(([k, v]) => <div key={k} className="flex justify-between py-1 text-[12px]"><span>{k}</span><b className="cy-num text-cash-red">{money(v)}</b></div>)}</div></div></Panel>
      <Panel title="سجل المصروفات" hint={`${data.expenses.length} سند`}><div className="overflow-auto cy-scroll max-h-[560px]"><table className="w-full text-[12px]"><thead className="bg-ink-800 text-white sticky top-0"><tr>{["التاريخ", "البيان", "القيمة", "النوع", "الرقم"].map((h) => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr></thead><tbody>{data.expenses.map((e, i) => <tr key={e.id} className={`${i % 2 ? "bg-paper-2" : "bg-white"} border-b border-slate-200`}><td className="text-center py-2 cy-num">{shortStamp(e.createdAt)}</td><td className="px-3">{e.notes || "—"}</td><td className="text-center font-black text-cash-red cy-num">{money(e.amount)}</td><td className="text-center font-bold">{e.category}</td><td className="text-center cy-num">{e.number}</td></tr>)}</tbody></table></div></Panel></div>
    {doc && <PrintDocumentModal doc={doc} shop={data.shop} onClose={() => setDoc(null)} />}
  </ModuleShell>;
}

export function TreasuryScreen({ data, refresh, notify }: Common) {
  const [direction, setDirection] = useState("الكل");
  const [query, setQuery] = useState("");
  const [closing, setClosing] = useState(false);
  const [doc, setDoc] = useState<PrintDoc | null>(null);
  const rows = data.treasury.filter((m) => (direction === "الكل" || m.direction === direction) && (!query || m.source.includes(query) || m.partyName.includes(query) || m.reference.includes(query)));
  const incoming = rows.filter((m) => m.direction === "وارد").reduce((s, m) => s + m.amount, 0);
  const outgoing = rows.filter((m) => m.direction === "منصرف").reduce((s, m) => s + m.amount, 0);
  const open = data.shifts.find((s) => s.status === "مفتوحة");
  const close = async () => {
    if (!window.confirm("سيتم إغلاق الوردية الحالية وفتح وردية جديدة بالرصيد الختامي. هل تريد المتابعة؟")) return;
    setClosing(true);
    const res = await fetch("/api/treasury", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "closeShift", notes: "إغلاق ومراجعة درج النقدية" }) });
    const json = await res.json(); setClosing(false);
    if (!res.ok) { notify("err", json.error); return; }
    await refresh(); setDoc({ title: "تقرير إغلاق وردية", number: String(json.number), party: "م. وائل الجمال", date: shortStamp(new Date().toISOString()), amount: json.closingCash, lines: [
      { label: "الرصيد الافتتاحي", value: money(json.openingCash) },
      { label: "تحصيل المبيعات", value: money(json.sales) },
      { label: "سندات القبض والأقساط", value: money(json.receipts) },
      { label: "المدفوع للمشتريات", value: money(json.purchases) },
      { label: "المصروفات", value: money(json.expenses) },
      { label: "سندات الصرف", value: money(json.payments) },
      { label: "إجمالي الوارد", value: money(json.incoming) },
      { label: "إجمالي المنصرف", value: money(json.outgoing) },
    ], notes: `الرصيد الختامي تم ترحيله كرصيد افتتاحي للوردية ${json.nextNumber}` }); notify("ok", `تم إغلاق الوردية وفتح الوردية ${json.nextNumber}`); sfxSave();
  };
  return <ModuleShell><ModuleTitle title="حركة الخزينة وإغلاق الوردية" subtitle="كل حركة وارد ومنصرف موثقة بالمصدر ورقم المستند" badge={`الرصيد ${money(data.summary.treasury)}`} actions={<button disabled={closing || !open} onClick={() => void close()} className={`${btnCls} bg-cash-orange text-white`}>إغلاق الوردية {open?.number ?? ""}</button>} />
    <div className="grid grid-cols-3 gap-2 mt-2"><MoneyCard label="إجمالي الوارد" value={incoming} tone="green" /><MoneyCard label="إجمالي المنصرف" value={outgoing} tone="red" /><MoneyCard label="صافي الحركة المعروضة" value={incoming - outgoing} /></div>
    <Panel title="سجل حركة النقدية" hint={open ? `الوردية ${open.number} مفتوحة منذ ${shortStamp(open.openedAt)} · رصيد افتتاحي ${money(open.openingCash)}` : "لا توجد وردية مفتوحة"} className="mt-2"><div className="p-2 flex flex-wrap gap-2 border-b border-line"><input value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputCls} max-w-sm`} placeholder="بحث بالمصدر أو الاسم أو المرجع..." />{["الكل", "وارد", "منصرف"].map((d) => <button key={d} onClick={() => setDirection(d)} className={`${btnCls} h-9 ${direction === d ? "bg-ink-800 text-white" : "bg-slate-200"}`}>{d}</button>)}</div><div className="overflow-auto cy-scroll max-h-[460px]"><table className="w-full text-[12px]"><thead className="bg-ink-800 text-white sticky top-0"><tr>{["التاريخ", "الاسم", "المرجع", "المبلغ", "الاتجاه", "المصدر"].map((h) => <th key={h} className="px-3 py-2.5">{h}</th>)}</tr></thead><tbody>{rows.map((m, i) => <tr key={m.id} className={`${i % 2 ? "bg-paper-2" : "bg-white"} border-b border-slate-200`}><td className="text-center py-2 cy-num">{shortStamp(m.createdAt)}</td><td className="px-3 font-bold">{m.partyName || "—"}</td><td className="text-center cy-num">{m.reference}</td><td className={`text-center font-black cy-num ${m.direction === "وارد" ? "text-cash-green-deep" : "text-cash-red"}`}>{m.direction === "وارد" ? "+" : "−"}{money(m.amount)}</td><td className="text-center"><span className={`px-2 py-1 rounded-full text-[10.5px] font-black ${m.direction === "وارد" ? "bg-emerald-100 text-cash-green-deep" : "bg-red-100 text-cash-red"}`}>{m.direction}</span></td><td className="text-center font-bold">{m.source}</td></tr>)}</tbody></table>{!rows.length && <Empty text="لا توجد حركات مطابقة" />}</div></Panel>
    <Panel title="الورديات السابقة" className="mt-2"><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 p-2">{data.shifts.map((s) => <div key={s.id} className={`rounded-xl border p-3 ${s.status === "مفتوحة" ? "border-cash-green bg-emerald-50" : "border-line bg-paper-2"}`}><div className="flex justify-between font-black"><span>وردية {s.number}</span><span className={s.status === "مفتوحة" ? "text-cash-green-deep" : "text-slate-500"}>{s.status}</span></div><div className="text-[11px] text-slate-500 mt-1 cy-num">{shortStamp(s.openedAt)}</div><div className="flex justify-between mt-2 text-[12px]"><span>افتتاحي {money(s.openingCash)}</span><b className="cy-num">ختامي {money(s.status === "مغلقة" ? s.closingCash : data.summary.treasury)}</b></div></div>)}</div></Panel>
    {doc && <PrintDocumentModal doc={doc} shop={data.shop} onClose={() => setDoc(null)} />}
  </ModuleShell>;
}

export function ReportsScreen({ data }: { data: Bootstrap }) {
  const sales = data.invoices.reduce((s, i) => s + i.total, 0);
  const purchases = data.purchases.reduce((s, p) => s + p.total, 0);
  const expenses = data.expenses.reduce((s, e) => s + e.amount, 0);
  const salesReturns = data.returns.filter((r) => r.kind === "مرتجع مبيعات").reduce((s, r) => s + r.total, 0);
  const net = sales - purchases - expenses - salesReturns;
  return <ModuleShell><ModuleTitle title="التقارير والأرباح" subtitle="تحليل المبيعات والمشتريات والمصروفات وصافي النتيجة" badge={`${data.invoices.length} فاتورة`} />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2"><MoneyCard label="إجمالي المبيعات" value={sales} tone="green" /><MoneyCard label="إجمالي المشتريات" value={purchases} /><MoneyCard label="المصروفات" value={expenses} tone="red" /><MoneyCard label="صافي النتيجة" value={net} tone={net >= 0 ? "amber" : "cream"} /></div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2"><Panel title="ملخص الأرباح" hint="تقديري حسب متوسط أسعار الشراء الحالية"><div className="p-4 space-y-3">{[["مجمل ربح المبيعات", data.summary.grossProfit], ["مرتجعات المبيعات", -salesReturns], ["المصروفات التشغيلية", -expenses], ["صافي الربح التقديري", data.summary.grossProfit - salesReturns - expenses]].map(([k, v], i) => <div key={String(k)} className={`flex justify-between items-center rounded-xl px-4 py-3 ${i === 3 ? "bg-ink-800 text-white" : "bg-paper-2"}`}><span className="font-bold">{k}</span><b className={`cy-num text-[18px] ${Number(v) < 0 ? "text-cash-red" : i === 3 ? "text-amber-brand" : "text-cash-green-deep"}`}>{money(Number(v))}</b></div>)}</div></Panel><Panel title="توزيع التحصيل" hint="حسب طريقة السداد"><div className="p-4 space-y-3">{data.paymentMethods.map((m) => { const value = data.invoices.filter((i) => i.paymentMethod === m.name).reduce((s, i) => s + i.paid, 0); const pct = sales ? Math.min(100, value / sales * 100) : 0; return <div key={m.id}><div className="flex justify-between text-[12px] font-bold mb-1"><span>{m.name}</span><b className="cy-num">{money(value)}</b></div><div className="h-2.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-l from-cash-cyan to-cash-violet" style={{ width: `${pct}%` }} /></div></div>; })}</div></Panel></div>
    <Panel title="تقرير المبيعات التفصيلي" className="mt-2"><div className="overflow-auto cy-scroll max-h-[330px]"><table className="w-full text-[12px]"><thead className="bg-ink-800 text-white sticky top-0"><tr>{["التاريخ", "المتبقي", "المدفوع", "الإجمالي", "النوع", "العميل", "الفاتورة"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead><tbody>{data.invoices.map((i, n) => <tr key={i.id} className={`${n % 2 ? "bg-paper-2" : "bg-white"} border-b`}><td className="text-center py-2 cy-num">{shortStamp(i.createdAt)}</td><td className="text-center text-cash-red cy-num">{money(i.remaining)}</td><td className="text-center cy-num">{money(i.paid)}</td><td className="text-center font-black cy-num">{money(i.total)}</td><td className="text-center">{i.saleType}</td><td className="px-3 font-bold">{i.customerName}</td><td className="text-center cy-num">{i.number}</td></tr>)}</tbody></table></div></Panel>
  </ModuleShell>;
}
