"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Bootstrap, InvoiceRow, ModuleKind, Product, SessionUser, TrialStatus } from "@/lib/types";
import { money } from "@/lib/format";
import {
  IcoBox,
  IcoChart,
  IcoCheck,
  IcoCode,
  IcoCart,
  IcoGear,
  IcoHome,
  IcoLogo,
  IcoMinus,
  IcoMute,
  IcoSearch,
  IcoSliders,
  IcoSound,
  IcoSquare,
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

const RAIL: { kind: Tab["kind"]; icon: React.ReactNode; label: string }[] = [
  { kind: "home", icon: <IcoHome />, label: "الرئيسية" },
  { kind: "invoice", icon: <IcoCart />, label: "فاتورة مبيعات" },
  { kind: "source", icon: <IcoCode />, label: "كود المصدر VB.NET" },
];

export function TabStrip({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNew,
}: {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="shrink-0 flex items-stretch bg-paper border-b border-line" dir="rtl">
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

export function IconRail({
  activeKind,
  onRail,
}: {
  activeKind: Tab["kind"];
  onRail: (kind: Tab["kind"], label: string) => void;
}) {
  const extra: { icon: React.ReactNode; label: string; kind: ModuleKind; hover: string }[] = [
    { icon: <IcoBox />, label: "الأصناف والمخازن", kind: "products", hover: "hover:text-cash-green" },
    { icon: <IcoCart />, label: "فاتورة مشتريات", kind: "purchase", hover: "hover:text-cash-cyan" },
    { icon: <IcoUsers />, label: "العملاء والموردون", kind: "parties", hover: "hover:text-cash-violet" },
    { icon: <IcoWallet />, label: "نظام التقسيط", kind: "installments", hover: "hover:text-fuchsia-400" },
    { icon: <IcoGear />, label: "المصروفات", kind: "expenses", hover: "hover:text-cash-red" },
    { icon: <IcoWallet />, label: "الخزينة", kind: "treasury", hover: "hover:text-emerald-300" },
    { icon: <IcoChart />, label: "التقارير والأرباح", kind: "reports", hover: "hover:text-cash-cyan" },
    { icon: <IcoUsers />, label: "المستخدمون", kind: "users", hover: "hover:text-amber-brand" },
    { icon: <IcoCheck />, label: "تفعيل النسخة", kind: "activation", hover: "hover:text-cash-green" },
    { icon: <IcoSliders />, label: "إعدادات البرنامج", kind: "settings", hover: "hover:text-amber-brand" },
  ];
  return (
    <nav
      aria-label="شريط التنقل السريع"
      className="shrink-0 w-[52px] bg-ink-800 border-l border-black/40 flex flex-col items-center gap-1 py-2 overflow-y-auto cy-scroll-dark"
    >
      {RAIL.map((r) => (
        <RailBtn
          key={r.kind}
          label={r.label}
          active={activeKind === r.kind}
          onClick={() => onRail(r.kind, r.label)}
          hover="hover:text-amber-brand"
        >
          {r.icon}
        </RailBtn>
      ))}
      <span className="w-6 h-px bg-white/15 my-1" />
      {extra.map((r) => (
        <RailBtn
          key={r.label}
          label={r.label}
          active={activeKind === r.kind}
          onClick={() => onRail(r.kind, r.label)}
          hover={r.hover}
        >
          {r.icon}
        </RailBtn>
      ))}
      <span className="mt-auto text-[9px] font-black text-slate-600 tracking-widest [writing-mode:vertical-rl] rotate-180">
        CASH YOU
      </span>
    </nav>
  );
}

function RailBtn({
  children,
  label,
  active,
  onClick,
  hover,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  hover: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`w-10 h-10 grid place-items-center rounded-xl cy-press cy-focus transition-colors ${
        active
          ? "bg-amber-brand text-ink-900 shadow-[0_0_18px_-6px_rgba(245,158,11,0.9)]"
          : `text-slate-400 bg-white/5 ${hover} hover:bg-white/12`
      }`}
    >
      {children}
    </button>
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
}: {
  clock: Date;
  dateText: string;
  timeText: string;
  invoiceNumber: number;
  itemsCount: number;
  user?: SessionUser | null;
  trial?: TrialStatus | null;
  onOpenActivation?: () => void;
}) {
  void clock;
  return (
    <footer
      className="shrink-0 h-[34px] border-t border-black/40 text-slate-300 flex items-center px-3 gap-3 text-[11.5px] overflow-hidden"
      style={{ background: "var(--cy-header)" }}
      dir="rtl"
    >
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

      <div className="flex items-center gap-1.5 shrink-0">
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
      </div>
    </footer>
  );
}