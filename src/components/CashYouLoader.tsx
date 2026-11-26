"use client";

import { useCallback, useEffect, useState } from "react";
import type { Bootstrap } from "@/lib/types";
import { readOfflineBootstrap, saveOfflineBootstrap } from "@/lib/offline-cache";
import { ActivationModal } from "@/components/ActivationModal";
import { getDeviceIdentity, readActiveLicense } from "@/lib/license";
import CashYouApp from "@/components/CashYouApp";
import { IcoLogo } from "@/components/icons";

export default function CashYouLoader() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const grantAccess = useCallback(() => setAuthorized(true), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`/api/bootstrap?نسخة=${Date.now()}`, {
        cache: "no-store",
        signal: controller.signal,
        headers: { "Cache-Control": "no-cache" },
      });
      const result = (await response.json()) as Partial<Bootstrap> & { error?: string };
      if (!response.ok || result.error) {
        throw new Error(result.error ?? "تعذر الاتصال بالخادم");
      }
      if (!Array.isArray(result.categories) || !Array.isArray(result.products) || !Array.isArray(result.customers)) {
        throw new Error("استجابة قاعدة البيانات غير مكتملة");
      }
      setData(result as Bootstrap);
      void saveOfflineBootstrap(result as Bootstrap).catch(() => undefined);
      setError("");
    } catch (reason) {
      const cached = await readOfflineBootstrap().catch(() => null);
      if (cached) {
        setData(cached);
        setError("");
      } else {
        setData(null);
      }
      setError(
        reason instanceof Error && reason.name === "AbortError"
          ? "استغرق الاتصال بقاعدة البيانات وقتاً أطول من المعتاد. تحقق من الاتصال ثم أعد المحاولة."
          : reason instanceof Error
            ? reason.message
            : "تعذر تشغيل كاش يو. أعد المحاولة بعد لحظات.",
      );
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/cash-you-sw.js").catch(() => undefined);
    }
    if (!authorized) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, attempt, authorized]);

  useEffect(() => {
    if (!authorized) return;
    let alive = true;
    const check = async () => {
      const device = await getDeviceIdentity().catch(() => null);
      const license = device ? await readActiveLicense(device.code) : null;
      if (alive && !license) setAuthorized(false);
    };
    const timer = window.setInterval(() => void check(), 60_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [authorized]);

  if (!authorized) {
    return (
      <main className="relative min-h-[100dvh] w-full overflow-hidden cy-mesh cy-grain" dir="rtl">
        <ActivationModal required onClose={() => undefined} onActivated={grantAccess} />
      </main>
    );
  }
  if (data) return <CashYouApp initial={data} />;

  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden cy-mesh cy-grain grid place-items-center p-5" dir="rtl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 cy-aurora" />
      <section className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.07] p-7 sm:p-9 text-center shadow-[0_35px_100px_-35px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -top-24 -left-16 h-56 w-56 rounded-full bg-cash-cyan/10 blur-3xl" />
        <div className="relative">
          <IcoLogo className="mx-auto h-[76px] w-[76px] drop-shadow-[0_12px_24px_rgba(245,158,11,.28)]" />
          <p className="mt-4 text-[11px] font-black tracking-[0.28em] text-cash-cyan">نظام المبيعات ونقاط البيع</p>
          <h1 className="mt-1 text-[30px] font-black tracking-[0.16em] text-white sm:text-[36px]" dir="ltr">
            CASH<span className="text-amber-brand"> YOU</span>
          </h1>
          <p className="mt-1 text-[15px] font-bold text-slate-300">كاش يو — إدارة البيع والمخزون والحسابات</p>

          <div className="mt-7 rounded-2xl border border-white/10 bg-ink-950/45 px-4 py-4">
            {loading ? (
              <>
                <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-[3px] border-white/15 border-t-amber-brand" />
                <p className="mt-3 text-[13px] font-black text-white">جارٍ تشغيل كاش يو</p>
                <p className="mt-1 text-[11.5px] font-semibold text-slate-400">الاتصال بقاعدة البيانات وتحميل بيانات الأصناف والعملاء</p>
              </>
            ) : (
              <>
                <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-cash-red/15 text-cash-red text-lg font-black">!</span>
                <p className="mt-3 text-[13px] font-black text-white">تعذر فتح واجهة النظام</p>
                <p className="mt-1 text-[11.5px] font-semibold leading-relaxed text-slate-300">{error}</p>
                <button
                  onClick={() => setAttempt((n) => n + 1)}
                  className="mt-4 h-10 rounded-xl bg-amber-brand px-6 text-[12.5px] font-black text-ink-900 shadow-lg transition hover:brightness-110 active:translate-y-0.5"
                >
                  إعادة المحاولة
                </button>
              </>
            )}
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-[10.5px] font-bold text-slate-500">
            <span className={`h-2 w-2 rounded-full ${loading ? "animate-pulse bg-amber-brand" : error ? "bg-cash-red" : "bg-cash-green"}`} />
            <span>{loading ? "تهيئة قاعدة البيانات" : error ? "الخادم لم يرسل البيانات" : "النظام جاهز"}</span>
            <span>·</span>
            <span>الدعم الفني: م / وائل الجمال</span>
          </div>
        </div>
      </section>
      <div className="absolute bottom-5 text-[10px] font-semibold text-slate-600" dir="ltr">CASH YOU · POS 1.0</div>
    </main>
  );
}
