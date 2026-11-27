"use client";

import { useEffect, useState } from "react";

/* رسالة التحديث العائمة لبرنامج سطح المكتب (Windows).
 * تظهر فقط داخل تطبيق سطح المكتب عبر جسر window.cashYouUpdates (من preload.cjs).
 * على المتصفح العادي لا تظهر شيئاً. */

type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "downloaded" | "error";
type UpdateState = {
  status: UpdateStatus;
  version?: string;
  currentVersion?: string;
  notes?: string;
  percent?: number;
  message?: string;
};
type UpdateBridge = {
  getState: () => Promise<UpdateState>;
  download: () => Promise<boolean>;
  install: () => Promise<boolean>;
  subscribe: (listener: (state: UpdateState) => void) => () => void;
};

const VISIBLE: UpdateStatus[] = ["available", "downloading", "downloaded", "error"];

function getBridge(): UpdateBridge | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { cashYouUpdates?: UpdateBridge }).cashYouUpdates ?? null;
}

export function DesktopUpdateToast() {
  const [state, setState] = useState<UpdateState | null>(null);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) return;
    let alive = true;
    bridge.getState().then((s) => {
      if (alive) setState(s);
    }).catch(() => {});
    const unsubscribe = bridge.subscribe((s) => setState(s));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const bridge = getBridge();
  if (!bridge || !state || !VISIBLE.includes(state.status)) return null;

  const key = state.version ?? state.status;
  /* «لاحقاً» / «حسناً» تخفي الرسالة لهذا الإصدار حتى يُفتح البرنامج من جديد */
  if (dismissedFor === key) return null;

  const dismiss = () => setDismissedFor(key);
  const percent = Math.max(0, Math.min(100, Math.round(state.percent ?? 0)));

  const title = {
    available: "يتوفر تحديث جديد",
    downloading: "جارٍ تنزيل التحديث",
    downloaded: "التحديث جاهز للتثبيت",
    error: "تعذّر التحديث",
    checking: "",
    idle: "",
  }[state.status];

  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      className="fixed bottom-12 right-4 z-[120] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white text-ink-900 shadow-2xl overflow-hidden cy-pop"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-brand text-ink-900">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-black">{title}</div>
          {state.status === "available" && (
            <p className="mt-1 text-[12.5px] font-bold leading-relaxed text-slate-600">
              الإصدار <span className="cy-num text-ink-900">{state.version}</span> متاح الآن، وأنت على{" "}
              <span className="cy-num">{state.currentVersion}</span>.{" "}
              {state.notes || "فيه مميزات وتحسينات جديدة. بياناتك محفوظة ولن تتأثر."}
            </p>
          )}
          {state.status === "downloading" && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-cash-green transition-[width] duration-300" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-1.5 text-[12px] font-bold text-slate-600">
                <span className="cy-num">{percent}%</span> — لا تقفل البرنامج أثناء التنزيل.
              </p>
            </div>
          )}
          {state.status === "downloaded" && (
            <p className="mt-1 text-[12.5px] font-bold leading-relaxed text-slate-600">
              الإصدار <span className="cy-num text-ink-900">{state.version}</span> جاهز. التثبيت هيقفل البرنامج ويفتحه تاني بعد التحديث، وبياناتك محفوظة.
            </p>
          )}
          {state.status === "error" && (
            <p className="mt-1 text-[12.5px] font-bold leading-relaxed text-cash-red">{state.message}</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
        {state.status === "available" && (
          <>
            <button
              onClick={() => void bridge.download()}
              className="h-9 flex-1 rounded-lg bg-amber-brand text-[12.5px] font-black text-ink-900 cy-press"
            >
              تحديث الآن
            </button>
            <button onClick={dismiss} className="h-9 rounded-lg bg-white px-4 text-[12.5px] font-bold text-ink-700 border border-slate-300 cy-press">
              لاحقاً
            </button>
          </>
        )}
        {state.status === "downloading" && (
          <>
            <button disabled className="h-9 flex-1 rounded-lg bg-slate-200 text-[12.5px] font-black text-slate-500">
              جارٍ التنزيل…
            </button>
            <button onClick={dismiss} className="h-9 rounded-lg bg-white px-4 text-[12.5px] font-bold text-ink-700 border border-slate-300 cy-press">
              إخفاء
            </button>
          </>
        )}
        {state.status === "downloaded" && (
          <>
            <button
              onClick={() => void bridge.install()}
              className="h-9 flex-1 rounded-lg bg-ink-800 text-[12.5px] font-black text-white cy-press"
            >
              إعادة التشغيل والتحديث
            </button>
            <button onClick={dismiss} className="h-9 rounded-lg bg-white px-4 text-[12.5px] font-bold text-ink-700 border border-slate-300 cy-press">
              لاحقاً
            </button>
          </>
        )}
        {state.status === "error" && (
          <button onClick={dismiss} className="h-9 flex-1 rounded-lg bg-ink-800 text-[12.5px] font-black text-white cy-press">
            حسناً
          </button>
        )}
      </div>
    </div>
  );
}
