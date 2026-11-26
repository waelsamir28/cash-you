import { getSessionUser } from "@/lib/auth";
import { maskDbUrl, readDbConfig, resolveDatabaseUrl, writeDbConfig, type DbMode } from "@/lib/db-config";

export const dynamic = "force-dynamic";

async function requireOwner(req: Request): Promise<Response | null> {
  const current = await getSessionUser(req);
  if (!current) return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
  if (current.role !== "owner") return Response.json({ error: "إعدادات قاعدة البيانات للمالك فقط" }, { status: 403 });
  return null;
}

/** حالة الربح الحالية (بدون كشف كلمة المرور) */
export async function GET(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const saved = readDbConfig();
  const active = resolveDatabaseUrl();
  return Response.json({
    saved: saved ? { mode: saved.mode, maskedUrl: maskDbUrl(saved.url) } : null,
    active: active.url ? { maskedUrl: maskDbUrl(active.url), source: active.source } : null,
  });
}

/** حفظ الرابط — يُطبَّق بعد إعادة تشغيل البرنامج */
export async function PUT(req: Request) {
  const denied = await requireOwner(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { mode?: string; url?: string } | null;
  const mode = body?.mode;
  const url = (body?.url ?? "").trim();
  if (mode !== "cloud" && mode !== "local") return Response.json({ error: "اختر نوع الربط: سحابي أو محلي" }, { status: 400 });
  if (!/^postgres(ql)?:\/\/.+/i.test(url)) return Response.json({ error: "الرابط لازم يبدأ بـ postgres://" }, { status: 400 });
  if (mode === "local" && !/(localhost|127\.0\.0\.1|::1)/i.test(url)) {
    return Response.json({ error: "الربط المحلي لازم يشير إلى الجهاز نفسه (localhost أو 127.0.0.1)" }, { status: 400 });
  }
  writeDbConfig({ mode: mode as DbMode, url });
  return Response.json({ ok: true, restartRequired: true });
}
