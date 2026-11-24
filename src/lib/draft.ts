import type { LineItem } from "@/lib/types";
import { uid } from "@/lib/format";

export type Draft = {
  number: number;
  items: LineItem[];
  customerId: number | null;
  customerName: string;
  paymentMethod: string;
  saleType: "نقدي" | "آجل" | "تقسيط";
  discountPercent: number;
  paidText: string;
  categoryId: number | "all";
  query: string;
  page: number;
  lastAddedUid: string | null;
};

export function emptyDraft(number: number): Draft {
  return {
    number,
    items: [],
    customerId: null,
    customerName: "عميل نقدي",
    paymentMethod: "نقدي",
    saleType: "نقدي",
    discountPercent: 0,
    paidText: "0",
    categoryId: "all",
    query: "",
    page: 0,
    lastAddedUid: null,
  };
}

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function lineTotal(li: LineItem): number {
  return r2(Math.max(0, li.price * li.qty - li.discount));
}

export type Totals = {
  subtotal: number;
  discountValue: number;
  total: number;
  paid: number;
  remaining: number;
  change: number;
  count: number;
};

export function computeTotals(d: Draft): Totals {
  const subtotal = r2(d.items.reduce((s, li) => s + lineTotal(li), 0));
  const pct = Math.min(100, Math.max(0, d.discountPercent || 0));
  const discountValue = r2((subtotal * pct) / 100);
  const total = r2(subtotal - discountValue);
  const paid = r2(Number.parseFloat(d.paidText.replace(/[^\d.-]/g, "")) || 0);
  const remaining = r2(total - paid);
  return {
    subtotal,
    discountValue,
    total,
    paid,
    remaining,
    change: remaining < 0 ? r2(-remaining) : 0,
    count: d.items.reduce((s, li) => s + li.qty, 0),
  };
}

export function newLine(
  productId: number | null,
  code: string,
  name: string,
  unit: string,
  price: number,
): LineItem {
  return { uid: uid(), productId, code, name, unit, qty: 1, price, discount: 0 };
}