import { upsertParty, type PartyInput } from "@/lib/operations";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";
import { assertTrialAllows, bumpUsageCounter } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

export const POST = withTenant(async (req: Request) => {
  return withOfflineIdempotency(req, async () => {
    try {
      const body = (await req.json()) as PartyInput & { kind: "customer" | "supplier" };
      const isNew = !body.id;
      if (isNew) await assertTrialAllows(body.kind === "supplier" ? "suppliers" : "customers");
      const saved = await upsertParty(body.kind, body);
      if (isNew) await bumpUsageCounter(body.kind === "supplier" ? "suppliers" : "customers");
      return Response.json(saved);
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "تعذر حفظ البيانات" }, { status: 400 });
    }
  });
});
export const PUT = POST;
