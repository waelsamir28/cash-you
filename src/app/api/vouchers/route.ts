import { saveVoucher } from "@/lib/operations";
import { guardPermission, isDenied } from "@/lib/permission-guard";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withOfflineIdempotency(req, async () => {
    const guard = await guardPermission(req, "parties");
    if (isDenied(guard)) return guard;
    try {
      return Response.json(await saveVoucher(await req.json()));
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "تعذر حفظ السند" }, { status: 400 });
    }
  });
}
