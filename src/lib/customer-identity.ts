/**
 * هوية العميل — بصمة ثابتة تميّز كل عميل عن غيره.
 *
 * لماذا؟
 * لأن المزامنة بين قاعدة العميل على جهازه وقاعدته في السحابة يجب ألّا تنقل
 * حسابات المستخدمين أو الإعدادات (وبالتالي حالة الفترة التجريبية والترخيص)
 * من عميل إلى عميل آخر. فكل قاعدة عميل تحمل بصمة، ولا تُنسخ الحسابات والإعدادات
 * إلا إذا تطابقت البصمتان.
 *
 * البصمة تُخزَّن في جدول `settings` تحت المفتاح `customer.identity`:
 *  - في السحابة: تُولَّد مرة واحدة عند إنشاء وحدة عزل العميل.
 *  - على جهاز العميل: تُنسخ من السحابة عند أول مزامنة ناجحة.
 */
import type { Client } from "pg";

/** مفتاح تخزين البصمة في جدول الإعدادات */
export const CUSTOMER_IDENTITY_KEY = "customer.identity";

/** يولّد بصمة عشوائية جديدة */
export function newCustomerIdentity(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `c_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** يقرأ بصمة العميل من قاعدة بيانات (عبر عميل pg) */
export async function readCustomerIdentity(client: Client): Promise<string | null> {
  try {
    const res = await client.query(
      `SELECT value FROM settings WHERE key = $1 LIMIT 1`,
      [CUSTOMER_IDENTITY_KEY],
    );
    const value = res.rows?.[0]?.value;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    /* الجدول غير موجود — نعتبرها قاعدة بلا بصمة */
    return null;
  }
}

/** يكتب بصمة العميل في قاعدة بيانات (عبر عميل pg) */
export async function stampCustomerIdentity(client: Client, identity: string): Promise<void> {
  await client.query(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [CUSTOMER_IDENTITY_KEY, identity],
  );
}

/** عدد المستخدمين في قاعدة بيانات —用来 لتمييز «قاعدة فارغة» عن «قاعدة عميل آخر» */
export async function countOwners(client: Client): Promise<number> {
  try {
    const res = await client.query(`SELECT count(*)::int AS c FROM app_users`);
    return res.rows?.[0]?.c ?? 0;
  } catch {
    return 0;
  }
}
