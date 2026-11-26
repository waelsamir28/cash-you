import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * ربط قاعدة البيانات: إما سحابية أو محلية. يُحفظ الرابط في ملف على جهاز التشغيل
 * ويُطبَّق بعد إعادة تشغيل البرنامج. إن لم يوجد ملف، يُستخدم متغير البيئة DATABASE_URL.
 */
export type DbMode = "cloud" | "local";
export type DbConfig = { mode: DbMode; url: string };

const DIR = path.join(process.cwd(), ".cash-you");
const FILE = path.join(DIR, "db-config.json");

export function readDbConfig(): DbConfig | null {
  try {
    if (!existsSync(FILE)) return null;
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as Partial<DbConfig>;
    if ((parsed.mode === "cloud" || parsed.mode === "local") && typeof parsed.url === "string" && parsed.url) {
      return { mode: parsed.mode, url: parsed.url };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeDbConfig(config: DbConfig): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(config, null, 2), "utf8");
}

/** الرابط الذي سيُستخدم عند التشغيل التالي (الملف أولاً ثم متغير البيئة) */
export function resolveDatabaseUrl(): { url: string | null; source: "file" | "env" | "none" } {
  const fromFile = readDbConfig();
  if (fromFile) return { url: fromFile.url, source: "file" };
  const env = process.env.DATABASE_URL?.trim();
  if (env) return { url: env, source: "env" };
  return { url: null, source: "none" };
}

/** إخفاء كلمة المرور قبل عرض الرابط */
export function maskDbUrl(url: string): string {
  return url.replace(/:\/\/([^:/@]+):([^@]*)@/, "://$1:••••@");
}
