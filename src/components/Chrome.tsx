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
      className="relative z-40 shrink-0 bg-ink-800 border-b border-black/40 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)]"
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

        {/* البحث العام */}
        <div ref={boxRef} className="relative flex-1 min-w-0 max-w-[560px]">
          <div className="flex items-center gap-2 h-9 rounded-xl bg-ink-900/80 border border-white/10 px-3 focus-within:border-amber-brand/70 focus-within:bg-ink-900 transition-colors">
            <IcoSearch className="w-4 h-4 text-slate-400" />
            <input
              id="cy-global-search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
                setCursor(0);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => Math.min(c + 1, flat.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  choose(cursor);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder="بحث عام: صنف / عميل / فاتورة..."
              className="flex-1 bg-transparent outline-none text-[13px] text-slate-100 placeholder:text-slate-500 min-w-0"
            />
            {q && (
              <button
                onClick={() => {
                  setQ("");
                  setOpen(false);
                }}
                className="text-slate-500 hover:text-cash-red cy-press"
                aria-label="مسح البحث"
              >
                <IcoX className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd className="hidden md:block text-[10px] text-slate-500 border border-white/10 rounded px-1.5 py-0.5">
              Ctrl + K
            </kbd>
          </div>

          {open && q.trim() !== "" && (
            <div className="absolute top-[calc(100%+8px)] right-0 left-0 rounded-2xl bg-white border border-line shadow-2xl overflow-hidden cy-pop">
              {flat.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13px] text-slate-500">
                  لا توجد نتائج مطابقة لـ «{q}»
                </div>
              ) : (
                <div className="max-h-[62vh] overflow-y-auto cy-scroll py-1">
                  {results.prods.length > 0 && <GroupLabel>الأصناف</GroupLabel>}
                  {results.prods.map((p, i) => (
                    <Row key={p.id} active={cursor === i} onClick={() => choose(i)}>
                      <span className="font-mono text-[11px] text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                        {p.code}
                      </span>
                      <span className="flex-1 truncate font-semibold text-ink-800">{p.name}</span>
                      <span className="text-[12px] font-bold text-cash-green-deep cy-num">
                        {money(p.price)}
                      </span>
                    </Row>
                  ))}
                  {results.custs.length > 0 && <GroupLabel>العملاء</GroupLabel>}
                  {results.custs.map((c, k) => {
                    const i = results.prods.length + k;
                    return (
                      <Row key={c.id} active={cursor === i} onClick={() => choose(i)}>
                        <IcoUsers className="w-4 h-4 text-cash-violet" />
                        <span className="flex-1 truncate font-semibold text-ink-800">{c.name}</span>
                        <span className="text-[12px] text-slate-500 cy-num">{c.phone || "—"}</span>
                      </Row>
                    );
                  })}
                  {results.invs.length > 0 && <GroupLabel>الفواتير</GroupLabel>}
                  {results.invs.map((inv, k) => {
                    const i = results.prods.length + results.custs.length + k;
                    return (
                      <Row key={inv.id} active={cursor === i} onClick={() => choose(i)}>
                        <span className="font-mono text-[11px] text-white bg-ink-700 rounded px-1.5 py-0.5">
                          {inv.number}
                        </span>
                        <span className="flex-1 truncate font-semibold text-ink-800">
                          {inv.customerName}
                        </span>
                        <span className="text-[12px] font-bold text-ink-700 cy-num">
                          {money(inv.total)}
                        </span>
                      </Row>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* يسار: الصوت + المستخدم + الترخيص + أزرار النافذة */}
        <div className="flex items-center gap-1.5 sm:gap-2 mr-auto shrink-0">
          <button
            onClick={onToggleMute}
            title={muted ? "تشغيل أصوات النظام" : "كتم كل الأصوات"}
            className={`h-9 px-2.5 rounded-xl border cy-press cy-focus flex items-center gap-1.5 text-[12px] font-bold ${
              muted
                ? "bg-cash-red/15 border-cash-red/50 text-cash-red"
                : "bg-cash-green/15 border-cash-green/45 text-cash-green"
            }`}
          >
            {muted ? <IcoMute className="w-4 h-4" /> : <IcoSound className="w-4 h-4" />}
            <span className="hidden lg:inline">{muted ? "الصوت مكتوم" : "الصوت يعمل"}</span>
          </button>

          <div className="hidden md:flex items-center gap-2 h-9 rounded-xl bg-ink-700/70 border border-white/10 px-2.5">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-cash-cyan to-cash-violet grid place-items-center text-[11px] font-black text-ink-900">
              {(user?.fullName?.trim()?.[0] ?? "؟").toUpperCase()}
            </span>
            <span className="max-w-[150px] truncate text-[12px] font-bold text-slate-200">{user?.fullName ?? "غير مسجل"}</span>
            {user?.role === "owner" && <span className="rounded bg-amber-brand/20 px-1.5 py-0.5 text-[9.5px] font-black text-amber-brand">مالك</span>}
          </div>

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
}: {
  clock: Date;
  dateText: string;
  timeText: string;
  invoiceNumber: number;
  itemsCount: number;
  user?: SessionUser | null;
}) {
  void clock;
  return (
    <footer
      className="shrink-0 h-[34px] bg-ink-800 border-t border-black/40 text-slate-300 flex items-center px-3 gap-3 text-[11.5px] overflow-hidden"
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
        <span className="hidden sm:inline text-slate-500">·</span>
        <span className="hidden sm:inline text-slate-400">قاعدة البيانات جاهزة</span>
      </div>
    </footer>
  );
}