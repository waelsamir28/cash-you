"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bootstrap, Product } from "@/lib/types";
import { apiFetch } from "@/lib/offline-sync";
import { money, qtyText, shortStamp } from "@/lib/format";
import { IcoBox, IcoCheck, IcoSearch, IcoWarn, IcoX } from "@/components/icons";
import { btnCls, Empty, ModuleShell, ModuleTitle, Panel } from "@/components/ModuleUI";
import { Modal } from "@/components/Overlays";

type Notify = (kind: "ok" | "err" | "warn" | "info", text: string) => void;

type MovementRow = { at: string; type: string; reference: string; party: string; delta: number; balanceAfter: number };
type Movements = { product: { id: number; code: string; name: string; unit: string; stock: number }; rows: MovementRow[] };

const toNumber = (text: string): number | null => {
  const clean = text.trim().replace(",", ".");
  if (clean === "") return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null;
};

/**
 * شاشة الجرد: يُدخل المحاسب الرصيد الفعلي لكل صنف، ويُعرض الفرق قبل الاعتماد.
 * الاعتماد يكتب تسوية مخزون لكل فرق، ويُسجَّل في سجل النشاط باسم المستخدم.
 */
export function InventoryScreen({
  data,
  refresh,
  notify,
  onOpenCard,
}: {
  data: Bootstrap;
  refresh: () => Promise<void>;
  notify: Notify;
  onOpenCard: (product: Product) => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const tableRef = useRef<HTMLDivElement | null>(null);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.products.filter((p) => {
      const okCat = categoryId === "all" || p.categoryId === categoryId;
      const okTerm = term === "" || p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term);
      return okCat && okTerm;
    });
  }, [data.products, query, categoryId]);

  const changes = useMemo(() => {
    const out: { product: Product; actual: number; diff: number }[] = [];
    for (const p of data.products) {
      const actual = toNumber(counts[p.id] ?? "");
      if (actual === null) continue;
      const diff = Math.round((actual - p.stock) * 1000) / 1000;
      if (diff !== 0) out.push({ product: p, actual, diff });
    }
    return out;
  }, [counts, data.products]);

  const countedCount = useMemo(() => Object.values(counts).filter((v) => v.trim() !== "").length, [counts]);

  const catName = (id: number) => data.categories.find((c) => c.id === id)?.name ?? "—";

  const applyCount = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const lines = changes.map((c) => ({ productId: c.product.id, actual: c.actual }));
      const res = await apiFetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const json = (await res.json()) as { ok?: boolean; changed?: number; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "تعذر اعتماد الجرد");
      setCounts({});
      setConfirming(false);
      await refresh();
      notify("ok", `تم اعتماد الجرد وتعديل ${json.changed ?? lines.length} صنف`);
    } catch (err) {
      notify("err", err instanceof Error ? err.message : "تعذر اعتماد الجرد");
    } finally {
      setBusy(false);
    }
  }, [busy, changes, notify, refresh]);

  /* ينتقل المحاسب بالـ Enter إلى خانة الصنف التالية */
  const focusNext = (index: number) => {
    const inputs = tableRef.current?.querySelectorAll<HTMLInputElement>("input[data-count]");
    inputs?.[index + 1]?.focus();
    inputs?.[index + 1]?.select();
  };

  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setConfirming(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, busy]);

  return (
    <ModuleShell>
      <ModuleTitle
        title="الجرد"
        subtitle="أدخل الرصيد الفعلي للصنف، وسيُعرض الفرق قبل الاعتماد"
        badge={`${countedCount} مُدخَل`}
        actions={
          <>
            <button
              onClick={() => setCounts({})}
              disabled={countedCount === 0}
              className="h-8 rounded-lg bg-white/10 px-3 text-[12px] font-black text-white cy-press hover:bg-white/20 disabled:opacity-40"
            >
              مسح الإدخال
            </button>
            <button
              onClick={() => setConfirming(true)}
              disabled={changes.length === 0}
              className="h-8 rounded-lg bg-cash-green px-3 text-[12px] font-black text-white cy-press hover:bg-cash-green-deep disabled:opacity-40"
            >
              مراجعة الفروق ({changes.length})
            </button>
          </>
        }
      />

      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 shadow-sm">
        <div className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-line bg-paper-2 px-2.5">
          <IcoSearch className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الكود..."
            className="flex-1 bg-transparent text-[12.5px] font-bold text-ink-900 outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-400 hover:text-cash-red" aria-label="مسح">
              <IcoX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="h-9 rounded-lg border border-line bg-paper-2 px-2 text-[12.5px] font-bold text-ink-800 outline-none"
        >
          <option value="all">كل التصنيفات</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-[11.5px] font-bold text-slate-500">{visible.length} صنف معروض</span>
      </div>

      <div className="mt-2">
        <Panel title="قائمة الجرد" hint="Enter للانتقال للصنف التالي — الخانات الفارغة لا تُغيّر الرصيد">
          <div ref={tableRef} className="max-h-[calc(100vh-270px)] overflow-auto cy-scroll">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 z-[1] bg-ink-800 text-white">
                <tr>
                  {["الكود", "اسم الصنف", "التصنيف", "الوحدة", "الرصيد الدفتري", "الرصيد الفعلي", "الفرق", "كارت"].map((h) => (
                    <th key={h} className="border-l border-white/10 px-2 py-2.5 text-center first:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((p, index) => {
                  const actual = toNumber(counts[p.id] ?? "");
                  const diff = actual === null ? null : Math.round((actual - p.stock) * 1000) / 1000;
                  return (
                    <tr key={p.id} className={`${index % 2 ? "bg-paper-2" : "bg-white"} border-b border-slate-200`}>
                      <td className="px-2 py-1 font-mono text-[11.5px] font-bold text-ink-700" dir="ltr">
                        {p.code}
                      </td>
                      <td className="px-2 py-1 font-bold text-ink-900">{p.name}</td>
                      <td className="px-2 py-1 text-center text-slate-600">{catName(p.categoryId)}</td>
                      <td className="px-2 py-1 text-center text-slate-600">{p.unit}</td>
                      <td className="cy-num px-2 py-1 text-center font-black text-ink-800">{qtyText(p.stock)}</td>
                      <td className="px-2 py-1 text-center">
                        <input
                          data-count
                          value={counts[p.id] ?? ""}
                          onChange={(e) => setCounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              focusNext(index);
                            }
                          }}
                          inputMode="decimal"
                          placeholder="—"
                          className="h-8 w-24 rounded-md border border-line bg-white text-center text-[13px] font-black text-ink-900 outline-none focus:border-amber-brand"
                        />
                      </td>
                      <td
                        className={`cy-num px-2 py-1 text-center font-black ${
                          diff === null ? "text-slate-300" : diff === 0 ? "text-cash-green-deep" : diff > 0 ? "text-cash-green" : "text-cash-red"
                        }`}
                      >
                        {diff === null ? "—" : diff > 0 ? `+${qtyText(diff)}` : qtyText(diff)}
                      </td>
                      <td className="px-2 py-1 text-center">
                        <button
                          onClick={() => onOpenCard(p)}
                          className="h-7 rounded-md bg-ink-800 px-2.5 text-[11px] font-black text-white cy-press hover:bg-ink-900"
                        >
                          كارت الصنف
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length === 0 && <Empty text="لا توجد أصناف مطابقة" />}
          </div>
        </Panel>
      </div>

      {confirming && (
        <Modal title="مراجعة فروق الجرد" subtitle={`${changes.length} صنف يختلف رصيده — راجعها قبل الاعتماد`} onClose={() => !busy && setConfirming(false)} width="max-w-2xl" tone="amber">
          {changes.length === 0 ? (
            <Empty text="لا توجد فروق. أدخل الرصيد الفعلي لبعض الأصناف أولاً." />
          ) : (
            <div className="cy-scroll max-h-[50vh] overflow-auto rounded-xl border border-line">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-ink-800 text-white">
                  <tr>
                    {["الصنف", "الدفتري", "الفعلي", "الفرق"].map((h) => (
                      <th key={h} className="px-2 py-2 text-center first:text-right">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c, i) => (
                    <tr key={c.product.id} className={i % 2 ? "bg-paper-2" : "bg-white"}>
                      <td className="px-2 py-1.5 font-bold text-ink-900">{c.product.name}</td>
                      <td className="cy-num px-2 py-1.5 text-center">{qtyText(c.product.stock)}</td>
                      <td className="cy-num px-2 py-1.5 text-center">{qtyText(c.actual)}</td>
                      <td className={`cy-num px-2 py-1.5 text-center font-black ${c.diff > 0 ? "text-cash-green" : "text-cash-red"}`}>
                        {c.diff > 0 ? `+${qtyText(c.diff)}` : qtyText(c.diff)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-soft px-3 py-2 text-[11.5px] font-bold text-amber-900">
            <IcoWarn className="mt-0.5 h-4 w-4" />
            سيُعدَّل رصيد هذه الأصناف على الرصيد الفعلي، وتُسجَّل كل تسوية في كارت الصنف وسجل النشاط باسمك.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => void applyCount()}
              disabled={busy || changes.length === 0}
              className={`${btnCls} flex flex-1 items-center justify-center gap-2 bg-cash-green text-white`}
            >
              <IcoCheck />
              {busy ? "جارٍ الاعتماد..." : "اعتماد الجرد"}
            </button>
            <button onClick={() => setConfirming(false)} disabled={busy} className={`${btnCls} bg-slate-200 text-ink-800`}>
              رجوع
            </button>
          </div>
        </Modal>
      )}
    </ModuleShell>
  );
}

/** كارت الصنف: كل حركات الصنف (بيع، شراء، مرتجعات، جرد) مع الرصيد بعد كل حركة */
export function ItemCardDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const [state, setState] = useState<{ loading: boolean; error: string; data: Movements | null }>({ loading: true, error: "", data: null });

  useEffect(() => {
    let alive = true;
    fetch(`/api/stock/movements?productId=${product.id}&t=${Date.now()}`, { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as Movements & { error?: string };
        if (!res.ok) throw new Error(json.error ?? "تعذر تحميل حركات الصنف");
        if (alive) setState({ loading: false, error: "", data: json });
      })
      .catch((err: unknown) => {
        if (alive) setState({ loading: false, error: err instanceof Error ? err.message : "تعذر تحميل حركات الصنف", data: null });
      });
    return () => {
      alive = false;
    };
  }, [product.id]);

  const stock = state.data?.product.stock ?? product.stock;

  return (
    <Modal title={`كارت الصنف — ${product.name}`} subtitle={`الكود ${product.code} · الوحدة ${product.unit || "—"}`} onClose={onClose} width="max-w-3xl">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-line bg-paper-2 px-3 py-2">
          <div className="text-[10.5px] font-black text-slate-500">الرصيد الحالي</div>
          <div className="cy-num text-[18px] font-black text-ink-900">{qtyText(stock)}</div>
        </div>
        <div className="rounded-xl border border-line bg-paper-2 px-3 py-2">
          <div className="text-[10.5px] font-black text-slate-500">سعر البيع</div>
          <div className="cy-num text-[18px] font-black text-ink-900">{money(product.price)}</div>
        </div>
        <div className="rounded-xl border border-line bg-paper-2 px-3 py-2">
          <div className="text-[10.5px] font-black text-slate-500">عدد الحركات</div>
          <div className="cy-num text-[18px] font-black text-ink-900">{state.data?.rows.length ?? "—"}</div>
        </div>
      </div>

      <div className="mt-3 max-h-[52vh] overflow-auto cy-scroll rounded-xl border border-line">
        {state.loading && <p className="p-6 text-center text-[12.5px] font-bold text-slate-500">جارٍ تحميل الحركات...</p>}
        {state.error && <p className="p-6 text-center text-[12.5px] font-bold text-cash-red">{state.error}</p>}
        {state.data && state.data.rows.length === 0 && <Empty text="لا توجد حركات مسجلة لهذا الصنف بعد" />}
        {state.data && state.data.rows.length > 0 && (
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-ink-800 text-white">
              <tr>
                {["التاريخ", "الحركة", "المرجع", "الطرف", "الكمية", "الرصيد بعد"].map((h) => (
                  <th key={h} className="px-2 py-2 text-center first:text-right">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.data.rows.map((row, i) => (
                <tr key={`${row.at}-${row.reference}-${i}`} className={i % 2 ? "bg-paper-2" : "bg-white"}>
                  <td className="cy-num px-2 py-1.5 text-right text-slate-600">{shortStamp(row.at)}</td>
                  <td className="px-2 py-1.5 text-center font-bold text-ink-800">{row.type}</td>
                  <td className="px-2 py-1.5 text-center text-slate-600">{row.reference}</td>
                  <td className="px-2 py-1.5 text-center text-slate-600">{row.party || "—"}</td>
                  <td className={`cy-num px-2 py-1.5 text-center font-black ${row.delta >= 0 ? "text-cash-green" : "text-cash-red"}`}>
                    {row.delta > 0 ? `+${qtyText(row.delta)}` : qtyText(row.delta)}
                  </td>
                  <td className="cy-num px-2 py-1.5 text-center font-black text-ink-900">{qtyText(row.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
        <IcoBox className="h-3.5 w-3.5" />
        الرصيد بعد كل حركة يُحسب من الرصيد الحالي للخلف. تعديل الرصيد من شاشة الأصناف مباشرة لا يُسجَّل كحركة، لذلك يظهر أثره كفرق بين الرصيد المحسوب والرصيد الحالي.
      </p>
      <button onClick={onClose} className="mt-3 h-10 w-full rounded-xl bg-slate-200 text-[13px] font-black text-ink-800 cy-press hover:bg-slate-300">
        إغلاق
      </button>
    </Modal>
  );
}
