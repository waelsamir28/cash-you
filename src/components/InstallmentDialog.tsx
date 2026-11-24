"use client";

import { useState } from "react";
import type { InstallmentInput } from "@/lib/types";
import { money } from "@/lib/format";
import { Modal } from "@/components/Overlays";
import { btnCls, Field, inputCls } from "@/components/ModuleUI";

export function InstallmentDialog({ total, customerName, onClose, onSubmit }: { total: number; customerName: string; onClose: () => void; onSubmit: (v: InstallmentInput) => void }) {
  const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 10); };
  const [downPayment, setDown] = useState(String(Math.round(total * 0.2 * 100) / 100));
  const [interestRate, setRate] = useState("10");
  const [months, setMonths] = useState("6");
  const [firstDueDate, setDate] = useState(nextMonth());
  const [guarantorName, setGuarantor] = useState("");
  const [guarantorPhone, setPhone] = useState("");
  const down = Math.min(total, Math.max(0, Number(downPayment) || 0));
  const financed = Math.max(0, total - down);
  const interest = financed * (Math.max(0, Number(interestRate) || 0)) / 100;
  const count = Math.max(1, Math.min(60, Math.floor(Number(months) || 1)));
  const monthly = (financed + interest) / count;
  return <Modal title="إنشاء تعاقد تقسيط تلقائياً" subtitle={`${customerName} · إجمالي الفاتورة ${money(total)} جنيه`} onClose={onClose} width="max-w-2xl" tone="amber">
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <Field label="المقدم"><input autoFocus type="number" min="0" max={total} value={downPayment} onChange={(e) => setDown(e.target.value)} className={`${inputCls} cy-num`} /></Field>
      <Field label="نسبة الربح %"><input type="number" min="0" value={interestRate} onChange={(e) => setRate(e.target.value)} className={`${inputCls} cy-num`} /></Field>
      <Field label="عدد الأقساط / الشهور"><input type="number" min="1" max="60" value={months} onChange={(e) => setMonths(e.target.value)} className={`${inputCls} cy-num`} /></Field>
      <Field label="تاريخ أول قسط"><input type="date" value={firstDueDate} onChange={(e) => setDate(e.target.value)} className={`${inputCls} cy-num`} /></Field>
      <Field label="اسم الضامن"><input value={guarantorName} onChange={(e) => setGuarantor(e.target.value)} className={inputCls} placeholder="الاسم الثلاثي" /></Field>
      <Field label="تليفون الضامن"><input value={guarantorPhone} onChange={(e) => setPhone(e.target.value)} className={`${inputCls} cy-num`} placeholder="01xxxxxxxxx" /></Field>
    </div>
    <div className="grid grid-cols-3 gap-2 mt-4">
      <div className="rounded-xl bg-paper border border-line p-3"><span className="text-[11px] font-bold text-slate-500">أصل التقسيط</span><div className="font-black cy-num text-[20px]">{money(financed)}</div></div>
      <div className="rounded-xl bg-amber-soft border border-amber-brand p-3"><span className="text-[11px] font-bold text-amber-800">قيمة الربح</span><div className="font-black cy-num text-[20px] text-amber-900">{money(interest)}</div></div>
      <div className="rounded-xl bg-ink-800 p-3 text-white"><span className="text-[11px] font-bold text-slate-400">القسط الشهري</span><div className="font-black cy-num text-[20px] text-amber-brand">{money(monthly)}</div></div>
    </div>
    <p className="mt-3 text-[11.5px] font-bold text-slate-500 leading-relaxed">سيتم إنشاء {count} قسطاً شهرياً بدءاً من {firstDueDate}، وتسجيل المقدم في الخزينة، وإضافة أصل التقسيط والربح إلى رصيد العميل.</p>
    <div className="flex gap-2 mt-4"><button disabled={!firstDueDate || down > total} onClick={() => onSubmit({ downPayment: down, interestRate: Number(interestRate) || 0, months: count, firstDueDate, guarantorName, guarantorPhone })} className={`${btnCls} flex-1 bg-cash-violet text-white`}>حفظ الفاتورة وإنشاء الأقساط</button><button onClick={onClose} className={`${btnCls} bg-slate-200 text-ink-800`}>إلغاء</button></div>
  </Modal>;
}
