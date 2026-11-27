"use client";

import { IcoCart } from "@/components/icons";
import { Modal } from "@/components/Overlays";
import type { HeldInvoice } from "@/lib/held-invoices";
import { money, shortStamp } from "@/lib/format";

/** الفواتير المعلّقة على هذا الجهاز: تُسترجع في تبويب جديد (لا تُحذف من هنا) */
export function HeldInvoicesDialog({
  rows,
  onResume,
  onClose,
}: {
  rows: HeldInvoice[];
  onResume: (row: HeldInvoice) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="الفواتير المعلّقة" subtitle="فواتير مؤجلة على هذا الجهاز — تُحفظ حتى تسترجعها" onClose={onClose} width="max-w-xl">
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-paper-2 p-8 text-center text-[13px] font-bold text-slate-500">
          لا توجد فواتير معلّقة الآن
        </div>
      ) : (
        <div className="cy-scroll max-h-[55vh] space-y-2 overflow-y-auto pe-1">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5 shadow-sm">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-soft text-amber-800">
                <IcoCart className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-black text-ink-900">{row.customerName}</div>
                <div className="text-[11px] font-bold text-slate-500">
                  {row.itemsCount} صنف · {shortStamp(row.heldAt)}
                </div>
              </div>
              <div className="cy-num text-[14px] font-black text-cash-green-deep">{money(row.total)}</div>
              <button
                onClick={() => onResume(row)}
                className="h-9 rounded-lg bg-cash-green px-3 text-[12px] font-black text-white cy-press hover:bg-cash-green-deep"
              >
                استرجاع
              </button>
            </div>
          ))}
        </div>
      )}
      <button onClick={onClose} className="mt-4 h-10 w-full rounded-xl bg-slate-200 text-[13px] font-black text-ink-800 cy-press hover:bg-slate-300">
        إغلاق
      </button>
    </Modal>
  );
}
