import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, statfsSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pool } from "@/db";
import { resolveDatabaseUrl } from "@/lib/db-config";

/* ============================ الإعدادات ============================ */

export type BackupConfig = {
  auto: { enabled: boolean; every: number; unit: "hours" | "days" };
  /** مجلد حفظ النسخ — فاضي يعني المجلد الافتراضي */
  dir: string;
  telegram: { enabled: boolean; token: string; chatId: string; sendOnAuto: boolean };
  whatsapp: { phone: string };
  lastRunAt: string | null;
  lastStatus: string;
  lastFile: string | null;
};

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  auto: { enabled: false, every: 1, unit: "days" },
  dir: "",
  telegram: { enabled: false, token: "", chatId: "", sendOnAuto: false },
  whatsapp: { phone: "" },
  lastRunAt: null,
  lastStatus: "لم تُنفَّذ أي نسخة بعد",
  lastFile: null,
};

const STATE_DIR = path.join(process.cwd(), ".cash-you");
const CONFIG_FILE = path.join(STATE_DIR, "backup-config.json");
const DEFAULT_DIR = path.join(STATE_DIR, "backups");
const AUTO_KEEP = 30;

export function backupDir(config = readBackupConfig()): string {
  const dir = config.dir.trim() || DEFAULT_DIR;
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function readBackupConfig(): BackupConfig {
  try {
    if (!existsSync(CONFIG_FILE)) return structuredClone(DEFAULT_BACKUP_CONFIG);
    const parsed = JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as Partial<BackupConfig>;
    return {
      ...structuredClone(DEFAULT_BACKUP_CONFIG),
      ...parsed,
      auto: { ...DEFAULT_BACKUP_CONFIG.auto, ...(parsed.auto ?? {}) },
      telegram: { ...DEFAULT_BACKUP_CONFIG.telegram, ...(parsed.telegram ?? {}) },
      whatsapp: { ...DEFAULT_BACKUP_CONFIG.whatsapp, ...(parsed.whatsapp ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_BACKUP_CONFIG);
  }
}

export function writeBackupConfig(config: BackupConfig): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf8");
}

export function intervalMs(auto: BackupConfig["auto"]): number {
  return auto.every * (auto.unit === "days" ? 24 * 60 * 60_000 : 60 * 60_000);
}

/* ============================ الجداول ============================ */

/**
 * الجداول التي تُنسخ. الجلسات وعدّادات التجربة لا تُنسخ أبداً،
 * وإعدادات التفعيل والتجربة تبقى كما هي على الجهاز عند الاسترداد.
 */
export const BACKUP_TABLES = [
  "app_users",
  "settings",
  "categories",
  "payment_methods",
  "customers",
  "suppliers",
  "products",
  "invoices",
  "invoice_items",
  "purchases",
  "purchase_items",
  "returns",
  "return_items",
  "vouchers",
  "installment_plans",
  "installments",
  "expenses",
  "treasury_movements",
  "shifts",
  "offline_sync_receipts",
] as const;

const PROTECTED_SETTING_PREFIXES = ["license.", "trial."];

function isProtectedSetting(key: string): boolean {
  return PROTECTED_SETTING_PREFIXES.some((p) => key.startsWith(p));
}

/* الأعمدة الزمنية تُقرأ كنص خام كما هي في القاعدة (بدون تحويل المنطقة الزمنية) */
const RAW_TYPES = {
  getTypeParser: () => (v: string) => v,
};

async function existingTables(client: Pick<typeof pool, "query">): Promise<Set<string>> {
  const res = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public'",
  );
  return new Set((res.rows as { table_name: string }[]).map((r) => r.table_name));
}

/* ============================ التصدير ============================ */

export type Snapshot = {
  app: "cash-you";
  version: 1;
  createdAt: string;
  /** بصمة SHA-256 لمحتوى الجداول: تكشف أي تلف أو تعديل للملف قبل الاسترداد */
  checksum?: string;
  tables: Record<string, Record<string, unknown>[]>;
};

export function tablesChecksum(tables: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(tables)).digest("hex");
}

export async function createSnapshot(): Promise<Snapshot> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const present = await existingTables(pool);
  for (const name of BACKUP_TABLES) {
    if (!present.has(name)) continue;
    const res = await pool.query({ text: `select * from "${name}"`, types: RAW_TYPES as never });
    tables[name] = res.rows as Record<string, unknown>[];
  }
  return { app: "cash-you", version: 1, createdAt: new Date().toISOString(), checksum: tablesChecksum(tables), tables };
}

/* ============================ الاسترداد ============================ */

export function validateSnapshot(input: unknown): Snapshot {
  if (!input || typeof input !== "object") throw new Error("ملف النسخة غير صالح");
  const s = input as Partial<Snapshot>;
  if (s.app !== "cash-you" || !s.tables || typeof s.tables !== "object") {
    throw new Error("هذا الملف ليس نسخة احتياطية من كاش يو");
  }
  for (const [name, rows] of Object.entries(s.tables)) {
    if (!(BACKUP_TABLES as readonly string[]).includes(name)) throw new Error(`جدول غير معروف في النسخة: ${name}`);
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) {
      throw new Error(`بيانات الجدول ${name} غير صالحة`);
    }
  }
  if (s.checksum !== undefined && s.checksum !== tablesChecksum(s.tables)) {
    throw new Error("ملف النسخة تالف أو تم تعديله، لم يتم الاسترداد");
  }
  return s as Snapshot;
}

