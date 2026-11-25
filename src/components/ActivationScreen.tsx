"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionUser, TrialStatus } from "@/lib/types";
import { readDeviceCode } from "@/lib/device";
import { IcoCheck, IcoCopy, IcoWarn } from "@/components/icons";
import { btnCls, Field, inputCls, ModuleShell, ModuleTitle, Panel } from "@/components/ModuleUI";

type Plan = 30 | 90 | 180 | 365;

const PLANS: { days: Plan; label: string }[] = [
  { days: 30, label: "شهر" },
  { days: 90, label: "3 شهور" },
  { days: 180, label: "6 شهور" },
  { days: 365, label: "سنة" },
];

/**
 * صفحة التفعيل الداخلية:
 * تعرض كود الجهاز وحالة التجربة/الترخيص، وتقبل كود HMAC-SHA256 لتفعيل النسخة.
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
  const [plan, setPlan] = useState<Plan>(365);
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

  const copyDevice = async () => {
    if (!device) return;
    try {
      await navigator.clipboard.writeText(device.code);
      notify("ok", "تم نسخ كود الجهاز");
    } catch {
      notify("err", "تعذر النسخ — انسخ الكود يدوياً");
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
        body: JSON.stringify({ code, deviceCode: device.code, days: plan }),
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
  }, [busy, code, device, notify, onUpdated, plan]);

  const licensed = Boolean(trial?.licensed);
  const licenseEnd = trial?.license?.validUntil ? new Date(trial.license.validUntil) : null;
  const trialEnd = trial?.startedAt ? new Date(new Date(trial.startedAt).getTime() + 15 * 86400000) : null;

  const statusTone = licensed
    ? "border-cash-green/50 bg-cash-green/10 text-cash-green-deep"
    : trial?.expired
      ? "border-cash-red/50 bg-cash-red/10 text-cash-red"
      : "border-amber-brand/50 bg-amber-soft text-amber-800";

  return (
    <ModuleShell>
      <ModuleTitle
        title="تفعيل النسخة"
        subtitle="أدخل كود التفعيل الخاص بجهازك (HMAC-SHA256) لإلغاء حدود الفترة التجريبية"
        badge={licensed ? "مفعّلة" : trial?.expired ? "منتهية" : "تجريبية"}
      />

      <div className="mt-2 grid grid-cols-1 items-start gap-2 xl:grid-cols-[380px_1fr]">
        <Panel title="كود التفعيل" hint={`متاح للمالك فقط`}>
          <div className="space-y-3 p-3">
            <Field label="كود الجهاز">
              <div className="flex items-center gap-2">
                <input value={device?.code ?? "جارٍ القراءة..."} readOnly dir="ltr" className={`${inputCls} flex-1 font-mono text-center`} />
                <button
                  type="button"
                  onClick={() => void copyDevice()}
                  disabled={!device}
                  className={`${btnCls} h-10 w-10 shrink-0 bg-ink-700 p-0 text-white`}
                  aria-label="نسخ كود الجهاز"
                  title="نسخ كود الجهاز"
                >
                  <IcoCopy className="mx-auto h-4 w-4" />
                </button>
              </div>
            </Field>
            <p className="text-[10.5px] font-semibold leading-5 text-slate-500">
              {device?.desktop
                ? "هذا كود نسخة الويندوز (بصمة الجهاز) — أرسله للدعم الفني لاستلام كود التفعيل."
                : "أنت تعمل من المتصفح؛ الكود أعلاه بصمة محلية لهذا المتصفح — أرسلها للدعم الفني لاستلام كود التفعيل."}
            </p>

            <Field label="المدة المطلوبة">
              <div className="grid grid-cols-4 gap-1.5">
                {PLANS.map((item) => (
                  <button
                    key={item.days}
                    type="button"
                    onClick={() => setPlan(item.days)}
                    className={`h-9 rounded-lg border text-[11.5px] font-black transition ${
                      plan === item.days ? "border-amber-brand bg-amber-soft text-amber-800" : "border-line bg-paper-2 text-slate-500"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="كود التفعيل (12 حرفاً)">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                dir="ltr"
                placeholder="XXXX-XXXX-XXXX"
                className={`${inputCls} text-center font-mono text-[14px] tracking-[0.12em]`}
                maxLength={14}
              />
            </Field>

            {error && (
              <p className="flex items-start gap-1.5 rounded-lg border border-cash-red/40 bg-cash-red/10 px-2.5 py-2 text-[11px] font-bold leading-5 text-cash-red">
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
              <p className="text-center text-[11px] font-bold text-slate-500">التفعيل متاح لحساب المالك فقط.</p>
            )}
          </div>
        </Panel>

        <div className="space-y-2">
          <Panel title="حالة النسخة">
            <div className="space-y-3 p-3">
              <div className={`rounded-xl border-2 px-3 py-3 ${statusTone}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-black">
                    {licensed ? "نسخة مفعّلة — بلا حدود" : trial?.expired ? "انتهت الفترة التجريبية" : "نسخة تجريبية"}
                  </span>
                  <span className="text-[12px] font-black cy-num">
                    {licensed
                      ? `متبقٍ ${trial?.license?.daysLeft ?? 0} يوم`
                      : trial?.expired
                        ? "0 يوم"
                        : `متبقٍ ${trial?.daysLeft ?? 0} يوم`}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-bold opacity-80">
                  {licensed
                    ? `الترخيص ساري حتى ${licenseEnd ? licenseEnd.toLocaleDateString("ar-EG") : "—"}`
                    : `الفترة التجريبية تنتهي في ${trialEnd ? trialEnd.toLocaleDateString("ar-EG") : "—"}`}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "الأصناف", value: trial?.usage.products ?? 0, limit: trial?.limits.products ?? 20 },
                  { label: "الفواتير", value: trial?.usage.invoices ?? 0, limit: trial?.limits.invoices ?? 20 },
                  { label: "العملاء", value: trial?.usage.customers ?? 0, limit: trial?.limits.customers ?? 20 },
                  { label: "الموردون", value: trial?.usage.suppliers ?? 0, limit: trial?.limits.suppliers ?? 20 },
                ].map((row) => (
                  <div key={row.label} className="rounded-lg border border-line bg-paper-2 px-2.5 py-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span>{row.label}</span>
                      <span className="font-black text-ink-800 cy-num" dir="ltr">
                        {licensed ? `${row.value} / ∞` : `${row.value} / ${row.limit}`}
                      </span>
                    </div>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <span
                        className={`block h-full rounded-full ${licensed ? "bg-cash-green" : row.value >= row.limit ? "bg-cash-red" : "bg-amber-brand"}`}
                        style={{ width: licensed ? "100%" : `${Math.min(100, Math.round((row.value / Math.max(1, row.limit)) * 100))}%` }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="إزاي تحصل على الكود؟">
            <ol className="list-inside list-decimal space-y-1.5 p-3 text-[11.5px] font-semibold leading-6 text-slate-600">
              <li>انسخ «كود الجهاز» من الخانة اليسرى وأرسله للدعم الفني مع المدة المطلوبة.</li>
              <li>
                الدعم يولّد الكود من أداة التوليد الرسمية
                <span className="mx-1 rounded bg-paper-2 px-1.5 py-0.5 font-mono text-[10.5px] text-amber-800">tools/activation-generator.html</span>
                بخوارزمية HMAC-SHA256.
              </li>
              <li>اكتب الكود هنا واختر نفس المدة، ثم اضغط «تفعيل النسخة».</li>
              <li>كل كود يُستخدم مرة واحدة فقط على نفس الجهاز.</li>
            </ol>
          </Panel>
        </div>
      </div>
    </ModuleShell>
  );
}
