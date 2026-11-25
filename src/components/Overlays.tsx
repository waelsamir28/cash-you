"use client";

import { useEffect, useRef, useState } from "react";
import type { Bootstrap, InvoiceRow } from "@/lib/types";
import type { Draft, Totals } from "@/lib/draft";
import { lineTotal } from "@/lib/draft";
import { apiFetch } from "@/lib/offline-sync";
import { money, qtyText, shortStamp } from "@/lib/format";
import {
  IcoCheck,
  IcoCopy,
  IcoDownload,
  IcoLogo,
  IcoMute,
  IcoPrint,
  IcoSound,
  IcoUndo,
  IcoWarn,
  IcoX,
} from "@/components/icons";

/* ============================ غلاف النافذة ============================ */

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  width = "max-w-lg",
  tone = "ink",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
  tone?: "ink" | "red" | "amber";
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const head =
    tone === "red"
      ? "bg-cash-red"
      : tone === "amber"
        ? "bg-amber-brand"
        : "bg-ink-800";

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center p-3 bg-ink-950/70 backdrop-blur-[3px] cy-no-print"
      dir="rtl"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${width} rounded-2xl bg-white shadow-[0_40px_90px_-30px_rgba(2,6,23,0.9)] overflow-hidden cy-pop border border-line`}
      >
        <div className={`${head} px-4 py-3 flex items-center gap-3`}>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-black text-[15px] truncate">{title}</h2>
            {subtitle && <p className="text-white/70 text-[11.5px] mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 grid place-items-center rounded-lg text-white/80 hover:bg-white/20 cy-press"
            aria-label="إغلاق"
          >
            <IcoX className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/* ============================ رسالة الترحيب الوسطية ============================ */

/**
 * رسالة عائمة في منتصف الشاشة ترحب بالمستخدم بعد تسجيل الدخول،
 * وتختفي تلقائياً بعد ثلاث ثوانٍ (أو بالضغط عليها).
 */
export function WelcomeToast({
  name,
  detail,
  logo,
  shopName,
  muted,
  onToggleMute,
  onDone,
  duration = 3000,
}: {
  name: string;
  detail?: string;
  /** شعار المحل (data-URL) — يظهر بدل اللوجو الافتراضي */
  logo?: string;
  shopName?: string;
  muted?: boolean;
  onToggleMute?: () => void;
  onDone: () => void;
  /** مدة الظهور بالملي ثانية */
  duration?: number;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(timer);
  }, [onDone, duration]);

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center pointer-events-none cy-no-print"
      dir="rtl"
      role="status"
      aria-live="polite"
    >
      {/* زر الصوت: أيقونة صغيرة أعلى اليسار */}
      {onToggleMute && (
        <button
          type="button"
          onClick={onToggleMute}
          title={muted ? "تشغيل الصوت" : "كتم الصوت"}
          aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
          className={`pointer-events-auto absolute top-4 left-4 grid h-8 w-8 place-items-center rounded-full border backdrop-blur transition ${
            muted
              ? "border-cash-red/50 bg-cash-red/15 text-cash-red"
              : "border-white/25 bg-white/10 text-white hover:bg-white/20"
          }`}
        >
          {muted ? <IcoMute className="h-3.5 w-3.5" /> : <IcoSound className="h-3.5 w-3.5" />}
        </button>
      )}

      <button
        type="button"
        onClick={onDone}
        className="cy-toast-pop pointer-events-auto relative w-[min(92vw,400px)] overflow-hidden rounded-[26px] border border-white/15 bg-ink-900/95 px-6 py-7 text-center shadow-[0_40px_120px_-30px_rgba(0,0,0,.95)] backdrop-blur-xl"
      >
        <span className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-cash-cyan/20 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-amber-brand/20 blur-3xl" />

        {/* شعار المحل */}
        <span className="relative mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-amber-brand to-orange-500 shadow-[0_12px_30px_-10px_rgba(245,158,11,.9)]">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={shopName ?? "شعار المحل"} className="h-full w-full object-contain p-2" />
          ) : (
            <span className="text-[30px] font-black text-ink-900">✓</span>
          )}
        </span>

        {shopName && (
          <p className="relative mt-3 text-[12px] font-black tracking-wide text-cash-cyan">{shopName}</p>
        )}
        <p className="relative mt-1 text-[10.5px] font-black tracking-[0.24em] text-slate-500">CASH YOU · POS</p>
        <h2 className="relative mt-1.5 text-[21px] font-black leading-snug text-white">
          أهلاً بك، {name}
        </h2>
        <p className="relative mt-2 text-[12.5px] font-bold leading-6 text-slate-300">
          {detail ?? "تم تسجيل الدخول بنجاح — نتمنى لك يوماً موفقاً"}
        </p>

        <span className="relative mt-5 block h-1 w-full overflow-hidden rounded-full bg-white/10">
          <span
            className="cy-toast-bar block h-full rounded-full bg-gradient-to-l from-amber-brand to-cash-cyan"
            style={{ animationDuration: `${duration}ms` }}
          />
        </span>
        <p className="relative mt-2 text-[10px] font-bold text-slate-500">
          تختفي تلقائياً بعد {Math.round(duration / 1000)} ثوانٍ
        </p>
      </button>
    </div>
  );
}

/* ============================ التنبيهات ============================ */

export type Toast = {
  id: string;
  kind: "ok" | "warn" | "err" | "info";
  text: string;
  undo?: () => void;
};

const TOAST_STYLE: Record<Toast["kind"], string> = {
  ok: "bg-cash-green-deep border-emerald-300/40",
  warn: "bg-amber-brand border-amber-200/50",
  err: "bg-cash-red border-red-200/50",
  info: "bg-ink-800 border-white/15",
};

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="fixed bottom-12 left-3 z-[95] flex flex-col gap-2 w-[320px] max-w-[86vw] cy-no-print"
      dir="rtl"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`cy-slide-in rounded-xl border px-3 py-2.5 shadow-2xl text-white flex items-center gap-2.5 ${TOAST_STYLE[t.kind]}`}
        >
          <span className="w-6 h-6 rounded-full bg-white/20 grid place-items-center shrink-0">
            {t.kind === "ok" ? (
              <IcoCheck className="w-3.5 h-3.5" />
            ) : t.kind === "err" || t.kind === "warn" ? (
              <IcoWarn className="w-3.5 h-3.5" />
            ) : (
              <IcoLogo className="w-4 h-4" />
            )}
          </span>
          <span className="flex-1 text-[12.5px] font-bold leading-snug">{t.text}</span>
          {t.undo && (
            <button
              onClick={() => {
                t.undo?.();
                onDismiss(t.id);
              }}
              className="shrink-0 h-7 px-2 rounded-lg bg-white/20 hover:bg-white/35 text-[11.5px] font-black flex items-center gap-1 cy-press"
            >
              <IcoUndo className="w-3.5 h-3.5" />
              تراجع
            </button>
          )}
          <button
            onClick={() => onDismiss(t.id)}
            className="shrink-0 text-white/70 hover:text-white"
            aria-label="إخفاء"
          >
            <IcoX className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ============================ شاشة الزبون ============================ */

export function CustomerDisplay({
  draft,
  totals,
  shopName,
  onClose,
}: {
  draft: Draft;
  totals: Totals;
  shopName: string;
  onClose: () => void;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [draft.items.length]);

  return (
    <div className="fixed inset-0 z-[90] cy-mesh cy-grain text-white flex flex-col cy-no-print" dir="rtl">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
        <IcoLogo className="w-10 h-10" />
        <div>
          <div className="font-black tracking-[0.18em] text-lg">
            CASH<span className="text-amber-brand"> YOU</span>
          </div>
          <div className="text-[11px] text-slate-400">{shopName}</div>
        </div>
        <div className="mr-auto flex items-center gap-3">
          <span className="text-[13px] font-bold text-slate-300">
            فاتورة رقم <span className="cy-num text-amber-brand font-black">{draft.number}</span>
          </span>
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-xl bg-white/10 hover:bg-cash-red border border-white/15 text-[12.5px] font-bold cy-press"
          >
            إغلاق شاشة الزبون (Esc)
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-4">
        <div className="flex-1 min-h-0 rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1fr_90px_110px_130px] px-4 py-2.5 bg-white/10 text-[13px] font-black text-slate-200">
            <span>الصنف</span>
            <span className="text-center">الكمية</span>
            <span className="text-center">السعر</span>
            <span className="text-left">الإجمالي</span>
          </div>
          <div className="flex-1 overflow-y-auto cy-scroll-dark">
            {draft.items.length === 0 ? (
              <div className="h-full grid place-items-center text-slate-400 text-lg font-bold">
                في انتظار مسح الأصناف...
              </div>
            ) : (
              draft.items.map((li) => (
                <div
                  key={li.uid}
                  className="grid grid-cols-[1fr_90px_110px_130px] px-4 py-3 border-b border-white/5 text-[15px] cy-rise"
                >
                  <span className="font-bold truncate">{li.name}</span>
                  <span className="text-center cy-num text-amber-brand font-black">
                    {qtyText(li.qty)}
                  </span>
                  <span className="text-center cy-num text-slate-300">{money(li.price)}</span>
                  <span className="text-left cy-num font-black text-cash-cyan">
                    {money(lineTotal(li))}
                  </span>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="lg:w-[360px] shrink-0 flex flex-col gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-amber-brand to-cash-orange p-5 text-ink-900 shadow-2xl">
            <div className="text-[13px] font-black opacity-80">الإجمالي المستحق</div>
            <div className="text-[52px] leading-none font-black cy-num mt-1">
              {money(totals.total)}
            </div>
            <div className="text-[12px] font-bold mt-2 opacity-75">جنيه مصري</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
              <div className="text-[12px] font-bold text-slate-400">المدفوع</div>
              <div className="text-[26px] font-black cy-num text-cash-green">
                {money(totals.paid)}
              </div>
            </div>
            <div className="rounded-2xl bg-white/8 border border-white/10 p-4">
              <div className="text-[12px] font-bold text-slate-400">
                {totals.remaining < 0 ? "الباقي" : "المتبقي"}
              </div>
              <div
                className={`text-[26px] font-black cy-num ${
                  totals.remaining > 0 ? "text-cash-red" : "text-cash-cyan"
                }`}
              >
                {money(Math.abs(totals.remaining))}
              </div>
            </div>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-center">
            <div className="text-[13px] font-bold text-slate-300">
              عدد الأصناف: <span className="cy-num text-white font-black">{draft.items.length}</span>
            </div>
            <div className="text-[13px] font-bold text-slate-300 mt-1">
              العميل: <span className="text-white font-black">{draft.customerName}</span>
            </div>
            <p className="text-[12.5px] text-amber-brand font-black mt-3">
              شكراً لتعاملكم معنا
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ إيصال الطباعة ============================ */

export type ReceiptData = {
  number: number;
  createdAt: string;
  customerName: string;
  paymentMethod: string;
  saleType: string;
  discountPercent: number;
  subtotal: number;
  total: number;
  paid: number;
  remaining: number;
  items: { name: string; code: string; qty: number; price: number; total: number; unit: string }[];
};

export function ReceiptModal({
  receipt,
  shop,
  paper = "80mm",
  logo = "",
  address = "",
  receiptFooter = "",
  thanks = true,
  accent = "#f59e0b",
  onClose,
}: {
  receipt: ReceiptData;
  shop: { name: string; phone: string };
  /** مقاس ورق الفاتورة */
  paper?: "58mm" | "80mm" | "a5";
  /** شعار المحل (data-URL) */
  logo?: string;
  address?: string;
  receiptFooter?: string;
  thanks?: boolean;
  /** لون هوية المحل (من الثيم) */
  accent?: string;
  onClose: () => void;
}) {
  const [printed, setPrinted] = useState(false);
  const accentSoft = `${accent}22`;
  const width = paper === "58mm" ? "w-[224px]" : paper === "a5" ? "w-[384px]" : "w-[300px]";
  const textSize = paper === "58mm" ? "text-[9.5px]" : paper === "a5" ? "text-[12px]" : "text-[11px]";

  return (
    <Modal
      title={`تم حفظ الفاتورة رقم ${receipt.number}`}
      subtitle={`معاينة الإيصال قبل الطباعة — ${paper === "a5" ? "A5" : paper === "58mm" ? "58 مم" : "80 مم"}`}
      onClose={onClose}
      width="max-w-md"
    >
      <div
        id="cy-print-area"
        className={`mx-auto ${width} ${textSize} rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-black cy-scroll max-h-[58vh] overflow-y-auto`}
      >
        {/* رأس الإيصال */}
        <div className="text-center">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt={shop.name} className="mx-auto mb-1.5 h-14 w-14 object-contain" />
          ) : null}
          <div className="text-[15px] font-black leading-tight tracking-wide">{shop.name}</div>
          {address ? <div className="mt-0.5 text-[10px] font-semibold text-black/70">{address}</div> : null}
          <div className="cy-num text-[10.5px] font-bold">ت: {shop.phone}</div>
          <div className="mx-auto mt-2 h-[3px] w-16 rounded-full" style={{ background: accent }} />
        </div>

        {/* بيانات الفاتورة */}
        <div className="mt-2 rounded-md border border-dashed border-slate-300 px-2 py-1">
          <div className="grid grid-cols-2 gap-y-0.5 cy-num [&>span:nth-child(odd)]:font-bold">
            <span>رقم الفاتورة</span>
            <span className="text-left font-black">{receipt.number}</span>
            <span>التاريخ</span>
            <span className="text-left">{shortStamp(receipt.createdAt)}</span>
            <span>العميل</span>
            <span className="truncate text-left">{receipt.customerName}</span>
            <span>نوع البيع</span>
            <span className="text-left">{receipt.saleType} · {receipt.paymentMethod}</span>
          </div>
        </div>

        {/* جدول الأصناف */}
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr className="border-y border-slate-400 text-[10px] font-black">
              <th className="py-1 text-right">الصنف</th>
              <th className="w-8 py-1 text-center">كمية</th>
              <th className="w-11 py-1 text-center">سعر</th>
              <th className="w-14 py-1 text-left">إجمالي</th>
            </tr>
          </thead>
          <tbody className="cy-num">
            {receipt.items.map((it, i) => (
              <tr key={i} className={`align-top ${i % 2 ? "bg-slate-50" : ""}`}>
                <td className="py-[3px] pl-1 text-right leading-tight">{it.name}</td>
                <td className="py-[3px] text-center">{qtyText(it.qty)}</td>
                <td className="py-[3px] text-center">{money(it.price)}</td>
                <td className="py-[3px] text-left font-bold">{money(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* الإجماليات */}
        <div className="mt-2 space-y-0.5 border-t border-dashed border-slate-400 pt-2 cy-num">
          <Row2 k="الإجمالي قبل الخصم" v={money(receipt.subtotal)} />
          {receipt.discountPercent > 0 && (
            <Row2 k={`الخصم (${receipt.discountPercent}%)`} v={money(receipt.subtotal - receipt.total)} />
          )}
          <div
            className="mt-1 flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] font-black"
            style={{ background: accentSoft }}
          >
            <span>الصافي المطلوب</span>
            <span className="cy-num text-[15px]">{money(receipt.total)}</span>
          </div>
          <div className="flex items-center justify-between px-2 pt-0.5 font-bold">
            <span>المدفوع</span>
            <span className="cy-num">{money(receipt.paid)}</span>
          </div>
          <div className="flex items-center justify-between px-2 pb-0.5 font-bold">
            <span>{receipt.remaining < 0 ? "الباقي للزبون" : "المتبقي"}</span>
            <span className="cy-num">{money(Math.abs(receipt.remaining))}</span>
          </div>
        </div>

        {/* التذييل */}
        <div className="mt-2 border-t border-dashed border-slate-400 pt-2 text-center leading-relaxed">
          {thanks && receiptFooter ? (
            <div className="rounded-md px-2 py-1 text-[10.5px] font-black" style={{ background: accentSoft }}>
              {receiptFooter}
            </div>
          ) : null}
          <div className="mt-1.5 text-[9.5px] font-bold text-black/60">
            البضاعة المباعة تُرد خلال 14 يوم بشرط سلامة العبوة
          </div>
          <div className="mt-1 text-[9px] font-semibold text-black/50">
            CASH YOU · POS — {shortStamp(receipt.createdAt)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2 cy-no-print">
        <button
          onClick={() => {
            setPrinted(true);
            void apiFetch("/api/invoices", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ number: receipt.number }),
            }).catch(() => undefined);
            window.print();
          }}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-ink-800 font-black text-white cy-press hover:bg-ink-900"
        >
          <IcoPrint className="h-4 w-4" />
          {printed ? "إعادة الطباعة" : "طباعة الإيصال"}
        </button>
        <button
          onClick={onClose}
          className="h-11 rounded-xl bg-slate-200 px-5 font-black text-ink-800 cy-press hover:bg-slate-300"
        >
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

function Row2({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return (
    <div className={`flex justify-between ${big ? "font-black text-[14px]" : ""}`}>
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}

/* ============================ حوارات سريعة ============================ */

export function PromptDialog({
  title,
  subtitle,
  fields,
  submitLabel,
  onClose,
  onSubmit,
  tone = "ink",
}: {
  title: string;
  subtitle?: string;
  fields: { key: string; label: string; placeholder: string; type?: string; required?: boolean }[];
  submitLabel: string;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
  tone?: "ink" | "amber" | "red";
}) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, ""])),
  );
  const [err, setErr] = useState("");
  const first = useRef<HTMLInputElement | null>(null);
  useEffect(() => first.current?.focus(), []);

  const submit = () => {
    for (const f of fields) {
      if (f.required && !vals[f.key]?.trim()) {
        setErr(`الحقل «${f.label}» مطلوب`);
        return;
      }
    }
    onSubmit(vals);
  };

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} width="max-w-md" tone={tone}>
      <div className="space-y-3">
        {fields.map((f, i) => (
          <label key={f.key} className="block">
            <span className="block text-[12px] font-black text-ink-700 mb-1">{f.label}</span>
            <input
              ref={i === 0 ? first : undefined}
              type={f.type ?? "text"}
              value={vals[f.key] ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => {
                setErr("");
                setVals((v) => ({ ...v, [f.key]: e.target.value }));
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full h-11 rounded-xl border border-line bg-paper-2 px-3 text-[13.5px] font-bold text-ink-900 outline-none focus:border-amber-brand focus:bg-white"
            />
          </label>
        ))}
        {err && (
          <p className="text-[12px] font-bold text-cash-red flex items-center gap-1.5">
            <IcoWarn className="w-4 h-4" />
            {err}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            className="flex-1 h-11 rounded-xl bg-cash-green text-white font-black cy-press hover:bg-cash-green-deep"
          >
            {submitLabel}
          </button>
          <button
            onClick={onClose}
            className="h-11 px-5 rounded-xl bg-slate-200 text-ink-800 font-black cy-press hover:bg-slate-300"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function DiscountDialog({
  current,
  subtotal,
  onClose,
  onApply,
}: {
  current: number;
  subtotal: number;
  onClose: () => void;
  onApply: (percent: number, amount: number) => void;
}) {
  const [pct, setPct] = useState(String(current));
  const [amount, setAmount] = useState("0");

  const pctNum = Math.min(100, Math.max(0, Number.parseFloat(pct) || 0));
  const amountNum = Math.max(0, Number.parseFloat(amount) || 0);
  const derivedPct =
    subtotal > 0 ? Math.min(100, Math.round((amountNum / subtotal) * 10000) / 100) : 0;

  return (
    <Modal
      title="خصم على الفاتورة"
      subtitle={`إجمالي الفاتورة قبل الخصم: ${money(subtotal)} جنيه`}
      onClose={onClose}
      width="max-w-md"
      tone="red"
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[12px] font-black text-ink-700 mb-1">نسبة الخصم %</span>
          <input
            type="number"
            min={0}
            max={100}
            value={pct}
            onChange={(e) => {
              setPct(e.target.value);
              const p = Math.min(100, Math.max(0, Number.parseFloat(e.target.value) || 0));
              setAmount(String(Math.round(subtotal * p) / 100));
            }}
            className="w-full h-12 rounded-xl border border-line bg-paper-2 px-3 text-center text-[20px] font-black text-cash-red cy-num outline-none focus:border-cash-red"
          />
        </label>
        <label className="block">
          <span className="block text-[12px] font-black text-ink-700 mb-1">قيمة الخصم</span>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              const a = Math.max(0, Number.parseFloat(e.target.value) || 0);
              setPct(subtotal > 0 ? String(Math.min(100, Math.round((a / subtotal) * 10000) / 100)) : "0");
            }}
            className="w-full h-12 rounded-xl border border-line bg-paper-2 px-3 text-center text-[20px] font-black text-ink-800 cy-num outline-none focus:border-amber-brand"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {[0, 5, 10, 15, 20, 25, 50].map((p) => (
          <button
            key={p}
            onClick={() => {
              setPct(String(p));
              setAmount(String(Math.round(subtotal * p) / 100));
            }}
            className="h-8 px-3 rounded-full bg-slate-200 hover:bg-ink-800 hover:text-white text-[12px] font-black cy-press"
          >
            {p}%
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-amber-cream border border-amber-brand/60 px-3 py-2.5 flex items-center justify-between">
        <span className="text-[12.5px] font-bold text-amber-900">الصافي بعد الخصم</span>
        <span className="text-[22px] font-black text-cash-green-deep cy-num">
          {money(Math.max(0, subtotal - (subtotal * pctNum) / 100))}
        </span>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onApply(pctNum, (subtotal * pctNum) / 100)}
          className="flex-1 h-11 rounded-xl bg-cash-red text-white font-black cy-press hover:brightness-110"
        >
          تطبيق الخصم ({pctNum}%)
        </button>
        <button
          onClick={() => onApply(derivedPct, amountNum)}
          className="h-11 px-4 rounded-xl bg-ink-800 text-white font-black cy-press hover:bg-ink-900"
        >
          تطبيق بالمبلغ
        </button>
        <button
          onClick={onClose}
          className="h-11 px-4 rounded-xl bg-slate-200 text-ink-800 font-black cy-press hover:bg-slate-300"
        >
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

/* ============================ تفاصيل فاتورة ============================ */

export function InvoiceDetail({
  invoice,
  onClose,
}: {
  invoice: InvoiceRow;
  onClose: () => void;
}) {
  return (
    <Modal
      title={`تفاصيل الفاتورة رقم ${invoice.number}`}
      subtitle={`${invoice.customerName} · ${shortStamp(invoice.createdAt)}`}
      onClose={onClose}
      width="max-w-md"
      tone="amber"
    >
      <div className="grid grid-cols-2 gap-2.5">
        <Stat k="الإجمالي" v={money(invoice.total)} tone="ink" />
        <Stat k="المدفوع" v={money(invoice.paid)} tone="green" />
        <Stat k="المتبقي" v={money(invoice.remaining)} tone={invoice.remaining > 0 ? "red" : "green"} />
        <Stat k="عدد الأسطر" v={String(invoice.itemsCount)} tone="slate" />
      </div>
      <div className="mt-3 rounded-xl bg-paper border border-line px-3 py-2.5 text-[12.5px] font-bold text-ink-700 space-y-1">
        <div className="flex justify-between">
          <span>نوع البيع</span>
          <span className="text-ink-900">{invoice.saleType}</span>
        </div>
        <div className="flex justify-between">
          <span>طريقة الدفع</span>
          <span className="text-ink-900">{invoice.paymentMethod}</span>
        </div>
        <div className="flex justify-between">
          <span>حالة السداد</span>
          <span className={invoice.remaining > 0 ? "text-cash-red" : "text-cash-green-deep"}>
            {invoice.remaining > 0 ? "آجل / غير مسدد" : "مسدد بالكامل"}
          </span>
        </div>
      </div>
      <button
        onClick={onClose}
        className="w-full mt-4 h-11 rounded-xl bg-ink-800 text-white font-black cy-press hover:bg-ink-900"
      >
        إغلاق
      </button>
    </Modal>
  );
}

function Stat({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone: "ink" | "green" | "red" | "slate";
}) {
  const map = {
    ink: "bg-ink-800 text-white border-black/40",
    green: "bg-cash-green-deep text-white border-emerald-900/40",
    red: "bg-cash-red text-white border-red-800/40",
    slate: "bg-paper text-ink-800 border-line",
  } as const;
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${map[tone]}`}>
      <div className="text-[11px] font-bold opacity-75">{k}</div>
      <div className="text-[20px] font-black cy-num">{v}</div>
    </div>
  );
}

