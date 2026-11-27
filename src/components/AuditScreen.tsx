"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { shortStamp } from "@/lib/format";
import { IcoChart, IcoWarn } from "@/components/icons";
import { Empty, ModuleShell, ModuleTitle, Panel } from "@/components/ModuleUI";

type AuditRow = { id: number; createdAt: string; userName: string; action: string; entity: string; reference: string; details: string };

/** سجل النشاط: من حذف فاتورة، ومن اعتمد جرداً، ومن غيّر صلاحيات موظف، ومتى */
export function AuditScreen() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/audit?t=${Date.now()}`, { cache: "no-store" });
      const json = (await res.json()) as { rows?: AuditRow[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "تعذر تحميل سجل النشاط");
      setRows(json.rows ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل سجل النشاط");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <ModuleShell>
      <ModuleTitle
        title="سجل النشاط"
        subtitle="العمليات الحساسة: حذف الفواتير، الجرد، وتعديل صلاحيات الموظفين"
        badge={`${rows.length} عملية`}
        actions={
          <button onClick={() => void load()} disabled={loading} className="h-8 rounded-lg bg-white/10 px-3 text-[12px] font-black text-white cy-press hover:bg-white/20 disabled:opacity-50">
            تحديث
          </button>
        }
      />

      <div className="mt-2">
        <Panel title="آخر 300 عملية" hint="اضغط على الصف لعرض التفاصيل">
          <div className="max-h-[calc(100vh-200px)] overflow-auto cy-scroll">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 z-[1] bg-ink-800 text-white">
                <tr>
                  {["الوقت", "المستخدم", "العملية", "النوع", "المرجع"].map((h) => (
                    <th key={h} className="border-l border-white/10 px-2 py-2.5 text-center first:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => setOpen(open === row.id ? null : row.id)}
                      className={`${index % 2 ? "bg-paper-2" : "bg-white"} cursor-pointer border-b border-slate-200 hover:bg-amber-soft/40`}
                    >
                      <td className="cy-num px-2 py-1.5 text-right text-slate-600">{shortStamp(row.createdAt)}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-ink-800">{row.userName || "—"}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`rounded px-2 py-0.5 text-[11px] font-black ${row.action.startsWith("حذف") ? "bg-red-50 text-cash-red" : "bg-amber-soft text-amber-800"}`}>
                          {row.action}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-center text-slate-600">{row.entity}</td>
                      <td className="px-2 py-1.5 text-center font-bold text-ink-900">{row.reference}</td>
                    </tr>
                    {open === row.id && (
                      <tr className="bg-paper border-b border-slate-200">
                        <td colSpan={5} className="px-3 py-2">
                          <pre className="cy-scroll max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white p-2.5 text-[11.5px] leading-relaxed text-ink-800" dir="ltr">
                            {formatDetails(row.details)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {error && (
              <p className="flex items-center justify-center gap-2 p-6 text-[12.5px] font-bold text-cash-red">
                <IcoWarn className="h-4 w-4" />
                {error}
              </p>
            )}
            {!error && !loading && rows.length === 0 && <Empty text="لا توجد عمليات مسجلة بعد" />}
            {loading && <p className="p-4 text-center text-[12px] font-bold text-slate-500">جارٍ تحميل السجل...</p>}
          </div>
        </Panel>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
        <IcoChart className="h-3.5 w-3.5" />
        السجل للقراءة فقط ولا يمكن تعديله من البرنامج.
      </p>
    </ModuleShell>
  );
}

function formatDetails(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text || "—";
  }
}
