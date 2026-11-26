"use client";

import { apiFetch } from "@/lib/offline-sync";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Bootstrap, ModuleKind, Product } from "@/lib/types";
import { money, qtyText, shortStamp, uid } from "@/lib/format";
import { sfxAdd, sfxCash, sfxError, sfxKey, sfxRemove, sfxSave, sfxScan } from "@/lib/sound";
import { DiscountDialog, PromptDialog } from "@/components/Overlays";
import {
  IcoBarcode,
  IcoCheck,
  IcoChevronLeft,
  IcoChevronRight,
  IcoPlus,
  IcoPrint,
  IcoSearch,
  IcoTrash,
  IcoUsers,
  IcoWallet,
  IcoX,
} from "@/components/icons";
import { Empty, PrintDocumentModal, type PrintDoc } from "@/components/ModuleUI";
import { AmountTile } from "@/components/AmountTile";

type TradeKind = Extract<ModuleKind, "purchase" | "salesReturn" | "purchaseReturn">;
type Line = { uid: string; product: Product; qty: number; price: number };

type Props = {
  kind: TradeKind;
  data: Bootstrap;
  refresh: () => Promise<void>;
  notify: (kind: "ok" | "err" | "warn" | "info", text: string) => void;
  stamp: { date: string; time: string };
};

const PAGE_SIZE = 24;

/* مقاسات الجدول والأشرطة مطابقة لشاشة فاتورة المبيعات */
const ROW_H = 25;
const HEAD_H = 32;
const FOOT_H = 32;
/* ×، الإجمالي، السعر، الكمية، الوحدة، اسم الصنف، الرصيد بعد، الكود */
const COLS_T = "38px 100px 96px 118px 72px 1fr 110px 100px";

const HUE: Record<string, string> = {
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  cyan: "bg-cyan-500",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
  orange: "bg-orange-500",
  sky: "bg-sky-500",
  slate: "bg-ink-700",
};

