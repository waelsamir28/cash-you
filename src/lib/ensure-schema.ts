import { sql } from "drizzle-orm";
import { db } from "@/db";
import { FULL_SCHEMA_SQL } from "@/db/full-schema";

/**
 * الترقية الذاتية لقاعدة البيانات.
 *
 * تُنشئ مخطط كاش يو الكامل (22 جدولاً) إن لم يكن موجوداً، باستخدام
 * `create table if not exists` فقط، فتكون آمنة على قاعدة بيانات قائمة
 * ولا تحذف أو تغيّر أي بيانات موجودة.
 *
 * السبب: نسخة الويندوز تتصل بقاعدة بيانات قد تكون فاضية (أو لم يُشغَّل عليها
 * `npm run db:push`)، فيجب أن يعمل البرنامج من أول طلب بدون خطوات يدوية.
 */
let ensurePromise: Promise<void> | null = null;

async function createSchema(): Promise<void> {
  await db.execute(sql.raw(FULL_SCHEMA_SQL));
}

export function ensureDatabaseSchema(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = createSchema().catch((error) => {
      /* نعيد المحاولة في الطلب التالي بدل تثبيت الفشل */
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

/** اسم قديم محفوظ للتوافق مع بقية الملفات */
export const ensureAuthSchema = ensureDatabaseSchema;
