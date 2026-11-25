import { saveTrade, type TradeInput } from "@/lib/operations";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

export const POST = withTenant(async (req: Request) => {
  return withOfflineIdempotency(req, async () => {
    try {
      const body = (await req.json()) as TradeInput;
      return Response.json(await saveTrade(body));
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "تعذر حفظ المستند" }, { status: 400 });
    }
  });
});
