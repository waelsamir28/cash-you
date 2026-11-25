"use client";

import { useCallback, useEffect, useState } from "react";
import type { Bootstrap, SessionUser, TrialStatus } from "@/lib/types";
import { readOfflineBootstrap, saveOfflineBootstrap } from "@/lib/offline-cache";
import CashYouApp from "@/components/CashYouApp";
import { AuthScreen } from "@/components/AuthScreen";
import { IcoLogo } from "@/components/icons";

type AuthState = {
  loading: boolean;
  user: SessionUser | null;
  /** true عندما لا يوجد أي مستخدم في قاعدة البيانات بعد */
  needSetup: boolean;
  trial: TrialStatus | null;
};

const SESSION_CACHE = "cash-you.session.v1";

export default function CashYouLoader() {
  const [auth, setAuth] = useState<AuthState>({ loading: true, user: null, needSetup: false, trial: null });
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);

  /* ---------------- قراءة الجلسة الحالية ---------------- */
  const readSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/auth/me?t=${Date.now()}`, { cache: "no-store" });
      const result = (await response.json()) as {
        user: SessionUser | null;
        trial: TrialStatus | null;
        users?: SessionUser[];
      };
      const needSetup = !result.user && (result.users?.length ?? 0) === 0;
      setAuth({ loading: false, user: result.user, needSetup, trial: result.trial });
      return result.user;
    } catch {
      /* وضع عدم الاتصال: نستخدم آخر مستخدم مسجل دخوله محلياً */
      const cached = readCachedUser();
      setAuth({ loading: false, user: cached, needSetup: false, trial: null });
      return cached;
    }
  }, []);

  /* ---------------- تحميل بيانات النظام ---------------- */
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
      const bootstrap = result as Bootstrap;
      setData(bootstrap);
      void saveOfflineBootstrap(bootstrap).catch(() => undefined);
      if (bootstrap.trial) setAuth((prev) => ({ ...prev, trial: bootstrap.trial ?? prev.trial }));
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
    const timer = window.setTimeout(() => void readSession(), 0);
    return () => window.clearTimeout(timer);
  }, [readSession]);

  useEffect(() => {
    if (!auth.user) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [auth.user, load, attempt]);

  /* فحص دوري: الجلسة قد تنتهي، والفترة التجريبية تتغير يوماً بيوم */
  useEffect(() => {
    if (!auth.user) return;
    let alive = true;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/auth/me?t=${Date.now()}`, { cache: "no-store" });
        const result = (await response.json()) as { user: SessionUser | null; trial: TrialStatus | null };
        if (!alive) return;
        if (!result.user) {
          clearCachedUser();
          setAuth({ loading: false, user: null, needSetup: false, trial: null });
          setData(null);
          return;
        }
        setAuth((prev) => ({ ...prev, trial: result.trial }));
      } catch {
        /* نتجاهل انقطاع الشبكة المؤقت */
      }
    }, 60_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [auth.user]);

  const handleAuthenticated = (user: SessionUser) => {
    cacheUser(user);
    setAuth((prev) => ({ ...prev, user, needSetup: false }));
    setAttempt((n) => n + 1);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* الخروج محلياً حتى لو تعذر الوصول للخادم */
    }
    clearCachedUser();
    setAuth({ loading: false, user: null, needSetup: false, trial: null });
    setData(null);
  };

  if (auth.loading) return <Splash text="جارٍ التحقق من الجلسة" />;
  if (!auth.user) return <AuthScreen needSetup={auth.needSetup} onAuthenticated={handleAuthenticated} />;
  if (data) {
    return (
      <CashYouApp
        key={auth.user.id}
        initial={data}
        user={auth.user}
        onLogout={handleLogout}
      />
    );
  }

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
          <p className="mt-1 text-[15px] font-bold text-slate-300">مرحباً {auth.user.fullName}</p>

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

/* ============================ أدوات مساعدة ============================ */

function Splash({ text }: { text: string }) {
  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden cy-mesh cy-grain grid place-items-center p-5" dir="rtl">
      <div className="text-center">
        <IcoLogo className="mx-auto h-20 w-20 rounded-2xl" />
        <p className="mt-4 text-[12px] font-black tracking-[0.28em] text-cash-cyan">CASH YOU</p>
        <span className="mx-auto mt-5 block h-8 w-8 animate-spin rounded-full border-[3px] border-white/15 border-t-amber-brand" />
        <p className="mt-3 text-[12.5px] font-bold text-slate-400">{text}</p>
      </div>
    </main>
  );
}

function cacheUser(user: SessionUser) {
  try {
    window.localStorage.setItem(SESSION_CACHE, JSON.stringify(user));
  } catch {
    /* التخزين غير متاح */
  }
}

function readCachedUser(): SessionUser | null {
  try {
    const raw = window.localStorage.getItem(SESSION_CACHE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionUser;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

function clearCachedUser() {
  try {
    window.localStorage.removeItem(SESSION_CACHE);
  } catch {
    /* ignore */
  }
}
