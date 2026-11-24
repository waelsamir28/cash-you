import { saveVoucher } from "@/lib/operations";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    return Response.json(await saveVoucher(await req.json()));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "تعذر حفظ السند" }, { status: 400 });
  }
}