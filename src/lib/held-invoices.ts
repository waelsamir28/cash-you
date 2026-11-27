/**
 * تخزين محلي على هذا الجهاز فقط (localStorage):
 * - الفواتير المعلّقة: فواتير تركها البائع مؤقتاً لخدمة زبون آخر.
 * - الحفظ التلقائي للتبويبات: يحفظ الفواتير المفتوحة باستمرار حتى لا تضيع عند انقطاع الكهرباء أو إغلاق البرنامج.
 */
import type { Draft } from "@/lib/draft";
import type { Tab } from "@/components/Chrome";

const HELD_KEY = "cy-held-invoices.v1";
const SESSION_KEY = "cy-open-tabs.v1";

export type HeldInvoice = {
  id: string;
  heldAt: string;
  customerName: string;
  itemsCount: number;
  total: number;
  draft: Draft;
};

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* التخزين ممتلئ أو غير متاح — لا نوقف العمل */
  }
}

export function readHeld(): HeldInvoice[] {
  return read<HeldInvoice[]>(HELD_KEY) ?? [];
}

export function holdInvoice(draft: Draft, total: number): HeldInvoice {
  const row: HeldInvoice = {
    id: `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    heldAt: new Date().toISOString(),
    customerName: draft.customerName || "عميل نقدي",
    itemsCount: draft.items.length,
    total,
    draft,
  };
  write(HELD_KEY, [row, ...readHeld()]);
  return row;
}

export function removeHeld(id: string): HeldInvoice[] {
  const next = readHeld().filter((row) => row.id !== id);
  write(HELD_KEY, next);
  return next;
}

export type SavedSession = {
  userId: number;
  savedAt: string;
  activeId: string;
  tabs: Tab[];
  drafts: Record<string, Draft>;
};

export function readSession(): SavedSession | null {
  return read<SavedSession>(SESSION_KEY);
}

export function writeSession(session: SavedSession): void {
  write(SESSION_KEY, session);
}

/** الجلسة المحفوظة لهذا المستخدم فقط، بعد التحقق من صحتها؛ null إن لم توجد */
export function readRestorable(userId: number): { tabs: Tab[]; drafts: Record<string, Draft>; activeId: string; maxSeq: number } | null {
  const saved = readSession();
  if (!saved || saved.userId !== userId || !Array.isArray(saved.tabs) || saved.tabs.length === 0) return null;
  const tabs = saved.tabs.filter((t) => t.kind !== "invoice" || saved.drafts[t.id]);
  if (tabs.length === 0) return null;
  const drafts: Record<string, Draft> = {};
  let maxSeq = 1;
  tabs.forEach((t) => {
    if (t.kind !== "invoice") return;
    drafts[t.id] = saved.drafts[t.id];
    const n = Number(t.id.replace(/^inv-/, ""));
    if (Number.isFinite(n)) maxSeq = Math.max(maxSeq, n);
  });
  const activeId = tabs.some((t) => t.id === saved.activeId) ? saved.activeId : tabs[0].id;
  return { tabs, drafts, activeId, maxSeq };
}
