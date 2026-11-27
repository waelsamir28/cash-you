import { getBootstrap, getInvoiceWithItems, markInvoicePrinted, saveInvoice, type SavePayload } from "@/lib/data";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";
import { assertTrialAllows, bumpUsageCounter } from "@/lib/auth";
import { guardPermission, isDenied } from "@/lib/permission-guard";
import { deleteInvoice } from "@/lib/invoice-admin";

export const dynamic = "force-dynamic";

/** بدون معامل: قائمة الفواتير الأخيرة. مع ?number=: تفاصيل فاتورة بأصنافها. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const numberText = url.searchParams.get("number");
  if (numberText !== null) {
    const number = Number.parseInt(numberText, 10);
    if (!Number.isInteger(number)) return Response.json({ error: "رقم الفاتورة غير صالح" }, { status: 400 });
    const found = await getInvoiceWithItems(number);
    if (!found) return Response.json({ error: "الفاتورة غير موجودة" }, { status: 404 });
    return Response.json({
      invoice: { ...found.invoice, createdAt: found.invoice.createdAt.toISOString() },
      items: found.items,
    });
  }
  const data = await getBootstrap();
  return Response.json({ invoices: data.invoices, nextInvoiceNumber: data.nextInvoiceNumber });
}

export async function PATCH(req: Request) {
  return withOfflineIdempotency(req, async () => {
    const guard = await guardPermission(req, "sales");
    if (isDenied(guard)) return guard;
    try {
      const body = (await req.json()) as { number: number };
      if (!Number.isInteger(body.number)) return Response.json({ error: "رقم الفاتورة غير صالح" }, { status: 400 });
      await markInvoicePrinted(body.number);
      return Response.json({ ok: true, number: body.number });
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : "تعذر تحديث حالة الطباعة" }, { status: 500 });
    }
  });
}

export async function POST(req: Request) {
  return withOfflineIdempotency(req, async () => {
    const guard = await guardPermission(req, "sales");
    if (isDenied(guard)) return guard;
    try {
      const body = (await req.json()) as SavePayload;
      if (!body || !Array.isArray(body.items) || body.items.length === 0) return Response.json({ error: "لا توجد أصناف في الفاتورة" }, { status: 400 });
      await assertTrialAllows("invoices");
      const saved = await saveInvoice(body);
      await bumpUsageCounter("invoices");
      return Response.json(saved);
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : "تعذر حفظ الفاتورة" }, { status: 500 });
    }
  });
}

/** حذف فاتورة بسبب مسجّل — يتطلب صلاحية «حذف الفواتير» وتُسجَّل في سجل النشاط */
export async function DELETE(req: Request) {
  const guard = await guardPermission(req, "invoiceDelete");
  if (isDenied(guard)) return guard;
  try {
    const body = (await req.json()) as { number?: number; reason?: string };
    if (!Number.isInteger(body.number)) return Response.json({ error: "رقم الفاتورة غير صالح" }, { status: 400 });
    const result = await deleteInvoice(body.number as number, String(body.reason ?? ""), guard.fullName);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "تعذر حذف الفاتورة" }, { status: 400 });
  }
}
