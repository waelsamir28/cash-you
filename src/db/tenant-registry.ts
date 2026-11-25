/**
 * سجل المستأجرين — lives في قاعدة لوحة التحكم فقط.
 *
 * كل صف يمثّل عميلاً له وحدة عزل خاصة (قاعدة مستقلة أو مخطط مستقل).
 * هذا السجل هو ما يسمح للبرنامج بمعرفة «أي قاعدة تخص أي متصفح».
 */
import { sql } from "drizzle-orm";
import { controlDb } from "@/db/control-pool";
import { LEGACY_TENANT, type TenantUnit } from "@/db/tenant-context";

const TENANTS_TABLE_SQL = `
create table if not exists "tenants" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_key" text NOT NULL,
  "unit_kind" text NOT NULL DEFAULT 'database',
  "unit_name" text NOT NULL,
  "db_url" text,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL
);
create unique index if not exists "tenants_tenant_key_unique" on "tenants" ("tenant_key");
`;

let ready: Promise<void> | null = null;

/** ينشئ جدول المستأجرين مرة واحدة */
export function ensureTenantsTable(): Promise<void> {
  if (!ready) {
    ready = controlDb
      .execute(sql.raw(TENANTS_TABLE_SQL))
      .then(() => undefined)
      .catch((error) => {
        ready = null;
        throw error;
      });
  }
  return ready;
}

type TenantRow = {
  tenant_key: string;
  unit_kind: string;
  unit_name: string;
  db_url: string | null;
  status: string;
};

function toUnit(row: TenantRow): TenantUnit {
  return {
    key: row.tenant_key,
    kind: row.unit_kind === "schema" ? "schema" : row.unit_kind === "legacy" ? "legacy" : "database",
    name: row.unit_name,
    dbUrl: row.db_url,
  };
}

/** كل المستأجرين المسجّلين */
export async function listTenants(): Promise<TenantUnit[]> {
  await ensureTenantsTable();
  const res = (await controlDb.execute(
    sql.raw(`select tenant_key, unit_kind, unit_name, db_url, status from "tenants" order by id asc`),
  )) as unknown as { rows: TenantRow[] };
  return res.rows.map(toUnit);
}

/** البحث عن مستأجر بمفتاحه */
export async function findTenantByKey(key: string): Promise<TenantUnit | null> {
  if (!key) return null;
  await ensureTenantsTable();
  const res = (await controlDb.execute(
    sql.raw(
      `select tenant_key, unit_kind, unit_name, db_url, status from "tenants" where tenant_key = ${sqlParam(key)} limit 1`,
    ),
  )) as unknown as { rows: TenantRow[] };
  const row = res.rows[0];
  return row ? toUnit(row) : null;
}

/** يحفظ مستأجراً جديداً */
export async function saveTenant(tenant: TenantUnit): Promise<void> {
  await ensureTenantsTable();
  await controlDb.execute(
    sql.raw(
      `insert into "tenants" (tenant_key, unit_kind, unit_name, db_url, status, last_seen_at) ` +
        `values (${sqlParam(tenant.key)}, ${sqlParam(tenant.kind)}, ${sqlParam(tenant.name)}, ` +
        `${tenant.dbUrl ? sqlParam(tenant.dbUrl) : "null"}, 'active', now()) ` +
        `on conflict (tenant_key) do update set unit_kind = excluded.unit_kind, unit_name = excluded.unit_name, ` +
        `db_url = excluded.db_url, last_seen_at = now()`,
    ),
  );
}

/** يحدّث آخر ظهور */
export async function touchTenant(key: string): Promise<void> {
  await ensureTenantsTable();
  await controlDb.execute(
    sql.raw(`update "tenants" set last_seen_at = now() where tenant_key = ${sqlParam(key)}`),
  );
}

/** المستأجر «الأصلي» — قاعدة لوحة التحكم نفسها */
export function legacyTenant(): TenantUnit {
  return LEGACY_TENANT;
}

/** يهرّب قيمة نصية للاستخدام داخل SQL */
function sqlParam(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
