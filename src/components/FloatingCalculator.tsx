"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { IcoCalc, IcoX } from "@/components/icons";

type Op = "+" | "−" | "×" | "÷";

const compute = (a: number, b: number, op: Op): number => {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      return b === 0 ? Number.NaN : a / b;
  }
};

const fmt = (n: number): string => {
  if (!Number.isFinite(n)) return "خطأ";
  return String(Math.round(n * 1e10) / 1e10);
};

/**
 * حاسبة عائمة بنمط Windows 11: تُسحب من رأسها، وتبقى فوق الشاشة دون أن تعطّل الباركود.
 * لا تلتقط لوحة المفاتيح إلا عندما تكون مركّزة، حتى لا تسرق أرقام الباركود.
 */
export function FloatingCalculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(true);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: typeof window === "undefined" ? 0 : Math.max(8, window.innerWidth - 300),
    y: typeof window === "undefined" ? 0 : Math.max(8, window.innerHeight - 470),
  }));
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const current = Number(display);

  const digit = (d: string) => {
    if (display === "خطأ") {
      setDisplay(d);
      setFresh(false);
      return;
    }
    if (fresh) {
      setDisplay(d);
      setFresh(false);
      return;
    }
    if (display === "0" && d !== ".") return setDisplay(d);
    if (d === "." && display.includes(".")) return;
    if (display.replace(/[-.]/g, "").length >= 14) return;
    setDisplay(display + d);
  };

  const pressOp = (next: Op) => {
    if (stored !== null && op && !fresh) {
      const result = compute(stored, current, op);
      setStored(result);
      setDisplay(fmt(result));
    } else {
      setStored(current);
    }
    setOp(next);
    setFresh(true);
  };

  const equals = () => {
    if (stored === null || !op) return;
    const result = compute(stored, current, op);
    setDisplay(fmt(result));
    setStored(null);
    setOp(null);
    setFresh(true);
  };

  const clearAll = () => {
    setDisplay("0");
    setStored(null);
    setOp(null);
    setFresh(true);
  };

  const backspace = () => {
    if (fresh || display === "خطأ") return setDisplay("0");
    const next = display.length > 1 ? display.slice(0, -1) : "0";
    setDisplay(next === "-" ? "0" : next);
  };

  const onHeaderDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHeaderMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const x = Math.min(Math.max(0, e.clientX - drag.current.dx), window.innerWidth - 120);
    const y = Math.min(Math.max(0, e.clientY - drag.current.dy), window.innerHeight - 60);
    setPos({ x, y });
  };
  const onHeaderUp = () => {
    drag.current = null;
  };

  const keys: { label: string; onPress: () => void; tone?: "op" | "eq" | "clear" | "num" }[] = [
    { label: "C", onPress: clearAll, tone: "clear" },
    { label: "⌫", onPress: backspace, tone: "clear" },
    { label: "÷", onPress: () => pressOp("÷"), tone: "op" },
    { label: "×", onPress: () => pressOp("×"), tone: "op" },
    { label: "7", onPress: () => digit("7") },
    { label: "8", onPress: () => digit("8") },
    { label: "9", onPress: () => digit("9") },
    { label: "−", onPress: () => pressOp("−"), tone: "op" },
    { label: "4", onPress: () => digit("4") },
    { label: "5", onPress: () => digit("5") },
    { label: "6", onPress: () => digit("6") },
    { label: "+", onPress: () => pressOp("+"), tone: "op" },
    { label: "1", onPress: () => digit("1") },
    { label: "2", onPress: () => digit("2") },
    { label: "3", onPress: () => digit("3") },
    { label: "=", onPress: equals, tone: "eq" },
    { label: "0", onPress: () => digit("0") },
    { label: "00", onPress: () => digit("00") },
    { label: ".", onPress: () => digit(".") },
  ];

  const toneCls = {
    op: "bg-amber-100 text-amber-900 hover:bg-amber-200",
    eq: "bg-cash-green text-white hover:bg-cash-green-deep",
    clear: "bg-red-50 text-cash-red hover:bg-red-100",
    num: "bg-white text-ink-900 hover:bg-slate-100",
  } as const;

  return (
    <div
      className="fixed z-[95] w-[272px] select-none overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_40px_-12px_rgba(15,23,42,0.45)] cy-pop"
      style={{ left: pos.x, top: pos.y }}
      dir="ltr"
      role="dialog"
      aria-label="الحاسبة"
      tabIndex={-1}
      onKeyDown={(e) => {
        const map: Record<string, () => void> = {
          Enter: equals,
          "=": equals,
          Escape: onClose,
          Backspace: backspace,
          Delete: clearAll,
          "+": () => pressOp("+"),
          "-": () => pressOp("−"),
          "*": () => pressOp("×"),
          "/": () => pressOp("÷"),
          ".": () => digit("."),
        };
        if (/^\d$/.test(e.key)) {
          e.preventDefault();
          digit(e.key);
        } else if (map[e.key]) {
          e.preventDefault();
          map[e.key]();
        }
      }}
    >
      <div
        className="flex h-10 cursor-move items-center gap-2 bg-ink-800 px-3 text-white touch-none"
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderUp}
        onPointerCancel={onHeaderUp}
      >
        <IcoCalc className="h-4 w-4 text-amber-300" />
        <span className="text-[12.5px] font-black" dir="rtl">
          الحاسبة
        </span>
        <button
          onClick={onClose}
          className="mr-auto grid h-7 w-7 place-items-center rounded-md text-white/80 hover:bg-white/15 hover:text-white"
          aria-label="إغلاق الحاسبة"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <IcoX className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="bg-paper-2 px-3 py-2.5 text-right">
        <div className="h-4 text-[11px] font-bold text-slate-500 cy-num">
          {stored !== null && op ? `${fmt(stored)} ${op}` : "\u00a0"}
        </div>
        <div className="truncate text-[28px] font-black text-ink-900 cy-num" aria-live="polite">
          {display}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 p-2.5">
        {keys.map((k) => (
          <button
            key={k.label}
            onClick={k.onPress}
            className={`h-11 rounded-lg text-[16px] font-black cy-press cy-focus transition-colors ${toneCls[k.tone ?? "num"]}`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <p className="px-3 pb-2 text-center text-[10px] font-bold text-slate-400" dir="rtl">
        اسحب من الشريط العلوي لتحريك الحاسبة
      </p>
    </div>
  );
}
