"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Bootstrap, InvoiceRow, ModuleKind, Product, SessionUser, TrialStatus } from "@/lib/types";
import { money } from "@/lib/format";
import {
  IcoBox,
  IcoCalc,
  IcoChart,
  IcoCheck,
  IcoCode,
  IcoCart,
  IcoGear,
  IcoHome,
  IcoDatabase,
  IcoMenu,
  IcoLogo,
  IcoMinus,
  IcoMute,
  IcoPrint,
  IcoSearch,
  IcoSliders,
  IcoSound,
  IcoSquare,
  IcoPhone,
  IcoSync,
  IcoTrash,
  IcoUsers,
  IcoWallet,
  IcoX,
} from "@/components/icons";

/* ============================ الشريط العلوي ============================ */

export function TitleBar({
  data,
  muted,
  onToggleMute,
  onPickProduct,
  onPickInvoice,
  onWindowAction,
  minimized,
  user,
  trial,
  onLogout,
  onOpenActivation,
  onOpenCalculator,
}: {
  data: Bootstrap;
  muted: boolean;
  onToggleMute: () => void;
  onPickProduct: (p: Product) => void;
  onPickInvoice: (i: InvoiceRow) => void;
  onWindowAction: (a: "min" | "max" | "close") => void;
  minimized: boolean;
  user: SessionUser | null;
  trial: TrialStatus | null;
  onLogout: () => void;
  onOpenActivation: () => void;
  onOpenCalculator?: () => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return { prods: [] as Product[], custs: [] as Bootstrap["customers"], invs: [] as InvoiceRow[] };
    return {
      prods: data.products
        .filter((p) => p.name.toLowerCase().includes(term) || p.code.includes(term))
        .slice(0, 6),
      custs: data.customers
        .filter((c) => c.name.toLowerCase().includes(term) || c.phone.includes(term))
        .slice(0, 4),
      invs: data.invoices
        .filter((i) => String(i.number).includes(term) || i.customerName.toLowerCase().includes(term))
        .slice(0, 4),
    };
  }, [q, data]);

  const flat = useMemo(
    () => [
      ...results.prods.map((p) => ({ kind: "p" as const, p })),
      ...results.custs.map((c) => ({ kind: "c" as const, c })),
      ...results.invs.map((i) => ({ kind: "i" as const, i })),
    ],
    [results],
  );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (idx: number) => {
    const hit = flat[idx];
    if (!hit) return;
    if (hit.kind === "p") onPickProduct(hit.p);
    if (hit.kind === "i") onPickInvoice(hit.i);
    if (hit.kind === "c") setQ(hit.c.name);
    setOpen(false);
  };

  return (
    <header
      className="relative z-40 shrink-0 border-b border-black/40 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)]"
      style={{ background: "var(--cy-header)" }}
      dir="rtl"
    >
      <div className="pointer-events-none absolute inset-0 cy-aurora opacity-70" />
      <div className="relative flex items-center gap-2 px-2.5 h-[58px] sm:h-[62px]">
        {/* يمين: الشعار والعنوان */}
        <div className="flex items-center gap-2.5 shrink-0">
          <IcoLogo className="w-9 h-9 sm:w-10 sm:h-10 drop-shadow" />
          <div className="leading-none">
            <div className="text-white font-black tracking-[0.14em] text-[15px] sm:text-[17px]">
              CASH<span className="text-amber-brand"> YOU</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 font-semibold mt-1">
              كاش يو · نقاط البيع
            </div>
          </div>
        </div>

        <div className="w-px h-8 bg-white/10 mx-1 hidden sm:block" />

        {/* البحث العام: أيقونة تفتح شاشة عائمة */}
        <div className="flex-1" />
        <SearchOverlay
          data={data}
          onPickProduct={onPickProduct}
          onPickInvoice={onPickInvoice}
        />

        {/* يسار: الصوت + المستخدم + الترخيص + أزرار النافذة */}
        <div className="flex items-center gap-1.5 sm:gap-2 mr-auto shrink-0">
          {onOpenCalculator && (
            <button
              onClick={onOpenCalculator}
              title="آلة حاسبة"
              aria-label="آلة حاسبة"
              className="h-8 w-8 rounded-full border bg-white/5 border-white/15 text-slate-300 hover:text-amber-brand cy-press cy-focus grid place-items-center"
            >
              <IcoCalc className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onToggleMute}
            title={muted ? "تشغيل أصوات النظام" : "كتم كل الأصوات"}
            aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
            className={`h-8 w-8 rounded-full border cy-press cy-focus grid place-items-center ${
              muted
                ? "bg-cash-red/15 border-cash-red/50 text-cash-red"
                : "bg-white/5 border-white/15 text-slate-300 hover:text-cash-green"
            }`}
          >
            {muted ? <IcoMute className="w-3.5 h-3.5" /> : <IcoSound className="w-3.5 h-3.5" />}
          </button>

          {trial && (
            <button
              onClick={onOpenActivation}
              className={`hidden sm:flex items-center gap-1.5 h-9 rounded-xl border px-2.5 transition hover:brightness-125 ${trial.licensed ? "bg-cash-green/15 border-cash-green/45 text-cash-green" : trial.expired ? "bg-cash-red/15 border-cash-red/45 text-cash-red" : trial.daysLeft <= 3 ? "bg-amber-brand/15 border-amber-brand/45 text-amber-brand" : "bg-cash-green/15 border-cash-green/45 text-cash-green"}`}
              title={
                trial.licensed
                  ? `نسخة مفعّلة حتى ${trial.license?.validUntil ? new Date(trial.license.validUntil).toLocaleDateString("ar-EG") : ""} — اضغط للتفاصيل`
                  : `الفترة التجريبية: ${trial.daysLeft} يوم متبقٍ · اضغط للتفعيل · حدود: ${trial.limits.products} صنف / ${trial.limits.invoices} فاتورة / ${trial.limits.customers} عميل / ${trial.limits.suppliers} مورد`
              }
            >
              <span className={`w-2 h-2 rounded-full ${trial.licensed ? "bg-cash-green cy-ring" : trial.expired ? "bg-cash-red" : trial.daysLeft <= 3 ? "bg-amber-brand animate-pulse" : "bg-cash-green cy-ring"}`} />
              <span className="text-[12px] font-bold">
                {trial.licensed
                  ? `مفعّلة · ${trial.license?.daysLeft ?? 0} يوم`
                  : trial.expired
                    ? "انتهت التجربة · فعّل"
                    : `تجريبي · ${trial.daysLeft} يوم`}
              </span>
            </button>
          )}

          <button
            onClick={onLogout}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
            className="hidden sm:flex items-center gap-1.5 h-9 rounded-xl border border-white/10 bg-ink-700/70 px-2.5 text-[12px] font-bold text-slate-300 transition hover:border-cash-red/50 hover:text-cash-red"
          >
            <IcoX className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">خروج</span>
          </button>

          <div className="flex items-center gap-1 mr-1">
            <WinBtn label="تصغير" onClick={() => onWindowAction("min")} tone="slate">
              <IcoMinus className="w-3.5 h-3.5" />
            </WinBtn>
            <WinBtn label="تكبير" onClick={() => onWindowAction("max")} tone="slate">
              <IcoSquare className="w-3 h-3" />
            </WinBtn>
            <WinBtn label="إغلاق" onClick={() => onWindowAction("close")} tone="red">
              <IcoX className="w-3.5 h-3.5" />
            </WinBtn>
          </div>
        </div>
      </div>

      {minimized && (
        <div className="absolute inset-x-0 -bottom-px h-px bg-amber-brand" aria-hidden />
      )}
      <span className="sr-only">{data.shop.name}</span>
    </header>
  );
}

