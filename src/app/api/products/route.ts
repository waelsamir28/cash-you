import { deleteProduct, upsertProduct, type ProductInput } from "@/lib/operations";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";

export const dynamic = "force-dynamic";

async function handle(req: Request) {
  return withOfflineIdempotency(req, async () => {
    try {
      const body = await req.json();
      if (req.method === "DELETE") {
        await deleteProduct(Number(body.id));
        return Response.json({ ok: true });
      }
      return Response.json(await upsertProduct(body as ProductInput));
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      const message = raw.toLowerCase().includes("duplicate") ? "هذا الباركود مستخدم لصنف آخر" : raw || "تعذر تنفيذ العملية";
      return Response.json({ error: message }, { status: 400 });
    }
  });
}
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
