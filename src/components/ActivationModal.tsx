"use client";

import { useEffect, useState } from "react";
import { activate, getDeviceIdentity, readActiveLicense, type DeviceIdentity, type LicensePayload } from "@/lib/license";
import { IcoLogo } from "@/components/icons";

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
      setError("تم نسخ كود الجهاز");
    } catch {
      setError("تعذر النسخ تلقائيًا؛ حدّد كود الجهاز وانسخه يدويًا");
    }
  };

  const submit = async () => {
    if (!device) return;
    if (!device.isWindowsDesktop) {
      setError("التفعيل المرتبط بهاردوير Windows متاح من تطبيق Windows فقط");
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

  return (
    <div className={`fixed inset-0 ${isBlocking ? "z-[200]" : "z-[100]"} grid place-items-center bg-ink-950/80 backdrop-blur-sm p-3`} dir="rtl">
      <section className="w-full max-w-lg overflow-hidden rounded-[22px] border border-white/15 bg-ink-800 shadow-[0_35px_100px_-25px_rgba(0,0,0,.8)]">
        <header className="border-b border-white/10 bg-gradient-to-l from-amber-brand/15 via-cash-cyan/10 to-cash-violet/15 px-5 py-5">
          <div className="flex items-center gap-3"><IcoLogo className="h-11 w-11 rounded-2xl bg-white/95 p-0.5" /><div><p className="text-[10px] font-black tracking-[.2em] text-cash-cyan">CASH YOU · LICENSE</p><h2 className="mt-1 text-[18px] font-black text-white">{active ? "النسخة مفعّلة" : "تفعيل نسخة كاش يو"}</h2></div>
            {!isBlocking && <button onClick={onClose} className="mr-auto rounded-lg px-3 py-2 text-[12px] font-bold text-slate-300 hover:bg-white/10">إغلاق</button>}
          </div>
          <p className="mt-3 text-[12px] leading-6 text-slate-300">{active ? `نوع الترخيص: ${planTitle(active.payload.plan)}${active.expiresAt ? ` · ينتهي ${new Date(active.expiresAt).toLocaleDateString("ar-EG")}` : ""}` : "أرسل كود الجهاز إلى الدعم، ثم أدخل كود التفعيل الذي يصدره لك."}</p>
        </header>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-2 block text-[11px] font-black text-slate-300">كود الجهاز</label>
            <div className="flex gap-2"><code dir="ltr" className="min-w-0 flex-1 break-all rounded-xl border border-white/10 bg-ink-950 px-3 py-3 text-left font-mono text-[12px] text-amber-200">{device?.code ?? "جارٍ إنشاء كود الجهاز..."}</code><button onClick={() => void copyDeviceCode()} disabled={!device} className="rounded-xl bg-slate-700 px-3 text-[11px] font-black text-white disabled:opacity-50">نسخ</button></div>
            {device && !device.isWindowsDesktop && <p className="mt-2 text-[10.5px] leading-5 text-amber-200">تنبيه: هذه نسخة متصفح؛ الكود مرتبط بملف المتصفح وليس ببصمة Windows. استخدم تطبيق Windows المرفق للحصول على قفل الجهاز المطلوب.</p>}
          </div>
          {!active && <div>
            <label className="mb-2 block text-[11px] font-black text-slate-300" htmlFor="cy-license-input">كود التفعيل</label>
            <textarea id="cy-license-input" value={key} onChange={(event) => setKey(event.target.value)} dir="ltr" rows={4} spellCheck={false} className="w-full resize-y rounded-xl border border-white/10 bg-ink-950 px-3 py-3 font-mono text-[11px] text-white outline-none focus:border-amber-brand" placeholder="الصق كود التفعيل هنا" />
            <button onClick={() => void submit()} disabled={busy || !device?.isWindowsDesktop || !key.trim()} className="mt-3 h-11 w-full rounded-xl bg-gradient-to-l from-amber-brand to-orange-500 font-black text-ink-900 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "جارٍ التحقق..." : "تحقق وفعّل النسخة"}</button>
          </div>}
          {error && <p role="status" className={`rounded-lg border px-3 py-2 text-[11px] leading-5 ${error.startsWith("تم نسخ") ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-red-400/30 bg-red-400/10 text-red-200"}`}>{error}</p>}
          {active && <button onClick={onClose} className="h-11 w-full rounded-xl bg-emerald-500 font-black text-ink-950">متابعة إلى البرنامج</button>}
          {isBlocking && <p className="text-center text-[10px] leading-5 text-slate-500">التحقق يتم محليًا بالتوقيع الرقمي؛ لا يلزم اتصال بالإنترنت لإدخال الترخيص.</p>}
        </div>
      </section>
    </div>
  );
}
