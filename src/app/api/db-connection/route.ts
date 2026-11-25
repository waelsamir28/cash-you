/*
 * ربط قاعدة البيانات: اختبار الاتصال + حفظ الإعدادات محلياً.
 *
 * هذا المسار يعمل على الخادم فقط (Route Handler) — لذلك يستورد `pg` بأمان.
 * (لو استُورد `pg` من مكوّن عميل لأُسحب net/dns/fs إلى حزمة المتصفح وفشل البناء.)
 *
 * الحفظ:
 *  - نسخة الويندوز  → ملف على جهاز العميل (عبر جسر Electron) — لا يصل إلى أي سيرفر.
 *  - نسخة الويب متعددة المستأجرين → داخل قاعدة العميل نفسه (settings) — حتى لا
 *    يتشارك عملاء مختلفون رابط قاعدة سحابية واحدة من ملف مشترك على السيرفر.
 *  - نسخة الويب/التطوير (قاعدة واحدة) → .cash-you-db.json (احتياطي).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { tenantModeEnabled } from "@/db/tenant-context";
import { db } from "@/db";
import { settings as settingsTable } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Mode = "cloud" | "local";

const CONFIG_PATH = path.join(process.cwd(), "electron", "app-config.json");
const FALLBACK_PATH = path.join(process.cwd(), ".cash-you-db.json");

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "••••";
    return `${u.protocol}//${u.username ? `${u.username}:••••@` : ""}${u.host}${u.pathname}`;
  } catch {
    return "••••";
  }
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** مفتاح حفظ رابط قاعدة العميل داخل جدول إعدادات العميل */
const TENANT_DB_URL_KEY = "db.tenantUrl";

/** يقرأ الرابط المحفوظ داخل قاعدة العميل (وضع المستأجرين) */
async function readTenantSaved(): Promise<string> {
  try {
    const rows = await db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, TENANT_DB_URL_KEY))
      .limit(1);
    return rows[0]?.value ?? "";
  } catch {
    return "";
  }
}

/** يحفظ الرابط داخل قاعدة العميل (وضع المستأجرين) */
async function saveTenantUrl(url: string): Promise<string | null> {
  try {
    await db
      .insert(settingsTable)
      .values({ key: TENANT_DB_URL_KEY, value: url })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: url } });
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "تعذر الحفظ داخل قاعدة العميل";
  }
}

async function readSaved(): Promise<{ mode: Mode; url: string } | null> {
  /* في وضع المستأجرين: الرابط داخل قاعدة العميل — لا ملف مشترك */
  if (tenantModeEnabled()) {
    const url = await readTenantSaved();
    if (url) return { mode: "cloud", url };
    return null;
  }
  for (const file of [CONFIG_PATH, FALLBACK_PATH]) {
    const json = await readJson(file);
    /* مفاتيح منفصلة: "url" في app-config.json هو رابط الموقع وليس قاعدة البيانات */
    const url = typeof json.dbUrl === "string" ? json.dbUrl : "";
    if (url) return { mode: json.dbMode === "local" ? "local" : "cloud", url };
  }
  return null;
}

/** تحويل أخطاء `pg` إلى رسالة عربية مفهومة */
function describeError(err: unknown): string {
  const codes: string[] = [];
  const texts: string[] = [];
  const collect = (e: unknown) => {
    if (!e || typeof e !== "object") return;
    const rec = e as { code?: unknown; message?: unknown; errors?: unknown };
    if (typeof rec.code === "string") codes.push(rec.code);
    if (typeof rec.message === "string" && rec.message) texts.push(rec.message);
    if (Array.isArray(rec.errors)) rec.errors.forEach(collect);
  };
  collect(err);
  const blob = [...codes, ...texts].join(" | ");

  if (/ECONNREFUSED/i.test(blob)) return "رفض الاتصال — تأكد أن الخادم يعمل والمنفذ صحيح";
  if (/ENOTFOUND|EAI_AGAIN/i.test(blob)) return "تعذر الوصول للمضيف — تحقق من عنوان الخادم";
  if (/timeout|ETIMEDOUT/i.test(blob)) return "انتهت المهلة — تحقق من الرابط والإنترنت";
  if (/password authentication failed/i.test(blob)) return "كلمة المرور غير صحيحة";
  if (/does not exist/i.test(blob)) return "اسم قاعدة البيانات غير موجود";
  if (/ECONNRESET/i.test(blob)) return "انقطع الاتصال — تحقق من الشبكة أو جدار الحماية";
  const detail = texts[0] || codes[0] || "غير معروف";
  return `تعذر الاتصال: ${detail}`;
}

