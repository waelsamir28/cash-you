import { readFileSync } from "node:fs";
import { resolveBackupFile } from "@/lib/backup";
import { requireBackupOwner } from "@/lib/backup-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireBackupOwner(req);
  if (denied) return denied;
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const file = resolveBackupFile(name);
  if (!file) return Response.json({ error: "الملف غير موجود" }, { status: 404 });
  return new Response(readFileSync(file), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
