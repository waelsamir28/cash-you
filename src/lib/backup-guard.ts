import { getSessionUser } from "@/lib/auth";

/** النسخ الاحتياطي والاسترداد للمالك فقط */
export async function requireBackupOwner(req: Request): Promise<Response | null> {
  const current = await getSessionUser(req);
  if (!current) return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
  if (current.role !== "owner") return Response.json({ error: "النسخ الاحتياطي للمالك فقط" }, { status: 403 });
  return null;
}
