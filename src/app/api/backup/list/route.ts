import { listBackups } from "@/lib/backup";
import { requireBackupOwner } from "@/lib/backup-guard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requireBackupOwner(req);
  if (denied) return denied;
  return Response.json({ backups: listBackups().slice(0, 50) });
}
