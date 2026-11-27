"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Bootstrap, Customer, InvoiceRow, ModuleKind, Product, SessionUser, TrialStatus } from "@/lib/types";
import { money, qtyText } from "@/lib/format";
import {
  IcoBox,
  IcoCart,
  IcoChart,
  IcoCheck,
  IcoCode,
  IcoCollapse,
  IcoExpand,
  IcoEye,
  IcoGear,
  IcoDownload,
  IcoHome,
  IcoLogo,
  IcoMenu,
  IcoMinus,
  IcoMute,
  IcoPlus,
  IcoSearch,
  IcoSliders,
  IcoSound,
  IcoUsers,
  IcoWallet,
  IcoX,
} from "@/components/icons";

/** نص حالة التفعيل المعروض في الشريط العلوي والسفلي */
export function trialLabel(trial: TrialStatus | null): string {
  if (!trial) return "";
  if (trial.licensed) return `مفعّلة · ${trial.license?.daysLeft ?? 0} يوم`;
  if (trial.expired) return "انتهت التجربة · فعّل";
  return `تجريبي · ${trial.daysLeft} يوم`;
}

/* ============================ الشريط العلوي ============================ */

export function TitleBar({
  shopName,
  muted,
  onToggleMute,
  onWindowAction,
  minimized,
  trial,
  onLogout,
  onOpenActivation,
  onOpenSearch,
  fullscreen,
  onToggleFullscreen,
}: {
  shopName: string;
  muted: boolean;
  onToggleMute: () => void;
  onWindowAction: (a: "min" | "close") => void;
  minimized: boolean;
  trial: TrialStatus | null;
  onLogout: () => void;
  onOpenActivation: () => void;
  onOpenSearch: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  return (
    <header
      className="relative z-40 shrink-0 bg-ink-800 border-b border-black/40 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)]"
      dir="rtl"
    >
      <div className="pointer-events-none absolute inset-0 cy-aurora opacity-70" />
      <div className="relative flex items-center gap-2 px-2.5 h-[54px] sm:h-[58px]">
        {/* يمين: الشعار والعنوان */}
        <div className="flex items-center gap-2.5 shrink-0">
          <IcoLogo className="w-9 h-9 drop-shadow" />
          <div className="leading-none">
            <div className="text-white font-black tracking-[0.14em] text-[15px]">
              CASH<span className="text-amber-brand"> YOU</span>
            </div>
            <div className="text-[10px] text-slate-400 font-semibold mt-1 max-w-[160px] truncate">{shopName}</div>
          </div>
        </div>

        <div className="w-px h-8 bg-white/10 mx-1 hidden sm:block" />

        {/* أيقونة البحث العام: تفتح نافذة عائمة */}
        <button
          onClick={onOpenSearch}
          title="بحث عام (Ctrl + K)"
          aria-label="بحث عام"
          className="cy-h-search w-9 h-9 grid place-items-center rounded-xl bg-ink-900/80 border border-white/10 text-slate-300 cy-press cy-focus hover:border-amber-brand/70 hover:text-amber-brand"
        >
          <IcoSearch className="w-4 h-4" />
        </button>

        {/* يسار: الصوت + ملء الشاشة + الترخيص + أزرار النافذة */}
        <div className="flex items-center gap-1.5 mr-auto shrink-0">
          <button
            onClick={onToggleMute}
            title={muted ? "تشغيل أصوات النظام" : "كتم كل الأصوات"}
            aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
            className={`cy-h-sound w-9 h-9 rounded-xl border cy-press cy-focus grid place-items-center ${
              muted
                ? "bg-cash-red/15 border-cash-red/50 text-cash-red"
                : "bg-cash-green/15 border-cash-green/45 text-cash-green"
            }`}
          >
            {muted ? <IcoMute className="w-4 h-4" /> : <IcoSound className="w-4 h-4" />}
          </button>

          <button
            onClick={onToggleFullscreen}
            title={fullscreen ? "الخروج من ملء الشاشة" : "تكبير الشاشة (ملء الشاشة)"}
            aria-label={fullscreen ? "الخروج من ملء الشاشة" : "تكبير الشاشة"}
            className="cy-h-fullscreen w-9 h-9 rounded-xl border border-white/10 bg-ink-700/70 text-slate-200 cy-press cy-focus grid place-items-center hover:border-amber-brand/60 hover:text-amber-brand"
          >
            {fullscreen ? <IcoCollapse className="w-4 h-4" /> : <IcoExpand className="w-4 h-4" />}
          </button>


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
            <WinBtn label="إغلاق" onClick={() => onWindowAction("close")} tone="red">
              <IcoX className="w-3.5 h-3.5" />
            </WinBtn>
          </div>
        </div>
      </div>

      {minimized && <div className="absolute inset-x-0 -bottom-px h-px bg-amber-brand" aria-hidden />}
    </header>
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

/* ============================ البحث العام (نافذة عائمة) ============================ */

type SearchHit =
  | { kind: "p"; p: Product }
  | { kind: "c"; c: Customer }
  | { kind: "i"; i: InvoiceRow };

export function GlobalSearch({
  data,
  hueName,
  onClose,
  onViewProduct,
  onAddProduct,
  onViewCustomer,
  onViewInvoice,
}: {
  data: Bootstrap;
  hueName: (catId: number) => string;
  onClose: () => void;
  onViewProduct: (p: Product) => void;
  onAddProduct: (p: Product) => void;
  onViewCustomer: (c: Customer) => void;
  onViewInvoice: (i: InvoiceRow) => void;
}) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, []);

  const hits = useMemo<SearchHit[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const prods = data.products
      .filter((p) => p.name.toLowerCase().includes(term) || p.code.includes(term))
      .slice(0, 4)
      .map((p) => ({ kind: "p" as const, p }));
    const custs = data.customers
      .filter((c) => c.name.toLowerCase().includes(term) || c.phone.includes(term))
      .slice(0, 2)
      .map((c) => ({ kind: "c" as const, c }));
    const invs = data.invoices
      .filter((i) => String(i.number).includes(term) || i.customerName.toLowerCase().includes(term))
      .slice(0, 2)
      .map((i) => ({ kind: "i" as const, i }));
    return [...prods, ...custs, ...invs];
  }, [q, data]);

  const viewHit = (h: SearchHit) => {
    if (h.kind === "p") onViewProduct(h.p);
    if (h.kind === "c") onViewCustomer(h.c);
    if (h.kind === "i") onViewInvoice(h.i);
  };

  const groupTitle = (kind: SearchHit["kind"]) =>
    kind === "p" ? "الأصناف" : kind === "c" ? "العملاء" : "الفواتير";

  return (
    <div
      className="fixed inset-0 z-[85] grid place-items-center p-3 bg-ink-950/60 backdrop-blur-[2px] cy-no-print"
      dir="rtl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cy-pop cy-fluent-panel w-[min(94vw,640px)] rounded-2xl bg-white overflow-hidden">
        <div className="flex items-center gap-2 px-3 h-14 border-b border-line bg-paper">
          <IcoSearch className="w-5 h-5 text-slate-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, hits.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const h = hits[cursor];
                if (h) viewHit(h);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="ابحث عن صنف بالاسم أو الكود، أو عميل، أو رقم فاتورة..."
            className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-bold text-ink-900 placeholder:text-slate-400 placeholder:font-normal"
          />
          {q && (
            <button onClick={() => setQ("")} className="text-slate-400 hover:text-cash-red" aria-label="مسح">
              <IcoX className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] font-mono text-slate-500 border border-line rounded px-1.5 py-0.5">Esc</kbd>
        </div>

        <div className="h-[370px] overflow-hidden py-1">
          {q.trim() === "" ? (
            <div className="px-4 py-10 text-center text-[13px] font-bold text-slate-500">
              اكتب للبحث في الأصناف والعملاء والفواتير، ثم اضغط «عرض» بجوار النتيجة
            </div>
          ) : hits.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] font-bold text-slate-500">
              لا توجد نتائج مطابقة لـ «{q}»
            </div>
          ) : (
            hits.map((h, idx) => {
              const first = idx === 0 || hits[idx - 1].kind !== h.kind;
              const active = cursor === idx;
              return (
                <div key={`${h.kind}-${idx}`}>
                  {first && (
                    <div className="px-4 pt-2 pb-1 text-[10.5px] font-black tracking-widest text-slate-400">
                      {groupTitle(h.kind)}
                    </div>
                  )}
                  <div
                    onMouseEnter={() => setCursor(idx)}
                    className={`flex items-center gap-3 px-4 py-2 transition-colors ${active ? "bg-amber-100" : "hover:bg-slate-50"}`}
                  >
                    {h.kind === "p" && (
                      <>
                        <span className="font-mono text-[11px] text-amber-700 bg-amber-100 rounded px-1.5 py-0.5 shrink-0">
                          {h.p.code}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[13px] text-ink-800 truncate">{h.p.name}</div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {hueName(h.p.categoryId)} · الرصيد <span className="cy-num">{qtyText(h.p.stock)}</span>
                          </div>
                        </div>
                        <span className="text-[12.5px] font-black text-cash-green-deep cy-num shrink-0">{money(h.p.price)}</span>
                      </>
                    )}
                    {h.kind === "c" && (
                      <>
                        <IcoUsers className="w-4 h-4 text-cash-violet shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[13px] text-ink-800 truncate">{h.c.name}</div>
                          <div className="text-[11px] text-slate-500 cy-num">{h.c.phone || "بدون تليفون"}</div>
                        </div>
                        <span className="text-[12px] font-bold text-ink-700 cy-num shrink-0">{money(h.c.balance)}</span>
                      </>
                    )}
                    {h.kind === "i" && (
                      <>
                        <span className="font-mono text-[11px] text-white bg-ink-700 rounded px-1.5 py-0.5 shrink-0">
                          {h.i.number}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[13px] text-ink-800 truncate">{h.i.customerName}</div>
                          <div className="text-[11px] text-slate-500 truncate">{h.i.paymentMethod}</div>
                        </div>
                        <span className="text-[12px] font-bold text-ink-700 cy-num shrink-0">{money(h.i.total)}</span>
                      </>
                    )}

                    {h.kind === "p" && (
                      <button
                        onClick={() => onAddProduct(h.p)}
                        disabled={h.p.stock <= 0}
                        title="إضافة إلى الفاتورة"
                        className="h-8 px-2.5 rounded-lg bg-cash-green text-white text-[11.5px] font-black cy-press flex items-center gap-1 shrink-0 hover:bg-cash-green-deep disabled:opacity-40"
                      >
                        <IcoPlus className="w-3.5 h-3.5" />
                        إضافة
                      </button>
                    )}
                    <button
                      onClick={() => viewHit(h)}
                      title="عرض التفاصيل"
                      className="h-8 px-2.5 rounded-lg bg-ink-800 text-white text-[11.5px] font-black cy-press flex items-center gap-1 shrink-0 hover:bg-ink-900"
                    >
                      <IcoEye className="w-3.5 h-3.5" />
                      عرض
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="px-4 h-8 border-t border-line bg-paper flex items-center justify-between text-[10.5px] font-bold text-slate-500">
          <span>↑ ↓ للتنقل · Enter للعرض</span>
          <span className="cy-num">{hits.length} نتيجة</span>
        </div>
      </div>
    </div>
  );
}

/* ============================ التبويبات + الشريط الجانبي ============================ */

export type Tab = { id: string; kind: ModuleKind; title: string; badge?: string };

/** كل وحدات البرنامج كما تظهر في القائمة العائمة */
export const MENU_ITEMS: { kind: ModuleKind; label: string; icon: React.ReactNode }[] = [
  { kind: "home", label: "الرئيسية", icon: <IcoHome className="w-4 h-4" /> },
  { kind: "invoice", label: "فاتورة مبيعات", icon: <IcoCart className="w-4 h-4" /> },
  { kind: "products", label: "الأصناف والمخازن", icon: <IcoBox className="w-4 h-4" /> },
  { kind: "purchase", label: "فاتورة مشتريات", icon: <IcoCart className="w-4 h-4" /> },
  { kind: "parties", label: "العملاء والموردون", icon: <IcoUsers className="w-4 h-4" /> },
  { kind: "installments", label: "نظام التقسيط", icon: <IcoWallet className="w-4 h-4" /> },
  { kind: "expenses", label: "المصروفات", icon: <IcoGear className="w-4 h-4" /> },
  { kind: "treasury", label: "الخزينة", icon: <IcoWallet className="w-4 h-4" /> },
  { kind: "reports", label: "التقارير والأرباح", icon: <IcoChart className="w-4 h-4" /> },
  { kind: "users", label: "المستخدمون", icon: <IcoUsers className="w-4 h-4" /> },
  { kind: "activation", label: "تفعيل النسخة", icon: <IcoCheck className="w-4 h-4" /> },
  { kind: "backup", label: "النسخ الاحتياطي", icon: <IcoDownload className="w-4 h-4" /> },
  { kind: "settings", label: "الإعدادات", icon: <IcoSliders className="w-4 h-4" /> },
];

/** القائمة العائمة أعلى الصفحة: أزرار بأسمائها، تُغلق تلقائياً عند الاختيار أو الضغط خارجها */
export function FloatingMenu({
  open,
  onClose,
  onPick,
  onCustomize,
  showIcons,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (kind: ModuleKind, label: string) => void;
  onCustomize: () => void;
  showIcons: boolean;
}) {
  const prefsIcons = showIcons;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90]" onMouseDown={onClose} dir="rtl">
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="cy-menu-drop cy-menu-panel cy-fluent-panel absolute top-[104px] right-2 p-2"
      >
        <div className="flex items-center justify-between px-1.5 pb-2 mb-1 border-b border-white/15">
          <span className="text-[12px] font-black tracking-wide">القائمة</span>
          <button
            onClick={() => {
              onClose();
              onCustomize();
            }}
            title="تخصيص القائمة (ألوان وأزرار)"
            aria-label="تخصيص القائمة"
            className="w-7 h-7 grid place-items-center rounded-md opacity-80 hover:opacity-100 hover:bg-white/15 cy-press"
          >
            <IcoSliders className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid gap-1 max-h-[calc(100vh-150px)] overflow-y-auto cy-scroll">
          {MENU_ITEMS.map((it) => (
            <button
              key={it.kind + it.label}
              onClick={() => {
                onClose();
                onPick(it.kind, it.label);
              }}
              className="cy-menu-item flex items-center gap-2 px-2 text-[13px] font-bold"
            >
              {/* ترتيب العناصر في RTL: المسافة يمين، الكلام في المنتصف، والأيقونة على الشمال */}
              <span className="w-6 shrink-0" />
              <span className="flex-1 text-center">{it.label}</span>
              {prefsIcons && <span className="w-6 shrink-0 grid place-items-center opacity-90">{it.icon}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TabStrip({
  tabs,
  activeId,
  onSelect,
  onClose,
  onNew,
  onToggleMenu,
  menuOpen,
}: {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onToggleMenu: () => void;
  menuOpen: boolean;
}) {
  return (
    <div className="shrink-0 flex flex-col bg-paper border-b border-line" dir="rtl">
      <div className="flex items-stretch min-w-0">
      <nav className="flex items-end gap-1 px-2 pt-1.5 overflow-x-auto cy-scroll flex-1 min-w-0">
        <button
          onClick={onToggleMenu}
          aria-expanded={menuOpen}
          aria-label="القائمة"
          title="القائمة"
          className={`cy-h-menu cy-press cy-focus mb-0.5 h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-[12px] font-black whitespace-nowrap transition-colors ${
            menuOpen
              ? "bg-ink-800 border-ink-800 text-white"
              : "bg-white/70 border-line text-ink-800 hover:bg-white"
          }`}
        >
          <IcoMenu className="w-4 h-4" />
          القائمة
        </button>
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <div
              key={t.id}
              className={`group flex items-center gap-2 h-9 pr-3 pl-2 rounded-t-xl border border-b-0 text-[12.5px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                active
                  ? "bg-white border-line text-ink-800 shadow-[0_-2px_0_0_var(--color-amber-brand)_inset]"
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
      </div>

      {/* وحدة نقاط البيع: تحت التبويبات على الشمال، بمقاس صغير */}
      <div className="hidden sm:flex mr-auto items-center gap-1 h-[18px] px-2 mb-0.5 rounded-md bg-white/60 border border-line text-[10px] font-bold leading-none text-slate-500 whitespace-nowrap">
        <span className="w-1 h-1 rounded-full bg-cash-green" />
        وحدة نقاط البيع 01
      </div>
    </div>
  );
}

/* ============================ شريط الحالة السفلي ============================ */

export function StatusBar({
  dateText,
  timeText,
  user,
  trial,
  onOpenActivation,
}: {
  dateText: string;
  timeText: string;
  user: SessionUser | null;
  trial: TrialStatus | null;
  onOpenActivation: () => void;
}) {
  return (
    <footer
      className="shrink-0 h-[36px] bg-ink-800 border-t border-black/40 text-slate-300 flex items-center px-3 gap-3 text-[11.5px] overflow-hidden"
      dir="rtl"
    >
      {/* يمين: المستخدم */}
      <div className="cy-h-user flex items-center gap-2 shrink-0">
        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-brand to-cash-orange grid place-items-center text-[10px] font-black text-ink-900">
          {(user?.fullName?.trim()?.[0] ?? "؟").toUpperCase()}
        </span>
        <span className="font-bold text-slate-200 truncate max-w-[220px]">
          المستخدم: {user?.fullName ?? "غير مسجل"}
        </span>
        {user?.role === "owner" && (
          <span className="rounded bg-amber-brand/20 px-1.5 py-0.5 text-[9.5px] font-black text-amber-brand">مالك</span>
        )}
      </div>

      {/* الوسط: التاريخ والوقت + الدعم */}
      <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
        <span className="cy-h-date hidden md:inline text-slate-300 cy-num shrink-0">{dateText}</span>
        <span className="cy-h-time hidden md:inline text-slate-300 cy-num shrink-0">{timeText}</span>
        <span className="cy-h-support hidden lg:inline font-bold text-white truncate">
          الدعم الفني : م / وائل الجمال&nbsp;&nbsp;&nbsp;تليفون : 01222355769
        </span>
      </div>

      {/* يسار: حالة النظام وحالة التفعيل */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="cy-h-status flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cash-green cy-ring" />
        <span className="font-bold text-cash-green">النظام متصل</span>
        </span>
        {trial && (
          <span className="cy-h-trial flex items-center gap-2">
            <span className="text-slate-500">·</span>
            <button
              onClick={onOpenActivation}
              className={`font-black hover:underline ${
                trial.licensed
                  ? "text-cash-green"
                  : trial.expired
                    ? "text-cash-red"
                    : trial.daysLeft <= 3
                      ? "text-amber-brand"
                      : "text-cash-cyan"
              }`}
              title="فتح صفحة تفعيل النسخة"
            >
              {trialLabel(trial)}
            </button>
          </span>
        )}
      </div>
    </footer>
  );
}