/* ============================ تأكيد الإغلاق ============================ */

export function CloseConfirm({
  onCancel,
  onConfirm,
  dirty,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  dirty: boolean;
}) {
  return (
    <Modal
      title="إنهاء جلسة كاش يو"
      subtitle={dirty ? "توجد فاتورة لم يتم حفظها" : "كل الفواتير محفوظة"}
      onClose={onCancel}
      width="max-w-sm"
      tone="red"
    >
      <p className="text-[13.5px] font-bold text-ink-700 leading-relaxed">
        {dirty
          ? "الفاتورة الحالية تحتوي على أصناف غير محفوظة. هل تريد إغلاق النظام وفقدانها؟"
          : "سيتم إغلاق النظام وإنهاء الجلسة الحالية. يمكنك إعادة التشغيل في أي وقت."}
      </p>
      <div className="flex gap-2 mt-4">
        <button
          onClick={onConfirm}
          className="flex-1 h-11 rounded-xl bg-cash-red text-white font-black cy-press hover:brightness-110"
        >
          نعم، إغلاق
        </button>
        <button
          onClick={onCancel}
          className="h-11 px-5 rounded-xl bg-slate-200 text-ink-800 font-black cy-press hover:bg-slate-300"
        >
          رجوع
        </button>
      </div>
    </Modal>
  );
}

