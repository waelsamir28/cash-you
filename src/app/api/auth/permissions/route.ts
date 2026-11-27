import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { ensureAuthSchema } from "@/lib/ensure-schema";
import { writeAudit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth";
import { SCREENS, isScreenKey, type ScreenKey } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** تعديل صلاحيات الشاشات لحساب كاشير — للمالك فقط */
export async function POST(req: Request) {
  const current = await getSessionUser(req);
  if (!current) return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
  if (current.role !== "owner") return Response.json({ error: "تعديل الصلاحيات للمالك فقط" }, { status: 403 });
  try {
    await ensureAuthSchema();
    const body = (await req.json()) as { userId?: number; permissions?: unknown };
    if (!Number.isInteger(body.userId)) return Response.json({ error: "الحساب غير صالح" }, { status: 400 });
    if (!Array.isArray(body.permissions)) return Response.json({ error: "قائمة الصلاحيات غير صالحة" }, { status: 400 });
    const keys = body.permissions.filter(isScreenKey) as ScreenKey[];
    const unique = SCREENS.map((s) => s.key).filter((k) => keys.includes(k));
    const [target] = await db.select().from(appUsers).where(eq(appUsers.id, body.userId as number)).limit(1);
    if (!target) return Response.json({ error: "الحساب غير موجود" }, { status: 404 });
    if (target.role !== "cashier") return Response.json({ error: "صلاحيات المالك دائماً كاملة" }, { status: 400 });
    await db.update(appUsers).set({ permissions: JSON.stringify(unique) }).where(eq(appUsers.id, target.id));
    await writeAudit(db, current.fullName, "تعديل الصلاحيات", "حساب مستخدم", target.username, JSON.stringify({ permissions: unique }));
    return Response.json({ ok: true, permissions: unique });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "تعذر حفظ الصلاحيات" }, { status: 400 });
  }
}
