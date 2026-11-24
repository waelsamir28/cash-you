import { collectInstallment } from "@/lib/operations";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withOfflineIdempotency(req, async () => {
    try {
      const body = (await req.json()) as { id: number };
      return Response.json(await collectInstallment(Number(body.id)));
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "تعذر تحصيل القسط" }, { status: 400 });
    }
  });
}
