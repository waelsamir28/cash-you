import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { controlPool, controlDb, databaseUrl } from "@/db/control-pool";
import { currentTenantContext, LEGACY_TENANT } from "@/db/tenant-context";
import { getTenantDb } from "@/db/tenant-pool";

/**
 * رابط قاعدة البيانات (لوحة التحكم أو قاعدة العميل حسب السياق).
 *
 * أولوية الرابط:
 *  1) متغير البيئة DATABASE_URL (النشر السحابي / CI / التشغيل المحلي).
 *  2) الرابط المحفوظ من صفحة «ربط قاعدة البيانات»:
 *     - .cash-you-db.json في مجلد العمل (نتيجة الحفظ على السيرفر).
 *     - electron/app-config.json (نفس الشيء لنسخة ويندوز).
 */
export { databaseUrl };

const globalForDb = globalThis as unknown as {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool = controlPool;

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = controlPool;
}

/**
 * قاعدة البيانات النشطة.
 *
 * في وضع المستأجرين المتعددين تكون هذه القاعدة مرتبطة بالسياق الحالي
 * (AsyncLocalStorage) — أي قاعدة العميل الذي أرسل الطلب. خارجه تُستخدم
 * قاعدة لوحة التحكم.
 */
function activeDb(): NodePgDatabase<Record<string, never>> {
  const ctx = currentTenantContext();
  if (ctx) return ctx.db;
  return controlDb;
}

export const db = new Proxy({} as NodePgDatabase<Record<string, never>>, {
  get(_target, prop, receiver) {
    const instance = activeDb();
    const value = Reflect.get(instance as object, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
}) as NodePgDatabase<Record<string, never>>;

/** قاعدة لوحة التحكم — لسجل المستأجرين وعمليات الإدارة فقط */
export { controlDb, controlPool };

/** القاعدة المستخدمة حالياً (للتشخيص) */
export function activeDatabaseUrl(): string {
  const ctx = currentTenantContext();
  if (!ctx) return databaseUrl;
  if (ctx.tenant.kind === "database" && ctx.tenant.dbUrl) return ctx.tenant.dbUrl;
  return `${databaseUrl} (search_path=${ctx.tenant.name})`;
}

export { LEGACY_TENANT };
