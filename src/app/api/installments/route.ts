import { collectInstallment } from "@/lib/operations";
import { guardPermission, isDenied } from "@/lib/permission-guard";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withOfflineIdempotency(req, async () => {
    const guard = await guardPermission(req, "installments");
    if (isDenied(guard)) return guard;
    try {
      const body = (await req.json()) as { id: number };
      return Response.json(await collectInstallment(Number(body.id)));
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "تعذر تحصيل القسط" }, { status: 400 });
    }
  });
}
