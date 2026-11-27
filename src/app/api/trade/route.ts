import { saveTrade, type TradeInput } from "@/lib/operations";
import { guardPermission, isDenied } from "@/lib/permission-guard";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withOfflineIdempotency(req, async () => {
    const preview = (await req.clone().json().catch(() => ({}))) as { kind?: string };
    const guard = await guardPermission(req, preview.kind === "salesReturn" ? "sales" : "purchases");
    if (isDenied(guard)) return guard;
    try {
      const body = (await req.json()) as TradeInput;
      return Response.json(await saveTrade(body));
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "تعذر حفظ المستند" }, { status: 400 });
    }
  });
}
