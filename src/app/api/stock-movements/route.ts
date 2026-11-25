import { listStockMovements } from "@/lib/data";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

export const GET = withTenant(async (req: Request) => {
  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");
  const rows = await listStockMovements(productId ? Number(productId) : undefined);
  return Response.json({ movements: rows });
});
