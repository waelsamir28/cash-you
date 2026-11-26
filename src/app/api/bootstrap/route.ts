import { getBootstrap } from "@/lib/data";
import { withTenant } from "@/lib/tenant-routes";
import { pool } from "@/db";
import { FULL_SCHEMA_SQL } from "@/db/full-schema";

export const dynamic = "force-dynamic";

export const GET = withTenant(async () => {
  try {
    const data = await getBootstrap();
    return Response.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("Failed query")) {
      try {
        await pool.query(FULL_SCHEMA_SQL);
        const data = await getBootstrap();
        return Response.json(data);
      } catch (initErr) {
        return Response.json(
          { error: initErr instanceof Error ? initErr.message : "فشل تهيئة الجداول" },
          { status: 500 },
        );
      }
    }
    return Response.json(
      { error: msg || "خطأ غير معروف" },
      { status: 500 },
    );
  }
});
