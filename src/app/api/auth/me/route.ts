import { getSessionUser, getTrialStatus, listUsers } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

/** يُستخدم عند فتح التطبيق: هل هناك جلسة صالحة؟ + حالة الفترة التجريبية. */
export const GET = withTenant(async (req: Request) => {
  try {
    const user = await getSessionUser(req);
    const trial = await getTrialStatus();
    const users = user?.role === "owner" ? await listUsers() : undefined;
    return Response.json({ user, trial, users });
  } catch {
    return Response.json({ user: null, trial: null, users: undefined });
  }
});
