/**
 * سياق المستأجر (Tenant) — يسمح لكل طلب أن يعمل على قاعدة بيانات مستقلة.
 *
 * الفكرة: «كل عميل مالك مستقل» — لكل عميل على النسخة السحابية قاعدة بيانات
 * خاصة به (أو مخطط خاص به داخل نفس الخادم)، فلا تتشارك البيانات ولا الفترة
 * التجريبية ولا الترخيص ولا حساب المالك.
 *
 * mechanism: AsyncLocalStorage — نضع سياق المستأجر مرة واحدة عند بداية الطلب،
 * ثم تستخدم كل خدمات البرنامج `db` فتصل تلقائياً لقاعدة المستأجر الحالي.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export type TenantKind = "legacy" | "database" | "schema";

export type TenantUnit = {
  /** مفتاح المستأجر — يُحفظ في كوكي المتصفح */
  key: string;
  /** نوع العزل */
  kind: TenantKind;
  /** اسم القاعدة أو المخطط داخل الخادم */
  name: string;
  /** رابط اتصال خاص (قاعدة مستقلة) أو null للمخططات */
  dbUrl: string | null;
};

export type TenantContext = {
  tenant: TenantUnit;
  db: NodePgDatabase<Record<string, never>>;
};

/** قاعدة المستأجر «الأصلي» — هي قاعدة لوحة التحكم نفسها */
export const LEGACY_TENANT: TenantUnit = {
  key: "legacy",
  kind: "legacy",
  name: "public",
  dbUrl: null,
};

const storage = new AsyncLocalStorage<TenantContext>();

/** ينفّذ الدالة داخل سياق مستأجر محدد */
export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** سياق المستأجر الحالي (إن وُجد) */
export function currentTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/**
 * هل وضع المستأجرين مفعل؟
 *
 * الوضع **مفعل افتراضياً** على النسخ السحابية: كل عميل يحصل على قاعدة بيانات
 * مستقلة تلقائياً، فلا تتشارك البيانات ولا الحسابات ولا حالة التجربة.
 *
 * يُعطَّل فقط في الحالات التي تكون فيها قاعدة واحدة مقصودة:
 *  - `CASH_YOU_TENANT_MODE=0` — نسخة ويندوز المحلية (قاعدة واحدة على جهاز
 *    العميل نفسه) وخوادم التطوير والاختبار.
 */
export function tenantModeEnabled(): boolean {
  const raw = process.env.CASH_YOU_TENANT_MODE?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  return true;
}

/** هل وحدة العزل تُنشأ كقاعدة مستقلة (الأفضل) أم كمخطط داخل القاعدة؟ */
export function tenantUnitPreference(): "database" | "schema" {
  const raw = process.env.CASH_YOU_TENANT_UNIT?.trim().toLowerCase();
  return raw === "schema" ? "schema" : "database";
}

export type { PostgresJsDatabase };
