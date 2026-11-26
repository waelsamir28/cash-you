import { Pool } from "pg";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** اختبار الاتصال برابط قاعدة البيانات دون حفظه */
export async function POST(req: Request) {
  const current = await getSessionUser(req);
  if (!current) return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
  if (current.role !== "owner") return Response.json({ error: "للمالك فقط" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { url?: string } | null;
  const url = (body?.url ?? "").trim();
  if (!/^postgres(ql)?:\/\/.+/i.test(url)) return Response.json({ ok: false, error: "الرابط لازم يبدأ بـ postgres://" }, { status: 400 });
  const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000, max: 1 });
  try {
    const res = await pool.query("select version() as v");
    return Response.json({ ok: true, version: String(res.rows[0]?.v ?? "").split(" ").slice(0, 2).join(" ") });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "تعذر الاتصال" }, { status: 400 });
  } finally {
    await pool.end().catch(() => undefined);
  }
}
