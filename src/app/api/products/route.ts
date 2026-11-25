import { deleteProduct, upsertProduct, type ProductInput } from "@/lib/operations";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";
import { assertTrialAllows, bumpUsageCounter } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  return withOfflineIdempotency(req, async () => {
    try {
      const body = await req.json();
      if (req.method === "DELETE") {
        await deleteProduct(Number(body.id));
        return Response.json({ ok: true });
      }
      const input = body as ProductInput;
      if (!input.id) await assertTrialAllows("products");
      const saved = await upsertProduct(input);
      if (!input.id) await bumpUsageCounter("products");
      return Response.json(saved);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      /* 23505 = unique_violation في Postgres (الباركود مكرر) */
      const code = (e as { cause?: { code?: string } })?.cause?.code;
      const duplicate =
        code === "23505" ||
        /duplicate key|23505|unique_violation/i.test(raw) ||
        raw.toLowerCase().includes("duplicate");
      const message = duplicate
        ? "هذا الباركود مستخدم لصنف آخر"
        : raw || "تعذر تنفيذ العملية";
      return Response.json({ error: message }, { status: 400 });
    }
  });
}
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