/* ============================ عارض كود المصدر ============================ */

const FILES = [
  { path: "/desktop/CashYou.vbproj", name: "CashYou.vbproj", desc: "ملف المشروع .NET 8" },
  { path: "/desktop/App.xaml", name: "App.xaml", desc: "تعريف التطبيق والموارد" },
  { path: "/desktop/Models.vb", name: "Models.vb", desc: "كيانات البيانات العربية" },
  { path: "/desktop/Database.vb", name: "Database.vb", desc: "طبقة SQLite" },
  { path: "/desktop/MainWindow.xaml", name: "MainWindow.xaml", desc: "واجهة WPF كاملة RTL" },
  { path: "/desktop/MainWindow.xaml.vb", name: "MainWindow.xaml.vb", desc: "منطق شاشة البيع والتقسيط" },
  { path: "/desktop/DatabaseExtended.vb", name: "DatabaseExtended.vb", desc: "المشتريات والمرتجعات والخزينة SQLite" },
  { path: "/desktop/ModulesWindow.xaml", name: "ModulesWindow.xaml", desc: "كل وحدات الإدارة RTL" },
  { path: "/desktop/ModulesWindow.xaml.vb", name: "ModulesWindow.xaml.vb", desc: "المخازن والحسابات والأقساط" },
];

