import { clearedSessionCookie, destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await destroySession(req).catch(() => undefined);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearedSessionCookie() } });
}
