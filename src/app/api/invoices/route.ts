import { getBootstrap, markInvoicePrinted, saveInvoice, type SavePayload } from "@/lib/data";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getBootstrap();
  return Response.json({ invoices: data.invoices, nextInvoiceNumber: data.nextInvoiceNumber });
}

export async function PATCH(req: Request) {
  return withOfflineIdempotency(req, async () => {
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
    try {
      const body = (await req.json()) as SavePayload;
      if (!body || !Array.isArray(body.items) || body.items.length === 0) return Response.json({ error: "لا توجد أصناف في الفاتورة" }, { status: 400 });
      return Response.json(await saveInvoice(body));
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : "تعذر حفظ الفاتورة" }, { status: 500 });
    }
  });
}
