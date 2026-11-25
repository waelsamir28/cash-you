import { deleteInvoiceSafely, listDeletedInvoices } from "@/lib/data";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

export const GET = withTenant(async () => {
  const rows = await listDeletedInvoices();
  return Response.json({ deleted: rows });
});

export const POST = withTenant(async (req: Request) => {
  try {
    const body = (await req.json()) as { number?: number; reason?: string; deletedBy?: string };
    if (!body.number) return Response.json({ error: "رقم الفاتورة غير صالح" }, { status: 400 });
    const result = await deleteInvoiceSafely(body.number, body.reason ?? "", body.deletedBy ?? "");
    if (!result.ok) return Response.json({ error: result.error ?? "تعذر الحذف" }, { status: 400 });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "تعذر الحذف" }, { status: 500 });
  }
});
