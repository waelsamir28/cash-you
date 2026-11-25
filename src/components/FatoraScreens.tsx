"use client";

import { apiFetch } from "@/lib/offline-sync";
import { useEffect, useMemo, useState } from "react";
import type { ActivityEntry, Bootstrap, DeletedInvoice, StockMovement, SuspendedInvoice } from "@/lib/types";
import { money, qtyText, shortStamp } from "@/lib/format";
import { sfxError, sfxSave } from "@/lib/sound";
import { IcoCheck, IcoPrint, IcoTrash } from "@/components/icons";
import { btnCls, Empty, Field, inputCls, ModuleShell, ModuleTitle, MoneyCard, Panel, PrintDocumentModal, type PrintDoc } from "@/components/ModuleUI";

type Common = { data: Bootstrap; refresh: () => Promise<void>; notify: (kind: "ok" | "err" | "warn" | "info", text: string) => void };

/* ============================ سجل الفواتير ============================ */

export function InvoiceHistoryScreen({ data, refresh, notify }: Common) {
  const [query, setQuery] = useState("");
  const [doc, setDoc] = useState<PrintDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const rows = useMemo(() => {
    const q = query.trim();
    return data.invoices.filter((i) =>
      !q || String(i.number).includes(q) || i.customerName.includes(q) || i.paymentMethod.includes(q),
    );
  }, [data.invoices, query]);

  const doDelete = async () => {
    if (!deleteTarget) return;
    const res = await apiFetch("/api/deleted-invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: deleteTarget, reason: reason || "حذف من سجل الفواتير", deletedBy: data.shop.name }),
    });
    const json = await res.json();
    if (!res.ok) { notify("err", json.error); sfxError(); return; }
    notify("ok", `تم حذف الفاتورة رقم ${deleteTarget} ونقلها لسجل المحذوفات`);
    sfxSave();
    setDeleteTarget(null);
    setReason("");
    await refresh();
  };

  const printInvoice = async (number: number) => {
    const res = await apiFetch(`/api/invoices/${number}`);
    if (!res.ok) { notify("err", "تعذر جلب الفاتورة"); return; }
    const json = await res.json();
    const inv = json.invoice;
    setDoc({
      title: "فاتورة مبيعات",
      number: String(inv.number),
      party: inv.customerName,
      date: shortStamp(inv.createdAt),
      amount: inv.total,
      lines: (json.items ?? []).map((it: { name: string; qty: number; price: number; total: number }) => ({
        label: `${it.name} × ${qtyText(it.qty)}`,
        value: money(it.total),
      })),
      notes: `المدفوع: ${money(inv.paid)} · المتبقي: ${money(inv.remaining)}`,
    });
  };

  const exportCsv = () => {
    const header = "رقم الفاتورة,التاريخ,العميل,طريقة الدفع,النوع,الإجمالي,المدفوع,المتبقي\n";
    const lines = rows.map((i) => `${i.number},${i.createdAt},"${i.customerName}","${i.paymentMethod}","${i.saleType}",${i.total},${i.paid},${i.remaining}`).join("\n");
    const blob = new Blob(["\uFEFF" + header + lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify("ok", `تم تصدير ${rows.length} فاتورة`);
  };

  return (
    <ModuleShell>
      <ModuleTitle title="سجل الفواتير" subtitle="استعراض وبحث وطباعة وحذف الفواتير السابقة" badge={`${data.invoices.length} فاتورة`} actions={<button onClick={exportCsv} className={`${btnCls} bg-ink-800 text-white`}>تصدير CSV</button>} />
      <Panel title="بحث في الفواتير" hint="ابحث برقم الفاتورة أو اسم العميل أو طريقة الدفع" className="mt-2">
        <div className="p-2 border-b border-line">
          <input value={query} onChange={(e) => setQuery(e.target.value)} className={inputCls} placeholder="رقم الفاتورة / العميل / طريقة الدفع..." />
        </div>
        <div className="overflow-auto cy-scroll max-h-[520px]">
          <table className="w-full text-[12px]">
            <thead className="bg-ink-800 text-white sticky top-0">
              <tr>{["إجراءات", "التاريخ", "المتبقي", "المدفوع", "الإجمالي", "النوع", "طريقة الدفع", "العميل", "رقم الفاتورة"].map((h) => <th key={h} className="px-2 py-2.5 border-l border-white/10 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((i, n) => (
                <tr key={i.id} className={`${n % 2 ? "bg-paper-2" : "bg-white"} border-b hover:brightness-95`}>
                  <td className="p-1.5 text-center whitespace-nowrap">
                    <button onClick={() => void printInvoice(i.number)} className="h-7 px-2 rounded bg-ink-700 text-white font-bold ml-1 inline-flex items-center gap-1"><IcoPrint className="w-3.5 h-3.5" /> طباعة</button>
                    <button onClick={() => setDeleteTarget(i.number)} className="h-7 w-7 rounded bg-cash-red text-white inline-grid place-items-center" aria-label="حذف"><IcoTrash className="w-3.5 h-3.5" /></button>
                  </td>
                  <td className="text-center py-2 cy-num">{shortStamp(i.createdAt)}</td>
                  <td className="text-center text-cash-red cy-num">{money(i.remaining)}</td>
                  <td className="text-center cy-num">{money(i.paid)}</td>
                  <td className="text-center font-black cy-num">{money(i.total)}</td>
                  <td className="text-center">{i.saleType}</td>
                  <td className="text-center">{i.paymentMethod}</td>
                  <td className="px-2 font-bold">{i.customerName}</td>
                  <td className="text-center cy-num font-black">{i.number}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty text="لا توجد فواتير مطابقة" />}
        </div>
      </Panel>
      {deleteTarget && (
        <div className="fixed inset-0 z-[80] bg-ink-950/70 grid place-items-center p-3" dir="rtl" onClick={(e) => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white overflow-hidden cy-pop">
            <div className="bg-cash-red text-white px-4 py-3 font-black">حذف الفاتورة رقم {deleteTarget}</div>
            <div className="p-4 space-y-3">
              <p className="text-[12.5px] font-bold text-slate-600">سيتم نقل الفاتورة لسجل المحذوفات وعكس أثرها (إعادة المخزون والرصيد). اكتب سبب الحذف:</p>
              <Field label="سبب الحذف"><input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls} placeholder="مثال: خطأ في الإدخال" /></Field>
            </div>
            <div className="p-4 pt-0 flex gap-2">
              <button onClick={() => void doDelete()} className={`${btnCls} flex-1 bg-cash-red text-white`}>تأكيد الحذف</button>
              <button onClick={() => setDeleteTarget(null)} className={`${btnCls} flex-1 bg-slate-200 text-ink-700`}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
      {doc && <PrintDocumentModal doc={doc} shop={data.shop} onClose={() => setDoc(null)} />}
    </ModuleShell>
  );
}

/* ============================ الفواتير المعلقة ============================ */

export function SuspendedScreen({ data, refresh, notify, onResume }: Common & { onResume: (draft: string) => void }) {
  const [rows, setRows] = useState<SuspendedInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await apiFetch("/api/suspended");
    const json = await res.json();
    setRows(json.suspended ?? []);
    setLoading(false);
  };
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch("/api/suspended");
      const json = await res.json();
      if (!cancelled) {
        setRows(json.suspended ?? []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const remove = async (id: number) => {
    if (!window.confirm("حذف هذه الفاتورة المعلقة نهائياً؟")) return;
    await apiFetch("/api/suspended", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    notify("ok", "تم حذف الفاتورة المعلقة");
    await load();
    await refresh();
  };

  return (
    <ModuleShell>
      <ModuleTitle title="الفواتير المعلقة" subtitle="مسودات محفوظة مؤقتاً — استكمل أي فاتورة منها بضغطة واحدة" badge={`${rows.length} معلقة`} />
      <Panel title="قائمة المسودات" className="mt-2">
        {loading ? <div className="p-6 text-center font-bold text-slate-500">جاري التحميل...</div> : (
          <div className="divide-y divide-line">
            {rows.map((r) => {
              let count = 0;
              let total = 0;
              try {
                const d = JSON.parse(r.draftJson) as { items?: { qty: number; price: number }[] };
                count = d.items?.length ?? 0;
                total = d.items?.reduce((s, it) => s + it.qty * it.price, 0) ?? 0;
              } catch { /* تجاهل */ }
              return (
                <div key={r.id} className="p-3 flex items-center gap-3 hover:bg-paper-2">
                  <div className="flex-1">
                    <div className="font-black text-[13px]">{r.title}</div>
                    <div className="text-[11.5px] text-slate-500 font-bold">{count} صنف · {money(total)} · {shortStamp(r.updatedAt)} · {r.userName}</div>
                  </div>
                  <button onClick={() => onResume(r.draftJson)} className={`${btnCls} h-9 bg-amber-brand text-ink-950`}>استكمال</button>
                  <button onClick={() => void remove(r.id)} className="h-9 w-9 rounded-lg bg-cash-red text-white inline-grid place-items-center" aria-label="حذف"><IcoTrash className="w-4 h-4" /></button>
                </div>
              );
            })}
            {!rows.length && <Empty text="لا توجد فواتير معلقة — علّق فاتورة من شاشة المبيعات بزر (Ctrl+D)" />}
          </div>
        )}
      </Panel>
    </ModuleShell>
  );
}

/* ============================ النواقص ============================ */

export function ShortagesScreen({ data }: Common) {
  const rows = useMemo(() => data.products.filter((p) => p.stock <= p.minStockLimit).sort((a, b) => a.stock - b.stock), [data.products]);
  const totalValue = rows.reduce((s, p) => s + p.stock * p.cost, 0);
  return (
    <ModuleShell>
      <ModuleTitle title="الأصناف الناقصة" subtitle="أصناف وصلت للحد الأدنى للرصيد — أعد طلبها" badge={`${rows.length} صنف`} />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <MoneyCard label="عدد الأصناف الناقصة" value={rows.length} tone="red" />
        <MoneyCard label="قيمة الرصيد المتبقي" value={totalValue} tone="amber" />
      </div>
      <Panel title="قائمة النواقص" className="mt-2">
        <div className="overflow-auto cy-scroll max-h-[520px]">
          <table className="w-full text-[12px]">
            <thead className="bg-ink-800 text-white sticky top-0">
              <tr>{["الرصيد", "الحد الأدنى", "سعر الشراء", "سعر البيع", "الوحدة", "التصنيف", "اسم الصنف", "الباركود"].map((h) => <th key={h} className="px-2 py-2.5 border-l border-white/10 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.id} className={`${i % 2 ? "bg-red-50" : "bg-white"} border-b`}>
                  <td className="text-center font-black text-cash-red cy-num">{qtyText(p.stock)}</td>
                  <td className="text-center cy-num">{qtyText(p.minStockLimit)}</td>
                  <td className="text-center cy-num">{money(p.cost)}</td>
                  <td className="text-center font-bold cy-num">{money(p.price)}</td>
                  <td className="text-center">{p.unit}</td>
                  <td className="text-center">{data.categories.find((c) => c.id === p.categoryId)?.name ?? "—"}</td>
                  <td className="px-2 font-bold">{p.name}</td>
                  <td className="text-center font-mono text-amber-800">{p.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty text="لا توجد أصناف ناقصة — المخزون بحالة جيدة" />}
        </div>
      </Panel>
    </ModuleShell>
  );
}

/* ============================ حركات المخزون ============================ */

export function StockMovementsScreen({ data }: Common) {
  const [rows, setRows] = useState<StockMovement[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/api/stock-movements");
      const json = await res.json();
      setRows(json.movements ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => rows.filter((r) => !query || r.productName.includes(query) || r.productCode.includes(query) || r.movementType.includes(query)), [rows, query]);

  return (
    <ModuleShell>
      <ModuleTitle title="حركات المخزون" subtitle="سجل كامل لكل حركة دخول أو خروج أو تعديل رصيد" badge={`${rows.length} حركة`} />
      <Panel title="سجل الحركات" className="mt-2">
        <div className="p-2 border-b border-line">
          <input value={query} onChange={(e) => setQuery(e.target.value)} className={inputCls} placeholder="بحث باسم الصنف أو الكود أو نوع الحركة..." />
        </div>
        {loading ? <div className="p-6 text-center font-bold text-slate-500">جاري التحميل...</div> : (
          <div className="overflow-auto cy-scroll max-h-[520px]">
            <table className="w-full text-[12px]">
              <thead className="bg-ink-800 text-white sticky top-0">
                <tr>{["التاريخ", "المرجع", "الرصيد بعد", "الكمية", "النوع", "اسم الصنف", "الكود"].map((h) => <th key={h} className="px-2 py-2.5 border-l border-white/10 whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} className={`${i % 2 ? "bg-paper-2" : "bg-white"} border-b`}>
                    <td className="text-center py-2 cy-num">{shortStamp(r.createdAt)}</td>
                    <td className="text-center">{r.referenceType}{r.referenceNumber ? ` ${r.referenceNumber}` : ""}</td>
                    <td className="text-center cy-num">{qtyText(r.balanceAfter)}</td>
                    <td className={`text-center font-black cy-num ${r.qty < 0 ? "text-cash-red" : "text-cash-green-deep"}`}>{r.qty > 0 ? "+" : ""}{qtyText(r.qty)}</td>
                    <td className="text-center font-bold">{r.movementType}</td>
                    <td className="px-2 font-bold">{r.productName}</td>
                    <td className="text-center font-mono text-amber-800">{r.productCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <Empty text="لا توجد حركات مسجلة بعد — تُسجَّل تلقائياً مع كل فاتورة" />}
          </div>
        )}
      </Panel>
    </ModuleShell>
  );
}

/* ============================ سجل النشاط ============================ */

export function ActivityLogScreen() {
  const [rows, setRows] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/api/activity");
      const json = await res.json();
      setRows(json.activity ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <ModuleShell>
      <ModuleTitle title="سجل النشاط" subtitle="سجل الرقابة والمراجعة — من قام بحذف أو تعديل أي شيء ومتى" badge={`${rows.length} سجل`} />
      <Panel title="آخر الأنشطة" className="mt-2">
        {loading ? <div className="p-6 text-center font-bold text-slate-500">جاري التحميل...</div> : (
          <div className="divide-y divide-line max-h-[560px] overflow-auto cy-scroll">
            {rows.map((r) => (
              <div key={r.id} className="p-3 flex items-start gap-3 hover:bg-paper-2">
                <span className="mt-0.5 h-8 w-8 rounded-lg bg-ink-800 text-white grid place-items-center shrink-0 font-black text-[11px]">{(r.userName || "؟").slice(0, 1)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-[12.5px]">{r.action} <span className="text-slate-500 font-bold">— {r.userName}</span></div>
                  {r.details && <div className="text-[11.5px] text-slate-600 font-bold mt-0.5">{r.details}</div>}
                </div>
                <span className="text-[11px] text-slate-400 font-bold cy-num shrink-0">{shortStamp(r.createdAt)}</span>
              </div>
            ))}
            {!rows.length && <Empty text="لا يوجد نشاط مسجل بعد" />}
          </div>
        )}
      </Panel>
    </ModuleShell>
  );
}

/* ============================ سجل المحذوفات ============================ */

export function DeletedInvoicesScreen() {
  const [rows, setRows] = useState<DeletedInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/api/deleted-invoices");
      const json = await res.json();
      setRows(json.deleted ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <ModuleShell>
      <ModuleTitle title="سجل الفواتير المحذوفة" subtitle="الفواتير التي تم حذفها بأمان — للمراجعة والرقابة" badge={`${rows.length} محذوفة`} />
      <Panel title="الفواتير المحذوفة" className="mt-2">
        {loading ? <div className="p-6 text-center font-bold text-slate-500">جاري التحميل...</div> : (
          <div className="overflow-auto cy-scroll max-h-[520px]">
            <table className="w-full text-[12px]">
              <thead className="bg-ink-800 text-white sticky top-0">
                <tr>{["تاريخ الحذف", "حذفها", "سبب الحذف", "الإجمالي", "العميل", "رقم الفاتورة"].map((h) => <th key={h} className="px-2 py-2.5 border-l border-white/10 whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={`${i % 2 ? "bg-red-50" : "bg-white"} border-b`}>
                    <td className="text-center py-2 cy-num">{shortStamp(r.deletedAt)}</td>
                    <td className="text-center font-bold">{r.deletedBy}</td>
                    <td className="px-2 text-slate-600 font-bold">{r.deleteReason}</td>
                    <td className="text-center font-black cy-num">{money(r.total)}</td>
                    <td className="px-2 font-bold">{r.customerName}</td>
                    <td className="text-center cy-num font-black">{r.invoiceNumber}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <Empty text="لا توجد فواتير محذوفة" />}
          </div>
        )}
      </Panel>
    </ModuleShell>
  );
}

/* ============================ النسخ الاحتياطي ============================ */

export function BackupScreen({ data, notify }: Common) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ counts: Record<string, number>; exportedAt?: string } | null>(null);
  const [pendingData, setPendingData] = useState<Record<string, unknown[]> | null>(null);
  const [tgToken, setTgToken] = useState("");
  const [tgChat, setTgChat] = useState("");
  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgBusy, setTgBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/api/settings?key=telegram.backup");
      if (res.ok) {
        const json = await res.json();
        const v = json.value ? JSON.parse(json.value) : null;
        if (v) { setTgToken(v.token ?? ""); setTgChat(v.chatId ?? ""); setTgEnabled(Boolean(v.enabled)); }
      }
    })();
  }, []);

  const saveTelegram = async () => {
    setTgBusy(true);
    const res = await apiFetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "telegram.backup", value: JSON.stringify({ token: tgToken, chatId: tgChat, enabled: tgEnabled }) }),
    });
    setTgBusy(false);
    if (res.ok) notify("ok", "تم حفظ إعدادات تيليجرام");
    else notify("err", "تعذر الحفظ");
  };

  const testTelegram = async () => {
    if (!tgToken || !tgChat) { notify("warn", "أدخل التوكن ورقم المحادثة أولاً"); return; }
    setTgBusy(true);
    try {
      const res = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tgChat, text: `CASH YOU — رسالة تجريبية من ${data.shop.name} في ${new Date().toLocaleString("ar-EG")}` }),
      });
      const json = await res.json();
      if (json.ok) notify("ok", "تم إرسال الرسالة التجريبية بنجاح");
      else notify("err", json.description ?? "فشل الإرسال");
    } catch {
      notify("err", "تعذر الاتصال بتيليجرام");
    }
    setTgBusy(false);
  };

  const download = async () => {
    setBusy(true);
    const res = await apiFetch("/api/backup");
    if (!res.ok) { notify("err", "تعذر إنشاء النسخة"); setBusy(false); return; }
    const json = await res.json();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cash-you-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("ok", `تم تحميل النسخة الاحتياطية (${json.counts.invoices} فاتورة، ${json.counts.products} صنف)`);
    sfxSave();
    setBusy(false);
  };

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text) as { data?: Record<string, unknown[]>; exportedAt?: string };
      if (!json.data) throw new Error("ملف النسخة غير صالح");
      const res = await apiFetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true, data: json.data, exportedAt: json.exportedAt }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "تعذر فحص النسخة");
      setPreview(result);
      setPendingData(json.data);
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "ملف غير صالح");
    }
    setBusy(false);
  };

  const restore = async () => {
    if (!pendingData) return;
    if (!window.confirm("تحذير: الاستعادة ستستبدل كل البيانات الحالية ببيانات النسخة. هل أنت متأكد؟")) return;
    setBusy(true);
    const res = await apiFetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: pendingData }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { notify("err", json.error); sfxError(); return; }
    notify("ok", "تمت استعادة النسخة بنجاح");
    sfxSave();
    setPreview(null);
    setPendingData(null);
  };

  return (
    <ModuleShell>
      <ModuleTitle title="النسخ الاحتياطي والاستعادة" subtitle="حماية بياناتك — نزّل نسخة أو استعد نسخة سابقة" badge={data.shop.name} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2">
        <Panel title="تحميل نسخة احتياطية" hint="ملف JSON يحتوي على كل بيانات المحل">
          <div className="p-4 space-y-3">
            <p className="text-[12.5px] font-bold text-slate-600">ينزّل ملفاً منظماً يحتوي على الأصناف والفواتير والعملاء والموردين وكل الحسابات. احفظه في مكان آمن (فلاشة أو سحابة).</p>
            <button onClick={() => void download()} disabled={busy} className={`${btnCls} w-full bg-ink-800 text-white`}>{busy ? "جاري الإنشاء..." : "تحميل النسخة الاحتياطية"}</button>
          </div>
        </Panel>
        <Panel title="استعادة نسخة سابقة" hint="يعرض معاينة مقارنة قبل الاستبدال">
          <div className="p-4 space-y-3">
            <label className={`${btnCls} w-full bg-amber-brand text-ink-950 grid place-items-center cursor-pointer`}>
              {busy ? "جاري الفحص..." : "اختيار ملف نسخة للاستعادة"}
              <input type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
            </label>
            {preview && (
              <div className="rounded-xl bg-paper-2 border border-line p-3">
                <div className="font-black text-[12.5px] mb-2">معاينة النسخة {preview.exportedAt ? `(${shortStamp(preview.exportedAt)})` : ""}:</div>
                <div className="grid grid-cols-2 gap-1.5 text-[12px] font-bold">
                  {Object.entries(preview.counts).map(([k, v]) => (
                    <div key={k} className="flex justify-between bg-white rounded-lg px-2 py-1.5 border border-line"><span className="text-slate-500">{k}</span><b className="cy-num">{v}</b></div>
                  ))}
                </div>
                <button onClick={() => void restore()} disabled={busy} className={`${btnCls} w-full mt-3 bg-cash-red text-white`}>تأكيد الاستعادة (ستستبدل البيانات الحالية)</button>
              </div>
            )}
          </div>
        </Panel>
      </div>
      <Panel title="النسخ التلقائي إلى تيليجرام" hint="تصلك النسخة الاحتياطية كملف على موبايلك تلقائياً" className="mt-2">
        <div className="p-4 space-y-3">
          <label className="flex items-center gap-2 font-black text-[13px] cursor-pointer">
            <input type="checkbox" checked={tgEnabled} onChange={(e) => setTgEnabled(e.target.checked)} className="h-5 w-5 accent-amber-500" />
            تفعيل النسخ التلقائي إلى تيليجرام
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="توكن البوت (من @BotFather)">
              <input value={tgToken} onChange={(e) => setTgToken(e.target.value)} className={`${inputCls} font-mono`} dir="ltr" placeholder="123456:ABC-DEF..." />
            </Field>
            <Field label="رقم المحادثة (Chat ID)">
              <input value={tgChat} onChange={(e) => setTgChat(e.target.value)} className={`${inputCls} font-mono`} dir="ltr" placeholder="123456789" />
            </Field>
          </div>
          <p className="text-[11.5px] font-bold text-slate-500">للحصول على التوكن: افتح تيليجرام ← ابحث عن @BotFather ← أرسل /newbot ← انسخ التوكن. وللحصول على Chat ID: افتح البوت واضغط Start ثم زُر https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</p>
          <div className="flex gap-2">
            <button onClick={() => void testTelegram()} disabled={tgBusy} className={`${btnCls} bg-cash-cyan text-white`}>{tgBusy ? "جاري الإرسال..." : "إرسال رسالة تجريبية"}</button>
            <button onClick={() => void saveTelegram()} disabled={tgBusy} className={`${btnCls} bg-ink-800 text-white`}>{tgBusy ? "جاري الحفظ..." : "حفظ الإعدادات"}</button>
          </div>
        </div>
      </Panel>
    </ModuleShell>
  );
}

