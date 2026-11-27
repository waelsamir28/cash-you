/**
 * مستند الفاتورة الموحّد: يُستخدم في نص الواتساب، ومعاينة الطباعة، وملف PDF.
 * كل الدوال هنا خالصة (بدون React) حتى تعمل في المتصفح وفي تطبيق سطح المكتب.
 */
import { money, shortStamp } from "@/lib/format";

export type InvoiceDoc = {
  number: number;
  createdAt: string;
  customerName: string;
  paymentMethod: string;
  saleType: string;
  total: number;
  paid: number;
  remaining: number;
  /** الرصيد السابق للعميل — يظهر فقط عندما تكون القيمة معروفة وقت الحفظ */
  previousBalance?: number | null;
  /** المبلغ الذي نُزّل على حساب العميل (زيادة في الدفع) */
  overpayCredit?: number;
  items: { code: string; name: string; unit: string; qty: number; price: number; total: number }[];
};

export type ShopBrief = { name: string; phone: string; address?: string };

const esc = (value: string | number) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);

/** نص رسالة الواتساب: ملخص الفاتورة بأصنافها وأرقامها */
export function invoiceWhatsAppText(doc: InvoiceDoc, shop: ShopBrief): string {
  const lines = doc.items.map((it, i) => `${i + 1}. ${it.name} × ${it.qty} = ${money(it.total)}`);
  const parts = [
    `فاتورة رقم ${doc.number} — ${shop.name}`,
    `التاريخ: ${shortStamp(doc.createdAt)}`,
    `العميل: ${doc.customerName}`,
    "",
    ...lines,
    "",
    `الإجمالي: ${money(doc.total)} ج`,
    `المدفوع: ${money(doc.paid)} ج`,
    `المتبقي: ${money(doc.remaining)} ج`,
  ];
  if (doc.previousBalance !== null && doc.previousBalance !== undefined) {
    parts.push(`الرصيد السابق: ${money(doc.previousBalance)} ج`);
  }
  parts.push("", `${shop.name}${shop.phone ? ` — ${shop.phone}` : ""}`);
  return parts.join("\n");
}

/** مستند HTML كامل للفاتورة (A4) — يُطبع أو يُحوَّل إلى PDF */
export function invoiceHtml(doc: InvoiceDoc, shop: ShopBrief): string {
  const rows = doc.items
    .map(
      (it, i) => `<tr>
        <td>${i + 1}</td><td class="code">${esc(it.code)}</td><td class="name">${esc(it.name)}</td>
        <td>${esc(it.unit)}</td><td class="num">${esc(it.qty)}</td><td class="num">${money(it.price)}</td><td class="num">${money(it.total)}</td>
      </tr>`,
    )
    .join("");
  const extra: string[] = [];
  if (doc.previousBalance !== null && doc.previousBalance !== undefined) {
    extra.push(`<div class="kv"><span>الرصيد السابق</span><b>${money(doc.previousBalance)} ج</b></div>`);
  }
  if (doc.overpayCredit && doc.overpayCredit > 0) {
    extra.push(`<div class="kv"><span>تنزيل على الحساب</span><b>${money(doc.overpayCredit)} ج</b></div>`);
  }
  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>فاتورة ${doc.number}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Tahoma, Arial, sans-serif; color: #0f172a; margin: 0; font-size: 12px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
  .brand { font-weight: 900; letter-spacing: 3px; font-size: 16px; }
  .shop { font-weight: 800; font-size: 14px; margin-top: 4px; }
  .meta { text-align: left; font-size: 12px; }
  .meta div { margin-bottom: 3px; }
  h1 { text-align: center; font-size: 18px; margin: 14px 0 10px; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; margin-bottom: 12px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #94a3b8; padding: 6px 5px; text-align: right; }
  th { background: #1e293b; color: #fff; font-weight: 800; }
  td.num, th.num { text-align: center; font-variant-numeric: tabular-nums; }
  td.code { font-family: Consolas, monospace; text-align: center; }
  tr:nth-child(even) td { background: #f8fafc; }
  .totals { margin-top: 14px; margin-right: auto; width: 60%; }
  .kv { display: flex; justify-content: space-between; padding: 5px 8px; border-bottom: 1px dashed #94a3b8; }
  .kv.grand { background: #0f172a; color: #fff; font-size: 14px; font-weight: 900; border: none; margin-top: 4px; }
  .foot { margin-top: 28px; text-align: center; font-size: 11px; color: #475569; border-top: 1px dashed #94a3b8; padding-top: 8px; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <div class="brand">CASH YOU</div>
      <div class="shop">${esc(shop.name)}</div>
      ${shop.address ? `<div>${esc(shop.address)}</div>` : ""}
      ${shop.phone ? `<div dir="ltr">${esc(shop.phone)}</div>` : ""}
    </div>
    <div class="meta">
      <div><b>رقم الفاتورة:</b> ${doc.number}</div>
      <div><b>التاريخ:</b> ${esc(shortStamp(doc.createdAt))}</div>
    </div>
  </div>
  <h1>فاتورة مبيعات</h1>
  <div class="info">
    <div>العميل: ${esc(doc.customerName)}</div>
    <div>نوع البيع: ${esc(doc.saleType)}</div>
    <div>طريقة الدفع: ${esc(doc.paymentMethod)}</div>
  </div>
  <table>
    <thead><tr><th>#</th><th>الكود</th><th>اسم الصنف</th><th>الوحدة</th><th class="num">الكمية</th><th class="num">السعر</th><th class="num">الإجمالي</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    ${extra.join("\n    ")}
    <div class="kv"><span>الإجمالي</span><b>${money(doc.total)} ج</b></div>
    <div class="kv"><span>المدفوع</span><b>${money(doc.paid)} ج</b></div>
    <div class="kv"><span>المتبقي</span><b>${money(doc.remaining)} ج</b></div>
  </div>
  <div class="foot">شكراً لتعاملكم معنا — ${esc(shop.name)}${shop.phone ? ` — ${esc(shop.phone)}` : ""}</div>
</body>
</html>`;
}

/** يفتح الفاتورة في نافذة طباعة المتصفح (يمكن اختيار «حفظ كـ PDF» منها) */
export function printInvoiceHtml(html: string): boolean {
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
  return true;
}

type ExportBridge = { exportPdf?: (payload: { html: string; fileName: string }) => Promise<{ canceled: boolean; filePath?: string }> };

/**
 * تصدير PDF:
 * - داخل تطبيق سطح المكتب: حفظ ملف PDF حقيقي بعد اختيار المكان.
 * - في المتصفح: نافذة الطباعة، واختيار «حفظ كـ PDF».
 */
export async function exportInvoicePdf(doc: InvoiceDoc, shop: ShopBrief): Promise<"saved" | "printed" | "cancelled" | "blocked"> {
  const html = invoiceHtml(doc, shop);
  const bridge = (window as unknown as { cashYou?: ExportBridge }).cashYou;
  if (bridge?.exportPdf) {
    const result = await bridge.exportPdf({ html, fileName: `فاتورة-${doc.number}.pdf` });
    return result.canceled ? "cancelled" : "saved";
  }
  return printInvoiceHtml(html) ? "printed" : "blocked";
}