export function SourceScreen() {
  const [active, setActive] = useState(FILES[4]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(active.path)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("404"))))
      .then((t) => alive && setCode(t))
      .catch(() => alive && setCode("' تعذر تحميل الملف"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [active]);

  const download = () => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = active.name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 p-2 bg-paper" dir="rtl">
      <aside className="lg:w-[260px] shrink-0 rounded-xl bg-ink-800 border border-black/40 overflow-hidden flex flex-col">
        <div className="px-3 py-2.5 border-b border-white/10">
          <h2 className="text-white font-black text-[14px]">كود المصدر — VB.NET / WPF</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            نفس التطبيق كبرنامج سطح مكتب .NET 8 + SQLite
          </p>
        </div>
        <div className="flex-1 overflow-y-auto cy-scroll-dark p-1.5 space-y-1">
          {FILES.map((f) => (
            <button
              key={f.path}
              onClick={() => setActive(f)}
              className={`w-full text-right rounded-lg px-2.5 py-2 cy-press transition-colors ${
                active.path === f.path
                  ? "bg-amber-brand text-ink-900"
                  : "bg-white/5 text-slate-200 hover:bg-white/12"
              }`}
            >
              <div className="text-[12.5px] font-black font-mono" dir="ltr">
                {f.name}
              </div>
              <div
                className={`text-[11px] mt-0.5 ${active.path === f.path ? "text-ink-800/80" : "text-slate-400"}`}
              >
                {f.desc}
              </div>
            </button>
          ))}
        </div>
        <div className="p-2 border-t border-white/10 flex gap-1.5">
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(code);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
            className="flex-1 h-9 rounded-lg bg-white/10 text-white text-[12px] font-black cy-press hover:bg-white/20 flex items-center justify-center gap-1.5"
          >
            {copied ? <IcoCheck className="w-3.5 h-3.5" /> : <IcoCopy className="w-3.5 h-3.5" />}
            {copied ? "تم النسخ" : "نسخ"}
          </button>
          <button
            onClick={download}
            className="flex-1 h-9 rounded-lg bg-cash-green text-white text-[12px] font-black cy-press hover:bg-cash-green-deep flex items-center justify-center gap-1.5"
          >
            <IcoDownload className="w-3.5 h-3.5" />
            تنزيل
          </button>
        </div>
      </aside>

      <div className="flex-1 min-h-0 rounded-xl bg-ink-950 border border-black/50 overflow-hidden flex flex-col">
        <div className="h-9 px-3 flex items-center gap-2 bg-ink-900 border-b border-white/10">
          <span className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cash-red" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-brand" />
            <span className="w-2.5 h-2.5 rounded-full bg-cash-green" />
          </span>
          <span className="text-[12px] font-mono text-slate-400" dir="ltr">
            CASH YOU / {active.name}
          </span>
          <span className="mr-auto text-[11px] font-bold text-slate-500 cy-num">
            {code.split("\n").length} سطر
          </span>
        </div>
        <pre
          dir="ltr"
          className="flex-1 min-h-0 overflow-auto cy-scroll-dark p-3 text-[12px] leading-[1.6] font-mono text-slate-200 whitespace-pre"
        >
          {loading ? "جارٍ التحميل..." : code}
        </pre>
      </div>
    </section>
  );
}

