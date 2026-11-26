import { createSession, findUserByUsername, sessionCookie, verifyPassword, ensureTrialStarted } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { username?: string; password?: string };
    const username = String(body.username ?? "");
    const password = String(body.password ?? "");
    if (!username.trim() || !password) {
      return Response.json({ error: "أدخل اسم المستخدم وكلمة المرور" }, { status: 400 });
    }

    const user = await findUserByUsername(username);
    /* نفس الرسالة في الحالتين حتى لا نكشف أسماء المستخدمين */
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return Response.json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, { status: 401 });
    }

    await ensureTrialStarted();
    const token = await createSession(user.id);
    return Response.json(
      {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role === "cashier" ? "cashier" : "owner",
        },
      },
      { headers: { "Set-Cookie": sessionCookie(token) } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "تعذر تسجيل الدخول" },
      { status: 500 },
    );
  }
}
