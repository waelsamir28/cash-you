import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * الترقية الذاتية لقاعدة البيانات:
 * تُنشئ جداول الحسابات والجلسات وعدّادات الفترة التجريبية إن لم تكن موجودة.
 * آمنة للتشغيل المتكرر (IF NOT EXISTS) وتعمل على قواعد بيانات قائمة قبل التحديث.
 */
let ensurePromise: Promise<void> | null = null;

async function createTables(): Promise<void> {
  await db.execute(sql`
    create table if not exists "app_users" (
      "id" serial primary key,
      "username" text not null unique,
      "full_name" text not null,
      "password_hash" text not null,
      "role" text not null default 'owner',
      "created_at" timestamp not null default now(),
      "last_login_at" timestamp
    )
  `);
  await db.execute(sql`
    create table if not exists "app_sessions" (
      "token" text primary key,
      "user_id" integer not null,
      "created_at" timestamp not null default now(),
      "expires_at" timestamp not null default now()
    )
  `);
  await db.execute(sql`
    create table if not exists "usage_counters" (
      "key" text primary key,
      "count" integer not null default 0,
      "updated_at" timestamp not null default now()
    )
  `);
}

export function ensureAuthSchema(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = createTables().catch((error) => {
      /* نعيد المحاولة في الطلب التالي بدل تثبيت الفشل */
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}
