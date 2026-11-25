import { createSuspended, deleteSuspended, listSuspended } from "@/lib/data";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

export const GET = withTenant(async () => {
  const rows = await listSuspended();
  return Response.json({ suspended: rows });
});

export const POST = withTenant(async (req: Request) => {
  try {
    const body = (await req.json()) as { title?: string; draftJson?: string; userName?: string };
    if (!body.draftJson) return Response.json({ error: "لا توجد بيانات للتعليق" }, { status: 400 });
    const row = await createSuspended(body.title ?? "فاتورة معلقة", body.draftJson, body.userName ?? "");
    return Response.json({ ok: true, suspended: row });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "تعذر تعليق الفاتورة" }, { status: 500 });
  }
});

export const DELETE = withTenant(async (req: Request) => {
  try {
    const body = (await req.json()) as { id?: number };
    if (!body.id) return Response.json({ error: "رقم غير صالح" }, { status: 400 });
    await deleteSuspended(body.id);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "تعذر الحذف" }, { status: 500 });
  }
});
