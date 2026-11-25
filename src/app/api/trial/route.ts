import { getTrialStatus } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

export const GET = withTenant(async () => {
  try {
    return Response.json(await getTrialStatus());
  } catch {
    return Response.json({ error: "تعذر قراءة حالة الفترة التجريبية" }, { status: 500 });
  }
});
