import { getSessionUser, listUsers } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** قائمة الحسابات المسجّلة — للمالك فقط. */
export async function GET(req: Request) {
  const current = await getSessionUser(req);
  if (!current) return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
  if (current.role !== "owner") return Response.json({ error: "قائمة المستخدمين متاحة للمالك فقط" }, { status: 403 });
  return Response.json({ users: await listUsers() });
}
