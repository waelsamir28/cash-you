"use client";

import { useEffect, useState } from "react";

/** قفل الشاشة بعد فترة خمول: يطلب كلمة مرور المستخدم الحالي للرجوع. minutes = 0 يعني مُعطَّل */
export function IdleLock({ minutes }: { minutes: number }) {
  const [locked, setLocked] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!minutes || minutes <= 0 || locked) return;
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLocked(true), minutes * 60_000);
    };
    const events = ["pointerdown", "keydown", "mousemove", "touchstart", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    arm();
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [minutes, locked]);

  useEffect(() => {
    if (!locked) return;
    fetch(`/api/auth/me?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { user?: { username?: string } | null }) => {
        if (j.user?.username) setUsername(j.user.username);
      })
      .catch(() => {});
  }, [locked]);

  if (!locked) return null;

  const unlock = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "تعذر فتح الشاشة");
        return;
      }
      setPassword("");
      setLocked(false);
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] cy-mesh cy-grain grid place-items-center p-4 text-white" dir="rtl">
      <form
        className="w-full max-w-sm rounded-2xl bg-white text-ink-900 shadow-2xl overflow-hidden cy-pop"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && password) void unlock();
        }}
      >
        <div className="bg-ink-800 px-5 py-4 text-white">
          <div className="font-black text-[16px]">الجهاز مقفول</div>
          <div className="text-[12px] text-slate-300 mt-0.5">تم القفل بعد فترة خمول. أدخل كلمة المرور للمتابعة.</div>
        </div>
        <div className="p-5 grid gap-3">
          <label className="grid gap-1 text-[12px] font-bold">
            اسم المستخدم
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="h-10 rounded-lg border border-line px-3 text-[13px]" />
          </label>
          <label className="grid gap-1 text-[12px] font-bold">
            كلمة المرور
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-lg border border-line px-3 text-[13px]"
            />
          </label>
          {error && <p className="text-[12px] font-bold text-cash-red">{error}</p>}
          <button
            type="submit"
            disabled={busy || !password}
            className="h-10 rounded-lg bg-amber-brand text-ink-900 font-black text-[13px] disabled:opacity-50"
          >
            {busy ? "جارٍ التحقق…" : "فتح الشاشة"}
          </button>
        </div>
      </form>
    </div>
  );
}
