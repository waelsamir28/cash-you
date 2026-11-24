import {
  createSession,
  findUserByUsername,
  getSessionUser,
  hashPassword,
  normalizeUsername,
  sessionCookie,
  type PublicUser,
} from "@/lib/auth";
import { db } from "@/db";
import { appUsers } from "@/db/schema";

export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-z0-9._-]{3,24}$/;

/**
 * إنشاء حساب المالك (أول حساب فقط)، أو إضافة موظف بواسطة المالك.
 * أول حساب يتم إنشاؤه يصبح owner تلقائياً.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      username?: string;
      fullName?: string;
      password?: string;
      role?: string;
    };
    const username = normalizeUsername(String(body.username ?? ""));
    const fullName = String(body.fullName ?? "").trim();
    const password = String(body.password ?? "");
    const role = body.role === "cashier" ? "cashier" : "owner";

    if (!USERNAME_RE.test(username)) {
      return Response.json({ error: "اسم المستخدم: 3 إلى 24 حرفاً إنجليزياً/رقماً بدون مسافات" }, { status: 400 });
    }
    if (fullName.length < 2) {
      return Response.json({ error: "الاسم الكامل مطلوب" }, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ error: "كلمة المرور يجب ألا تقل عن 6 أحرف" }, { status: 400 });
    }
    if (await findUserByUsername(username)) {
      return Response.json({ error: "اسم المستخدم مستخدم بالفعل، اختر اسماً آخر" }, { status: 409 });
    }

    const existing = await db.select({ id: appUsers.id }).from(appUsers).limit(1);
    const isFirstUser = existing.length === 0;

    /* بعد وجود المالك، إضافة الحسابات تحتاج جلسة مالك. */
    if (!isFirstUser) {
      const current = await getSessionUser(req);
      if (!current || current.role !== "owner") {
        return Response.json({ error: "إنشاء الحسابات متاح للمالك فقط بعد إنشاء الحساب الأول" }, { status: 403 });
      }
    }

    const inserted = await db
      .insert(appUsers)
      .values({
        username,
        fullName,
        passwordHash: await hashPassword(password),
        role: isFirstUser ? "owner" : role,
      })
      .returning({ id: appUsers.id, username: appUsers.username, fullName: appUsers.fullName, role: appUsers.role });

    const user: PublicUser = {
      id: inserted[0].id,
      username: inserted[0].username,
      fullName: inserted[0].fullName,
      role: inserted[0].role === "cashier" ? "cashier" : "owner",
    };

    /* أول حساب: نفتح له جلسة فوراً ونبدأ عدّاد التجربة. */
    if (isFirstUser) {
      const { ensureTrialStarted } = await import("@/lib/auth");
      await ensureTrialStarted();
      const token = await createSession(user.id);
      return Response.json(
        { user, registered: true },
        { headers: { "Set-Cookie": sessionCookie(token) } },
      );
    }

    return Response.json({ user, registered: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "تعذر إنشاء الحساب" },
      { status: 500 },
    );
  }
}
