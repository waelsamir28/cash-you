"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionUser, TrialStatus } from "@/lib/types";
import { readDeviceCode } from "@/lib/device";
import { PLAN_CATALOG, type ActivationPlan } from "@/lib/activation-plans";
import { money } from "@/lib/format";
import { IcoCheck, IcoCopy, IcoWarn } from "@/components/icons";
import { btnCls, Field, inputCls, ModuleShell } from "@/components/ModuleUI";

/**
 * صفحة التفعيل الداخلية — تصميم فخم بثلاث باقات.
 *
 * تعرض كود الجهاز وحالة الترخيص، وبطاقات الأسعار (سنة / سنتان / مدى الحياة)،
 * ثم خانة كود HMAC-SHA256 الذي يُصدره الدعم الفني.
 */
export function ActivationScreen({
  user,
  trial,
  onUpdated,
  notify,
}: {
  user: SessionUser;
  trial: TrialStatus | null;
  onUpdated: (trial: TrialStatus) => void;
  notify: (kind: "ok" | "err", message: string) => void;
}) {
  const [device, setDevice] = useState<{ code: string; desktop: boolean } | null>(null);
  const [code, setCode] = useState("");
  const [plan, setPlan] = useState<ActivationPlan>(730);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const isOwner = user.role === "owner";
  const licensed = Boolean(trial?.licensed);

  useEffect(() => {
    let alive = true;
    void readDeviceCode().then((info) => {
      if (alive) setDevice(info);
    });
    return () => {
      alive = false;
    };
  }, []);

  const copyDevice = async () => {
    if (!device) return;
    try {
      await navigator.clipboard.writeText(device.code);
      setCopied(true);
      notify("ok", "تم نسخ كود الجهاز");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      notify("err", "تعذر النسخ — انسخ الكود يدوياً");
    }
  };

  const submit = useCallback(async () => {
    if (busy || !device) return;
    if (!code.trim()) {
      setError("أدخل كود التفعيل أولاً");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, deviceCode: device.code, days: plan }),
      });
      const json = (await res.json()) as { trial?: TrialStatus; message?: string; error?: string };
      if (!res.ok || !json.trial) throw new Error(json.error ?? "تعذر التفعيل");
      onUpdated(json.trial);
      notify("ok", "تم تفعيل النسخة بنجاح");
      setCode("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر التفعيل");
    } finally {
      setBusy(false);
    }
  }, [busy, code, device, notify, onUpdated, plan]);

  const licenseEnd = trial?.license?.validUntil ? new Date(trial.license.validUntil) : null;
  const trialEnd = trial?.startedAt ? new Date(new Date(trial.startedAt).getTime() + 15 * 86400000) : null;

  return (
    <ModuleShell>
      {/* ============ رأس فخم ============ */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-bl from-ink-900 via-ink-800 to-ink-950 px-4 py-5 shadow-lg">
        <div className="pointer-events-none absolute -left-10 -top-10 h-36 w-36 rounded-full bg-amber-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -right-6 h-36 w-36 rounded-full bg-cash-cyan/15 blur-3xl" />
        <div className="relative text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-brand/40 bg-amber-brand/10 px-2.5 py-0.5 text-[10px] font-black text-amber-brand">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-brand" />
            ترخيص CASH YOU
          </span>
          <h1 className="mt-2 text-[21px] font-black leading-tight text-white">اختر الباقة المناسبة لمحلك</h1>
          <p className="mx-auto mt-1 max-w-md text-[11.5px] font-semibold leading-5 text-slate-300">
            دفعة واحدة — بلا اشتراكات شهرية. كل الباقات تفتح كل وحدات البرنامج بدون حدود.
          </p>
          {/* شارة الحالة */}
          <div
            className={`mx-auto mt-3 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border px-3 py-1.5 text-[11px] font-black ${
              licensed
                ? "border-cash-green/50 bg-cash-green/15 text-cash-green"
                : trial?.expired
                  ? "border-cash-red/50 bg-cash-red/15 text-cash-red"
                  : "border-amber-brand/50 bg-amber-brand/15 text-amber-brand"
            }`}
          >
            <span>{licensed ? "نسخة مفعّلة" : trial?.expired ? "انتهت الفترة التجريبية" : "نسخة تجريبية"}</span>
            <span className="h-3 w-px bg-current opacity-30" />
            <span className="cy-num">
              {licensed
                ? `متبقٍ ${trial?.license?.daysLeft ?? 0} يوم${licenseEnd ? ` · حتى ${licenseEnd.toLocaleDateString("ar-EG")}` : ""}`
                : `متبقٍ ${trial?.daysLeft ?? 0} يوم${trialEnd ? ` · حتى ${trialEnd.toLocaleDateString("ar-EG")}` : ""}`}
            </span>
          </div>
        </div>
      </div>

      {/* ============ بطاقات الباقات ============ */}
      <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
        {PLAN_CATALOG.map((p) => {
          const active = plan === p.days;
          const highlight = Boolean(p.badge);
          return (
            <button
              key={p.days}
              type="button"
              onClick={() => setPlan(p.days as ActivationPlan)}
              className={`group relative overflow-hidden rounded-2xl border-2 p-3 text-center transition-all cy-press ${
                active
                  ? "border-cash-green bg-white shadow-[0_0_0_4px_rgba(16,185,129,0.14)]"
                  : highlight
                    ? "border-amber-brand/60 bg-white hover:border-amber-brand"
                    : "border-line bg-white hover:border-ink-500"
              }`}
            >
              {p.badge && (
                <span
                  className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[9px] font-black text-white ${
                    p.days === 36500 ? "bg-gradient-to-l from-cash-violet to-fuchsia-500" : "bg-gradient-to-l from-amber-brand to-cash-orange"
                  }`}
                >
                  {p.badge}
                </span>
              )}
              {active && (
                <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-cash-green text-white">
                  <IcoCheck className="h-3 w-3" />
                </span>
              )}

              <div className="mt-3 text-[12.5px] font-black text-ink-800">{p.label}</div>
              <div className="mt-0.5 text-[10px] font-semibold text-slate-500">{p.period}</div>

              <div className="mt-2 flex items-baseline justify-center gap-0.5">
                <span className="cy-num text-[27px] font-black leading-none text-ink-900">{p.price}</span>
                <span className="text-[11px] font-black text-slate-500">ج</span>
              </div>
              <div className="mt-0.5 text-[9.5px] font-bold text-slate-400">دفعة واحدة</div>

              <ul className="mt-2.5 space-y-1 border-t border-line pt-2 text-right">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1 text-[10px] font-semibold leading-4 text-slate-600">
                    <IcoCheck className="mt-0.5 h-2.5 w-2.5 shrink-0 text-cash-green" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* ============ كود الجهاز + كود التفعيل ============ */}
      <div className="mt-3 grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
        {/* كود الجهاز */}
        <div className="rounded-xl border border-line bg-white">
          <div className="border-b border-line px-3 py-2">
            <h2 className="text-[12.5px] font-black text-ink-800">١ · كود جهازك</h2>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-500">أرسله للدعم الفني لاستلام كود التفعيل</p>
          </div>
          <div className="space-y-2 p-3">
            <div className="flex items-center gap-2">
              <input
                value={device?.code ?? "جارٍ القراءة..."}
                readOnly
                dir="ltr"
                className={`${inputCls} flex-1 text-center font-mono text-[13px] tracking-wider`}
              />
              <button
                type="button"
                onClick={() => void copyDevice()}
                disabled={!device}
                className={`${btnCls} h-10 w-10 shrink-0 bg-ink-800 p-0 text-white`}
                aria-label="نسخ كود الجهاز"
                title="نسخ كود الجهاز"
              >
                {copied ? <IcoCheck className="mx-auto h-4 w-4" /> : <IcoCopy className="mx-auto h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] font-semibold leading-4 text-slate-500">
              {device?.desktop
                ? "بصمة جهاز نسخة الويندوز — ثابتة لا تتغيّر."
                : "بصمة المتصفح المحلي — أرسلها كاملة بدون تعديل."}
            </p>
            <div className="rounded-lg bg-paper-2 px-2.5 py-2 text-[10px] font-bold leading-4 text-slate-600">
              الدعم الفني: <span className="cy-num text-ink-800">01222355769</span> — م / وائل الجمال
            </div>
          </div>
        </div>

        {/* كود التفعيل */}
        <div className="rounded-xl border border-amber-brand/40 bg-white">
          <div className="border-b border-amber-brand/30 bg-amber-soft/40 px-3 py-2">
            <h2 className="text-[12.5px] font-black text-ink-800">٢ · كود التفعيل</h2>
            <p className="mt-0.5 text-[10px] font-semibold text-slate-600">
              الباقة المختارة: <span className="font-black text-amber-800">{PLAN_CATALOG.find((p) => p.days === plan)?.label}</span>
            </p>
          </div>
          <div className="space-y-2 p-3">
            <Field label="كود التفعيل (12 حرفاً)">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
                }}
                dir="ltr"
                placeholder="XXXX-XXXX-XXXX"
                className={`${inputCls} text-center font-mono text-[14px] tracking-[0.18em]`}
                maxLength={14}
              />
            </Field>

            {error && (
              <p className="flex items-start gap-1.5 rounded-lg border border-cash-red/40 bg-cash-red/10 px-2.5 py-2 text-[10.5px] font-bold leading-4 text-cash-red">
                <IcoWarn className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              onClick={() => void submit()}
              disabled={busy || !isOwner || !device}
              className={`${btnCls} flex w-full items-center justify-center gap-2 bg-cash-green text-white`}
            >
              <IcoCheck />
              {busy ? "جارٍ التحقق..." : "تفعيل النسخة"}
            </button>

            {!isOwner && (
              <p className="text-center text-[10.5px] font-bold text-slate-500">التفعيل متاح لحساب المالك فقط.</p>
            )}
            <p className="text-center text-[9.5px] font-semibold leading-4 text-slate-400">
              الكود مرتبط بجهازك ومدة الباقة — ولا يعمل على جهاز آخر.
            </p>
          </div>
        </div>
      </div>

      {/* ============ خطوات التفعيل ============ */}
      <div className="mt-3 rounded-xl border border-line bg-white p-3">
        <h2 className="text-center text-[12px] font-black text-ink-800">كيف تفعّل في ٣ خطوات</h2>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { n: "١", t: "انسخ كود الجهاز", d: "من الخانة أعلاه بضغطة زر" },
            { n: "٢", t: "أرسله للدعم", d: "واتساب أو هاتف مع الباقة المطلوبة" },
            { n: "٣", t: "أدخل الكود", d: "واستخدم البرنامج كاملاً بلا حدود" },
          ].map((s) => (
            <div key={s.n} className="flex items-start gap-2 rounded-lg bg-paper-2 px-2.5 py-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-800 text-[11px] font-black text-white">
                {s.n}
              </span>
              <span className="flex-1">
                <span className="block text-[11px] font-black text-ink-800">{s.t}</span>
                <span className="block text-[9.5px] font-semibold leading-4 text-slate-500">{s.d}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* المدفوع سابقاً (إن وُجد) */}
      {licensed && (
        <p className="mt-2 text-center text-[10px] font-semibold text-slate-500 cy-num">
          الباقة الحالية سارية حتى {licenseEnd ? licenseEnd.toLocaleDateString("ar-EG") : "—"} · متبقٍ{" "}
          {trial?.license?.daysLeft ?? 0} يوم
          {trial?.license?.daysLeft && trial.license.daysLeft > 3000 ? " (مدى الحياة)" : ""}
        </p>
      )}
    </ModuleShell>
  );
}
