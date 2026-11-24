import { getBootstrap, saveInvoice, type SavePayload } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getBootstrap();
  return Response.json({
    invoices: data.invoices,
    nextInvoiceNumber: data.nextInvoiceNumber,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SavePayload;
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return Response.json(
        { error: "لا توجد أصناف في الفاتورة" },
        { status: 400 },
      );
    }
    const saved = await saveInvoice(body);
    return Response.json(saved);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "تعذر حفظ الفاتورة" },
      { status: 500 },
    );
  }
}