/* ============================ البحث العام العائم ============================ */

/**
 * زر أيقونة صغير في الشريط العلوي؛ عند الضغط تظهر شاشة عائمة
 * بها شريط البحث والنتائج، وبجانب كل نتيجة زر لعرضها.
 */
function SearchOverlay({
  data,
  onPickProduct,
  onPickInvoice,
}: {
  data: Bootstrap;
  onPickProduct: (p: Product) => void;
  onPickInvoice: (i: InvoiceRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* اختصار Ctrl+K لفتح البحث */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") { setOpen(false); setQ(""); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  const term = q.trim().toLowerCase();
  const prods = term
    ? data.products.filter((p) => p.name.toLowerCase().includes(term) || p.code.includes(term)).slice(0, 8)
    : [];
  const custs = term
    ? data.customers.filter((c) => c.name.toLowerCase().includes(term) || c.phone.includes(term)).slice(0, 5)
    : [];
  const invs = term
    ? data.invoices.filter((i) => String(i.number).includes(term) || i.customerName.toLowerCase().includes(term)).slice(0, 5)
    : [];

  const total = prods.length + custs.length + invs.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="بحث عام (Ctrl + K)"
        aria-label="فتح البحث العام"
        className="h-9 w-9 shrink-0 grid place-items-center rounded-xl border border-white/15 bg-white/5 text-slate-300 transition hover:border-amber-brand/70 hover:text-amber-brand cy-press"
      >
        <IcoSearch className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center p-4 pt-[8vh]" dir="rtl">
          <button
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
            onClick={() => { setOpen(false); setQ(""); }}
            aria-label="إغلاق البحث"
          />
          <div className="cy-pop relative w-full max-w-2xl overflow-hidden rounded-2xl border border-line bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-line bg-paper-2 px-3 py-2.5">
              <IcoSearch className="h-4 w-4 shrink-0 text-amber-600" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن صنف / عميل / فاتورة..."
                className="h-9 flex-1 bg-transparent text-[14px] font-bold text-ink-900 outline-none placeholder:font-normal placeholder:text-slate-400"
              />
              {q && (
                <button onClick={() => setQ("")} className="text-slate-400 hover:text-cash-red" aria-label="مسح">
                  <IcoX className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => { setOpen(false); setQ(""); }}
                className="grid h-7 w-7 place-items-center rounded-lg bg-slate-200 text-ink-700 hover:bg-slate-300"
                aria-label="إغلاق"
              >
                <IcoX className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-[62vh] overflow-y-auto cy-scroll">
              {!term && (
                <p className="px-4 py-8 text-center text-[13px] font-bold text-slate-500">
                  اكتب اسم صنف أو باركود أو رقم فاتورة أو اسم عميل
                </p>
              )}
              {term && total === 0 && (
                <p className="px-4 py-8 text-center text-[13px] font-bold text-slate-500">
                  لا توجد نتائج مطابقة لـ «{q}»
                </p>
              )}

              {prods.length > 0 && <GroupLabel>الأصناف — اضغط «عرض» لإضافتها للفاتورة</GroupLabel>}
              {prods.map((p) => (
                <div key={`p-${p.id}`} className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 hover:bg-amber-50/60">
                  <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] text-amber-800">{p.code}</span>
                  <span className="flex-1 truncate text-[13px] font-bold text-ink-800">{p.name}</span>
                  <span className="shrink-0 text-[12px] font-black text-cash-green-deep cy-num">{money(p.price)}</span>
                  <button
                    onClick={() => { onPickProduct(p); setOpen(false); }}
                    className="shrink-0 rounded-lg bg-ink-800 px-2.5 py-1 text-[11px] font-black text-white hover:bg-ink-700"
                  >
                    عرض
                  </button>
                </div>
              ))}

              {custs.length > 0 && <GroupLabel>العملاء</GroupLabel>}
              {custs.map((c) => (
                <div key={`c-${c.id}`} className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 hover:bg-amber-50/60">
                  <IcoUsers className="h-4 w-4 shrink-0 text-cash-violet" />
                  <span className="flex-1 truncate text-[13px] font-bold text-ink-800">{c.name}</span>
                  <span className="shrink-0 text-[12px] text-slate-500 cy-num">{c.phone || "—"}</span>
                  <span className="shrink-0 text-[12px] font-black cy-num text-ink-700">{money(c.balance)}</span>
                </div>
              ))}

              {invs.length > 0 && <GroupLabel>الفواتير</GroupLabel>}
              {invs.map((inv) => (
                <div key={`i-${inv.id}`} className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 hover:bg-amber-50/60">
                  <span className="shrink-0 rounded bg-ink-700 px-1.5 py-0.5 font-mono text-[11px] text-white">{inv.number}</span>
                  <span className="flex-1 truncate text-[13px] font-bold text-ink-800">{inv.customerName}</span>
                  <span className="shrink-0 text-[12px] font-black text-ink-700 cy-num">{money(inv.total)}</span>
                  <button
                    onClick={() => { onPickInvoice(inv); setOpen(false); }}
                    className="shrink-0 rounded-lg bg-ink-800 px-2.5 py-1 text-[11px] font-black text-white hover:bg-ink-700"
                  >
                    عرض
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-line bg-paper-2 px-3 py-1.5 text-[10.5px] font-bold text-slate-500">
              <span>{total} نتيجة</span>
              <span>Esc للإغلاق · Ctrl+K للفتح</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-2 pb-1 text-[10px] font-black tracking-widest text-slate-400">
      {children}
    </div>
  );
}

function Row({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-right text-[13px] transition-colors ${
        active ? "bg-amber-100" : "hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function WinBtn({
  children,
  label,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: "slate" | "red";
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`w-9 h-8 rounded-lg grid place-items-center cy-press cy-focus border ${
        tone === "red"
          ? "border-white/10 text-slate-300 hover:bg-cash-red hover:text-white hover:border-cash-red"
          : "border-white/10 text-slate-300 hover:bg-white/15 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/* ============================ التبويبات + الشريط الجانبي ============================ */

export type Tab = { id: string; kind: ModuleKind; title: string; badge?: string };

/* ============================ زر القائمة المنسدلة ============================ */

/** كل وحدات البرنامج المتاحة من القائمة */
export const NAV_ITEMS: { kind: ModuleKind; label: string; icon: React.ReactNode; tone: string }[] = [
  { kind: "home", label: "الرئيسية", icon: <IcoHome />, tone: "text-amber-brand" },
  { kind: "invoice", label: "فاتورة مبيعات", icon: <IcoCart />, tone: "text-cash-green" },
  { kind: "invoiceHistory", label: "سجل الفواتير", icon: <IcoChart />, tone: "text-cash-cyan" },
  { kind: "suspended", label: "الفواتير المعلقة", icon: <IcoCart />, tone: "text-amber-brand" },
  { kind: "products", label: "الأصناف والمخازن", icon: <IcoBox />, tone: "text-cash-cyan" },
  { kind: "purchase", label: "فاتورة مشتريات", icon: <IcoCart />, tone: "text-cash-cyan" },
  { kind: "parties", label: "العملاء والموردون", icon: <IcoUsers />, tone: "text-cash-violet" },
  { kind: "installments", label: "نظام التقسيط", icon: <IcoWallet />, tone: "text-fuchsia-400" },
  { kind: "expenses", label: "المصروفات", icon: <IcoGear />, tone: "text-cash-red" },
  { kind: "treasury", label: "الخزينة", icon: <IcoWallet />, tone: "text-emerald-400" },
  { kind: "reports", label: "التقارير والأرباح", icon: <IcoChart />, tone: "text-cash-cyan" },
  { kind: "dashboard", label: "لوحة المالك", icon: <IcoChart />, tone: "text-amber-brand" },
  { kind: "shortages", label: "الأصناف الناقصة", icon: <IcoBox />, tone: "text-cash-red" },
  { kind: "stockMovements", label: "حركات المخزون", icon: <IcoBox />, tone: "text-cash-cyan" },
  { kind: "itemCard", label: "كارت الصنف", icon: <IcoBox />, tone: "text-cash-violet" },
  { kind: "stocktake", label: "جرد المخزون", icon: <IcoBox />, tone: "text-emerald-400" },
  { kind: "barcodePrint", label: "طباعة الباركود", icon: <IcoPrint />, tone: "text-cash-cyan" },
  { kind: "smartPurchase", label: "الشراء الذكي", icon: <IcoCart />, tone: "text-amber-brand" },
  { kind: "priceKiosk", label: "كشك السعر", icon: <IcoCart />, tone: "text-cash-green" },
  { kind: "activityLog", label: "سجل النشاط", icon: <IcoChart />, tone: "text-slate-500" },
  { kind: "deletedInvoices", label: "سجل المحذوفات", icon: <IcoTrash />, tone: "text-cash-red" },
  { kind: "backup", label: "النسخ الاحتياطي", icon: <IcoCheck />, tone: "text-cash-green" },
  { kind: "health", label: "صحة البرنامج", icon: <IcoCheck />, tone: "text-emerald-400" },
  { kind: "users", label: "المستخدمون", icon: <IcoUsers />, tone: "text-amber-brand" },
  { kind: "activation", label: "تفعيل النسخة", icon: <IcoCheck />, tone: "text-cash-green" },
  { kind: "support", label: "الدعم الفني", icon: <IcoPhone />, tone: "text-cash-cyan" },
  { kind: "settings", label: "إعدادات البرنامج", icon: <IcoSliders />, tone: "text-amber-brand" },
];

/**
 * زر ☰ بجانب تبويب «الرئيسية».
 * عند الضغط تنزلق قائمة عائمة تغطي الشاشة من اليمين (مع تعتيم الخلفية)،
 * وتعرض كل وحدات البرنامج — بلا سكرول داخلي.
 * تُغلق بالنقر خارجها أو بمفتاح Escape أو باختيار أي بند منها.
 */
export function NavMenuButton({
  activeKind,
  onPick,
  labels = true,
}: {
  activeKind: Tab["kind"];
  onPick: (kind: ModuleKind, label: string) => void;
  /** إظهار أسماء البنود بجانب الأيقونات */
  labels?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  /* الإغلاق بالنقر خارج القائمة أو بمفتاح Escape */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (wrapRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  /* منع تمرير الصفحة خلف القائمة */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="قائمة الوحدات"
        aria-expanded={open}
        title="قائمة الوحدات"
        className={`grid h-8 w-8 place-items-center rounded-lg border transition-colors cy-press ${
          open
            ? "border-[var(--cy-menu-accent)] bg-[var(--cy-menu-accent)] text-ink-900"
            : "border-line bg-white text-ink-700 hover:border-[var(--cy-menu-accent)] hover:text-[var(--cy-menu-accent)]"
        }`}
      >
        <IcoMenu className="h-4 w-4" />
      </button>

      {open && (
        /* طبقة تغطي الشاشة: تعتيم + لوحة منزلقة من اليمين */
        <div className="fixed inset-0 z-[120] flex justify-start" dir="rtl">
          <button
            aria-label="إغلاق القائمة"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-ink-950/55 backdrop-blur-[2px]"
          />
          <div
            ref={panelRef}
            role="menu"
            className="relative flex h-full w-[290px] max-w-[86vw] flex-col overflow-hidden shadow-[0_0_60px_-10px_rgba(2,10,30,0.9)] cy-drawer-in"
            style={{ background: "var(--cy-menu-bg)", color: "var(--cy-menu-text)" }}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2" style={{ background: "var(--cy-menu-bg)" }}>
              <span className="text-[10px] font-black tracking-wide opacity-70">وحدات البرنامج</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-[13px] font-black transition hover:bg-white/20"
              >
                ✕
              </button>
            </div>
            {/* شبكة: كل بند يملأ صفاً متساوياً — لا سكرول داخلي إطلاقاً */}
            <div
              className="grid min-h-0 flex-1 gap-0.5 overflow-hidden px-1.5 py-1.5"
              style={{ gridTemplateRows: `repeat(${NAV_ITEMS.length}, minmax(0, 1fr))` }}
            >
              {NAV_ITEMS.map((item) => {
                const active = activeKind === item.kind;
                return (
                  <button
                    key={`${item.kind}-${item.label}`}
                    role="menuitem"
                    onClick={() => {
                      onPick(item.kind, item.label);
                      setOpen(false);
                    }}
                    className="flex min-h-0 w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 text-right transition-colors hover:bg-white/10"
                    style={active ? { background: "var(--cy-menu-accent)", color: "#0f172a" } : undefined}
                  >
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${active ? "bg-black/10" : "bg-white/10"}`}>
                      <span className={active ? "" : item.tone}>{item.icon}</span>
                    </span>
                    {labels && <span className="flex-1 truncate text-[12.5px] font-bold leading-none">{item.label}</span>}
                    {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-black/40" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TabStrip({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNew,
  activeKind,
  onPickModule,
  menuLabels = true,
  showMenu = true,
}: {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  activeKind?: Tab["kind"];
  onPickModule?: (kind: ModuleKind, label: string) => void;
  menuLabels?: boolean;
  /** إظهار زر القائمة المنسدلة (يتحكم فيه مفتاح «rail» في الإعدادات) */
  showMenu?: boolean;
}) {
  return (
    <div className="shrink-0 min-w-0 flex items-stretch bg-paper border-b border-line overflow-hidden" dir="rtl">
      {/* زر القائمة المنسدلة — بجانب تبويب الرئيسية */}
      {onPickModule && showMenu && (
        <div className="flex items-center pr-2 pl-1 pt-0.5">
          <NavMenuButton activeKind={activeKind ?? "home"} onPick={onPickModule} labels={menuLabels} />
        </div>
      )}
      <nav className="flex items-end gap-1 px-2 pt-1.5 overflow-x-auto cy-scroll flex-1 min-w-0">
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              className={`group flex items-center gap-2 h-9 pr-3 pl-2 rounded-t-xl border border-b-0 text-[12.5px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                active
                  ? "bg-white border-line text-ink-800 shadow-[0_-2px_0_0_#f59e0b_inset]"
                  : "bg-slate-200/70 border-transparent text-slate-600 hover:bg-white/70"
              }`}
              onClick={() => onSelect(t.id)}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  active ? "bg-amber-brand" : "bg-slate-400 group-hover:bg-amber-brand"
                }`}
              />
              {t.title}
              {t.badge && (
                <span className="text-[10px] font-mono bg-amber-soft text-amber-800 rounded px-1">
                  {t.badge}
                </span>
              )}
              {t.kind !== "home" && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(t.id);
                  }}
                  className="w-4 h-4 grid place-items-center rounded text-slate-400 hover:bg-cash-red hover:text-white transition-colors"
                  aria-label={`إغلاق ${t.title}`}
                >
                  <IcoX className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={onNew}
          title="فاتورة جديدة (F4)"
          className="h-9 w-9 grid place-items-center rounded-t-xl text-slate-500 hover:text-ink-800 hover:bg-white/80 cy-press font-black text-lg"
        >
          +
        </button>
      </nav>

      <div className="hidden sm:flex items-center gap-2 px-3 border-r border-line bg-white/60 text-[11px] font-bold text-slate-500">
        <span className="w-1.5 h-1.5 rounded-full bg-cash-green" />
        وحدة نقاط البيع 01
      </div>
    </div>
  );
}



/* ============================ شريط الحالة السفلي ============================ */

export function StatusBar({
  clock,
  dateText,
  timeText,
  invoiceNumber,
  itemsCount,
  user,
  trial,
  onOpenActivation,
  showBadge = true,
  onOpenDatabase,
  onOpenSync,
  syncPending,
}: {
  clock: Date;
  dateText: string;
  timeText: string;
  invoiceNumber: number;
  itemsCount: number;
  user?: SessionUser | null;
  trial?: TrialStatus | null;
  onOpenActivation?: () => void;
  /** إخفاء شارة حالة النظام من صفحة الإعدادات */
  showBadge?: boolean;
  /** فتح صفحة ربط قاعدة البيانات */
  onOpenDatabase?: () => void;
  /** فتح صفحة المزامنة بين القاعدتين */
  onOpenSync?: () => void;
  /** عدد العمليات المعلّقة للمزامنة */
  syncPending?: number;
}) {
  void clock;
  const hijri = (() => {
    try {
      return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", { day: "numeric", month: "long", year: "numeric" }).format(new Date());
    } catch {
      return "";
    }
  })();
  return (
    <footer
      className="shrink-0 h-[34px] border-t border-black/40 text-slate-300 flex items-center px-3 gap-3 text-[11.5px] overflow-hidden"
      style={{ background: "var(--cy-header)" }}
      dir="rtl"
    >
      {hijri && <span className="hidden md:inline shrink-0 text-slate-400 font-bold">{hijri}</span>}
      <div className="flex items-center gap-2 shrink-0">
        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-brand to-cash-orange grid place-items-center text-[10px] font-black text-ink-900">
          {(user?.fullName?.trim()?.[0] ?? "؟").toUpperCase()}
        </span>
        <span className="font-bold text-slate-200">المستخدم: {user?.fullName ?? "غير مسجل"}</span>
        <span className="hidden xl:inline text-slate-500">|</span>
        <span className="hidden xl:inline text-slate-400 cy-num">
          فاتورة رقم {invoiceNumber} · {itemsCount} صنف
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
        <span className="hidden md:inline text-slate-400 cy-num shrink-0">
          {dateText} — {timeText}
        </span>
        <span className="font-bold text-white truncate">
          الدعم الفني : م / وائل الجمال&nbsp;&nbsp;&nbsp;تليفون : 01222355769
        </span>
      </div>

      {showBadge && <div className="flex items-center gap-1.5 shrink-0">
        <span className="w-2 h-2 rounded-full bg-cash-green cy-ring" />
        <span className="font-bold text-cash-green">النظام متصل</span>
        {trial && (
          <>
            <span className="hidden sm:inline text-slate-500">·</span>
            <button
              onClick={onOpenActivation}
              className={`hidden sm:inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold transition hover:brightness-125 ${
                trial.licensed
                  ? "bg-cash-green/15 text-cash-green"
                  : trial.expired
                    ? "bg-cash-red/20 text-cash-red"
                    : "bg-amber-brand/15 text-amber-brand"
              }`}
              title="اضغط لفتح صفحة التفعيل"
            >
              {trial.licensed ? `مفعّلة · ${trial.license?.daysLeft ?? 0} يوم` : trial.expired ? "انتهت التجربة · فعّل" : `تجريبي · ${trial.daysLeft} يوم`}
            </button>
          </>
        )}
        {onOpenSync && (
          <button
            onClick={onOpenSync}
            title="مزامنة البيانات بين القاعدة المحلية والسحابية"
            className="mr-1 hidden items-center gap-1 rounded px-1.5 py-0.5 font-bold text-slate-300 transition hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <IcoSync className="h-3 w-3" />
            <span className="text-[10px]">مزامنة</span>
            {syncPending ? (
              <span className="rounded bg-amber-brand px-1 text-[9px] font-black text-ink-900 cy-num">
                {syncPending}
              </span>
            ) : null}
          </button>
        )}
        {onOpenDatabase && (
          <button
            onClick={onOpenDatabase}
            title="ربط قاعدة البيانات السحابية أو المحلية"
            className="mr-1 hidden items-center gap-1 rounded px-1.5 py-0.5 font-bold text-slate-300 transition hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <IcoDatabase className="h-3 w-3" />
            <span className="text-[10px]">ربط قاعدة البيانات</span>
          </button>
        )}
      </div>}
    </footer>
  );
}