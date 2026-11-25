import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * رابط قاعدة البيانات.
 *
 * الأولوية:
 *  1) متغير البيئة DATABASE_URL (النشر السحابي / CI / التشغيل المحلي).
 *  2) الرابط المحفوظ من صفحة «ربط قاعدة البيانات»:
 *     - .cash-you-db.json في مجلد العمل (نتيجة الحفظ على السيرفر).
 *     - electron/app-config.json (نفس الشيء لنسخة ويندوز).
 */
function savedDatabaseUrl(): string {
  /* مسارات ثابتة داخل مجلد التطبيق — لتفادي تتبع المشروع كاملاً عند البناء */
  const files = [
    path.join(process.cwd(), ".cash-you-db.json"),
    path.join(process.cwd(), "electron", "app-config.json"),
  ];
  for (const file of files) {
    try {
      const json = JSON.parse(
        readFileSync(/*turbopackIgnore: true*/ file, "utf8"),
      ) as { dbUrl?: unknown };
      if (typeof json.dbUrl === "string" && json.dbUrl.trim()) return json.dbUrl.trim();
    } catch {
      /* الملف غير موجود أو غير صالح */
    }
  }
  return "";
}

const savedUrl = savedDatabaseUrl();

/**
 * رابط قاعدة البيانات كما هو (قد يكون فارغاً وقت البناء).
 * لا نرمي خطأً هنا حتى ينجح بناء المشروع دون سلسلة اتصال.
 */
export const databaseUrl = process.env.DATABASE_URL?.trim() || savedUrl;

/** رابط قاعدة البيانات الفعّال — يُحلّ عند أول استخدام حقيقي */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim() || savedUrl;
  if (!url) throw new Error("DATABASE_URL is required");
  return url;
}

const globalForDb = globalThis as unknown as {
  __arenaNextJsPostgresqlPool?: Pool;
};

/**
 * حوض الاتصال بالقاعدة الأساسية (لوحة التحكم).
 *
 * يُنشأ eagerly لأن بقية الوحدات تعتمد عليه، لكن لا يتصل بأي خادم إلا عند
 * أول استعلام — فلا يفشل البناء ولا التشغيل المبكر.
 */
export const controlPool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl || "postgresql://localhost:5432/postgres",
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = controlPool;
}

/** نسخة Drizzle للقاعدة الأساسية — تُستخدم لسجل المستأجرين فقط */
export const controlDb = drizzle(controlPool);