/** اختبار اتصال حقيقي بقاعدة البيانات */
async function testConnection(url: string): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const started = Date.now();
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    await client.query("select 1");
    const latencyMs = Date.now() - started;
    return { ok: true, message: "الاتصال ناجح — تم الوصول لقاعدة البيانات", latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const message = describeError(err);
    return { ok: false, message, latencyMs };
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** حفظ الرابط مع الحفاظ على باقي مفاتيح ملف التهيئة */
async function saveConfig(mode: Mode, url: string): Promise<string[]> {
  const notes: string[] = [];
  const existing = await readJson(CONFIG_PATH);
  try {
    await writeFile(CONFIG_PATH, `${JSON.stringify({ ...existing, dbMode: mode, dbUrl: url }, null, 2)}\n`, "utf8");
  } catch {
    notes.push("تعذر الكتابة على ملف إعدادات النسخة المكتبية");
  }
  try {
    await writeFile(FALLBACK_PATH, `${JSON.stringify({ dbMode: mode, dbUrl: url }, null, 2)}\n`, "utf8");
  } catch {
    notes.push("تعذر الكتابة على ملف الإعداد الاحتياطي");
  }
  return notes;
}

export async function GET() {
  try {
    const saved = await readSaved();
    return Response.json({
      saved: Boolean(saved),
      mode: saved?.mode ?? "cloud",
      maskedUrl: saved ? maskUrl(saved.url) : "",
    });
  } catch {
    return Response.json({ saved: false, mode: "cloud", maskedUrl: "" });
  }
}

/** body: { action: "test" | "save", mode: "cloud" | "local", url: string } */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { action?: "test" | "save"; mode?: Mode; url?: string };
    const url = String(body.url ?? "").trim();
    const mode: Mode = body.mode === "local" ? "local" : "cloud";
    const action = body.action === "save" ? "save" : "test";

    if (!url) return Response.json({ ok: false, message: "أدخل رابط الاتصال أولاً" }, { status: 400 });
    if (!/^postgres(ql)?:\/\//i.test(url)) {
      return Response.json({ ok: false, message: "الرابط يجب أن يبدأ بـ postgresql://" }, { status: 400 });
    }

    const test = await testConnection(url);
    if (action === "test") {
      return Response.json({ ok: test.ok, message: test.message, latencyMs: test.latencyMs });
    }

    if (!test.ok) {
      return Response.json({ ok: false, message: `لم يتم الحفظ — ${test.message}`, latencyMs: test.latencyMs });
    }

    /* في وضع المستأجرين: نخزّن الرابط داخل قاعدة العميل نفسه */
    if (tenantModeEnabled()) {
      const note = await saveTenantUrl(url);
      return Response.json({
        ok: true,
        saved: true,
        message: note
          ? `تم الحفظ — ${note}`
          : "تم حفظ الرابط داخل قاعدة بياناتك — لن يراه أي عميل آخر",
        latencyMs: test.latencyMs,
        note,
      });
    }

    const notes = await saveConfig(mode, url);
    /* الوضع المحلي على الويب لا يكفي — الاختبار يتم من السيرفر البعيد،
       لذا قاعدة «localhost» على جهاز العميل لا يراها هذا السيرفر.
       نسخة ويندوز تحفظ وتختبر محلياً عبر جسر Electron. */
    const localHint =
      mode === "local"
        ? " (قاعدة محلية على جهازك تحتاج نسخة ويندوز — في الويب يُختبر الاتصال من السيرفر)"
        : "";
    return Response.json({
      ok: true,
      saved: true,
      message: notes.length
        ? `تم الحفظ — ${notes[0]}${localHint}`
        : `تم الحفظ — أعد تشغيل البرنامج ليعمل بالاتصال الجديد${localHint}`,
      latencyMs: test.latencyMs,
      note: notes[0] ?? null,
    });
  } catch (err) {
    return Response.json(
      { ok: false, message: err instanceof Error ? err.message : "تعذر تنفيذ العملية" },
      { status: 500 },
    );
  }
}
