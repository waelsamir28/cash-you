import { getInvoiceWithItems } from "@/lib/data";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

export const GET = withTenant(async (_req: Request, ctx: { params: Promise<{ number: string }> }) => {
  const { number } = await ctx.params;
  const data = await getInvoiceWithItems(Number(number));
  if (!data) return Response.json({ error: "الفاتورة غير موجودة" }, { status: 404 });
  return Response.json(data);
});