/** حجم القاعدة والمساحة الفاضية على الجهاز لمكان النسخ */
export async function storageStats(): Promise<{ databaseBytes: number | null; diskFreeBytes: number | null; diskTotalBytes: number | null }> {
  let databaseBytes: number | null = null;
  try {
    const res = await pool.query<{ size: string }>("select pg_database_size(current_database())::text as size");
    databaseBytes = Number(res.rows[0]?.size ?? 0);
  } catch {
    databaseBytes = null;
  }
  let diskFreeBytes: number | null = null;
  let diskTotalBytes: number | null = null;
  try {
    const fs = statfsSync(backupDir());
    diskFreeBytes = Number(fs.bavail) * Number(fs.bsize);
    diskTotalBytes = Number(fs.blocks) * Number(fs.bsize);
  } catch {
    /* المساحة غير متاحة على هذا النظام */
  }
  return { databaseBytes, diskFreeBytes, diskTotalBytes };
}

/** يستبدل بيانات القاعدة بالنسخة في معاملة واحدة، ويحتفظ بإعدادات التفعيل والتجربة الحالية */
export async function restoreSnapshot(snapshot: Snapshot): Promise<Record<string, number>> {
  const client = await pool.connect();
  const counts: Record<string, number> = {};
  try {
    await client.query("begin");
    const present = await existingTables(client);
    const targets = BACKUP_TABLES.filter((t) => present.has(t));

    // الإعدادات: نحذف غير المحمي فقط، ونحتفظ بمفاتيح التجربة والتفعيل الحالية
    if (present.has("settings") && snapshot.tables.settings) {
      await client.query(
        `delete from "settings" where not (${PROTECTED_SETTING_PREFIXES.map((_, i) => `"key" like $${i + 1}`).join(" or ")})`,
        PROTECTED_SETTING_PREFIXES.map((p) => `${p}%`),
      );
    }

    // بقية الجداول: تفريغ كامل ثم إدخال النسخة بالترتيب
    const truncate = targets.filter((t) => t !== "settings");
    if (truncate.length) {
      await client.query(`truncate ${truncate.map((t) => `"${t}"`).join(", ")} restart identity`);
    }
    // الجلسات الحالية تُلغى لأن أرقام المستخدمين قد تختلف بعد الاسترداد
    if (present.has("app_sessions")) await client.query('delete from "app_sessions"');

    for (const name of targets) {
      let rows = snapshot.tables[name] ?? [];
      if (name === "settings") rows = rows.filter((r) => !isProtectedSetting(String(r.key ?? "")));
      counts[name] = rows.length;
      if (!rows.length) continue;
      await client.query(
        `insert into "${name}" select * from json_populate_recordset(null::"${name}", $1::json)`,
        [JSON.stringify(rows)],
      );
    }

    // ضبط عدّادات الترقيم التلقائي بعد الإدخال بأرقام محددة
    for (const name of targets) {
      if (name === "settings") continue;
      // بعض الجداول ليس لها عمود id (مثل offline_sync_receipts)، فنتحقق من وجوده أولاً
      const hasId = await client.query(
        "select 1 from information_schema.columns where table_schema = 'public' and table_name = $1 and column_name = 'id'",
        [name],
      );
      if (!hasId.rowCount) continue;
      const seq = await client.query<{ s: string | null }>("select pg_get_serial_sequence($1, 'id') as s", [`"${name}"`]);
      const s = seq.rows[0]?.s;
      if (s) await client.query(`select setval($1, coalesce((select max("id") from "${name}"), 0) + 1, false)`, [s]);
    }

    await client.query("commit");
    return counts;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/* ============================ ملفات النسخ ============================ */

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export const BACKUP_NAME_RE = /^cash-you-backup-\d{8}-\d{6}-(auto|manual|pre-restore)\.json$/;

export function listBackups(): { name: string; size: number; createdAt: string }[] {
  const dir = backupDir();
  return readdirSync(dir)
    .filter((n) => BACKUP_NAME_RE.test(n))
    .map((name) => {
      const st = statSync(path.join(dir, name));
      return { name, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function resolveBackupFile(name: string): string | null {
  if (!BACKUP_NAME_RE.test(name)) return null;
  const file = path.join(backupDir(), name);
  return existsSync(file) ? file : null;
}

export async function writeSnapshotFile(kind: "auto" | "manual" | "pre-restore"): Promise<{ name: string; file: string; bytes: number }> {
  const snapshot = await createSnapshot();
  const name = `cash-you-backup-${stamp()}-${kind}.json`;
  const file = path.join(backupDir(), name);
  const text = JSON.stringify(snapshot);
  writeFileSync(file, text, "utf8");
  return { name, file, bytes: Buffer.byteLength(text) };
}

function pruneAuto(): void {
  const autos = listBackups().filter((b) => b.name.endsWith("-auto.json"));
  for (const old of autos.slice(AUTO_KEEP)) {
    try {
      unlinkSync(path.join(backupDir(), old.name));
    } catch {
      /* ملف مفتوح أو محذوف بالفعل */
    }
  }
}

/* ============================ تيليجرام ============================ */

export async function sendTelegramBackup(token: string, chatId: string, file: string, caption: string): Promise<void> {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append("document", new Blob([readFileSync(file)], { type: "application/json" }), path.basename(file));
  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, { method: "POST", body: form });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
  if (!res.ok || !json?.ok) throw new Error(json?.description ?? `تعذر الإرسال إلى تيليجرام (${res.status})`);
}

/* ============================ تنفيذ النسخة ============================ */

export async function runBackup(
  kind: "auto" | "manual",
  opts: { sendTelegram: boolean },
): Promise<{ name: string; bytes: number; telegram: "sent" | "skipped"; telegramError?: string }> {
  const config = readBackupConfig();
  const made = await writeSnapshotFile(kind);
  let telegram: "sent" | "skipped" = "skipped";
  let telegramError: string | undefined;
  if (opts.sendTelegram) {
    if (!config.telegram.token || !config.telegram.chatId) {
      telegramError = "أدخل توكن البوت ورقم المحادثة أولاً";
    } else {
      try {
        await sendTelegramBackup(
          config.telegram.token,
          config.telegram.chatId,
          made.file,
          `نسخة كاش يو — ${new Date().toLocaleString("ar-EG")}`,
        );
        telegram = "sent";
      } catch (error) {
        telegramError = error instanceof Error ? error.message : "تعذر الإرسال إلى تيليجرام";
      }
    }
  }
  if (kind === "auto") pruneAuto();
  const latest = readBackupConfig();
  const status = telegramError
    ? `تم حفظ النسخة، لكن تيليجرام: ${telegramError}`
    : telegram === "sent"
      ? "تم حفظ النسخة وإرسالها لتيليجرام"
      : "تم حفظ النسخة";
  writeBackupConfig({ ...latest, lastRunAt: new Date().toISOString(), lastStatus: status, lastFile: made.name });
  return { name: made.name, bytes: made.bytes, telegram, telegramError };
}

/* ============================ الجدولة التلقائية ============================ */

export async function backupTick(): Promise<void> {
  const config = readBackupConfig();
  if (!config.auto.enabled) return;
  const last = config.lastRunAt ? Date.parse(config.lastRunAt) : 0;
  if (Date.now() - last < intervalMs(config.auto)) return;
  try {
    await runBackup("auto", { sendTelegram: config.telegram.enabled && config.telegram.sendOnAuto });
  } catch (error) {
    writeBackupConfig({
      ...readBackupConfig(),
      lastRunAt: new Date().toISOString(),
      lastStatus: `فشلت النسخة التلقائية: ${error instanceof Error ? error.message : "خطأ غير معروف"}`,
    });
  }
}

/* ============================ معلومات القاعدة للعرض ============================ */

export type DatabaseInfo = {
  engine: string;
  mode: "cloud" | "local" | null;
  source: "file" | "env" | "bundled" | "none";
  host: string;
  port: string;
  database: string;
  /** مكان البيانات: مجلد القاعدة المدمجة، أو عنوان الخادم السحابي */
  location: string;
  maskedUrl: string | null;
};

/* معلومات القاعدة للعرض: نوعها واسمها ومكانها وهل هي محلية أم سحابية */
export function describeDatabase(): DatabaseInfo {
  const bundled = process.env.CASH_YOU_BUNDLED_DB === "1";
  const { url, source: rawSource } = resolveDatabaseUrl();
  const fileMode = rawSource === "file" ? readModeFromFile() : null;
  const source: DatabaseInfo["source"] = rawSource === "env" && bundled ? "bundled" : rawSource;
  const mode: DatabaseInfo["mode"] = fileMode ?? (source === "bundled" ? "local" : null);
  const base = { engine: "PostgreSQL", mode, source, host: "—", port: "—", database: "—", location: "—", maskedUrl: null };
  if (!url) return base;
  try {
    const u = new URL(url);
    const host = u.hostname;
    const isLocal = host === "127.0.0.1" || host === "localhost";
    return {
      ...base,
      host,
      port: u.port || "5432",
      database: decodeURIComponent(u.pathname.replace(/^\//, "")) || "—",
      location: source === "bundled" && process.env.CASH_YOU_DATA_DIR ? process.env.CASH_YOU_DATA_DIR : isLocal ? `${host}:${u.port || "5432"}` : host,
      maskedUrl: url.replace(/:\/\/([^:/@]+):([^@]*)@/, "://$1:••••@"),
    };
  } catch {
    return base;
  }
}

function readModeFromFile(): "cloud" | "local" | null {
  try {
    const file = path.join(STATE_DIR, "db-config.json");
    if (!existsSync(file)) return null;
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { mode?: string };
    return parsed.mode === "cloud" || parsed.mode === "local" ? parsed.mode : null;
  } catch {
    return null;
  }
}
