"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionUser, TrialStatus } from "@/lib/types";
import { readDeviceCode } from "@/lib/device";
import { IcoCheck, IcoCopy, IcoLogo, IcoWarn } from "@/components/icons";
import { SALE_PLANS, SALES_CONTACT, SYSTEM_NAME, SYSTEM_VERSION } from "@/lib/plans";
import { money } from "@/lib/format";

/**
 * صفحة التفعيل: حالة النسخة، خطط البيع بالأسعار، كود الجهاز، وإدخال كود التفعيل.
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
  const [planDays, setPlanDays] = useState<number>(365);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isOwner = user.role === "owner";

  useEffect(() => {
    let alive = true;
    void readDeviceCode().then((info) => {
      if (alive) setDevice(info);
    });
    return () => {
      alive = false;
    };
  }, []);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify("ok", `تم نسخ ${label}`);
    } catch {
      notify("err", "تعذر النسخ — انسخ يدوياً");
    }
  };

  const submit = useCallback(async () => {
    if (busy || !device) return;
    setError("");
    if (code.replace(/[^0-9a-z]/gi, "").length !== 12) {
      setError("كود التفعيل يتكون من 12 حرفاً بصيغة XXXX-XXXX-XXXX");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, deviceCode: device.code, days: planDays }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; message?: string; trial?: TrialStatus };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "تعذر تنفيذ التفعيل");
      setCode("");
      if (json.trial) onUpdated(json.trial);
      notify("ok", json.message ?? "تم تفعيل النسخة بنجاح");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "تعذر تنفيذ التفعيل";
      setError(message);
      notify("err", message);
    } finally {
      setBusy(false);
    }
  }, [busy, code, device, notify, onUpdated, planDays]);

  const licensed = Boolean(trial?.licensed);
  const licenseEnd = trial?.license?.validUntil ? new Date(trial.license.validUntil) : null;
  const lifetime = licensed && licenseEnd !== null && licenseEnd.getFullYear() > 2090;
  const daysLeft = licensed ? (trial?.license?.daysLeft ?? 0) : (trial?.daysLeft ?? 0);

  const status = licensed
    ? { tone: "bg-cash-green", text: lifetime ? "مفعّلة مدى الحياة" : `مفعّلة — متبقٍ ${daysLeft} يوم`, sub: licenseEnd ? `تنتهي في ${licenseEnd.toLocaleDateString("ar-EG")}` : "" }
    : trial?.expired
      ? { tone: "bg-cash-red", text: "انتهت الفترة التجريبية", sub: "فعّل النسخة لمتابعة إضافة الأصناف والفواتير" }
      : { tone: "bg-amber-brand", text: `نسخة تجريبية — متبقٍ ${daysLeft} يوم`, sub: "يمكنك التفعيل في أي وقت دون فقد البيانات" };

  return (
    <div className="h-full overflow-y-auto cy-scroll bg-paper cy-page-in" dir="rtl">
      <div className="mx-auto max-w-5xl p-5 space-y-5">
        {/* ============ الرأس ============ */}
        <div className="relative overflow-hidden rounded-2xl bg-ink-800 text-white p-5 cy-fluent-panel">
          <div className="pointer-events-none absolute inset-0 cy-aurora opacity-70" />
          <div className="relative flex flex-wrap items-center gap-4">
            <IcoLogo className="h-14 w-14 rounded-2xl" />
            <div className="flex-1 min-w-[200px]">
              <p className="text-[10.5px] font-black tracking-[0.25em] text-cash-cyan">{SYSTEM_NAME} · الإصدار {SYSTEM_VERSION}</p>
              <h1 className="text-[22px] font-black mt-1">تفعيل النسخة</h1>
              <p className="text-[12.5px] text-slate-300 mt-1">اختر الخطة المناسبة وأدخل كود التفعيل الذي يصلك من الدعم الفني.</p>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 px-4 py-3 min-w-[220px]">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${status.tone}`} />
                <span className="text-[13px] font-black">{status.text}</span>
              </div>
              {status.sub && <p className="text-[11px] text-slate-300 mt-1">{status.sub}</p>}
            </div>
          </div>
        </div>

        {/* ============ الخطط ============ */}
        <div className="grid gap-3 md:grid-cols-3">
          {SALE_PLANS.map((plan) => {
            const active = planDays === plan.days;
            return (
              <button
                key={plan.days}
                type="button"
                onClick={() => setPlanDays(plan.days)}
                className={`relative text-right rounded-2xl border bg-white p-4 transition cy-press cy-focus cy-fluent-panel ${
                  active ? "border-amber-brand ring-2 ring-amber-brand/60" : "border-line hover:border-slate-400"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-cash-cyan px-2.5 py-0.5 text-[10.5px] font-black text-ink-900">الأكثر طلباً</span>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-black text-ink-900">{plan.title}</span>
                  {active && <IcoCheck className="w-5 h-5 text-cash-green" />}
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="cy-num text-[30px] font-black text-ink-900">{money(plan.price)}</span>
                  <span className="text-[12px] font-bold text-slate-500">جنيه</span>
                </div>
                <p className="text-[11.5px] font-bold text-slate-500 mt-0.5">{plan.duration}</p>
                <ul className="mt-3 space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12px] text-ink-700">
                      <IcoCheck className="w-3.5 h-3.5 mt-0.5 text-cash-green shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* ============ كود التفعيل ============ */}
        <div className="grid gap-3 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl bg-white border border-line p-4 cy-fluent-panel">
            <h2 className="text-[14px] font-black text-ink-900">تفعيل الخطة المختارة</h2>
            <p className="text-[11.5px] text-slate-500 mt-0.5">
              الخطة: <span className="font-black text-ink-800">{SALE_PLANS.find((p) => p.days === planDays)?.title}</span>
            </p>
            {isOwner ? (
              <div className="mt-3 space-y-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX"
                  dir="ltr"
                  className="w-full h-11 rounded-xl border border-line bg-paper-2 px-3 text-center font-mono text-[15px] font-bold tracking-[0.2em] text-ink-900 outline-none focus:border-amber-brand"
                />
                {error && (
                  <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-cash-red">
                    <IcoWarn className="w-3.5 h-3.5" />
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy || !device}
                  className="cy-btn w-full h-11 rounded-xl bg-ink-800 text-white font-black cy-press hover:bg-ink-900 disabled:opacity-50"
                >
                  {busy ? "جاري التفعيل..." : "تفعيل النسخة"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-[12px] font-bold text-amber-800 bg-amber-50 rounded-lg px-3 py-2">التفعيل من حساب المالك فقط.</p>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-line p-4 cy-fluent-panel space-y-3">
            <div>
              <p className="text-[11px] font-black text-slate-500">كود الجهاز</p>
              <div className="mt-1 flex items-center gap-2">
                <code dir="ltr" className="flex-1 rounded-lg bg-paper-2 border border-line px-3 py-2 font-mono text-[13px] font-bold text-ink-900 break-all">
                  {device?.code ?? "..."}
                </code>
                <button
                  type="button"
                  onClick={() => device && void copyText(device.code, "كود الجهاز")}
                  disabled={!device}
                  className="h-9 px-3 rounded-lg bg-slate-200 text-ink-800 text-[12px] font-black cy-press hover:bg-slate-300 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <IcoCopy className="w-3.5 h-3.5" />
                  نسخ
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-ink-800 text-white p-3">
              <p className="text-[11px] font-black text-cash-cyan">للشراء والتفعيل</p>
              <p dir="ltr" className="cy-num text-[18px] font-black mt-0.5 text-right">{SALES_CONTACT}</p>
              <p className="text-[11px] text-slate-300 mt-1">ابعت كود الجهاز للدعم الفني واستلم كود التفعيل.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