const CONFIG = {
  purchase: {
    title: "فاتورة مشتريات",
    sub: "توريد أصناف من المورد",
    party: "المورد",
    partyPlural: "الموردين",
    save: "حفظ فاتورة المشتريات",
    cash: "المدفوع للمورد",
    rest: "المتبقي للمورد",
    banner: "امسح باركود الصنف الوارد أو اضغط صنفاً من القائمة لإضافته إلى فاتورة التوريد",
    accent: "bg-cyan-600 border-cyan-800",
    badge: "bg-cyan-400 text-ink-950 border-cyan-200",
  },
  salesReturn: {
    title: "مرتجع مبيعات",
    sub: "إرجاع أصناف من العميل",
    party: "العميل",
    partyPlural: "العملاء",
    save: "حفظ مرتجع المبيعات",
    cash: "المسترد نقداً للعميل",
    rest: "المتبقي على الحساب",
    banner: "امسح باركود الصنف المرتجع من العميل ليعود إلى رصيد المخزن تلقائياً",
    accent: "bg-cash-orange border-orange-700",
    badge: "bg-orange-300 text-ink-950 border-orange-100",
  },
  purchaseReturn: {
    title: "مرتجع مشتريات",
    sub: "إرجاع أصناف إلى المورد",
    party: "المورد",
    partyPlural: "الموردين",
    save: "حفظ مرتجع المشتريات",
    cash: "المسترد نقداً من المورد",
    rest: "المتبقي على الحساب",
    banner: "امسح باركود الصنف المرتجع للمورد ليُخصم من رصيد المخزن وتُسوّى حسابه",
    accent: "bg-cash-violet border-violet-800",
    badge: "bg-violet-300 text-ink-950 border-violet-100",
  },
} as const;

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function TradeScreen({ kind, data, refresh, notify, stamp }: Props) {
  const cfg = CONFIG[kind];
  const parties = kind === "salesReturn" ? data.customers : data.suppliers;
  const isPurchase = kind === "purchase";
  const addsStock = kind !== "purchaseReturn";

  const [partyId, setPartyId] = useState<number>(parties[0]?.id ?? 0);
  const [lines, setLines] = useState<Line[]>([]);
  const [lastUid, setLastUid] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [page, setPage] = useState(0);
  const [code, setCode] = useState("");
  const [paid, setPaid] = useState("0");
  const [discountPercent, setDiscount] = useState(0);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<PrintDoc | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showParty, setShowParty] = useState(false);

  const barcodeRef = useRef<HTMLInputElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const party = parties.find((p) => p.id === partyId);
  const subtotal = r2(lines.reduce((s, l) => s + l.qty * l.price, 0));
  const discountValue = r2((subtotal * discountPercent) / 100);
  const total = r2(subtotal - discountValue);
  const cash = r2(Math.max(0, Math.min(total, Number(paid) || 0)));
  const credit = r2(total - cash);
  const qtyCount = r2(lines.reduce((s, l) => s + l.qty, 0));
  const retailValue = r2(lines.reduce((s, l) => s + l.qty * (l.product.price || 0), 0));
  const marginPct = total > 0 ? Math.round(((retailValue - total) / total) * 1000) / 10 : 0;

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.products.filter((p) => {
      const okCat = categoryId === "all" || p.categoryId === categoryId;
      const okTerm = term === "" || p.name.toLowerCase().includes(term) || p.code.includes(term);
      return okCat && okTerm;
    });
  }, [data.products, categoryId, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const hueOf = (catId: number) => HUE[data.categories.find((c) => c.id === catId)?.hue ?? "slate"] ?? HUE.slate;

  const history = useMemo(() => {
    if (isPurchase) return data.purchases.filter((p) => p.supplierId === partyId).slice(0, 6).map((p) => ({ number: p.number, total: p.total, paid: p.paid, at: p.createdAt }));
    return data.returns
      .filter((r) => r.kind === (kind === "salesReturn" ? "مرتجع مبيعات" : "مرتجع مشتريات") && r.partyName === party?.name)
      .slice(0, 6)
      .map((r) => ({ number: r.number, total: r.total, paid: r.cashAmount, at: r.createdAt }));
  }, [data.purchases, data.returns, isPurchase, kind, partyId, party?.name]);

  /* ---------------- إضافة الأصناف ---------------- */
  const add = (p: Product) => {
    const price = kind === "salesReturn" ? p.price : p.cost;
    setLines((prev) => {
      const found = prev.find((l) => l.product.id === p.id);
      if (found) {
        setLastUid(found.uid);
        return prev.map((l) => (l.product.id === p.id ? { ...l, qty: r2(l.qty + 1) } : l));
      }
      const line: Line = { uid: uid(), product: p, qty: 1, price };
      setLastUid(line.uid);
      return [...prev, line];
    });
    sfxAdd();
    if (!addsStock && p.stock <= 0) notify("warn", `تنبيه: لا يوجد رصيد بالمخزن للصنف «${p.name}»`);
  };

  const scan = () => {
    const term = code.trim();
    if (!term) return;
    const hit =
      data.products.find((x) => x.code === term) ??
      data.products.find((x) => x.code.endsWith(term)) ??
      data.products.find((x) => x.name.includes(term));
    setCode("");
    if (!hit) {
      sfxError();
      notify("err", `لا يوجد صنف بالكود «${term}»`);
      return;
    }
    sfxScan();
    add(hit);
  };

  const setLine = (lineUid: string, patch: Partial<Pick<Line, "qty" | "price">>) =>
    setLines((prev) => prev.map((l) => (l.uid === lineUid ? { ...l, ...patch } : l)));

  const removeLine = (lineUid: string) => {
    const target = lines.find((l) => l.uid === lineUid);
    setLines((prev) => prev.filter((l) => l.uid !== lineUid));
    sfxRemove();
    if (target) notify("warn", `تم حذف «${target.product.name}» من المستند`);
  };

  const resetDoc = () => {
    setLines([]);
    setPaid("0");
    setDiscount(0);
    setReference("");
    setNotes("");
    setLastUid(null);
    sfxKey();
    barcodeRef.current?.focus();
  };

  const payFull = () => {
    if (!lines.length) {
      sfxError();
      notify("warn", "أضف أصنافاً إلى المستند أولاً");
      return;
    }
    setPaid(String(total));
    sfxCash();
    notify("ok", `تم تسجيل تسوية كاملة بمبلغ ${money(total)} جنيه`);
  };

  /* ---------------- الحفظ ---------------- */
  const save = async (print: boolean) => {
    if (busy) return;
    if (!lines.length) {
      sfxError();
      notify("err", "أضف أصنافاً إلى المستند أولاً");
      return;
    }
    if (!partyId) {
      sfxError();
      notify("err", `اختر ${cfg.party} أولاً`);
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          partyId,
          referenceNumber: reference ? Number(reference) : null,
          paid: cash,
          discountPercent,
          notes,
          items: lines.map((l) => ({ productId: l.product.id, qty: l.qty, price: l.price })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      await refresh();
      setDoc({
        title: cfg.title,
        number: String(json.number),
        party: json.partyName,
        date: shortStamp(new Date().toISOString()),
        amount: json.total,
        lines: [
          ...lines.map((l) => ({ label: `${l.product.name} × ${qtyText(l.qty)}`, value: money(l.qty * l.price) })),
          ...(discountPercent > 0 ? [{ label: `الخصم (${discountPercent}%)`, value: money(discountValue) }] : []),
          { label: cfg.cash, value: money(json.paid) },
          { label: cfg.rest, value: money(json.remaining) },
        ],
        notes: notes || (isPurchase ? "تم تحديث سعر الشراء ورصيد المخزن وحساب المورد" : "تم عكس الكميات وتسوية الحساب بدقة"),
      });
      resetDoc();
      sfxSave();
      notify("ok", `تم حفظ ${cfg.title} رقم ${json.number} وتحديث المخزون والحسابات`);
    } catch (e) {
      sfxError();
      notify("err", e instanceof Error ? e.message : "تعذر حفظ المستند");
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- اختصارات مفاتيح الوظائف ---------------- */
  const api = useRef({ save, resetDoc, payFull });
  useEffect(() => {
    api.current = { save, resetDoc, payFull };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!["F3", "F4", "F5", "F10", "F11", "F12"].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "F3") {
        sfxKey();
        barcodeRef.current?.focus();
        barcodeRef.current?.select();
      }
      if (e.key === "F4") api.current.resetDoc();
      if (e.key === "F5") void api.current.save(false);
      if (e.key === "F10") void api.current.save(true);
      if (e.key === "F11") {
        sfxKey();
        setShowDiscount(true);
      }
      if (e.key === "F12") api.current.payFull();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => barcodeRef.current?.focus(), 90);
    return () => window.clearTimeout(t);
  }, [kind]);

  useEffect(() => {
    gridRef.current?.querySelector<HTMLElement>("[data-last='1']")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [lastUid]);

  const submitParty = async (v: Record<string, string>) => {
    const res = await apiFetch("/api/parties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: isPurchase || kind === "purchaseReturn" ? "supplier" : "customer",
        name: v.name,
        phone: v.phone ?? "",
        address: v.address ?? "",
        openingBalance: Number(v.balance) || 0,
        balance: Number(v.balance) || 0,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      sfxError();
      notify("err", json.error ?? "تعذر إضافة الحساب");
      return;
    }
    await refresh();
    setPartyId(json.id);
    setShowParty(false);
    sfxSave();
    notify("ok", `تمت إضافة «${json.name}» واختياره في المستند`);
  };

  const balanceAfter = r2((party?.balance ?? 0) + (isPurchase ? credit : -credit));

  return (
    <section className="flex-1 min-h-0 flex flex-col gap-1.5 p-1.5 bg-paper overflow-hidden" dir="rtl">
      {/* ============ لافتة العنوان (نفس نمط فاتورة المبيعات) ============ */}
      <div className="relative shrink-0 rounded-xl bg-ink-700 overflow-hidden shadow-[0_6px_18px_-8px_rgba(15,23,42,0.8)]">
        <div className="pointer-events-none absolute inset-0 cy-aurora opacity-90" />
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 h-[44px]">
          <div className="flex items-center gap-1.5 justify-self-start min-w-0">
            <span
              className={`h-8 px-3 rounded-lg border text-[12px] font-black text-white flex items-center whitespace-nowrap ${cfg.accent}`}
            >
              {isPurchase ? "إضافة للمخزن +" : addsStock ? "إرجاع للمخزن +" : "خصم من المخزن −"}
            </span>
            <span className="cy-h-balances hidden md:flex h-8 px-2.5 items-center gap-1.5 rounded-lg bg-ink-800 border border-white/15 text-[11.5px] font-bold text-slate-200 whitespace-nowrap">
              <IcoUsers className="w-3.5 h-3.5 text-cash-cyan" />
              رصيد {cfg.party}:
              <b className={`cy-num ${(party?.balance ?? 0) > 0 ? "text-cash-red" : "text-cash-green"}`}>{money(party?.balance ?? 0)}</b>
            </span>
            <span className="hidden xl:flex flex-col leading-none">
              <span className="text-[10px] text-slate-400 font-semibold">{stamp.date}</span>
              <span className="text-[12px] text-slate-100 font-bold cy-num mt-0.5">{stamp.time}</span>
            </span>
          </div>

          <h1 className="text-center text-white font-black text-[16px] sm:text-[18px] tracking-wide drop-shadow whitespace-nowrap">
            {cfg.title}
            <span className="hidden sm:inline text-slate-400 text-[12px] font-bold"> — {cfg.sub}</span>
          </h1>

          <div className="justify-self-end flex items-center gap-1.5">
            <span className="text-[10.5px] text-slate-400 font-bold hidden sm:inline">رقم المستند</span>
            <span
              className={`min-w-[66px] h-8 px-3 grid place-items-center rounded-lg border-2 font-black text-[15px] cy-num text-ink-900 ${
                isPurchase ? "bg-cyan-100 border-cash-cyan" : "bg-amber-soft border-amber-brand shadow-[0_0_16px_-4px_rgba(245,158,11,0.8)]"
              }`}
            >
              {isPurchase ? data.nextPurchaseNumber : "جديد"}
            </span>
          </div>
        </div>
      </div>

      {/* ============ شريط الحساب والباركود والبحث (نفس نمط شاشة البيع) ============ */}
      <div className="shrink-0 rounded-xl bg-white border border-line shadow-sm px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Field label={cfg.party} grow>
            <select
              value={partyId}
              onChange={(e) => setPartyId(Number(e.target.value))}
              className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] font-bold text-ink-800 h-full"
            >
              {parties.length === 0 && <option value={0}>لا توجد حسابات</option>}
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — رصيد {money(p.balance)}
                </option>
              ))}
            </select>
            <MiniAdd title={`إضافة ${cfg.party} جديد`} onClick={() => { sfxKey(); setShowParty(true); }} />
          </Field>

          <Field label="الكود / الباركود" icon={<IcoBarcode className="w-4 h-4 text-amber-600" />} grow>
            <input
              ref={barcodeRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  scan();
                }
              }}
              onBlur={scan}
              placeholder="امسح الباركود ثم Enter"
              className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-mono font-bold text-ink-900 placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal h-full"
            />
          </Field>

          <Field label="بحث الصنف" icon={<IcoSearch className="w-4 h-4 text-slate-400" />} grow>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="اسم الصنف..."
              className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] text-ink-900 placeholder:text-slate-400 h-full"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-slate-400 hover:text-cash-red" aria-label="مسح البحث">
                <IcoX className="w-3.5 h-3.5" />
              </button>
            )}
          </Field>

          {!isPurchase && (
            <Field label="رقم الفاتورة الأصلية">
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="اختياري"
                inputMode="numeric"
                className="w-20 bg-transparent outline-none text-center text-[12.5px] font-bold text-ink-900 cy-num h-full placeholder:font-normal placeholder:text-slate-400"
              />
            </Field>
          )}

          <Field label="خصم %">
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={discountPercent}
              onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className="w-14 bg-transparent outline-none text-center text-[13px] font-black text-cash-red cy-num h-full"
            />
          </Field>

          <Field label="البيان" grow>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات المستند..."
              className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] text-ink-900 placeholder:text-slate-400 h-full"
            />
          </Field>
        </div>
      </div>

      {/* ============ لافتة التعليمات ============ */}
      <div className="shrink-0 relative overflow-hidden rounded-lg bg-ink-600 h-[28px] grid place-items-center">
        <div className="pointer-events-none absolute inset-y-0 w-1/3 cy-marquee bg-gradient-to-l from-transparent via-white/10 to-transparent" />
        <p className="relative text-white text-[12px] font-bold text-center px-2">{cfg.banner}</p>
      </div>

      {/* ============ مساحة العمل: المستند + قائمة الأصناف ============ */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-1.5">
        {/* جدول أصناف المستند */}
        <div className="flex-[3] min-h-0 flex flex-col rounded-xl bg-white border border-line overflow-hidden shadow-sm">
          <div
            className="shrink-0 grid bg-ink-800 text-white text-[12px] font-black"
            style={{ gridTemplateColumns: COLS_T, height: HEAD_H }}
          >
            {["×", "الإجمالي", isPurchase ? "سعر الشراء" : "السعر", "الكمية", "الوحدة", "اسم الصنف", "الرصيد بعد", "الكود"].map(
              (h) => (
                <div key={h} className="flex items-center justify-center px-1.5 border-l border-white/10 last:border-l-0">
                  {h}
                </div>
              ),
            )}
          </div>

          <div ref={gridRef} className="flex-1 min-h-0 overflow-y-auto cy-scroll">
            {lines.length === 0 ? (
              <div className="h-full grid place-items-center p-6 text-center">
                <div>
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 grid place-items-center text-slate-400 mb-2">
                    <IcoBarcode className="w-6 h-6" />
                  </div>
                  <p className="text-[13.5px] font-bold text-ink-700">لا توجد أصناف في المستند بعد</p>
                  <p className="text-[12px] text-slate-500 mt-1">{cfg.banner}</p>
                </div>
              </div>
            ) : (
              lines.map((l, idx) => {
                const after = r2(l.product.stock + (addsStock ? l.qty : -l.qty));
                const short = after < 0;
                const isLast = lastUid === l.uid;
                return (
                  <div
                    key={l.uid}
                    data-last={isLast ? "1" : "0"}
                    className={`cy-row grid items-stretch text-[12.5px] border-b border-slate-200 transition-colors hover:bg-amber-50/70 ${
                      isLast ? "cy-flash" : idx % 2 === 0 ? "bg-white" : "bg-paper-2"
                    }`}
                    style={{ gridTemplateColumns: COLS_T, height: ROW_H }}
                  >
                    <button
                      onClick={() => removeLine(l.uid)}
                      className="grid place-items-center text-slate-400 hover:text-white hover:bg-cash-red transition-colors border-l border-slate-200"
                      title="حذف السطر"
                      aria-label={`حذف ${l.product.name}`}
                    >
                      <IcoTrash className="w-3.5 h-3.5" />
                    </button>
                    <div className="grid place-items-center font-black text-ink-900 cy-num border-l border-slate-200 bg-slate-50/60">
                      {money(l.qty * l.price)}
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={l.price}
                      onChange={(e) => setLine(l.uid, { price: Math.max(0, Number(e.target.value) || 0) })}
                      className="w-full h-full text-center bg-transparent outline-none font-bold text-ink-800 cy-num border-l border-slate-200 focus:bg-amber-100"
                    />
                    <div className="flex items-center justify-center gap-0.5 border-l border-slate-200">
                      <button
                        onClick={() => setLine(l.uid, { qty: Math.max(0.01, r2(l.qty - 1)) })}
                        className="w-5 h-6 grid place-items-center rounded text-slate-500 hover:bg-ink-800 hover:text-white text-[13px] font-black"
                        aria-label="إنقاص"
                      >
                        −
                      </button>
                      <input
                        value={qtyText(l.qty)}
                        onChange={(e) => {
                          const v = Number.parseFloat(e.target.value.replace(/[^\d.]/g, ""));
                          setLine(l.uid, { qty: Number.isFinite(v) ? v : 0 });
                        }}
                        className="w-9 text-center bg-transparent outline-none font-black text-ink-900 cy-num focus:bg-amber-100 rounded"
                      />
                      <button
                        onClick={() => setLine(l.uid, { qty: r2(l.qty + 1) })}
                        className="w-5 h-6 grid place-items-center rounded text-slate-500 hover:bg-ink-800 hover:text-white text-[13px] font-black"
                        aria-label="زيادة"
                      >
                        +
                      </button>
                    </div>
                    <div className="grid place-items-center text-[11.5px] text-slate-600 border-l border-slate-200">{l.product.unit}</div>
                    <div className="cy-box px-2 font-bold text-ink-800 truncate border-l border-slate-200 flex items-center justify-center gap-1.5">
                      <span className={`w-1.5 h-4 rounded-full shrink-0 ${hueOf(l.product.categoryId)}`} />
                      <span className="truncate">{l.product.name}</span>
                    </div>
                    <div
                      className={`flex items-center justify-center gap-1 cy-num text-[11.5px] font-bold border-l border-slate-200 ${
                        short ? "text-cash-red bg-red-50" : "text-ink-700"
                      }`}
                      title={`الرصيد الحالي ${qtyText(l.product.stock)}`}
                    >
                      <span className="text-[10px] text-slate-400">{qtyText(l.product.stock)}←</span>
                      <span>{qtyText(after)}</span>
                    </div>
                    <div className="grid place-items-center font-mono text-[11.5px] text-amber-800 bg-amber-50/70">{l.product.code}</div>
                  </div>
                );
              })
            )}
          </div>

          <div
            className="cy-h-tableTotals shrink-0 bg-paper border-t border-line flex items-center justify-between px-3 text-[11.5px] font-bold text-ink-700 gap-2 overflow-x-auto cy-scroll"
            style={{ height: FOOT_H }}
          >
            <span>
              عدد الأسطر: <b className="cy-num text-ink-900">{lines.length}</b>
            </span>
            <span>
              إجمالي الكميات: <b className="cy-num text-ink-900">{qtyText(qtyCount)}</b>
            </span>
            <span>
              الإجمالي قبل الخصم: <b className="cy-num text-ink-900">{money(subtotal)}</b>
            </span>
            {discountPercent > 0 && (
              <span className="text-cash-red">
                خصم {discountPercent}% = <b className="cy-num">{money(discountValue)}</b>
              </span>
            )}
            {isPurchase && lines.length > 0 && (
              <span className={marginPct >= 0 ? "text-cash-green-deep" : "text-cash-red"}>
                هامش الربح المتوقع: <b className="cy-num">{marginPct}%</b>
              </span>
            )}
          </div>
        </div>

        {/* قائمة الأصناف (اللمس) */}
        <div className="flex-[2] min-h-0 flex flex-col rounded-xl bg-white border border-line overflow-hidden shadow-sm">
          <div className="shrink-0 px-2 flex items-center justify-between gap-2 bg-paper border-b border-line" style={{ height: HEAD_H }}>
            <span className="text-[12px] font-black text-ink-800 whitespace-nowrap">الأصناف</span>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value === "all" ? "all" : Number(e.target.value));
                setPage(0);
              }}
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
              <div className="h-full grid place-items-center text-[12.5px] text-slate-500 font-bold">لا توجد أصناف مطابقة</div>
            ) : (
              <div className="grid grid-cols-3 xl:grid-cols-4 gap-1">
                {slice.map((p) => {
                  const low = p.stock <= p.minStockLimit;
                  const h = HUE[data.categories.find((c) => c.id === p.categoryId)?.hue ?? "slate"] ?? HUE.slate;
                  return (
                    <button
                      key={p.id}
                      onClick={() => add(p)}
                      title={p.name}
                      className="group relative text-right rounded-lg border border-line bg-white px-1.5 pt-1.5 pb-1 h-[58px] cy-press cy-focus overflow-hidden flex flex-col justify-between hover:border-amber-brand hover:shadow-[0_6px_16px_-10px_rgba(245,158,11,0.9)]"
                    >
                      <span className={`absolute top-0 bottom-0 right-0 w-0.5 ${h} opacity-80`} />
                      <span className="block text-[11px] font-bold leading-[1.3] text-ink-800 line-clamp-2 pr-1">{p.name}</span>
                      <span className="flex items-center justify-between gap-1 pr-1">
                        <span className="text-[11.5px] font-black text-cash-green-deep cy-num">
                          {money(kind === "salesReturn" ? p.price : p.cost)}
                        </span>
                        <span className={`cy-h-stock text-[9.5px] font-bold cy-num ${low ? "text-cash-red" : "text-slate-400"}`}>
                          {qtyText(p.stock)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="shrink-0 bg-paper border-t border-line flex items-center justify-between px-2 gap-2" style={{ height: FOOT_H }}>
            <PagerBtn disabled={safePage === 0} onClick={() => setPage(Math.max(0, safePage - 1))}>
              <IcoChevronRight className="w-3.5 h-3.5" />
              السابق
            </PagerBtn>
            <span className="text-[11.5px] font-black text-ink-800 cy-num">
              {safePage + 1} / {pages}
            </span>
            <PagerBtn disabled={safePage >= pages - 1} onClick={() => setPage(Math.min(pages - 1, safePage + 1))}>
              التالي
              <IcoChevronLeft className="w-3.5 h-3.5" />
            </PagerBtn>
          </div>
        </div>
      </div>

      {/* ============ خانات المبالغ الكبيرة (نفس خانات شاشة البيع وتتحكم فيها الإعدادات) ============ */}
      <div className="shrink-0 flex flex-wrap items-stretch justify-center gap-1.5">
        <AmountTile k="net" label="إجمالي المستند">
          {money(total)}
        </AmountTile>

        <AmountTile
          k="paid"
          label={cfg.cash}
          aside={
            <button
              onClick={payFull}
              className="text-[10px] font-black opacity-80 hover:text-cash-red"
              title="تسوية كاملة (F12)"
            >
              تسوية كاملة F12
            </button>
          }
        >
          <input
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            inputMode="decimal"
            aria-label={cfg.cash}
            style={{ textAlign: "var(--cy-amt-paid-na)" as React.CSSProperties["textAlign"] }}
            className="w-full bg-transparent outline-none font-black leading-none cy-num focus:bg-white/60 rounded"
          />
        </AmountTile>

        <AmountTile
          k="rem"
          label={cfg.rest}
          aside={<span className="text-[9.5px] font-black">{credit > 0 ? "على الحساب" : "مسدد بالكامل"}</span>}
        >
          {money(credit)}
        </AmountTile>

        <div className="cy-h-balances flex flex-wrap gap-1.5">
          <AmountTile k="prev" label={`رصيد ${cfg.party} الحالي`}>
            {money(party?.balance ?? 0)}
          </AmountTile>

          <AmountTile k="after" label="الرصيد بعد المستند">
            {money(balanceAfter)}
          </AmountTile>
        </div>
      </div>

      <div className="shrink-0 text-center text-[11px] font-bold text-slate-500">
        {cfg.party}: <span className="text-ink-800">{party?.name ?? "—"}</span> · الخصم:{" "}
        <span className="text-ink-800 cy-num">{discountPercent}%</span>
      </div>

      {/* ============ سجل المستندات السابقة للحساب ============ */}
      <div className="shrink-0 flex items-center gap-2 flex-wrap justify-center">
        <Pill tone="slate">
          <IcoWallet className="w-3.5 h-3.5" />
          رصيد {cfg.party} الحالي: <b className="cy-num">{money(party?.balance ?? 0)}</b>
        </Pill>
        <Pill tone="amber">
          الرصيد بعد المستند: <b className="cy-num">{money(balanceAfter)}</b>
        </Pill>
        <div className="flex items-center gap-1.5 overflow-x-auto cy-scroll max-w-full">
          {history.length === 0 ? (
            <span className="text-[11px] font-bold text-slate-500">لا توجد مستندات سابقة لهذا الحساب</span>
          ) : (
            history.map((h) => (
              <span key={h.number} className="shrink-0 h-7 px-2.5 rounded-lg bg-white border border-line flex items-center gap-1.5 text-[11px] font-bold text-ink-700">
                <b className="font-mono text-amber-800">{h.number}</b>
                <span className="cy-num">{money(h.total)}</span>
                <span className="text-slate-400 cy-num">{shortStamp(h.at)}</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* ============ مفاتيح الوظائف (نفس أزرار شاشة البيع) ============ */}
      <div className="cy-h-fnKeys shrink-0 grid grid-cols-2 sm:grid-cols-6 gap-1.5">
        <FnKey onClick={resetDoc} k="F4" tone="light">
          مستند جديد
        </FnKey>
        <FnKey onClick={() => barcodeRef.current?.focus()} k="F3" tone="light">
          بحث بالكود
        </FnKey>
        <FnKey onClick={() => { sfxKey(); setShowDiscount(true); }} k="F11" tone="red">
          خصم
        </FnKey>
        <FnKey onClick={payFull} k="F12" tone="orange">
          تسوية كاملة
        </FnKey>
        <FnKey onClick={() => void save(false)} k="F5" tone="save" busy={busy}>
          <span className="inline-flex items-center gap-1.5">
            <IcoCheck className="w-4 h-4" />
            {cfg.save}
          </span>
        </FnKey>
        <FnKey onClick={() => void save(true)} k="F10" tone="savePrint" busy={busy}>
          <span className="inline-flex items-center gap-1.5">
            <IcoPrint className="w-4 h-4" />
            حفظ وطباعة
          </span>
        </FnKey>
      </div>

      {showDiscount && (
        <DiscountDialog
          current={discountPercent}
          subtotal={subtotal}
          onClose={() => setShowDiscount(false)}
          onApply={(percent) => {
            setDiscount(percent);
            setShowDiscount(false);
            sfxCash();
            notify("ok", `تم تطبيق خصم ${percent}% على المستند`);
          }}
        />
      )}

      {showParty && (
        <PromptDialog
          title={`إضافة ${cfg.party} جديد`}
          subtitle={`سيتم اختياره تلقائياً في ${cfg.title}`}
          fields={[
            { key: "name", label: `اسم ${cfg.party}`, placeholder: "اكتب الاسم...", required: true },
            { key: "phone", label: "رقم التليفون", placeholder: "01xxxxxxxxx" },
            { key: "address", label: "العنوان", placeholder: "المدينة - الشارع" },
            { key: "balance", label: "الرصيد الافتتاحي", placeholder: "0.00", type: "number" },
          ]}
          submitLabel="حفظ الحساب"
          onClose={() => setShowParty(false)}
          onSubmit={(v) => void submitParty(v)}
        />
      )}

      {doc && <PrintDocumentModal doc={doc} shop={data.shop} onClose={() => setDoc(null)} />}
    </section>
  );
}

/* ---------------- عناصر مساعدة ---------------- */

function Field({ label, children, icon, grow }: { label: string; children: React.ReactNode; icon?: React.ReactNode; grow?: boolean }) {
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

function PagerBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
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

function Pill({ children, tone }: { children: React.ReactNode; tone: "slate" | "amber" }) {
  return (
    <span
      className={`h-7 px-3 rounded-full flex items-center gap-1.5 text-[11.5px] font-bold border ${
        tone === "slate" ? "bg-ink-800 text-slate-200 border-black/40" : "bg-amber-soft text-amber-900 border-amber-brand/70"
      }`}
    >
      {children}
    </span>
  );
}

const FN_TONES: Record<string, string> = {
  light: "bg-slate-200 text-ink-800 border-slate-300 hover:bg-slate-300",
  red: "bg-cash-red text-white border-red-700 hover:brightness-110",
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
  tone: "light" | "red" | "orange" | "save" | "savePrint";
  busy?: boolean;
}) {
  // زرا الحفظ يستخدمان لونين أخضرين من الإعدادات (نفس أزرار شاشة البيع)
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
