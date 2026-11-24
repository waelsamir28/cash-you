"use client";

import type { ReactNode } from "react";
import { IcoPrint, IcoX } from "@/components/icons";
import { money } from "@/lib/format";

export function ModuleShell({ children }: { children: ReactNode }) {
  return <section className="flex-1 min-h-0 overflow-y-auto cy-scroll bg-paper p-2" dir="rtl">{children}</section>;
}

export function ModuleTitle({ title, subtitle, badge, actions }: { title: string; subtitle: string; badge?: string; actions?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-ink-700 border border-black/40 px-4 h-[58px] flex items-center gap-3 shadow-sm">
      <div className="pointer-events-none absolute inset-0 cy-aurora opacity-70" />
      <div className="relative flex-1 min-w-0">
        <h1 className="text-white font-black text-[18px]">{title}</h1>
        <p className="text-slate-300 text-[11.5px] font-semibold truncate">{subtitle}</p>
      </div>
      {badge && <span className="relative rounded-lg bg-amber-soft border border-amber-brand px-3 py-1 text-ink-900 text-[12px] font-black cy-num">{badge}</span>}
      {actions && <div className="relative flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, hint, children, className = "" }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-white border border-line overflow-hidden shadow-sm ${className}`}>
      <div className="h-10 px-3 flex items-center gap-2 bg-paper-2 border-b border-line">
        <span className="w-1.5 h-5 rounded-full bg-amber-brand" />
        <h2 className="text-[13px] font-black text-ink-800">{title}</h2>
        {hint && <span className="mr-auto text-[11px] font-bold text-slate-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`block ${className}`}><span className="block mb-1 text-[11.5px] font-black text-ink-700">{label}</span>{children}</label>;
}

export const inputCls = "w-full h-10 rounded-lg border border-line bg-paper-2 px-2.5 text-[12.5px] font-bold text-ink-900 outline-none focus:border-amber-brand focus:bg-white transition-colors";
export const btnCls = "h-10 px-4 rounded-lg font-black text-[12.5px] cy-press cy-focus disabled:opacity-50 disabled:cursor-not-allowed";

export function MoneyCard({ label, value, tone = "ink", input, onInput }: { label: string; value: number; tone?: "ink" | "amber" | "cream" | "green" | "red"; input?: string; onInput?: (v: string) => void }) {
  const tones = {
    ink: "bg-ink-800 border-black/40 text-white",
    amber: "bg-amber-soft border-amber-brand text-cash-green-deep",
    cream: "bg-amber-cream border-amber-brand/60 text-cash-red",
    green: "bg-emerald-50 border-cash-green text-cash-green-deep",
    red: "bg-red-50 border-cash-red text-cash-red",
  };
  return <div className={`rounded-xl border-2 px-3 py-2 ${tones[tone]}`}><div className="text-[11.5px] font-black opacity-75">{label}</div>{onInput ? <input value={input} onChange={(e) => onInput(e.target.value)} inputMode="decimal" className="w-full bg-transparent outline-none text-[28px] font-black cy-num text-left" /> : <div className="text-[28px] font-black cy-num text-left">{money(value)}</div>}</div>;
}

export function Empty({ text }: { text: string }) {
  return <div className="p-8 text-center text-[13px] font-bold text-slate-500">{text}</div>;
}

export type PrintDoc = {
  title: string;
  number: string;
  party: string;
  date: string;
  amount: number;
  lines?: { label: string; value: string }[];
  notes?: string;
};

export function PrintDocumentModal({ doc, shop, onClose }: { doc: PrintDoc; shop: { name: string; phone: string }; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-ink-950/70 backdrop-blur-sm p-3 cy-no-print" dir="rtl">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-line overflow-hidden cy-pop shadow-2xl">
        <div className="h-12 px-4 bg-ink-800 flex items-center"><h2 className="text-white font-black text-[14px]">معاينة وطباعة المستند</h2><button onClick={onClose} className="mr-auto text-white/70 hover:text-white" aria-label="إغلاق"><IcoX /></button></div>
        <div id="cy-print-area" className="m-4 border border-dashed border-slate-400 p-3 text-[12px] text-black max-h-[55vh] overflow-y-auto cy-scroll">
          <div className="text-center"><div className="font-black text-[17px] tracking-widest">CASH YOU</div><div className="font-bold">{shop.name}</div><div className="cy-num">{shop.phone}</div></div>
          <div className="border-b border-dashed border-slate-400 my-2" />
          <div className="text-center font-black text-[14px]">{doc.title}</div>
          <div className="mt-2 space-y-1 cy-num"><div className="flex justify-between"><span>رقم المستند</span><b>{doc.number}</b></div><div className="flex justify-between"><span>التاريخ</span><b>{doc.date}</b></div><div className="flex justify-between gap-2"><span>الاسم</span><b>{doc.party}</b></div></div>
          {doc.lines && <div className="my-2 border-y border-dashed border-slate-400 py-2 space-y-1">{doc.lines.map((l, i) => <div key={i} className="flex justify-between gap-2"><span>{l.label}</span><b className="cy-num">{l.value}</b></div>)}</div>}
          <div className="flex justify-between text-[17px] font-black mt-3"><span>القيمة</span><span className="cy-num">{money(doc.amount)}</span></div>
          {doc.notes && <p className="mt-2">{doc.notes}</p>}
          <div className="border-t border-dashed border-slate-400 mt-3 pt-2 text-center font-bold">الدعم الفني : م / وائل الجمال<br /><span className="cy-num">01222355769</span></div>
        </div>
        <div className="p-3 pt-0 flex gap-2 cy-no-print"><button onClick={() => window.print()} className={`${btnCls} flex-1 bg-ink-800 text-white flex items-center justify-center gap-2`}><IcoPrint /> طباعة</button><button onClick={onClose} className={`${btnCls} bg-slate-200 text-ink-800`}>إغلاق</button></div>
      </div>
    </div>
  );
}
