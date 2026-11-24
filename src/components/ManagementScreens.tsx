"use client";

import { apiFetch } from "@/lib/offline-sync";
import { useMemo, useState } from "react";
import type { Bootstrap, Party, Product } from "@/lib/types";
import { money, qtyText, shortStamp, uid } from "@/lib/format";
import { sfxAdd, sfxError, sfxSave } from "@/lib/sound";
import { IcoBarcode, IcoCheck, IcoPlus, IcoSearch, IcoTrash, IcoWallet } from "@/components/icons";
import { btnCls, Empty, Field, inputCls, ModuleShell, ModuleTitle, Panel, PrintDocumentModal, type PrintDoc } from "@/components/ModuleUI";

type Common = { data: Bootstrap; refresh: () => Promise<void>; notify: (kind: "ok" | "err" | "warn" | "info", text: string) => void };

const blankProduct = (data: Bootstrap): Omit<Product, "id" | "sortOrder"> & { id?: number } => ({
  code: "", name: "", categoryId: data.categories[0]?.id ?? 1, unit: "قطعة",
  price: 0, wholesalePrice: 0, cost: 0, stock: 0, minStockLimit: 5,
});

export function ProductsScreen({ data, refresh, notify }: Common) {
  const [form, setForm] = useState(blankProduct(data));
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const rows = useMemo(() => data.products.filter((p) => (!query || p.name.includes(query) || p.code.includes(query)) && (!lowOnly || p.stock <= p.minStockLimit)), [data.products, query, lowOnly]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/products", { method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await refresh();
      notify("ok", form.id ? "تم تعديل بيانات الصنف بنجاح" : "تمت إضافة الصنف إلى المخزن");
      setForm(blankProduct(data));
      sfxSave();
    } catch (e) { sfxError(); notify("err", e instanceof Error ? e.message : "تعذر حفظ الصنف"); }
    finally { setBusy(false); }
  };

  const remove = async (p: Product) => {
    if (!window.confirm(`هل تريد حذف الصنف «${p.name}» نهائياً؟`)) return;
    const res = await apiFetch("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) });
    if (!res.ok) { notify("err", "تعذر حذف الصنف"); return; }
    await refresh(); notify("warn", `تم حذف الصنف «${p.name}»`);
  };

  return <ModuleShell>
    <ModuleTitle title="الأصناف والمخازن" subtitle="إدارة الأصناف والأسعار والأرصدة وحدود الطلب" badge={`${data.products.length} صنف`} />
    <div className="grid grid-cols-1 xl:grid-cols-[390px_1fr] gap-2 mt-2 items-start">
      <Panel title={form.id ? "تعديل بيانات الصنف" : "إضافة صنف جديد"} hint="كل الحقول بالجنيه المصري">
        <div className="p-3 grid grid-cols-2 gap-2.5">
          <Field label="الباركود" className="col-span-2"><div className="flex gap-1.5"><input value={form.code} onChange={(e) => set("code", e.target.value)} className={`${inputCls} font-mono`} placeholder="أدخل أو امسح الباركود" /><button onClick={() => { set("code", `62${Date.now().toString().slice(-9)}`); sfxAdd(); }} className={`${btnCls} shrink-0 bg-amber-brand text-ink-900 flex items-center gap-1`}><IcoBarcode /> توليد</button></div></Field>
          <Field label="اسم الصنف" className="col-span-2"><input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="مثال: قلم جاف أزرق" /></Field>
          <Field label="التصنيف"><select value={form.categoryId} onChange={(e) => set("categoryId", Number(e.target.value))} className={inputCls}>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="الوحدة"><select value={form.unit} onChange={(e) => set("unit", e.target.value)} className={inputCls}>{["قطعة", "علبة", "كرتونة"].map((u) => <option key={u}>{u}</option>)}</select></Field>
          <Field label="سعر الشراء"><input type="number" min="0" value={form.cost} onChange={(e) => set("cost", Number(e.target.value))} className={`${inputCls} cy-num`} /></Field>
          <Field label="سعر البيع قطاعي"><input type="number" min="0" value={form.price} onChange={(e) => set("price", Number(e.target.value))} className={`${inputCls} cy-num`} /></Field>
          <Field label="سعر البيع جملة"><input type="number" min="0" value={form.wholesalePrice} onChange={(e) => set("wholesalePrice", Number(e.target.value))} className={`${inputCls} cy-num`} /></Field>
          <Field label="الرصيد الحالي"><input type="number" value={form.stock} onChange={(e) => set("stock", Number(e.target.value))} className={`${inputCls} cy-num`} /></Field>
          <Field label="حد تنبيه المخزون" className="col-span-2"><input type="number" min="0" value={form.minStockLimit} onChange={(e) => set("minStockLimit", Number(e.target.value))} className={`${inputCls} cy-num border-cash-red/40`} /></Field>
          <div className="col-span-2 flex gap-2 mt-1"><button disabled={busy} onClick={() => void save()} className={`${btnCls} flex-1 bg-cash-green text-white flex items-center justify-center gap-2`}><IcoCheck /> {form.id ? "حفظ التعديلات" : "إضافة الصنف"}</button>{form.id && <button onClick={() => setForm(blankProduct(data))} className={`${btnCls} bg-slate-200 text-ink-800`}>إلغاء</button>}</div>
        </div>
      </Panel>
      <Panel title="سجل الأصناف" hint={`${rows.length} نتيجة · الأحمر يعني رصيداً أقل من أو يساوي حد التنبيه`}>
        <div className="p-2 flex flex-wrap gap-2 border-b border-line"><label className="flex-1 min-w-[200px] h-9 rounded-lg border border-line px-2.5 flex items-center gap-2"><IcoSearch className="text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="بحث بالاسم أو الباركود..." className="flex-1 outline-none text-[12.5px] bg-transparent" /></label><button onClick={() => setLowOnly(!lowOnly)} className={`${btnCls} h-9 ${lowOnly ? "bg-cash-red text-white" : "bg-slate-200 text-ink-700"}`}>المخزون المنخفض فقط</button></div>
        <div className="overflow-auto cy-scroll max-h-[620px]"><table className="w-full text-[11.5px] border-collapse"><thead className="sticky top-0 bg-ink-800 text-white z-10"><tr>{["إجراءات", "الرصيد", "الحد", "جملة", "قطاعي", "شراء", "الوحدة", "التصنيف", "اسم الصنف", "الباركود"].map((h) => <th key={h} className="px-2 py-2.5 border-l border-white/10 whitespace-nowrap">{h}</th>)}</tr></thead><tbody>{rows.map((p, i) => { const low = p.stock <= p.minStockLimit; return <tr key={p.id} className={`${low ? "bg-red-100 text-red-900" : i % 2 ? "bg-paper-2" : "bg-white"} border-b border-slate-200 hover:brightness-95`}><td className="px-2 py-1.5 whitespace-nowrap"><button onClick={() => setForm({ ...p })} className="h-7 px-2 rounded bg-ink-700 text-white font-bold ml-1">تعديل</button><button onClick={() => void remove(p)} className="h-7 w-7 rounded bg-cash-red text-white inline-grid place-items-center" aria-label="حذف"><IcoTrash className="w-3.5 h-3.5" /></button></td><td className="text-center font-black cy-num">{qtyText(p.stock)}</td><td className="text-center cy-num">{qtyText(p.minStockLimit)}</td><td className="text-center cy-num">{money(p.wholesalePrice)}</td><td className="text-center font-bold cy-num">{money(p.price)}</td><td className="text-center cy-num">{money(p.cost)}</td><td className="text-center">{p.unit}</td><td className="text-center">{data.categories.find((c) => c.id === p.categoryId)?.name ?? "—"}</td><td className="px-2 font-bold">{p.name}</td><td className="text-center font-mono text-amber-800">{p.code}</td></tr>; })}</tbody></table>{!rows.length && <Empty text="لا توجد أصناف مطابقة للبحث" />}</div>
      </Panel>
    </div>
  </ModuleShell>;
}

