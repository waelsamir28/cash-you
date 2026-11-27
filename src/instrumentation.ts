/**
 * يعمل مع بداية السيرفر قبل قبول أي طلب:
 * 1) في نسخة سطح المكتب المدمجة مع PostgreSQL: ينشئ جداول القاعدة من ملفات الترحيل (idempotent).
 * 2) يشغّل المجدول التلقائي للنسخ الاحتياطية.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.CASH_YOU_BUNDLED_DB === "1") {
    try {
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      const { db } = await import("@/db");
      await migrate(db, { migrationsFolder: process.env.CASH_YOU_MIGRATIONS_DIR || "drizzle" });
    } catch (error) {
      console.error("[cash-you] تعذر تجهيز جداول قاعدة البيانات المدمجة", error);
    }
  }

  try {
    const { backupTick } = await import("@/lib/backup");
    const globalForBackup = globalThis as typeof globalThis & { __cyBackupTimer?: NodeJS.Timeout };
    if (globalForBackup.__cyBackupTimer) return;
    globalForBackup.__cyBackupTimer = setInterval(() => {
      void backupTick();
    }, 60_000);
  } catch {
    /* قاعدة البيانات غير مضبوطة بعد — يعمل البرنامج وتبدأ الجدولة بعد الإعداد */
  }
}
