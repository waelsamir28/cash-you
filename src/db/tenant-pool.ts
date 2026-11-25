/**
 * وحدات العزل لكل عميل.
 *
 * عند تسجيل عميل جديد نُنشئ له وحدة عزل تلقائياً:
 *  1) **قاعدة مستقلة** على نفس خادم PostgreSQL (`CREATE DATABASE`) — الأفضل.
 *  2) **مخطط مستقل** داخل نفس القاعدة (`CREATE SCHEMA`) — حين لا يسمح الخادم
 *     بإنشاء قواعد جديدة (مثل Neon) — فيبقى كل عميل في مخطط خاص به.
 *
 * في الحالتين: بيانات العميل وحساباته وتجارته وترخيصه لا تختلط بغيره.
 */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, Client } from "pg";
import { controlPool, controlDb, getDatabaseUrl } from "@/db/control-pool";
import {
  LEGACY_TENANT,
  tenantUnitPreference,
  type TenantUnit,
} from "@/db/tenant-context";
import { saveTenant } from "@/db/tenant-registry";

/** بركة الاتصال لكل وحدة عزل (مفهرسة بالمفتاح) */
const pools = new Map<string, Pool>();
const dbs = new Map<string, NodePgDatabase<Record<string, never>>>();

/** يولّد مفتاح مستأجر عشوائي */
function randomKey(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `t${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * هل هذا الخادم يسمح بإنشاء قواعد جديدة؟
 *
 * الافتراضي: قاعدة مستقلة — وهي ما يضمن عزل كل عميل.
 * إن لم يسمح الخادم (مثل بعض الخدمات السحابية المُدارة) نتراجع إلى مخطط
 * مستقل داخل نفس القاعدة — وهو يحفظ العزل نفسه بين العملاء.
 */
async function canCreateDatabase(): Promise<boolean> {
  if (tenantUnitPreference() === "schema") return false;
  try {
    const res = await controlPool.query("select current_setting('server_version_num') as v");
    return res.rows.length > 0;
  } catch {
    return false;
  }
}

/** ينشئ قاعدة مستقلة على نفس الخادم */
async function createDatabaseUnit(key: string): Promise<TenantUnit> {
  const name = `cash_you_${key}`;
  const url = new URL(getDatabaseUrl());
  url.pathname = `/${name}`;
  /* CREATE DATABASE لا يعمل داخل معاملة — نستخدم اتصالاً مستقلاً */
  const admin = new Client({ connectionString: getDatabaseUrl() });
  try {
    await admin.connect();
    await admin.query(`create database "${name}"`);
  } finally {
    await admin.end().catch(() => undefined);
  }
  return { key, kind: "database", name, dbUrl: url.toString() };
}

/** ينشئ مخططاً مستقلاً داخل القاعدة نفسها */
async function createSchemaUnit(key: string): Promise<TenantUnit> {
  const name = `tenant_${key}`;
  await controlDb.execute(`create schema if not exists "${name}"`);
  return { key, kind: "schema", name, dbUrl: null };
}

/** ينشئ وحدة عزل جديدة ويحفظها في السجل */
export async function provisionTenantUnit(): Promise<TenantUnit> {
  const key = randomKey();
  let unit: TenantUnit;
  if (await canCreateDatabase()) {
    try {
      unit = await createDatabaseUnit(key);
    } catch (error) {
      /* الخادم لا يسمح بقواعد جديدة (Neon مثلاً) — نستخدم مخططاً مستقلاً */
      const message = error instanceof Error ? error.message : String(error);
      if (tenantUnitPreference() === "database") {
        /* الطلب الصريح: قاعدة مستقلة أو لا شيء */
        throw new Error(`تعذّر إنشاء قاعدة العميل: ${message}`);
      }
      console.warn(
        `[tenant] تعذّر إنشاء قاعدة مستقلة (${message}) — تم استخدام مخطط مستقل بدلاً منها`,
      );
      unit = await createSchemaUnit(key);
    }
  } else {
    unit = await createSchemaUnit(key);
  }
  await saveTenant(unit);
  return unit;
}

/** بركة الاتصال لوحدة عزل */
export function getTenantPool(tenant: TenantUnit): Pool {
  if (tenant.kind === "legacy") return controlPool;
  const cached = pools.get(tenant.key);
  if (cached) return cached;

  const pool =
    tenant.kind === "database" && tenant.dbUrl
      ? new Pool({ connectionString: tenant.dbUrl })
      : new Pool({
          connectionString: getDatabaseUrl(),
          /* المخطط الخاص بالعميل فقط — لا نضيف public، لأن وجود جداول
             العميل الأساسي في public يمنع إنشاء جداول العميل ويختل العزل. */
          options: `-c search_path=${tenant.name}`,
        });
  pools.set(tenant.key, pool);
  return pool;
}

/**
 * خيارات الاتصال بوحدة عزل — تُستخدم عند الحاجة لاتصال `pg` مباشر
 * (مثل المزامنة) خارج Drizzle.
 */
export function tenantConnectionOptions(tenant: TenantUnit): {
  connectionString: string;
  options?: string;
} {
  if (tenant.kind === "database" && tenant.dbUrl) {
    return { connectionString: tenant.dbUrl };
  }
  if (tenant.kind === "schema") {
    return {
      connectionString: getDatabaseUrl(),
      options: `-c search_path=${tenant.name}`,
    };
  }
  return { connectionString: getDatabaseUrl() };
}

/** نسخة Drizzle لوحدة عزل */
export function getTenantDb(tenant: TenantUnit): NodePgDatabase<Record<string, never>> {
  if (tenant.kind === "legacy") return drizzle(controlPool);
  const cached = dbs.get(tenant.key);
  if (cached) return cached;
  const instance = drizzle(getTenantPool(tenant));
  dbs.set(tenant.key, instance);
  return instance;
}

/** إغلاق كل الأحواض (عند الإيقاف) */
export async function closeTenantPools(): Promise<void> {
  await Promise.all([...pools.values()].map((pool) => pool.end().catch(() => undefined)));
  pools.clear();
  dbs.clear();
}

export { LEGACY_TENANT };
