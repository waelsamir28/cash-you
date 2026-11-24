import { upsertParty, type PartyInput } from "@/lib/operations";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withOfflineIdempotency(req, async () => {
    try {
      const body = (await req.json()) as PartyInput & { kind: "customer" | "supplier" };
      return Response.json(await upsertParty(body.kind, body));
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "تعذر حفظ البيانات" }, { status: 400 });
    }
  });
}
export const PUT = POST;