const blankParty: Omit<Party, "id"> & { id?: number } = { name: "", phone: "", address: "", openingBalance: 0, balance: 0 };

export function PartiesScreen({ data, refresh, notify, initialKind = "customer" }: Common & { initialKind?: "customer" | "supplier" }) {
  const [kind, setKind] = useState<"customer" | "supplier">(initialKind);
  const [form, setForm] = useState(blankParty);
  const [query, setQuery] = useState("");
  const [voucher, setVoucher] = useState<Party | null>(null);
  const [amount, setAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [doc, setDoc] = useState<PrintDoc | null>(null);
  const parties = kind === "customer" ? data.customers : data.suppliers;
  const rows = parties.filter((p) => !query || p.name.includes(query) || p.phone.includes(query));
  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const res = await apiFetch("/api/parties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, kind }) });
    const json = await res.json();
    if (!res.ok) { notify("err", json.error); return; }
    await refresh(); setForm(blankParty); notify("ok", "تم حفظ البيانات والرصيد بنجاح"); sfxSave();
  };

  const saveVoucher = async () => {
    if (!voucher) return;
    const res = await apiFetch("/api/vouchers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: kind === "customer" ? "receipt" : "payment", partyId: voucher.id, amount: Number(amount), notes }) });
    const json = await res.json();
    if (!res.ok) { notify("err", json.error); sfxError(); return; }
    setDoc({ title: kind === "customer" ? "سند قبض من عميل" : "سند صرف لمورد", number: String(json.number), party: voucher.name, date: shortStamp(new Date().toISOString()), amount: Number(amount), notes });
    setVoucher(null); setAmount("0"); setNotes(""); await refresh(); notify("ok", "تم تسجيل السند وتحديث الرصيد وحركة الخزينة"); sfxSave();
  };

  return <ModuleShell>
    <ModuleTitle title="العملاء والموردون" subtitle="الأرصدة الافتتاحية والحالية وسندات القبض والصرف" actions={<div className="flex bg-ink-800 rounded-lg p-1"><button onClick={() => { setKind("customer"); setForm(blankParty); }} className={`h-8 px-4 rounded-md font-black text-[12px] ${kind === "customer" ? "bg-amber-brand text-ink-900" : "text-white"}`}>العملاء</button><button onClick={() => { setKind("supplier"); setForm(blankParty); }} className={`h-8 px-4 rounded-md font-black text-[12px] ${kind === "supplier" ? "bg-amber-brand text-ink-900" : "text-white"}`}>الموردون</button></div>} />
    <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-2 mt-2 items-start">
      <Panel title={kind === "customer" ? "بيانات العميل" : "بيانات المورد"}>
        <div className="p-3 space-y-2.5"><Field label="الاسم"><input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} /></Field><Field label="التليفون"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={`${inputCls} cy-num`} /></Field><Field label="العنوان"><input value={form.address} onChange={(e) => set("address", e.target.value)} className={inputCls} /></Field><div className="grid grid-cols-2 gap-2"><Field label="الرصيد الافتتاحي"><input type="number" value={form.openingBalance} onChange={(e) => set("openingBalance", Number(e.target.value))} className={`${inputCls} cy-num`} /></Field><Field label="الرصيد الحالي"><input type="number" value={form.balance} onChange={(e) => set("balance", Number(e.target.value))} className={`${inputCls} cy-num`} /></Field></div><button onClick={() => void save()} className={`${btnCls} w-full bg-cash-green text-white`}>حفظ البيانات</button>{form.id && <button onClick={() => setForm(blankParty)} className={`${btnCls} w-full bg-slate-200 text-ink-800`}>إلغاء التعديل</button>}</div>
      </Panel>
      <Panel title={kind === "customer" ? "كشف حساب العملاء" : "كشف حساب الموردين"} hint="الرصيد الموجب يعني مبلغاً مستحقاً">
        <div className="p-2 border-b border-line"><input value={query} onChange={(e) => setQuery(e.target.value)} className={inputCls} placeholder="بحث بالاسم أو التليفون..." /></div>
        <div className="overflow-auto cy-scroll max-h-[590px]"><table className="w-full text-[12px]"><thead className="bg-ink-800 text-white sticky top-0"><tr>{["سند", "تعديل", "الرصيد الحالي", "الرصيد الافتتاحي", "العنوان", "التليفون", "الاسم"].map((h) => <th key={h} className="px-2 py-2.5 border-l border-white/10">{h}</th>)}</tr></thead><tbody>{rows.map((p, i) => <tr key={p.id} className={`${i % 2 ? "bg-paper-2" : "bg-white"} border-b border-slate-200`}><td className="p-1.5 text-center"><button onClick={() => { setVoucher(p); setAmount(String(Math.max(0, p.balance))); }} className="h-8 px-2.5 rounded-lg bg-cash-orange text-white font-black text-[11px] inline-flex items-center gap-1"><IcoWallet className="w-3.5 h-3.5" />{kind === "customer" ? "سند قبض" : "سند صرف"}</button></td><td className="text-center"><button onClick={() => setForm({ ...p })} className="h-8 px-3 rounded-lg bg-ink-700 text-white font-bold text-[11px]">تعديل</button></td><td className={`text-center font-black cy-num ${p.balance > 0 ? "text-cash-red" : "text-cash-green-deep"}`}>{money(p.balance)}</td><td className="text-center cy-num">{money(p.openingBalance)}</td><td className="text-center text-slate-600">{p.address || "—"}</td><td className="text-center cy-num">{p.phone || "—"}</td><td className="px-2 font-bold">{p.name}</td></tr>)}</tbody></table></div>
      </Panel>
    </div>
    {voucher && <div className="fixed inset-0 z-[80] bg-ink-950/70 grid place-items-center p-3" dir="rtl"><div className="w-full max-w-sm rounded-2xl bg-white cy-pop overflow-hidden"><div className="bg-ink-800 p-4 text-white font-black">{kind === "customer" ? "سند قبض من عميل" : "سند صرف لمورد"}</div><div className="p-4 space-y-3"><p className="font-bold text-[13px]">{voucher.name} · الرصيد الحالي <b className="cy-num text-cash-red">{money(voucher.balance)}</b></p><Field label="قيمة السند"><input autoFocus type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${inputCls} text-[20px] cy-num`} /></Field><Field label="البيان"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="تحصيل من الحساب" /></Field><div className="flex gap-2"><button onClick={() => void saveVoucher()} className={`${btnCls} flex-1 bg-cash-green text-white`}>حفظ وطباعة السند</button><button onClick={() => setVoucher(null)} className={`${btnCls} bg-slate-200 text-ink-800`}>إلغاء</button></div></div></div></div>}
    {doc && <PrintDocumentModal doc={doc} shop={data.shop} onClose={() => setDoc(null)} />}
  </ModuleShell>;
}
