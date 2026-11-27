import { listAudit } from "@/lib/audit";
import { guardPermission, isDenied } from "@/lib/permission-guard";

export const dynamic = "force-dynamic";

/** سجل النشاط — يتطلب صلاحية «سجل النشاط» */
export async function GET(req: Request) {
  const guard = await guardPermission(req, "audit");
  if (isDenied(guard)) return guard;
  return Response.json({ rows: await listAudit(300) });
}
