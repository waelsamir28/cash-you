import { listActivity, recordActivity } from "@/lib/data";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

export const GET = withTenant(async () => {
  const rows = await listActivity();
  return Response.json({ activity: rows });
});

export const POST = withTenant(async (req: Request) => {
  try {
    const body = (await req.json()) as {
      userId?: number | null;
      userName?: string;
      action?: string;
      entityType?: string;
      entityId?: number | null;
      details?: string;
    };
    if (!body.action) return Response.json({ error: "لا يوجد إجراء" }, { status: 400 });
    await recordActivity({ ...body, action: body.action });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "تعذر التسجيل" }, { status: 500 });
  }
});
