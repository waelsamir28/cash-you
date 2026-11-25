/**
 * غلاف مسارات الـ API — يربط كل طلب بقاعدة بيانات العميل.
 *
 * في الوضع العادي (سطح المكتب / نشر واحد) يعمل كل شيء على قاعدة واحدة.
 * في وضع المستأجرين (`CASH_YOU_TENANT_MODE=1`) يُربط كل متصفح بوحدة عزل
 * خاصة به عبر كوكي `cy_tenant` — فكل عميل مالك مستقل بقاعدة مستقلة.
 */
import { sql } from "drizzle-orm";
import { controlDb } from "@/db/control-pool";
import {
  LEGACY_TENANT,
  currentTenantContext,
  runWithTenant,
  tenantModeEnabled,
  type TenantContext,
  type TenantUnit,
} from "@/db/tenant-context";
import { getTenantDb, provisionTenantUnit } from "@/db/tenant-pool";
import { findTenantByKey, touchTenant } from "@/db/tenant-registry";

export const TENANT_COOKIE = "cy_tenant";
const TENANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** يقرأ كوكي من الطلب */
export function readCookie(req: Request, name: string): string {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

/** كوكي تثبيت المستأجر */
export function tenantCookie(key: string): string {
  return `${TENANT_COOKIE}=${encodeURIComponent(key)}; Path=/; Max-Age=${TENANT_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax`;
}

/** يبني سياق مستأجر */
export function tenantContext(tenant: TenantUnit): TenantContext {
  return { tenant, db: getTenantDb(tenant) };
}

/** المستأجر الحالي من الطلب (أو الأساسي إن لم يوجد) */
export async function resolveTenant(req: Request): Promise<TenantUnit> {
  if (!tenantModeEnabled()) return LEGACY_TENANT;
  const key = readCookie(req, TENANT_COOKIE);
  if (!key) return LEGACY_TENANT;
  const tenant = await findTenantByKey(key);
  if (!tenant) return LEGACY_TENANT;
  void touchTenant(key).catch(() => undefined);
  return tenant;
}

/**
 * يلفّ معالج مسار ليعمل داخل سياق مستأجر.
 * المستأجر يُحدَّد من كوكي المتصفح، وإن لم يوجد يُستخدم الأساسي.
 */
export function withTenant<Args extends unknown[]>(
  handler: (req: Request, ...args: Args) => Promise<Response> | Response,
): (req: Request, ...args: Args) => Promise<Response> {
  return async (req: Request, ...args: Args) => {
    const tenant = await resolveTenant(req);
    const ctx = tenantContext(tenant);
    return runWithTenant(ctx, () => handler(req, ...args));
  };
}

/**
 * تسجيل عميل جديد: يضمن له وحدة عزل مستقلة (قاعدة/مخطط خاص به)
 * ثم ينشئ حساب المالك داخلها — فيصبح مالكاً مستقلاً تماماً.
 *
 * لو كان المتصفح مثبّتاً على مستأجر的单位 بلا مستخدمين، يُعاد استخدامه.
 */
export async function provisionForNewOwner(): Promise<TenantUnit> {
  if (!tenantModeEnabled()) return LEGACY_TENANT;

  const ctx = currentTenantContext();
  const current = ctx?.tenant ?? LEGACY_TENANT;

  /* إن كانت وحدة العميل الحالية فارغة من المستخدمين — نستخدمها
     (وهذا يغطي أول زائر على نشر جديد: يصبح مالك القاعدة الأساسية) */
  const users = await countUsers(current);
  if (users === 0) return current;

  /* وحدة العميل الأساسية فيها مستخدمون (أنت) — نُنشئ وحدة جديدة للعميل */
  const unit = await provisionTenantUnit();
  return unit;
}

/** عدد المستخدمين في وحدة عزل */
export async function countUsers(tenant: TenantUnit): Promise<number> {
  const instance = getTenantDb(tenant);
  try {
    const res = (await instance.execute(
      sql.raw(`select count(*)::int as c from "app_users"`),
    )) as unknown as { rows?: { c: number }[] };
    return res.rows?.[0]?.c ?? 0;
  } catch {
    /* الجدول غير موجود بعد — نعتبرها فارغة */
    return 0;
  }
}

/** هل يوجد مستخدمون في القاعدة الأساسية؟ (للتشخيص) */
export async function legacyHasUsers(): Promise<boolean> {
  try {
    const res = (await controlDb.execute(
      sql.raw(`select count(*)::int as c from "app_users"`),
    )) as unknown as { rows?: { c: number }[] };
    return (res.rows?.[0]?.c ?? 0) > 0;
  } catch {
    return false;
  }
}
