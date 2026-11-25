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
 *
 * ملاحظة: نسخة ويندوز تمرّر الرابط عبر متغير البيئة عند تشغيل خادمها المحلي،
 * لذلك لا حاجة لقراءة الملفات في تلك الحالة — لكن القراءة تبقى احتياطاً
 * مفيداً عند تشغيل الخادم محلياً بدون متغيرات بيئة.
 */
function savedDatabaseUrl(): string {
  const files = [
    path.join(process.cwd(), ".cash-you-db.json"),
    path.join(process.cwd(), "electron", "app-config.json"),
  ];
  for (const file of files) {
    try {
      const json = JSON.parse(readFileSync(file, "utf8")) as { dbUrl?: unknown };
      if (typeof json.dbUrl === "string" && json.dbUrl.trim()) return json.dbUrl.trim();
    } catch {
      /* الملف غير موجود أو غير صالح */
    }
  }
  return "";
}

const databaseUrl = process.env.DATABASE_URL?.trim() || savedDatabaseUrl();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
