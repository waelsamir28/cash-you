import { addExpense, closeShift } from "@/lib/operations";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

export const POST = withTenant(async (req: Request) => {
  return withOfflineIdempotency(req, async () => {
    try {
      const body = await req.json();
      if (body.action === "closeShift") return Response.json(await closeShift(body.notes));
      return Response.json(await addExpense(body));
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "تعذر تنفيذ العملية" }, { status: 400 });
    }
  });
});
