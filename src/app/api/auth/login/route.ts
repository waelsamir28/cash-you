import {
  createSession,
  findUserAcrossTenants,
  sessionCookie,
  verifyPassword,
  ensureTrialStarted,
} from "@/lib/auth";
import { tenantCookie, withTenant } from "@/lib/tenant-routes";
import { runWithTenant } from "@/db/tenant-context";
import { getTenantDb } from "@/db/tenant-pool";
import { tenantModeEnabled } from "@/db/tenant-context";

export const dynamic = "force-dynamic";

export const POST = withTenant(async (req: Request) => {
  try {
    const body = (await req.json()) as { username?: string; password?: string };
    const username = String(body.username ?? "");
    const password = String(body.password ?? "");
    if (!username.trim() || !password) {
      return Response.json({ error: "أدخل اسم المستخدم وكلمة المرور" }, { status: 400 });
    }

    /* في وضع المستأجرين نبحث في كل الوحدات: لو العميل فتح البرنامج من
       جهاز جديد فسنجد حسابه ونثبّت المتصفح على قاعدته. */
    const found = await findUserAcrossTenants(username);
    /* نفس الرسالة في الحالتين حتى لا نكشف أسماء المستخدمين */
    if (!found || !(await verifyPassword(password, found.user.passwordHash))) {
      return Response.json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, { status: 401 });
    }

    const user = found.user;
    const buildResponse = async () => {
      await ensureTrialStarted();
      const token = await createSession(user.id);
      const headers = new Headers();
      headers.append("Set-Cookie", sessionCookie(token));
      if (tenantModeEnabled() && found.tenant.key !== "legacy") {
        headers.append("Set-Cookie", tenantCookie(found.tenant.key));
      }
      return Response.json(
        {
          user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role === "cashier" ? "cashier" : "owner",
          },
        },
        { headers },
      );
    };

    /* ننفّذ داخل قاعدة صاحب الحساب */
    if (found.tenant.key !== "legacy") {
      const ctx = { tenant: found.tenant, db: getTenantDb(found.tenant) };
      return await runWithTenant(ctx, buildResponse);
    }
    return await buildResponse();
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "تعذر تسجيل الدخول" },
      { status: 500 },
    );
  }
});
