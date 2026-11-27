import { productMovements } from "@/lib/stock";
import { guardPermission, isDenied } from "@/lib/permission-guard";

export const dynamic = "force-dynamic";

/** كارت الصنف: حركاته مع الرصيد بعد كل حركة */
export async function GET(req: Request) {
  const guard = await guardPermission(req, ["products", "inventory"]);
  if (isDenied(guard)) return guard;
  const id = Number.parseInt(new URL(req.url).searchParams.get("productId") ?? "", 10);
  if (!Number.isInteger(id)) return Response.json({ error: "رقم الصنف غير صالح" }, { status: 400 });
  const result = await productMovements(id);
  if (!result.product) return Response.json({ error: "الصنف غير موجود" }, { status: 404 });
  return Response.json(result);
}
