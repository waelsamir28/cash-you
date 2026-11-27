"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PREFS, loadPrefs } from "@/lib/ui-prefs";
import { IcoLogo } from "@/components/icons";
import { TRIAL_DAYS, TRIAL_LIMITS } from "@/lib/trial";
import type { SessionUser } from "@/lib/types";

export type AuthUser = SessionUser;

type Props = {
  /** إن لم يوجد أي مستخدم بعد، تُفتح شاشة إنشاء حساب المالك. */
  needSetup: boolean;
  onAuthenticated: (user: AuthUser) => void;
};

type Tab = "login" | "register";

export function AuthScreen({ needSetup, onAuthenticated }: Props) {
  /* الحالة الافتراضية تُحسب مرة واحدة عند التحميل (لا حاجة لمزامنة في useEffect) */
  const [tab, setTab] = useState<Tab>(needSetup ? "register" : "login");
  /* إعدادات شاشة الدخول (من الإعدادات > شاشة الدخول) تُقرأ بعد التحميل لتفادي اختلاف الخادم والمتصفح */
  const [login, setLogin] = useState(DEFAULT_PREFS.login);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- قراءة التفضيلات من localStorage بعد التحميل فقط
    setLogin(loadPrefs().login);
  }, []);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");

    if (tab === "register") {
      if (password !== confirm) {
        setError("كلمتا المرور غير متطابقتين");
        return;
      }
      if (password.length < 6) {
        setError("كلمة المرور يجب ألا تقل عن 6 أحرف");
        return;
      }
    }

    setBusy(true);
    try {
      const response = await fetch(tab === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          tab === "login"
            ? { username, password }
            : { username, fullName, password },
        ),
      });
      const result = (await response.json()) as { user?: AuthUser; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error ?? "تعذر إتمام العملية");
      onAuthenticated(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر إتمام العملية، حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "h-11 w-full rounded-xl border border-white/10 bg-ink-950/70 px-3 text-[13px] font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-amber-brand focus:ring-2 focus:ring-amber-brand/25";

  return (
    <main className="relative min-h-[100dvh] w-full overflow-hidden cy-mesh cy-grain grid place-items-center p-4" dir="rtl" style={{ background: login.bg }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 cy-aurora" />

      <section className="relative grid w-full max-w-4xl overflow-hidden rounded-[26px] border border-white/15 bg-white/[0.06] shadow-[0_40px_120px_-40px_rgba(0,0,0,.85)] backdrop-blur-xl lg:grid-cols-[1.05fr_1fr]">
        {/* ---------- جانب الهوية ---------- */}
        <div className="relative hidden flex-col justify-between gap-8 p-8 lg:flex">
          <div className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full bg-cash-cyan/15 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 -left-16 h-56 w-56 rounded-full bg-cash-violet/15 blur-3xl" />
          <div className="relative">
            {login.showLogo && <IcoLogo className="h-16 w-16 rounded-2xl" />}
            <p className="mt-5 text-[11px] font-black tracking-[0.3em]" style={{ color: login.accent }}>CASH YOU · POS</p>
            <h1 className="mt-2 text-[28px] font-black leading-snug text-white">
              {login.title}
            </h1>
            <p className="mt-2 text-[13px] font-bold text-slate-300">{login.subtitle}</p>
            <p className="mt-3 max-w-sm text-[13px] font-semibold leading-7 text-slate-300">
              سجّل حسابك لتشغيل النسخة التجريبية، أو ادخل بحسابك الحالي. كل بياناتك محفوظة آمنة في قاعدة البيانات.
            </p>
          </div>

          <div className="relative space-y-3 rounded-2xl border border-white/10 bg-ink-950/45 p-4">
            <div className="flex items-center justify-between text-[12px] font-bold text-slate-300">
              <span>الفترة التجريبية</span>
              <span className="rounded-lg bg-amber-brand/15 px-2 py-1 font-black text-amber-brand">{TRIAL_DAYS} يوماً</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11.5px] font-bold text-slate-400">
              <span className="rounded-lg bg-white/5 px-2 py-1.5">أصناف: {TRIAL_LIMITS.products}</span>
              <span className="rounded-lg bg-white/5 px-2 py-1.5">فواتير: {TRIAL_LIMITS.invoices}</span>
              <span className="rounded-lg bg-white/5 px-2 py-1.5">عملاء: {TRIAL_LIMITS.customers}</span>
              <span className="rounded-lg bg-white/5 px-2 py-1.5">موردون: {TRIAL_LIMITS.suppliers}</span>
            </div>
            <p className="text-[10.5px] font-semibold leading-5 text-slate-500">
              بعد انتهاء التجربة يلزم تفعيل النسخة الكاملة عبر الدعم الفني.
            </p>
          </div>

          <p className="relative text-[10px] font-bold text-slate-600" dir="ltr">CASH YOU · POS 1.0</p>
        </div>

        {/* ---------- جانب النموذج ---------- */}
        <div className="relative border-white/10 bg-ink-900/70 p-6 sm:p-8 lg:border-r">
          <div className="flex items-center gap-3 lg:hidden">
            {login.showLogo && <IcoLogo className="h-11 w-11 rounded-xl" />}
            <div>
              <p className="text-[10px] font-black tracking-[0.25em]" style={{ color: login.accent }}>CASH YOU</p>
              <p className="text-[15px] font-black text-white">{login.title}</p>
            </div>
          </div>

          {needSetup ? (
            <div className="mt-6 flex rounded-xl bg-ink-950/60 p-1">
              <button
                type="button"
                onClick={() => { setTab("register"); setError(""); }}
                className={`h-9 flex-1 rounded-lg text-[12.5px] font-black transition ${
                  tab === "register" ? "bg-amber-brand text-ink-900 shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                إنشاء حساب المالك
              </button>
              <button
                type="button"
                onClick={() => { setTab("login"); setError(""); }}
                className={`h-9 flex-1 rounded-lg text-[12.5px] font-black transition ${
                  tab === "login" ? "bg-amber-brand text-ink-900 shadow" : "text-slate-400 hover:text-white"
                }`}
              >
                تسجيل الدخول
              </button>
            </div>
          ) : (
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-white/10 bg-ink-950/60 px-3 py-2.5">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-amber-brand/15 text-[12px] font-black text-amber-brand">!</span>
              <p className="text-[11.5px] font-bold leading-5 text-slate-400">
                حساب المالك مُنشأ بالفعل. لإضافة مستخدمين جدد ادخل بحساب المالك ثم افتح شاشة «المستخدمون».
              </p>
            </div>
          )}

          <h2 className="mt-6 text-[19px] font-black text-white">
            {tab === "register" ? "تسجيل حساب المستخدم المالك" : "تسجيل الدخول"}
          </h2>
          <p className="mt-1 text-[12px] font-semibold leading-6 text-slate-400">
            {tab === "register"
              ? needSetup
                ? "لا يوجد حساب بعد — أنشئ حساب المالك للبدء، وسيبدأ عدّاد الفترة التجريبية من الآن."
                : "أضف حساب مستخدم جديد للبرنامج (متاح للمالك فقط)."
              : "أدخل اسم المستخدم وكلمة المرور للمتابعة."}
          </p>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            {tab === "register" && (
              <div>
                <label htmlFor="cy-fullname" className="mb-1.5 block text-[11.5px] font-black text-slate-300">الاسم الكامل</label>
                <input
                  id="cy-fullname"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  required
                  placeholder="مثال: وائل الجمال"
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label htmlFor="cy-username" className="mb-1.5 block text-[11.5px] font-black text-slate-300">اسم المستخدم</label>
              <input
                id="cy-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                dir="ltr"
                placeholder="owner"
                className={`${inputClass} text-center font-mono`}
              />
            </div>

            <div>
              <label htmlFor="cy-password" className="mb-1.5 block text-[11.5px] font-black text-slate-300">كلمة المرور</label>
              <div className="relative">
                <input
                  id="cy-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                  required
                  dir="ltr"
                  placeholder="••••••"
                  className={`${inputClass} text-center font-mono`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 left-2 my-auto h-7 rounded-lg px-2 text-[10.5px] font-black text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  {showPassword ? "إخفاء" : "إظهار"}
                </button>
              </div>
            </div>

            {tab === "register" && (
              <div>
                <label htmlFor="cy-confirm" className="mb-1.5 block text-[11.5px] font-black text-slate-300">تأكيد كلمة المرور</label>
                <input
                  id="cy-confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  dir="ltr"
                  placeholder="••••••"
                  className={`${inputClass} text-center font-mono`}
                />
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-[11.5px] font-bold leading-5 text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-xl bg-gradient-to-l from-amber-brand to-orange-500 text-[13.5px] font-black text-ink-900 shadow-lg transition hover:brightness-110 active:translate-y-0.5 disabled:cursor-progress disabled:opacity-60"
            >
              {busy ? "جارٍ التنفيذ..." : tab === "register" ? "إنشاء الحساب والبدء" : "دخول"}
            </button>
          </form>

          <p className="mt-4 text-center text-[10.5px] font-semibold leading-5 text-slate-500">
            نسخة تجريبية لمدة {TRIAL_DAYS} يوماً · محدودة بـ {TRIAL_LIMITS.products} صنفاً و{TRIAL_LIMITS.invoices} فاتورة و
            {TRIAL_LIMITS.customers} عميلاً و{TRIAL_LIMITS.suppliers} مورداً
          </p>
        </div>
      </section>
    </main>
  );
}
