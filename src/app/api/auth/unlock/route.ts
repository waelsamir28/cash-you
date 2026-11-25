import { getSessionUser, verifyPassword } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-routes";
import { db } from "@/db";
import { appUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** فك قفل الشاشة: يتحقق من كلمة مرور المستخدم الحالي */
export const POST = withTenant(async (req: Request) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return Response.json({ error: "انتهت الجلسة — سجّل دخولك من جديد" }, { status: 401 });

    const body = (await req.json()) as { pin?: string; password?: string };
    const secret = String(body.pin ?? body.password ?? "");
    if (!secret) return Response.json({ error: "أدخل كلمة المرور" }, { status: 400 });

    const rows = await db.select().from(appUsers).where(eq(appUsers.id, user.id)).limit(1);
    const record = rows[0];
    if (!record) return Response.json({ error: "المستخدم غير موجود" }, { status: 404 });

    const ok = await verifyPassword(secret, record.passwordHash);
    if (!ok) return Response.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "تعذر التحقق" }, { status: 500 });
  }
});
