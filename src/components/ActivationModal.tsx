"use client";

import { useEffect, useState } from "react";
import { activate, getDeviceIdentity, readActiveLicense, type DeviceIdentity, type LicensePayload } from "@/lib/license";

const planTitle = (plan: LicensePayload["plan"]) => ({ "1y": "سنة واحدة من أول تفعيل", "2y": "سنتان من أول تفعيل", life: "مدى الحياة" })[plan];

export function ActivationModal({ required, onClose, onActivated }: { required: boolean; onClose: () => void; onActivated: () => void }) {
  const [device, setDevice] = useState<DeviceIdentity | null>(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<{ payload: LicensePayload; expiresAt: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    void getDeviceIdentity().then(async (identity) => {
      if (!alive) return;
      setDevice(identity);
      const license = await readActiveLicense(identity.code);
      if (alive && license) {
        setActive({ payload: license.payload, expiresAt: license.expiresAt });
        onActivated();
      }
    }).catch(() => alive && setError("تعذر قراءة معرّف الجهاز"));
    return () => { alive = false; };
  }, [onActivated]);

  const copyDeviceCode = async () => {
    if (!device) return;
    try {
      await navigator.clipboard.writeText(device.code);
      setError("تم نسخ كود الجهاز؛ أرسله إلى الدعم لإصدار التفعيل.");
    } catch {
      setError("تعذر النسخ تلقائيًا؛ حدّد كود الجهاز وانسخه يدويًا.");
    }
  };

  const submit = async () => {
    if (!device) return;
    if (!device.isWindowsDesktop) {
      setError("التفعيل المرتبط بجهازك متاح من تطبيق Windows فقط.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = await activate(key, device.code);
      const license = await readActiveLicense(device.code);
      setActive({ payload, expiresAt: license?.expiresAt ?? null });
      setKey("");
      onActivated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر تفعيل النسخة");
    } finally {
      setBusy(false);
    }
  };

  if (!required && !active) return null;
  const isBlocking = required && !active;
  const copied = error.startsWith("تم نسخ");

  return (
    <div className={`fixed inset-0 ${isBlocking ? "z-[200]" : "z-[100]"} grid place-items-center bg-[#10265b]/90 p-4 backdrop-blur-sm`} dir="rtl">
      <section className="w-full max-w-[430px] overflow-hidden rounded-[22px] bg-white text-[#182b5c] shadow-[0_30px_90px_rgba(0,0,0,.38)]">
        <header className="px-7 pb-1 pt-7 text-center">
          <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-[#214fe0] text-sm font-black text-white">CY</div>
          <p className="text-[21px] font-black leading-tight text-[#173c9c]">CASH YOU - تفعيل البرنامج</p>
          <p className="mt-2 text-[12px] text-slate-500">أداة خاصة بالدعم الفني لتفعيل نسخ العملاء</p>
          <p className="mt-5 text-right text-[13px] font-bold leading-6 text-[#273b68]">
            {active ? `النسخة مفعّلة · ${planTitle(active.payload.plan)}${active.expiresAt ? ` · تنتهي ${new Date(active.expiresAt).toLocaleDateString("ar-EG")}` : ""}` : "لإصدار كود التفعيل، أرسل كود جهازك إلى الدعم الفني."}
          </p>
        </header>

        <div className="space-y-4 px-7 pb-7 pt-2">
          <div>
            <label className="mb-1.5 block text-[13px] font-bold text-[#26395f]">كود جهاز العميل (Machine ID):</label>
            <div className="flex h-[52px] items-center gap-2 rounded-xl border-2 border-slate-300 px-3 focus-within:border-[#214fe0]">
              <code dir="ltr" className="min-w-0 flex-1 select-all break-all text-center font-mono text-[16px] font-black tracking-[.08em] text-slate-600">
                {device?.code ?? "جارٍ إنشاء كود الجهاز..."}
              </code>
              <button type="button" onClick={() => void copyDeviceCode()} disabled={!device} aria-label="نسخ كود الجهاز" className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50">نسخ</button>
            </div>
            {device && !device.isWindowsDesktop && <p className="mt-2 text-[11px] leading-5 text-amber-700">هذه نسخة متصفح؛ استخدم تطبيق Windows للحصول على كود ثابت مرتبط بالجهاز.</p>}
          </div>

          {!active && <div>
            <label className="mb-1.5 block text-[13px] font-bold text-[#26395f]" htmlFor="cy-license-input">كود التفعيل:</label>
            <textarea id="cy-license-input" value={key} onChange={(event) => setKey(event.target.value)} dir="ltr" rows={3} spellCheck={false} className="w-full resize-y rounded-xl border-2 border-slate-300 px-3 py-3 font-mono text-[12px] text-slate-800 outline-none focus:border-[#214fe0]" placeholder="الصق كود التفعيل الذي أرسله لك الدعم" />
            <button onClick={() => void submit()} disabled={busy || !device?.isWindowsDesktop || !key.trim()} className="mt-3 h-[48px] w-full rounded-xl bg-[#214fe0] text-[15px] font-black text-white transition hover:bg-[#193fbd] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "جارٍ التحقق..." : "تفعيل البرنامج"}</button>
          </div>}
          {error && <p role="status" className={`rounded-lg px-3 py-2 text-[11px] leading-5 ${copied ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{error}</p>}
          {active && <button onClick={onClose} className="h-11 w-full rounded-xl bg-emerald-600 font-black text-white">متابعة إلى البرنامج</button>}
          {isBlocking && <p className="text-center text-[10px] leading-5 text-slate-500">كود الجهاز خاص بهذا الجهاز. أرسله للدعم فقط؛ لا تشارك بيانات حساسة أخرى. التحقق والتفعيل يعملان دون إنترنت.</p>}
        </div>
      </section>
    </div>
  );
}