/* ============================ شاشة الإيقاف ============================ */

export function ShutdownScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] cy-mesh cy-grain grid place-items-center" dir="rtl">
      <div className="text-center cy-pop">
        <IcoLogo className="w-20 h-20 mx-auto" />
        <h1 className="text-white font-black text-3xl mt-4 tracking-[0.2em]">
          CASH<span className="text-amber-brand"> YOU</span>
        </h1>
        <p className="text-slate-400 font-bold mt-2">تم إنهاء الجلسة وإغلاق النظام بأمان</p>
        <p className="text-slate-500 text-[12.5px] mt-1">
          الدعم الفني : م / وائل الجمال — 01222355769
        </p>
        <button
          onClick={onRestart}
          className="mt-6 h-12 px-8 rounded-xl bg-amber-brand text-ink-900 font-black cy-press hover:brightness-110 shadow-2xl"
        >
          إعادة تشغيل النظام
        </button>
      </div>
    </div>
  );
}

/* ============================ شريط المهام المصغر ============================ */

export function MinimizedBar({
  onRestore,
  data,
}: {
  onRestore: () => void;
  data: Bootstrap;
}) {
  const today = data.invoices.reduce((s, i) => s + i.total, 0);
  return (
    <div className="fixed inset-0 z-[100] cy-mesh cy-grain flex items-end justify-center p-6" dir="rtl">
      <button
        onClick={onRestore}
        className="group flex items-center gap-3 rounded-2xl bg-ink-800/90 border border-white/15 px-4 py-3 shadow-2xl cy-press hover:border-amber-brand"
      >
        <IcoLogo className="w-9 h-9" />
        <span className="text-right">
          <span className="block text-white font-black tracking-widest text-[13px]">
            CASH YOU — كاش يو
          </span>
          <span className="block text-[11.5px] text-slate-400 font-bold cy-num">
            مبيعات مسجلة: {money(today)} · اضغط للاستعادة
          </span>
        </span>
      </button>
    </div>
  );
}