import { getSessionUser, type PublicUser } from "@/lib/auth";
import { can, type ScreenKey } from "@/lib/permissions";

/**
 * يتحقق من أن الطلب من حساب مسجّل ولديه صلاحية واحدة على الأقل من الشاشات المطلوبة.
 * يُعيد بيانات الحساب، أو استجابة خطأ (401/403) جاهزة للإرجاع مباشرة.
 */
export async function guardPermission(req: Request, key: ScreenKey | ScreenKey[]): Promise<PublicUser | Response> {
  const user = await getSessionUser(req);
  if (!user) return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
  const keys = Array.isArray(key) ? key : [key];
  if (!keys.some((k) => can(user, k))) return Response.json({ error: "ليس لديك صلاحية لهذه الشاشة" }, { status: 403 });
  return user;
}

export function isDenied(value: PublicUser | Response): value is Response {
  return value instanceof Response;
}
