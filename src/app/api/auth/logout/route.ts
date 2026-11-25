import { clearedSessionCookie, destroySession } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

export const POST = withTenant(async (req: Request) => {
  await destroySession(req).catch(() => undefined);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearedSessionCookie() } });
});
