import { saveVoucher } from "@/lib/operations";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withOfflineIdempotency(req, async () => {
    try {
      return Response.json(await saveVoucher(await req.json()));
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : "تعذر حفظ السند" }, { status: 400 });
    }
  });
}
