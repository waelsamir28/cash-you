import { sql } from "drizzle-orm";
import { db } from "@/db";
import { FULL_SCHEMA_SQL } from "@/db/full-schema";
import { currentTenantContext } from "@/db/tenant-context";
import { CUSTOMER_IDENTITY_KEY } from "@/lib/customer-identity";

/**
 * الترقية الذاتية لقاعدة البيانات.
 *
 * تُنشئ مخطط كاش يو الكامل (22 جدولاً) إن لم يكن موجوداً، باستخدام
 * `create table if not exists` فقط، فتكون آمنة على قاعدة بيانات قائمة
 * ولا تحذف أو تغيّر أي بيانات موجودة.
 *
 * السبب: نسخة الويندوز تتصل بقاعدة بيانات قد تكون فاضية (أو لم يُشغَّل عليها
 * `npm run db:push`)، فيجب أن يعمل البرنامج من أول طلب بدون خطوات يدوية.
 *
 * في وضع المستأجرين المتعددين: كل وحدة عزل لها ذاكرة إنشاء منفصلة،
 * فقاعدة العميل الجديد تُنشأ تلقائياً عند أول طلب له.
 */
const ensured = new Map<string, Promise<void>>();

function tenantKey(): string {
  return currentTenantContext()?.tenant.key ?? "control";
}

async function createSchema(): Promise<void> {
  await db.execute(sql.raw(FULL_SCHEMA_SQL));
  await ensureCustomerIdentity();
}

/**
 * يضمن وجود بصمة هوية العميل داخل قاعدة العميل.
 *
 * البصمة تميّز قاعدة العميل عن غيرها، وتُستخدم لمنع المزامنة من نقل
 * الحسابات والإعدادات (ومنها حالة التجربة والترخيص) بين عملاء مختلفين.
 *
 * - وحدة عزل في السحابة: البصمة هي مفتاح الوحدة نفسه (مصدر موثوق).
 * - قاعدة محلية على جهاز العميل: **لا** تُكتب لها بصمة قبل أول مزامنة،
 *   فتبنّي بصمة قاعدة العميل السحابية — وبذلك تُربط قاعدتاه ببعضهما،
 *   وتُرفض أي محاولة لمزامنة قاعدة عميل آخر.
 */
export async function ensureCustomerIdentity(): Promise<string | null> {
  const tenant = currentTenantContext()?.tenant;
  const expected = tenant && tenant.kind !== "legacy" ? tenant.key : null;

  const rows = (await db.execute(
    sql.raw(`select value from settings where key = '${CUSTOMER_IDENTITY_KEY}' limit 1`),
  )) as unknown as { rows?: { value: string }[] };
  const current = rows.rows?.[0]?.value;

  if (current && current.trim()) return current.trim();

  /* قاعدة محلية: ننتظر أول مزامنة لتثبيت البصمة */
  if (!expected) return null;

  await db.execute(
    sql.raw(
      `insert into settings (key, value) values ('${CUSTOMER_IDENTITY_KEY}', '${expected}')
       on conflict (key) do update set value = excluded.value`,
    ),
  );
  return expected;
}

export function ensureDatabaseSchema(): Promise<void> {
  const key = tenantKey();
  const cached = ensured.get(key);
  if (cached) return cached;

  const promise = createSchema().catch((error) => {
    /* نعيد المحاولة في الطلب التالي بدل تثبيت الفشل */
    ensured.delete(key);
    throw error;
  });
  ensured.set(key, promise);
  return promise;
}

/** اسم قديم محفوظ للتوافق مع بقية الملفات */
export const ensureAuthSchema = ensureDatabaseSchema;
