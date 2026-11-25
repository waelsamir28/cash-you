import { getScreenPermissions, setScreenPermissions } from "@/lib/data";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

export const GET = withTenant(async (req: Request) => {
  const url = new URL(req.url);
  const userId = Number(url.searchParams.get("userId"));
  if (!userId) return Response.json({ error: "رقم المستخدم غير صالح" }, { status: 400 });
  const kinds = await getScreenPermissions(userId);
  return Response.json({ permissions: kinds });
});

export const POST = withTenant(async (req: Request) => {
  try {
    const body = (await req.json()) as { userId?: number; kinds?: string[] };
    if (!body.userId || !Array.isArray(body.kinds)) {
      return Response.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }
    await setScreenPermissions(body.userId, body.kinds);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "تعذر الحفظ" }, { status: 500 });
  }
});
