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
import { provisionForNewOwner, tenantCookie, withTenant } from "@/lib/tenant-routes";
import { runWithTenant } from "@/db/tenant-context";
import { getTenantDb } from "@/db/tenant-pool";
import { tenantModeEnabled } from "@/db/tenant-context";

export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-z0-9._-]{3,24}$/;

/**
 * إنشاء حساب المالك (أول حساب فقط)، أو إضافة موظف بواسطة المالك.
 * أول حساب يتم إنشاؤه يصبح owner تلقائياً.
 */
export const POST = withTenant(async (req: Request) => {
  const body = (await req.json()) as {
    username?: string;
    fullName?: string;
    password?: string;
    role?: string;
  };
  /* حساب مسجّل (مالك أو موظف) → الإضافة تتم داخل قاعدة عميله الحالية */
  const session = await getSessionUser(req);
  if (session) {
    if (session.role !== "owner") {
      return Response.json(
        { error: "إنشاء الحسابات متاح للمالك فقط" },
        { status: 403 },
      );
    }
    return await registerOwner(req, body, null);
  }

  /* زائر جديد على نسخة متعددة المستأجرين → وحدة عزل مستقلة له */
  const isolated = await registerForNewTenant(req, body);
  if (isolated) return isolated;
  return await registerOwner(req, body, null);
});

/**
 * في وضع المستأجرين: كل عميل جديد يحصل على وحدة عزل مستقلة
 * (قاعدة/مخطط خاص به) فيصبح مالكاً مستقلاً تماماً.
 */
async function registerForNewTenant(
  req: Request,
  body: { username?: string; fullName?: string; password?: string; role?: string },
): Promise<Response | null> {
  if (!tenantModeEnabled()) return null;
  const unit = await provisionForNewOwner();
  if (!unit || unit.key === "legacy") return null;
  const ctx = { tenant: unit, db: getTenantDb(unit) };
  return await runWithTenant(ctx, () => registerOwner(req, body, unit.key));
}

/** ينشئ الحساب داخل قاعدة المستأجر الحالي */
async function registerOwner(
  req: Request,
  body: { username?: string; fullName?: string; password?: string; role?: string },
  tenantKey: string | null,
): Promise<Response> {
  try {
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
      const headers = new Headers();
      headers.append("Set-Cookie", sessionCookie(token));
      if (tenantKey) headers.append("Set-Cookie", tenantCookie(tenantKey));
      return Response.json({ user, registered: true }, { headers });
    }

    return Response.json({ user, registered: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "تعذر إنشاء الحساب" },
      { status: 500 },
    );
  }
}
