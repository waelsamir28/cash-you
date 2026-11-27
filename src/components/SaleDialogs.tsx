"use client";

import type { ShopInfo } from "@/lib/types";
import { overpayText, type OverpayChoice, type OverpayPrefs, type ReceiptPrefs } from "@/lib/ui-prefs";
import { money } from "@/lib/format";
import { IcoPrint } from "@/components/icons";
import { Modal, ReceiptPaper, type ReceiptData } from "@/components/Overlays";

/** معاينة الفاتورة قبل الحفظ عند الضغط على «حفظ وطباعة» */
export function SalePreviewDialog({
  receipt,
  shop,
  prefs,
  busy,
  onConfirm,
  onClose,
}: {
  receipt: ReceiptData;
  shop: ShopInfo;
  prefs: ReceiptPrefs;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title="معاينة الفاتورة قبل الطباعة" subtitle="راجع الفاتورة ثم اضغط طباعة (سيتم حفظها أولاً)" onClose={onClose} width="max-w-md">
      <div className="cy-scroll max-h-[52vh] overflow-y-auto">
        <ReceiptPaper receipt={receipt} shop={shop} prefs={prefs} />
      </div>
      <div className="flex gap-2 mt-4 cy-no-print">
        <button
          onClick={onConfirm}
          disabled={busy}
          style={{ background: "var(--cy-save-print)" }}
          className="flex-1 h-11 rounded-xl text-white font-black cy-press flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <IcoPrint className="w-4 h-4" />
          {busy ? "جاري الحفظ..." : "طباعة"}
        </button>
        <button
          onClick={onClose}
          disabled={busy}
          className="h-11 px-6 rounded-xl bg-slate-200 text-ink-800 font-black cy-press hover:bg-slate-300 disabled:opacity-50"
        >
          إلغاء
        </button>
      </div>
    </Modal>
  );
}

/** المدفوع أكبر من إجمالي المستند: يختار المستخدم تسليم الباقي أو تنزيله على حساب الطرف (عميل أو مورد) */
export function OverpayDialog({
  previousBalance,
  total,
  paid,
  partyName,
  creditAllowed,
  prefs,
  onPick,
  onClose,
}: {
  previousBalance: number;
  total: number;
  paid: number;
  partyName: string;
  creditAllowed: boolean;
  prefs: OverpayPrefs;
  onPick: (mode: OverpayChoice) => void;
  onClose: () => void;
}) {
  const extra = Math.round((paid - total) * 100) / 100;
  const boxes: { label: string; value: number; tone: string }[] = [
    ...(prefs.showPreviousBalance ? [{ label: "الرصيد السابق", value: previousBalance, tone: "bg-slate-50 border-slate-200 text-ink-800" }] : []),
    { label: "إجمالي المستند", value: total, tone: "bg-ink-800 border-ink-800 text-white" },
    { label: "المدفوع", value: paid, tone: "bg-amber-50 border-amber-300 text-ink-900" },
  ];
  const choices: OverpayChoice[] = [];
  if (prefs.showChange) choices.push("change");
  if (prefs.showCredit) choices.push("credit");
  const preferred: OverpayChoice = choices.includes(prefs.defaultChoice) ? prefs.defaultChoice : choices[0];
  const defaultChoice: OverpayChoice = preferred === "credit" && !creditAllowed && choices.includes("change") ? "change" : preferred;
  const pick = (c: OverpayChoice) => {
    if (c === "credit" && !creditAllowed) return;
    onPick(c);
  };
  return (
    <Modal
      title={prefs.title || "المبلغ المدفوع أكبر من المطلوب"}
      subtitle={`الزيادة: ${money(extra)} جنيه`}
      onClose={onClose}
      tone="amber"
      width="max-w-md"
    >
      <div className={`grid gap-2 ${boxes.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
        {boxes.map((b) => (
          <div key={b.label} className={`cy-box rounded-lg border px-2 py-2 text-center ${b.tone}`}>
            <div className="text-[10.5px] font-bold opacity-80">{b.label}</div>
            <div className="cy-num text-[14px] font-black mt-0.5">{money(b.value)}</div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[12px] text-slate-600 text-center">اختر ما يحدث للزيادة ({money(extra)} جنيه):</p>
      <div className={`grid gap-2 mt-2 ${choices.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {choices.includes("change") && (
          <button
            autoFocus={defaultChoice === "change"}
            onClick={() => pick("change")}
            className="h-12 rounded-xl bg-cash-green text-white font-black cy-press hover:bg-cash-green-deep flex flex-col items-center justify-center"
          >
            <span>{prefs.changeLabel}</span>
            {prefs.changeHint && <span className="text-[10.5px] font-bold opacity-85">{prefs.changeHint}</span>}
          </button>
        )}
        {choices.includes("credit") && (
          <button
            autoFocus={defaultChoice === "credit"}
            onClick={() => pick("credit")}
            disabled={!creditAllowed}
            className="cy-btn h-12 rounded-xl bg-ink-800 text-white font-black cy-press hover:bg-ink-900 disabled:opacity-40 flex flex-col items-center justify-center"
          >
            <span>{prefs.creditLabel}</span>
            <span className="text-[10.5px] font-bold opacity-85">
              {creditAllowed ? overpayText(prefs.creditHint, partyName) : "اختر عميلاً أولاً"}
            </span>
          </button>
        )}
      </div>
    </Modal>
  );
}