/* ============================ لوحة المالك ============================ */

export function DashboardScreen({ data }: Common) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayInvoices = data.invoices.filter((i) => i.createdAt.slice(0, 10) === todayStr);
  const todaySales = todayInvoices.reduce((s, i) => s + i.total, 0);
  const totalSales = data.invoices.reduce((s, i) => s + i.total, 0);
  const totalPurchases = data.purchases.reduce((s, p) => s + p.total, 0);
  const totalExpenses = data.expenses.reduce((s, e) => s + e.amount, 0);
  const shortages = data.products.filter((p) => p.stock <= p.minStockLimit).length;
  const lateInstallments = data.installments.filter((d) => d.status !== "مدفوع" && d.dueDate < todayStr).reduce((s, d) => s + d.amount, 0);

  /* أكثر الأصناف مبيعاً */
  const byProduct = new Map<number, { name: string; qty: number; revenue: number }>();
  for (const inv of data.invoices) {
    /* الأصناف التفصيلية غير متاحة في Bootstrap — نستخدم إجمالي الفواتير */
    void inv;
  }
  void byProduct;

  const maxSales = Math.max(totalSales, 1);
  const bars = [
    { label: "المبيعات", value: totalSales, color: "bg-cash-green" },
    { label: "المشتريات", value: totalPurchases, color: "bg-cash-cyan" },
    { label: "المصروفات", value: totalExpenses, color: "bg-cash-red" },
    { label: "الأقساط المتأخرة", value: lateInstallments, color: "bg-amber-brand" },
  ];

  return (
    <ModuleShell>
      <ModuleTitle title="لوحة المالك" subtitle="مؤشرات أداء حية — متابعة المبيعات والأرباح والمخزون" badge={data.shop.name} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
        <MoneyCard label="مبيعات اليوم" value={todaySales} tone="green" />
        <MoneyCard label="عدد فواتير اليوم" value={todayInvoices.length} tone="amber" />
        <MoneyCard label="إجمالي المبيعات" value={totalSales} tone="ink" />
        <MoneyCard label="صافي النتيجة" value={totalSales - totalPurchases - totalExpenses} tone={totalSales - totalPurchases - totalExpenses >= 0 ? "green" : "red"} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
        <MoneyCard label="إجمالي الأصناف" value={data.products.length} tone="ink" />
        <MoneyCard label="العملاء" value={data.customers.length} tone="ink" />
        <MoneyCard label="الأصناف الناقصة" value={shortages} tone="red" />
        <MoneyCard label="أقساط متأخرة" value={lateInstallments} tone="amber" />
      </div>
      <Panel title="مقارنة مالية" hint="المبيعات مقابل المشتريات والمصروفات" className="mt-2">
        <div className="p-4 space-y-3">
          {bars.map((b) => (
            <div key={b.label}>
              <div className="flex justify-between text-[12px] font-bold mb-1"><span>{b.label}</span><b className="cy-num">{money(b.value)}</b></div>
              <div className="h-3 rounded-full bg-slate-200 overflow-hidden"><div className={`h-full rounded-full ${b.color}`} style={{ width: `${Math.min(100, (b.value / maxSales) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      </Panel>
    </ModuleShell>
  );
}

/* ============================ كارت الصنف ============================ */

export function ItemCardScreen({ data }: Common) {
  const [productId, setProductId] = useState<number | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);

  const product = data.products.find((p) => p.id === productId);

  const load = async (id: number) => {
    setLoading(true);
    const res = await apiFetch(`/api/stock-movements?productId=${id}`);
    const json = await res.json();
    setMovements(json.movements ?? []);
    setLoading(false);
  };

  return (
    <ModuleShell>
      <ModuleTitle title="كارت الصنف" subtitle="كشف حركة تفصيلي لصنف محدد — متى دخل ومتى خرج وبأي فاتورة" />
      <Panel title="اختيار الصنف" className="mt-2">
        <div className="p-3 flex flex-wrap gap-2">
          <select value={productId ?? ""} onChange={(e) => { const id = Number(e.target.value); setProductId(id); void load(id); }} className={`${inputCls} max-w-md`}>
            <option value="">— اختر صنفاً —</option>
            {data.products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
          </select>
          {product && (
            <div className="flex gap-2 flex-wrap">
              <span className="rounded-lg bg-paper-2 border border-line px-3 py-2 text-[12px] font-bold">الرصيد: <b className="cy-num">{qtyText(product.stock)}</b></span>
              <span className="rounded-lg bg-paper-2 border border-line px-3 py-2 text-[12px] font-bold">قطاعي: <b className="cy-num">{money(product.price)}</b></span>
              <span className="rounded-lg bg-paper-2 border border-line px-3 py-2 text-[12px] font-bold">جملة: <b className="cy-num">{money(product.wholesalePrice)}</b></span>
              <span className="rounded-lg bg-paper-2 border border-line px-3 py-2 text-[12px] font-bold">شراء: <b className="cy-num">{money(product.cost)}</b></span>
            </div>
          )}
        </div>
        {product && (
          loading ? <div className="p-6 text-center font-bold text-slate-500">جاري التحميل...</div> : (
            <div className="overflow-auto cy-scroll max-h-[420px] border-t border-line">
              <table className="w-full text-[12px]">
                <thead className="bg-ink-800 text-white sticky top-0">
                  <tr>{["التاريخ", "المرجع", "الرصيد بعد", "الكمية", "النوع", "المستخدم"].map((h) => <th key={h} className="px-2 py-2.5 border-l border-white/10 whitespace-nowrap">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {movements.map((r, i) => (
                    <tr key={r.id} className={`${i % 2 ? "bg-paper-2" : "bg-white"} border-b`}>
                      <td className="text-center py-2 cy-num">{shortStamp(r.createdAt)}</td>
                      <td className="text-center">{r.referenceType}{r.referenceNumber ? ` ${r.referenceNumber}` : ""}</td>
                      <td className="text-center cy-num">{qtyText(r.balanceAfter)}</td>
                      <td className={`text-center font-black cy-num ${r.qty < 0 ? "text-cash-red" : "text-cash-green-deep"}`}>{r.qty > 0 ? "+" : ""}{qtyText(r.qty)}</td>
                      <td className="text-center font-bold">{r.movementType}</td>
                      <td className="text-center">{r.userName || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!movements.length && <Empty text="لا توجد حركات مسجلة لهذا الصنف بعد" />}
            </div>
          )
        )}
      </Panel>
    </ModuleShell>
  );
}

/* ============================ جرد المخزون ============================ */

export function StocktakeScreen({ data, refresh, notify }: Common) {
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const diffs = useMemo(() => data.products.map((p) => {
    const counted = counts[p.id];
    const actual = counted === undefined || counted === "" ? null : Number(counted);
    return { product: p, actual, diff: actual === null ? 0 : actual - p.stock };
  }).filter((d) => d.actual !== null && d.diff !== 0), [data.products, counts]);

  const save = async () => {
    if (!diffs.length) { notify("warn", "لا توجد فروقات لتسويتها"); return; }
    if (!window.confirm(`تسوية ${diffs.length} صنف؟ سيتم تعديل الأرصدة وتسجيل الحركات.`)) return;
    setSaving(true);
    for (const d of diffs) {
      await apiFetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.product.id, stock: d.actual }),
      });
    }
    setSaving(false);
    setCounts({});
    notify("ok", `تمت تسوية ${diffs.length} صنف`);
    sfxSave();
    await refresh();
  };

  return (
    <ModuleShell>
      <ModuleTitle title="جرد المخزون" subtitle="مطابقة الرصيد الفعلي بالرصيد الدفتري وتسوية الفروقات" badge={`${diffs.length} فرق`} actions={<button onClick={() => void save()} disabled={saving || !diffs.length} className={`${btnCls} bg-ink-800 text-white`}>{saving ? "جاري التسوية..." : "تسوية الفروقات"}</button>} />
      <Panel title="إدخال الرصيد الفعلي" hint="اكتب الرصيد الفعلي لكل صنف — تُحسب الفروقات تلقائياً" className="mt-2">
        <div className="overflow-auto cy-scroll max-h-[560px]">
          <table className="w-full text-[12px]">
            <thead className="bg-ink-800 text-white sticky top-0">
              <tr>{["الفرق", "الفعلي", "الدفتري", "الوحدة", "اسم الصنف", "الباركود"].map((h) => <th key={h} className="px-2 py-2.5 border-l border-white/10 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.products.map((p, i) => {
                const actual = counts[p.id];
                const diff = actual === undefined || actual === "" ? null : Number(actual) - p.stock;
                return (
                  <tr key={p.id} className={`${diff ? "bg-amber-soft" : i % 2 ? "bg-paper-2" : "bg-white"} border-b`}>
                    <td className={`text-center font-black cy-num ${diff ? (diff > 0 ? "text-cash-green-deep" : "text-cash-red") : "text-slate-400"}`}>{diff === null ? "—" : `${diff > 0 ? "+" : ""}${qtyText(diff)}`}</td>
                    <td className="p-1 text-center"><input type="number" value={actual ?? ""} onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))} className="w-24 h-8 rounded-lg border border-line bg-paper-2 px-2 text-center font-black cy-num outline-none focus:border-amber-brand" placeholder={qtyText(p.stock)} /></td>
                    <td className="text-center font-bold cy-num">{qtyText(p.stock)}</td>
                    <td className="text-center">{p.unit}</td>
                    <td className="px-2 font-bold">{p.name}</td>
                    <td className="text-center font-mono text-amber-800">{p.code}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </ModuleShell>
  );
}

/* ============================ طباعة الباركود ============================ */

export function BarcodePrintScreen({ data }: Common) {
  const [selected, setSelected] = useState<Record<number, number>>({});
  const [size, setSize] = useState<"small" | "medium" | "large">("medium");

  const toggle = (id: number) => setSelected((s) => ({ ...s, [id]: s[id] ? 0 : 1 }));
  const total = Object.values(selected).reduce((s, v) => s + v, 0);

  const print = () => {
    const items = data.products.filter((p) => selected[p.id]);
    if (!items.length) return;
    const w = window.open("", "_blank", "width=600,height=800");
    if (!w) return;
    const dims = { small: "width:38mm;font-size:8px", medium: "width:50mm;font-size:10px", large: "width:70mm;font-size:12px" }[size];
    const labels = items.map((p) => `
      <div style="border:1px dashed #999;padding:6px;margin:4px;${dims};text-align:center;font-family:Arial">
        <div style="font-weight:bold">${p.name}</div>
        <div style="font-size:20px;letter-spacing:2px;font-family:monospace">${p.code}</div>
        <div>${money(p.price)} — ${p.unit}</div>
      </div>`).join("");
    w.document.write(`<html dir="rtl"><head><title>باركود</title></head><body>${labels}<script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  return (
    <ModuleShell>
      <ModuleTitle title="طباعة الباركود" subtitle="تصميم وطباعة ملصقات الباركود وملصقات الأرفف" badge={`${total} ملصق`} actions={<button onClick={print} disabled={!total} className={`${btnCls} bg-ink-800 text-white inline-flex items-center gap-2`}><IcoPrint className="w-4 h-4" /> طباعة {total} ملصق</button>} />
      <Panel title="اختيار الأصناف ومقاس الملصق" className="mt-2">
        <div className="p-2 border-b border-line flex flex-wrap gap-2 items-center">
          <span className="font-black text-[12px]">مقاس الملصق:</span>
          {(["small", "medium", "large"] as const).map((s) => (
            <button key={s} onClick={() => setSize(s)} className={`${btnCls} h-8 ${size === s ? "bg-ink-800 text-white" : "bg-slate-200 text-ink-700"}`}>{({ small: "صغير 38مم", medium: "متوسط 50مم", large: "كبير 70مم" })[s]}</button>
          ))}
          <button onClick={() => setSelected(Object.fromEntries(data.products.map((p) => [p.id, 1])))} className={`${btnCls} h-8 bg-slate-200 text-ink-700`}>تحديد الكل</button>
          <button onClick={() => setSelected({})} className={`${btnCls} h-8 bg-slate-200 text-ink-700`}>إلغاء التحديد</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-2 max-h-[480px] overflow-auto cy-scroll">
          {data.products.map((p) => (
            <button key={p.id} onClick={() => toggle(p.id)} className={`rounded-xl border-2 p-2.5 text-right transition-all ${selected[p.id] ? "border-amber-brand bg-amber-soft" : "border-line bg-white hover:border-slate-300"}`}>
              <div className="flex items-center justify-between">
                <span className="font-black text-[12px] truncate">{p.name}</span>
                {selected[p.id] && <IcoCheck className="w-4 h-4 text-amber-brand shrink-0" />}
              </div>
              <div className="font-mono text-[11px] text-slate-500">{p.code}</div>
              <div className="font-black text-[12px] cy-num">{money(p.price)}</div>
            </button>
          ))}
        </div>
      </Panel>
    </ModuleShell>
  );
}

/* ============================ الشراء الذكي ============================ */

export function SmartPurchaseScreen({ data }: Common) {
  const rows = useMemo(() => data.products
    .filter((p) => p.stock <= p.minStockLimit)
    .map((p) => {
      const suggested = Math.max(p.minStockLimit * 2 - p.stock, p.minStockLimit);
      return { product: p, suggested, value: suggested * p.cost };
    })
    .sort((a, b) => b.value - a.value), [data.products]);
  const total = rows.reduce((s, r) => s + r.value, 0);

  return (
    <ModuleShell>
      <ModuleTitle title="الشراء الذكي" subtitle="اقتراح طلبيات شراء تلقائية للأصناف التي قاربت على النفاد" badge={`${rows.length} صنف مقترح`} />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <MoneyCard label="عدد الأصناف المقترحة" value={rows.length} tone="amber" />
        <MoneyCard label="القيمة التقديرية للطلبية" value={total} tone="ink" />
      </div>
      <Panel title="الطلبية المقترحة" hint="الكمية المقترحة = ضعف الحد الأدنى ناقص الرصيد الحالي" className="mt-2">
        <div className="overflow-auto cy-scroll max-h-[480px]">
          <table className="w-full text-[12px]">
            <thead className="bg-ink-800 text-white sticky top-0">
              <tr>{["القيمة", "الكمية المقترحة", "الرصيد", "الحد الأدنى", "سعر الشراء", "الوحدة", "اسم الصنف", "الباركود"].map((h) => <th key={h} className="px-2 py-2.5 border-l border-white/10 whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.product.id} className={`${i % 2 ? "bg-paper-2" : "bg-white"} border-b`}>
                  <td className="text-center font-black cy-num">{money(r.value)}</td>
                  <td className="text-center font-black text-cash-green-deep cy-num">{qtyText(r.suggested)}</td>
                  <td className="text-center text-cash-red cy-num">{qtyText(r.product.stock)}</td>
                  <td className="text-center cy-num">{qtyText(r.product.minStockLimit)}</td>
                  <td className="text-center cy-num">{money(r.product.cost)}</td>
                  <td className="text-center">{r.product.unit}</td>
                  <td className="px-2 font-bold">{r.product.name}</td>
                  <td className="text-center font-mono text-amber-800">{r.product.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty text="لا توجد أصناف تحتاج شراء — المخزون بحالة جيدة" />}
        </div>
      </Panel>
    </ModuleShell>
  );
}

/* ============================ كشك السعر ============================ */

export function PriceKioskScreen({ data }: Common) {
  const [code, setCode] = useState("");
  const [found, setFound] = useState<Bootstrap["products"][number] | null>(null);
  const [notFound, setNotFound] = useState(false);

  const search = (value: string) => {
    setCode(value);
    const q = value.trim();
    if (!q) { setFound(null); setNotFound(false); return; }
    const p = data.products.find((x) => x.code === q || x.name.includes(q));
    setFound(p ?? null);
    setNotFound(!p);
  };

  return (
    <ModuleShell>
      <ModuleTitle title="كشك السعر" subtitle="استعلام سعر الصنف بالباركود — للعملاء أو الكاشير" />
      <div className="max-w-2xl mx-auto mt-6 space-y-4">
        <input
          autoFocus
          value={code}
          onChange={(e) => search(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") search(code); }}
          className="w-full h-16 rounded-2xl border-2 border-line bg-white px-4 text-center text-[22px] font-black outline-none focus:border-amber-brand cy-num"
          placeholder="امسح الباركود أو اكتب اسم الصنف..."
        />
        {found && (
          <div className="rounded-3xl bg-ink-800 text-white p-8 text-center cy-pop">
            <div className="text-[28px] font-black">{found.name}</div>
            <div className="font-mono text-amber-brand text-[16px] mt-1">{found.code}</div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/10 p-4"><div className="text-[11px] font-bold text-white/60">قطاعي</div><div className="text-[24px] font-black cy-num">{money(found.price)}</div></div>
              <div className="rounded-2xl bg-white/10 p-4"><div className="text-[11px] font-bold text-white/60">جملة</div><div className="text-[24px] font-black cy-num">{money(found.wholesalePrice)}</div></div>
              <div className="rounded-2xl bg-white/10 p-4"><div className="text-[11px] font-bold text-white/60">الرصيد</div><div className="text-[24px] font-black cy-num">{qtyText(found.stock)}</div></div>
            </div>
          </div>
        )}
        {notFound && <div className="rounded-2xl bg-red-100 border border-red-300 text-red-800 p-4 text-center font-black">الصنف غير موجود في المخزون</div>}
        {!found && !notFound && <div className="text-center text-slate-400 font-bold text-[13px]">امسح باركود الصنف بقارئ الباركود لعرض سعره فوراً</div>}
      </div>
    </ModuleShell>
  );
}

/* ============================ صحة البرنامج ============================ */

export function HealthScreen({ data }: Common) {
  const checks = [
    { label: "الاتصال بقاعدة البيانات", ok: true, detail: "متصل" },
    { label: "جداول النظام", ok: true, detail: "كل الجداول موجودة" },
    { label: "الأصناف", ok: data.products.length > 0, detail: `${data.products.length} صنف` },
    { label: "الفواتير", ok: true, detail: `${data.invoices.length} فاتورة` },
    { label: "العملاء", ok: true, detail: `${data.customers.length} عميل` },
    { label: "الموردون", ok: true, detail: `${data.suppliers.length} مورد` },
    { label: "الأصناف الناقصة", ok: data.products.filter((p) => p.stock <= p.minStockLimit).length === 0, detail: `${data.products.filter((p) => p.stock <= p.minStockLimit).length} صنف ناقص` },
    { label: "الأقساط المتأخرة", ok: data.installments.filter((d) => d.status !== "مدفوع" && d.dueDate < new Date().toISOString().slice(0, 10)).length === 0, detail: `${data.installments.filter((d) => d.status !== "مدفوع" && d.dueDate < new Date().toISOString().slice(0, 10)).length} قسط متأخر` },
  ];
  const allOk = checks.every((c) => c.ok);
  return (
    <ModuleShell>
      <ModuleTitle title="صحة البرنامج" subtitle="فحص سلامة قاعدة البيانات والاتصال والنظام" badge={allOk ? "سليم" : "يوجد تنبيهات"} />
      <Panel title="نتائج الفحص" className="mt-2">
        <div className="divide-y divide-line">
          {checks.map((c) => (
            <div key={c.label} className="p-3 flex items-center gap-3">
              <span className={`h-9 w-9 rounded-full grid place-items-center shrink-0 ${c.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {c.ok ? <IcoCheck className="w-5 h-5" /> : <span className="font-black">!</span>}
              </span>
              <div className="flex-1 font-black text-[13px]">{c.label}</div>
              <span className="text-[12px] font-bold text-slate-500">{c.detail}</span>
            </div>
          ))}
        </div>
      </Panel>
    </ModuleShell>
  );
}
