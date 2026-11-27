import { addExpense, closeShift } from "@/lib/operations";
import { guardPermission, isDenied } from "@/lib/permission-guard";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withOfflineIdempotency(req, async () => {
    const preview = (await req.clone().json().catch(() => ({}))) as { action?: string };
    const guard = await guardPermission(req, preview.action === "closeShift" ? "treasury" : "expenses");
    if (isDenied(guard)) return guard;
    try {
      const body = await req.json();
      if (body.action === "closeShift") return Response.json(await closeShift(body.notes));
      return Response.json(await addExpense(body));
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "تعذر تنفيذ العملية" }, { status: 400 });
    }
  });
}
