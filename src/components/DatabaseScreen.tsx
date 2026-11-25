"use client";

import { useEffect, useMemo, useState } from "react";
import {
  isDesktopBridge,
  loadDbConfig,
  saveDbConfig,
  syncDatabases,
  testDbConnection,
  type DbConfigState,
  type DbMode,
  type DbTestResult,
  type SyncReport,
} from "@/lib/db-connection";
import {
  IcoCheck,
  IcoCloud,
  IcoDatabase,
  IcoMonitor,
  IcoSync,
  IcoWarn,
} from "@/components/icons";

type Mode = DbMode;

/**
 * صفحة ربط قاعدة البيانات: سحابية أو محلية.
 * تختبر الاتصال فعلياً قبل الحفظ، ثم تحفظ الرابط في إعدادات النسخة المكتبية.
 */
export function DatabaseScreen({
  notify,
}: {
  notify: (kind: "ok" | "err" | "warn" | "info", message: string) => void;
}) {
  /*
   * في نسخة ويندوز (EXE) تُنشأ قاعدة العميل المحلية تلقائياً على جهازه،
   * ويختار هو وحده رابطه السحابي (إن أراد نسخة احتياطية/مزامنة).
   * لذلك نبدأ في وضع «سحابية» لجمع رابطه، ونخفي اختيار المصدر المحلي.
   */
  const [mode, setMode] = useState<Mode>("cloud");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"test" | "save" | null>(null);
  const [result, setResult] = useState<DbTestResult | null>(null);
  const [saved, setSaved] = useState<DbConfigState | null>(null);
  /* هل نعمل داخل نسخة ويندوز؟ عندها الحفظ والاختبار يتمّان على جهاز العميل */
  const desktop = useMemo(() => isDesktopBridge(), []);

  /* ---------- حالة المزامنة ---------- */
  const [syncOpen, setSyncOpen] = useState(false);
  const [localUrl, setLocalUrl] = useState("");
  const [cloudUrl, setCloudUrl] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  /* في السحابة: لكل عميل قاعدة خاصة تُحدَّد تلقائياً — لا نطلب منه رابطاً */
  const [cloudLocked, setCloudLocked] = useState(false);

  useEffect(() => {
    void loadDbConfig()
      .then(setSaved)
      .catch(() => setSaved(null));
    /* هل نحن على نسخة متعددة المستأجرين؟ (قاعدة العميل تُحدَّد من الخادم) */
    void fetch("/api/bootstrap", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setCloudLocked(Boolean(json?.tenant?.isolated)))
      .catch(() => setCloudLocked(false));
  }, []);

  const run = async (action: "test" | "save") => {
    if (busy) return;
    setBusy(action);
    setResult(null);
    try {
      /* الاختبار أولاً — لا نُحفظ رابطاً غير صالح */
      if (action === "save") {
        const probe = await testDbConnection(url);
        if (!probe.ok) {
          setResult(probe);
          notify("err", `لم يتم الحفظ — ${probe.message}`);
          return;
        }
      }

      const json =
        action === "test"
          ? await testDbConnection(url)
          : await saveDbConfig(mode, url);

      setResult(json);
      if (json.ok) {
        notify("ok", json.message);
        if (action === "save" && json.saved !== false) {
          /*
           * نعيد قراءة الإعداد المحفوظ حتى تبقى كل الأعلام (قاعدة محلية
           * جاهزة، رابط سحابي محفوظ) كما هي — لا نخسرها بالاستبدال.
           */
          const fresh = await loadDbConfig().catch(() => null);
          setSaved(
            fresh && fresh.saved
              ? fresh
              : { saved: true, maskedUrl: "محفوظ على جهازك", mode },
          );
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

  /*
   * جاهزية روابط المزامنة:
   *  - في نسخة ويندوز: القاعدة المحلية جاهزة تلقائياً على جهاز العميل
   *    (لا يدخل رابطها ولا كلمة مروره)، والرابط السحابي قد يكون محفوظاً
   *    على جهازه من قبل فيكفيه تركه فارغاً.
   *  - في نسخة الويب: العميل يدخل الرابطين بنفسه.
   */
  const localReady = desktop ? Boolean(saved?.hasLocalDb) || Boolean(localUrl.trim()) : Boolean(localUrl.trim());
  const cloudReady = cloudLocked ? true : desktop ? Boolean(saved?.hasCloudDb) || Boolean(cloudUrl.trim()) : Boolean(cloudUrl.trim());

  /* ---------- تشغيل المزامنة ---------- */
  const runSync = async () => {
    if (syncBusy) return;
    if (!localReady || !cloudReady) {
      notify("err", desktop ? "أضف رابط قاعدتك السحابية أولاً" : "أدخل رابط القاعدة المحلية");
      return;
    }
    setSyncBusy(true);
    setSyncReport(null);
    try {
      const report = await syncDatabases(localUrl.trim(), cloudUrl.trim(), cloudLocked);
      setSyncReport(report);
      if (report.ok) {
        notify("ok", report.message);
      } else {
        notify("err", report.message);
      }
    } finally {
      setSyncBusy(false);
    }
  };

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
            {desktop
              ? "بياناتك محفوظة على جهازك تلقائياً — أضف رابطاً سحابياً إن أردت نسخة احتياطية ومزامنة."
              : "اختر مصدر البيانات: قاعدة سحابية تعمل من أي مكان، أو قاعدة محلية على جهازك بسرعة أعلى."}
          </p>
        </div>

        {/* الحالة المحفوظة */}
        {saved?.saved && (
          <div className="flex items-center gap-2 rounded-xl border border-cash-green/40 bg-cash-green/10 px-3 py-2 text-[11px] font-bold text-cash-green-deep">
            <IcoCheck className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              هناك اتصال محفوظ ({saved.mode === "cloud" ? "سحابي" : "محلي"})
              {desktop ? " على جهازك" : " على السيرفر"}
            </span>
            <span className="cy-num truncate text-[10px] opacity-70" dir="ltr">
              {saved.maskedUrl}
            </span>
          </div>
        )}

        {/* اختيار النوع */}
        {desktop ? (
          <div className="rounded-xl border-2 border-cash-green bg-cash-green/5 p-3">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cash-green text-white">
                <IcoMonitor className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="text-[12px] font-black text-ink-800">بياناتك على جهازك — جاهزة الآن</div>
                <div className="text-[9.5px] font-semibold leading-4 text-slate-500">
                  أنشأ البرنامج قاعدة بيانات خاصة بك على هذا الجهاز تلقائياً — بلا تثبيت ولا إعدادات.
                  {saved?.hasLocalDb ? " وهي محفوظة على جهازك ولن يراها أحد غيرك." : ""}
                </div>
              </div>
            </div>
          </div>
        ) : (
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
        )}

        {mode === "local" && !desktop && (
          <p className="rounded-xl border border-amber-brand/40 bg-amber-brand/10 px-3 py-2 text-[10px] font-bold leading-4 text-amber-800">
            {desktop
              ? "القاعدة المحلية تُشغَّل على جهازك: يحفظ البرنامج الرابط محلياً ويشغّل خادماً محلياً عند فتح التطبيق."
              : "في نسخة الويب يُختبر الاتصال من السيرفر البعيد — استخدم نسخة ويندوز لقاعدة محلية على جهازك."}
            {desktop && " (يعمل الخادم المحلي من أول تشغيل بعد الحفظ — أعد تشغيل البرنامج)."}{" "}
          </p>
        )}

        {/* الرابط */}
        <div className="rounded-xl border border-line bg-white p-3">
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-black text-slate-500">
              {desktop ? "رابط قاعدتك السحابية (اختياري — للمزامنة)" : "رابط الاتصال"}
            </span>
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
            {desktop
              ? "يُختبر الاتصال من جهازك نفسه — لذلك تنجح القواعد المحلية. الرابط يُحفظ على جهازك فقط ولا يظهر كاملاً بعد الحفظ."
              : "يُختبر الاتصال قبل الحفظ. الرابط يُحفظ على السيرفر ولا يظهر كاملاً بعد الحفظ."}
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
              {busy === "save" ? "جارٍ الحفظ..." : desktop ? "اختبار وحفظ" : "حفظ"}
            </button>
          </div>
        </div>

        {/* ---------- المزامنة بين القاعدتين ---------- */}
        <div className="rounded-xl border border-line bg-white p-3">
          <button
            type="button"
            onClick={() => setSyncOpen((v) => !v)}
            className="flex w-full items-center gap-2 text-right"
            aria-expanded={syncOpen}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cash-cyan/15 text-cash-cyan">
              <IcoSync className="h-4 w-4" />
            </span>
            <span className="flex-1">
              <span className="block text-[11.5px] font-black text-ink-800">مزامنة بين القاعدة المحلية والسحابية</span>
              <span className="block text-[9.5px] font-semibold leading-4 text-slate-500">
                مزامنة آمنة ثنائية الاتجاه بزر واحد — تُرفع السجلات الأحدث وتُنزل السجلات الأحدث، ولا يُحذف أي سجل من أي طرف.
              </span>
            </span>
            <span className={`shrink-0 text-[13px] font-black text-slate-400 transition-transform ${syncOpen ? "rotate-180" : ""}`}>
              ▾
            </span>
          </button>

          {syncOpen && (
            <div className="mt-3 space-y-2.5 border-t border-dashed border-line pt-3">
              {desktop ? (
                <div className="rounded-lg border border-cash-green/40 bg-cash-green/10 px-2.5 py-2">
                  <span className="block text-[10.5px] font-black text-slate-500">القاعدة المحلية</span>
                  <span className="mt-1 block text-[11px] font-bold text-ink-900">
                    قاعدة بيانات جهازك — تُنشأ تلقائياً وتُستخدم بلا إدخال أي رابط
                  </span>
                  {saved?.localMasked ? (
                    <span className="mt-0.5 block truncate text-[10px] font-bold opacity-70" dir="ltr">
                      {saved.localMasked}
                    </span>
                  ) : null}
                </div>
              ) : (
                <label className="block">
                  <span className="mb-1 block text-[10.5px] font-black text-slate-500">رابط القاعدة المحلية</span>
                  <input
                    value={localUrl}
                    onChange={(e) => setLocalUrl(e.target.value)}
                    dir="ltr"
                    placeholder="postgresql://postgres:password@localhost:5432/cash_you"
                    spellCheck={false}
                    className="h-10 w-full rounded-lg border border-line bg-paper-2 px-2.5 font-mono text-[11px] font-bold text-ink-900 outline-none focus:border-amber-brand focus:bg-white"
                  />
                </label>
              )}

              {cloudLocked ? (
                <div className="rounded-lg border border-line bg-paper-2 px-2.5 py-2">
                  <span className="block text-[10.5px] font-black text-slate-500">رابط القاعدة السحابية</span>
                  <span className="mt-1 block text-[11px] font-bold text-ink-900">
                    قاعدة سحابية خاصة بك — تُحدَّد تلقائياً ولا يراها غيرك
                  </span>
                </div>
              ) : (
                <label className="block">
                  <span className="mb-1 block text-[10.5px] font-black text-slate-500">رابط القاعدة السحابية</span>
                  <input
                    value={cloudUrl}
                    onChange={(e) => setCloudUrl(e.target.value)}
                    dir="ltr"
                    placeholder="postgresql://user:password@host:5432/dbname?sslmode=require"
                    spellCheck={false}
                    className="h-10 w-full rounded-lg border border-line bg-paper-2 px-2.5 font-mono text-[11px] font-bold text-ink-900 outline-none focus:border-amber-brand focus:bg-white"
                  />
                  {desktop && saved?.hasCloudDb ? (
                    <span className="mt-1 block text-[9.5px] font-semibold leading-4 text-slate-500">
                      المحفوظ على جهازك: <span dir="ltr">{saved.cloudMasked}</span> — اتركه فارغاً للمزامنة به.
                    </span>
                  ) : null}
                </label>
              )}

              <p className="rounded-lg border border-cash-green/30 bg-cash-green/10 px-2.5 py-1.5 text-[10px] font-bold leading-4 text-cash-green-deep">
                المزامنة ثنائية الاتجاه تلقائياً: تُرفع السجلات الأحدث وتُنزل السجلات الأحدث،
                ولا يُحذف أي شيء. ولا تُنسخ الحسابات أو الإعدادات بين عملاء مختلفين.
              </p>

              <button
                type="button"
                onClick={() => void runSync()}
                disabled={syncBusy || !localReady || !cloudReady}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-cash-cyan text-[12.5px] font-black text-white cy-press hover:brightness-110 disabled:opacity-50"
              >
                <IcoSync className={`h-4 w-4 ${syncBusy ? "animate-spin" : ""}`} />
                {syncBusy ? "جارٍ المزامنة..." : "مزامنة الآن"}
              </button>

              {syncReport && (
                <div
                  className={`rounded-lg border px-2.5 py-2 text-[10.5px] font-bold leading-4 ${
                    syncReport.ok
                      ? "border-cash-green/40 bg-cash-green/10 text-cash-green-deep"
                      : "border-cash-red/40 bg-cash-red/10 text-cash-red"
                  }`}
                >
                  <p className="flex items-start gap-1.5">
                    {syncReport.ok ? (
                      <IcoCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <IcoWarn className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="flex-1">{syncReport.message}</span>
                  </p>
                  {(syncReport.pushed > 0 || syncReport.pulled > 0) && (
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5 border-t border-current/15 pt-1.5">
                      <div className="rounded-md bg-white/60 px-1.5 py-1 text-center">
                        <span className="block text-[9px] font-black opacity-70">إلى السحابية ↑</span>
                        <span className="cy-num block text-[13px] font-black">{syncReport.pushed}</span>
                      </div>
                      <div className="rounded-md bg-white/60 px-1.5 py-1 text-center">
                        <span className="block text-[9px] font-black opacity-70">إلى المحلية ↓</span>
                        <span className="cy-num block text-[13px] font-black">{syncReport.pulled}</span>
                      </div>
                    </div>
                  )}
                  {syncReport.details.length > 0 && (
                    <div className="mt-1.5 space-y-0.5 border-t border-current/15 pt-1.5">
                      {syncReport.details.map((d, i) => (
                        <p key={`${d.direction}-${d.table}-${i}`} className="flex items-center justify-between gap-2 text-[9.5px] font-semibold opacity-85">
                          <span className="flex items-center gap-1">
                            <span
                              className={`rounded px-1 text-[8px] font-black ${
                                d.direction === "push"
                                  ? "bg-cash-cyan/20 text-cyan-800"
                                  : "bg-amber-brand/25 text-ink-800"
                              }`}
                            >
                              {d.direction === "push" ? "سحابي ↑" : "محلي ↓"}
                            </span>
                            <span dir="ltr">{d.table}</span>
                            {d.skipped ? (
                              <span className="rounded bg-cash-red/20 px-1 text-[8px] font-black text-cash-red">
                {d.skipped} تعذّر
              </span>
                            ) : null}
                          </span>
                          <span className="cy-num">+{d.copied}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  {syncReport.durationMs !== undefined && (
                    <p className="mt-1 text-[9px] font-bold opacity-60 cy-num">استغرق {syncReport.durationMs} مللي ثانية</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ملاحظات */}
        <div className="rounded-xl border border-line bg-white p-3">
          <h2 className="text-[11.5px] font-black text-ink-800">قبل ما تبدأ</h2>
          <ul className="mt-1.5 space-y-1 text-[10px] font-semibold leading-4 text-slate-600">
            {desktop ? (
              <>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-cash-green" />
                  بياناتك محفوظة على جهازك — قاعدة أُنشئت تلقائياً باسمك وحدك، ولا يراها أي عميل آخر.
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-brand" />
                  رابطك السحابي اختياري: يُحفظ على جهازك أنت، ويصلح للنسخة الاحتياطية والمزامنة.
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-amber-brand" />
                  للسحابة: استخدم رابط Neon أو Supabase مع <span className="font-mono" dir="ltr">sslmode=require</span>.
                </li>
              </>
            ) : (
              <>
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
              </>
            )}
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
