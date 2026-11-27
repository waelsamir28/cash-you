"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { IcoBarcode, IcoCamera, IcoX } from "@/components/icons";
import { sfxScan } from "@/lib/sound";

/**
 * قارئ الباركود بكاميرا الجهاز (الموبايل أو الويب كام).
 * يبقى مفتوحاً لقراءة عدة أصناف متتالية، ويتجاهل تكرار نفس الكود خلال ثانيتين.
 * يُستدعى onCode لكل قراءة، ويكون الرد true إن وُجد الصنف.
 */
export function CameraScanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => boolean;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const onCodeRef = useRef(onCode);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  /* المتصفح بلا كاميرا (أو بدون اتصال آمن): نعرف ذلك قبل الرسم فلا نحتاج setState داخل effect */
  const unsupported = typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia;
  const [status, setStatus] = useState<"starting" | "ready" | "error">(unsupported ? "error" : "starting");
  const [error, setError] = useState(
    unsupported ? "الكاميرا غير متاحة في هذا الجهاز أو المتصفح. تأكد من فتح البرنامج عبر اتصال آمن." : "",
  );
  const [scanned, setScanned] = useState<{ code: string; ok: boolean }[]>([]);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;
    if (unsupported) return;
    const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 120 });
    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        video,
        (result) => {
          if (cancelled || !result) return;
          const code = result.getText().trim();
          const now = Date.now();
          if (!code || (code === lastRef.current.code && now - lastRef.current.at < 2000)) return;
          lastRef.current = { code, at: now };
          const ok = onCodeRef.current(code);
          sfxScan();
          setScanned((prev) => [{ code, ok }, ...prev].slice(0, 6));
        },
      )
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        const name = err instanceof Error ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "لم يُسمح للبرنامج باستخدام الكاميرا. اسمح بالوصول من إعدادات المتصفح أو الجهاز ثم أعد المحاولة."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "لم يُعثر على كاميرا متصلة بهذا الجهاز."
              : "تعذر تشغيل الكاميرا. أعد المحاولة أو استخدم قارئ الباركود اليدوي.",
        );
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [unsupported]);

  return (
    <div className="fixed inset-0 z-[96] grid place-items-center bg-ink-950/70 p-3 backdrop-blur-sm cy-no-print" dir="rtl">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-white shadow-2xl cy-pop">
        <div className="flex h-12 items-center gap-2 bg-ink-800 px-4 text-white">
          <IcoCamera className="h-4 w-4 text-amber-300" />
          <h2 className="text-[14px] font-black">قراءة الباركود بالكاميرا</h2>
          <button onClick={onClose} className="mr-auto grid h-8 w-8 place-items-center rounded-md text-white/80 hover:bg-white/15" aria-label="إغلاق">
            <IcoX className="h-4 w-4" />
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-ink-950">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {status === "ready" && (
            <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-[30%] -translate-y-1/2 rounded-xl border-2 border-amber-brand shadow-[0_0_0_9999px_rgba(2,6,23,0.35)]">
              <span className="absolute inset-x-2 top-1/2 h-0.5 bg-cash-red/80" />
            </div>
          )}
          {status === "starting" && <p className="absolute inset-0 grid place-items-center text-[12.5px] font-bold text-slate-200">جارٍ تشغيل الكاميرا...</p>}
          {status === "error" && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <p className="text-[13px] font-bold leading-relaxed text-amber-200">{error}</p>
            </div>
          )}
        </div>

        <div className="space-y-2 p-3">
          <p className="text-[11.5px] font-bold text-slate-500">
            وجّه الكاميرا نحو الباركود، وتُضاف الأصناف تلقائياً. يمكنك قراءة عدة أصناف متتالية.
          </p>
          <div className="min-h-[72px] space-y-1.5 rounded-xl border border-line bg-paper-2 p-2">
            {scanned.length === 0 && (
              <p className="flex h-full items-center justify-center gap-1.5 text-[12px] font-bold text-slate-400">
                <IcoBarcode className="h-4 w-4" /> لم تُقرأ أي أصناف بعد
              </p>
            )}
            {scanned.map((row, i) => (
              <div key={`${row.code}-${i}`} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-[12px]">
                <span className={`font-black ${row.ok ? "text-cash-green-deep" : "text-cash-red"}`}>{row.ok ? "تمت الإضافة" : "غير موجود"}</span>
                <span className="cy-num font-mono font-bold text-ink-800" dir="ltr">
                  {row.code}
                </span>
              </div>
            ))}
          </div>
          <button onClick={onClose} className="h-10 w-full rounded-lg bg-ink-800 text-[13px] font-black text-white cy-press hover:bg-ink-900">
            تم
          </button>
        </div>
      </div>
    </div>
  );
}
