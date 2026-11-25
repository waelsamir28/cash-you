"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/offline-sync";
import {
  IcoCheck,
  IcoCloud,
  IcoDatabase,
  IcoMonitor,
  IcoWarn,
} from "@/components/icons";

type Mode = "cloud" | "local";

/**
 * صفحة ربط قاعدة البيانات: سحابية أو محلية.
 * تختبر الاتصال فعلياً قبل الحفظ، ثم تحفظ الرابط في إعدادات النسخة المكتبية.
 */
export function DatabaseScreen({
  notify,
}: {
  notify: (kind: "ok" | "err" | "warn" | "info", message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>("cloud");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null);
  const [saved, setSaved] = useState<{ saved: boolean; maskedUrl: string; mode: Mode } | null>(null);

  useEffect(() => {
    void apiFetch("/api/db-connection")
      .then((r) => r.json())
      .then((j: { saved: boolean; maskedUrl: string; mode: Mode }) => setSaved(j))
      .catch(() => setSaved(null));
  }, []);

  const run = async (action: "test" | "save") => {
    if (busy) return;
    setBusy(action);
    setResult(null);
    try {
      const res = await apiFetch("/api/db-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, mode, url }),
      });
      const json = (await res.json()) as { ok: boolean; message: string; latencyMs?: number; saved?: boolean };
      setResult(json);
      if (json.ok) {
        notify("ok", json.message);
        if (json.saved) {
          setSaved({ saved: true, maskedUrl: "محفوظ", mode });
          setUrl("");
        }
      } else {
        notify("err", json.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذر تنفيذ العملية";
      setResult({ ok: false, message: msg });
      notify("err", msg);
    } finally {
      setBusy(null);
    }
  };

  const placeholder =
    mode === "cloud"
      ? "postgresql://user:password@host:5432/dbname?sslmode=require"
      : "postgresql://postgres:password@localhost:5432/cash_you";

  return (
    <div className="h-full overflow-y-auto cy-scroll bg-paper p-3" dir="rtl">
      <div className="mx-auto max-w-2xl space-y-2.5">
        {/* الرأس */}
        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-ink-800 text-white">
            <IcoDatabase className="h-5 w-5" />
          </div>
          <h1 className="mt-1.5 text-[16px] font-black text-ink-900">ربط قاعدة البيانات</h1>
          <p className="mx-auto mt-0.5 max-w-sm text-[11px] font-semibold leading-5 text-slate-500">
            اختر مصدر البيانات: قاعدة سحابية تعمل من أي مكان، أو قاعدة محلية على جهازك بسرعة أعلى.
          </p>
        </div>

        {/* الحالة المحفوظة */}
        {saved?.saved && (
          <div className="flex items-center gap-2 rounded-xl border border-cash-green/40 bg-cash-green/10 px-3 py-2 text-[11px] font-bold text-cash-green-deep">
            <IcoCheck className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              هناك اتصال محفوظ ({saved.mode === "cloud" ? "سحابي" : "محلي"})
            </span>
            <span className="cy-num truncate text-[10px] opacity-70" dir="ltr">
              {saved.maskedUrl}
            </span>
          </div>
        )}

        {/* اختيار النوع */}
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: "cloud" as Mode, title: "قاعدة سحابية", hint: "تعمل من أي جهاز وإنترنت", icon: <IcoCloud className="h-5 w-5" /> },
            { id: "local" as Mode, title: "قاعدة محلية", hint: "على نفس الجهاز — أسرع", icon: <IcoMonitor className="h-5 w-5" /> },
          ]).map((opt) => {
            const active = mode === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setMode(opt.id)}
                className={`relative rounded-xl border-2 p-3 text-center transition cy-press ${
                  active ? "border-cash-green bg-cash-green/5 shadow-[0_0_0_3px_rgba(16,185,129,0.14)]" : "border-line bg-white hover:border-ink-500"
                }`}
              >
                {active && (
                  <span className="absolute left-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-cash-green text-white">
                    <IcoCheck className="h-2.5 w-2.5" />
                  </span>
                )}
                <span className={`mx-auto grid h-9 w-9 place-items-center rounded-lg ${active ? "bg-cash-green text-white" : "bg-paper-2 text-ink-700"}`}>
                  {opt.icon}
                </span>
                <div className="mt-1 text-[12px] font-black text-ink-800">{opt.title}</div>
                <div className="text-[9.5px] font-semibold text-slate-500">{opt.hint}</div>
              </button>
            );
          })}
        </div>

        {/* الرابط */}
        <div className="rounded-xl border border-line bg-white p-3">
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-black text-slate-500">رابط الاتصال</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              dir="ltr"
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
              className="h-10 w-full rounded-lg border border-line bg-paper-2 px-2.5 font-mono text-[11px] font-bold text-ink-900 outline-none focus:border-amber-brand focus:bg-white"
            />
          </label>
          <p className="mt-1.5 text-[9.5px] font-semibold leading-4 text-slate-500">
            يُختبر الاتصال قبل الحفظ. الرابط يُخزَّن مشفّراً على جهازك فقط، ولا يظهر كاملاً بعد الحفظ.
          </p>

          {result && (
            <p
              className={`mt-2 flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-[10.5px] font-bold leading-4 ${
                result.ok
                  ? "border-cash-green/40 bg-cash-green/10 text-cash-green-deep"
                  : "border-cash-red/40 bg-cash-red/10 text-cash-red"
              }`}
            >
              {result.ok ? <IcoCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <IcoWarn className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              <span className="flex-1">
                {result.message}
                {result.latencyMs !== undefined && (
                  <span className="cy-num mr-1 opacity-70"> · {result.latencyMs} مللي ثانية</span>
                )}
              </span>
            </p>
          )}

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button
              onClick={() => void run("test")}
              disabled={busy !== null || !url.trim()}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg border-2 border-ink-800 bg-white text-[12px] font-black text-ink-800 cy-press hover:bg-ink-800 hover:text-white disabled:opacity-50"
            >
              {busy === "test" ? "جارٍ الاختبار..." : "اختبار الاتصال"}
            </button>
            <button
              onClick={() => void run("save")}
              disabled={busy !== null || !url.trim()}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-cash-green text-[12px] font-black text-white cy-press hover:brightness-110 disabled:opacity-50"
            >
              {busy === "save" ? "جارٍ الحفظ..." : "اختبار وحفظ"}
            </button>
          </div>
        </div>

        {/* ملاحظات */}
        <div className="rounded-xl border border-line bg-white p-3">
          <h2 className="text-[11.5px] font-black text-ink-800">قبل ما تبدأ</h2>
          <ul className="mt-1.5 space-y-1 text-[10px] font-semibold leading-4 text-slate-600">
            <li className="flex items-start gap-1.5">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-brand" />
              بعد الحفظ أعد تشغيل البرنامج ليعمل بالاتصال الجديد.
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-brand" />
              للقاعدة السحابية: استخدم رابط Neon أو Supabase مع <span className="font-mono" dir="ltr">sslmode=require</span>.
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-brand" />
              للقاعدة المحلية: ثبّت PostgreSQL على الجهاز واستخدم منفذ 5432.
            </li>
            <li className="flex items-start gap-1.5">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-cash-green" />
              الجداول تُنشأ تلقائياً في القاعدة الجديدة عند أول تشغيل — بدون SQL يدوي.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
