import { applyStockCount, type CountLine } from "@/lib/stock";
import { guardPermission, isDenied } from "@/lib/permission-guard";

export const dynamic = "force-dynamic";

/** اعتماد الجرد: الرصيد الفعلي لكل صنف، ويُحسب الفرق على الرصيد الحالي وقت الحفظ */
export async function POST(req: Request) {
  const guard = await guardPermission(req, "inventory");
  if (isDenied(guard)) return guard;
  try {
    const body = (await req.json()) as { lines?: CountLine[] };
    const lines = Array.isArray(body.lines) ? body.lines : [];
    if (lines.length === 0) return Response.json({ error: "لا توجد أصناف في الجرد" }, { status: 400 });
    if (lines.length > 5000) return Response.json({ error: "عدد الأصناف في الجرد كبير جداً" }, { status: 400 });
    return Response.json({ ok: true, ...(await applyStockCount(lines, guard.fullName)) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "تعذر حفظ الجرد" }, { status: 400 });
  }
}
