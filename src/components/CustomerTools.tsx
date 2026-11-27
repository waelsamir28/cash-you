import type { Bootstrap, InvoiceRow, Party } from "@/lib/types";
import type { PrintDoc } from "@/components/ModuleUI";
import { money, shortStamp } from "@/lib/format";

/** عدد الأيام بعد أقدم فاتورة مفتوحة يُعتبر بعدها العميل متأخراً (افتراضي 30 يوم) */
export const LATE_DAYS = 30;

/** تحويل رقم مصري إلى صيغة واتساب الدولية (01xxxxxxxxx → 201xxxxxxxxx) */
export function waNumber(phone: string): string | null {
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = `20${d.slice(1)}`;
  return d.length >= 8 ? d : null;
}

export function openWhatsApp(phone: string, text: string): boolean {
  const n = waNumber(phone);
  if (!n) return false;
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  return true;
}

/** متأخر = عليه رصيد، وأقدم فاتورة ليه أقدم من LATE_DAYS يوم. الرصيد الافتتاحي بدون فاتورة لا يُحسب */
export function lateInfo(party: Party, invoices: InvoiceRow[], now = Date.now()): { days: number; amount: number } | null {
  if (party.balance <= 0) return null;
  const mine = invoices.filter((i) => i.customerId === party.id);
  if (mine.length === 0) return null;
  const oldest = Math.min(...mine.map((i) => new Date(i.createdAt).getTime()).filter((t) => Number.isFinite(t)));
  if (!Number.isFinite(oldest)) return null;
  const days = Math.floor((now - oldest) / 86_400_000);
  return days >= LATE_DAYS ? { days, amount: party.balance } : null;
}

export function statementDoc(party: Party, data: Bootstrap): PrintDoc {
  const inv = data.invoices
    .filter((i) => i.customerId === party.id)
    .slice(0, 30)
    .map((i) => ({ label: `فاتورة ${i.number} · ${shortStamp(i.createdAt)}`, value: `إجمالي ${money(i.total)} · متبقي ${money(i.remaining)}` }));
  const vou = data.vouchers
    .filter((v) => v.partyType === "عميل" && v.partyName === party.name)
    .slice(0, 30)
    .map((v) => ({ label: `سند قبض ${v.number} · ${shortStamp(v.createdAt)}`, value: money(v.amount) }));
  return {
    title: "كشف حساب عميل",
    number: String(party.id),
    party: party.name,
    date: shortStamp(new Date().toISOString()),
    amount: party.balance,
    lines: [...inv, ...vou],
    notes: `الرصيد الحالي المستحق: ${money(party.balance)}`,
  };
}

export function statementText(party: Party, data: Bootstrap): string {
  return `كشف حساب ${party.name}\nالرصيد الحالي المستحق: ${money(party.balance)}\n${data.shop.name} - ${data.shop.phone}`;
}

export function reminderText(party: Party, data: Bootstrap, days: number): string {
  return `أستاذ/ة ${party.name}، نحيطكم علماً بأن رصيدكم المستحق لدى ${data.shop.name} هو ${money(party.balance)}، ومرّ على أقدم فاتورة مفتوحة ${days} يوماً. نرجو التواصل لسداد المبلغ. شكراً لتعاملكم معنا.`;
}
