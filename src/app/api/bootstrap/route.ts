import { getBootstrap } from "@/lib/data";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

export const GET = withTenant(async () => {
  try {
    const data = await getBootstrap();
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "خطأ غير معروف" },
      { status: 500 },
    );
  }
});