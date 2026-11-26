"use client";

import type { CSSProperties, ReactNode } from "react";
import type { AmountKey } from "@/lib/ui-prefs";

/**
 * خانة مبلغ كبيرة: الألوان والمقاس والمحاذاة والخطوط تُقرأ من متغيرات CSS
 * (--cy-amt-<key>-*) التي يضبطها applyPrefs من إعدادات «خانات المبالغ».
 */
export function AmountTile({
  k,
  label,
  children,
  aside,
}: {
  k: AmountKey;
  label: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  const v = (name: string) => `var(--cy-amt-${k}-${name})`;
  const boxStyle: CSSProperties = {
    width: `var(--cy-amt-${k}-w, 156px)`,
    height: `var(--cy-amt-${k}-h, 56px)`,
    background: v("bg"),
    color: v("text"),
    borderColor: v("border"),
  };
  return (
    <div
      className="relative rounded-xl border-2 px-2 py-1.5 flex flex-col items-center justify-center shadow-sm overflow-hidden"
      style={boxStyle}
    >
      <span
        className="block w-full leading-none font-black truncate"
        style={{ fontSize: v("lbl"), color: v("label"), textAlign: v("la") as CSSProperties["textAlign"] }}
      >
        {label}
      </span>
      <div
        className="w-full mt-1 font-black leading-none cy-num"
        style={{ fontSize: v("num"), textAlign: v("na") as CSSProperties["textAlign"] }}
      >
        {children}
      </div>
      {aside && <div className="absolute bottom-0.5 left-1.5 leading-none">{aside}</div>}
    </div>
  );
}
