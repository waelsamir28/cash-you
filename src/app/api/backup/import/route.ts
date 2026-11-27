import { restoreSnapshot, validateSnapshot, writeSnapshotFile } from "@/lib/backup";
import { requireBackupOwner } from "@/lib/backup-guard";

export const dynamic = "force-dynamic";

/** استرداد نسخة: بيعمل نسخة أمان الأول، وبعدين يستبدل البيانات */
export async function POST(req: Request) {
  const denied = await requireBackupOwner(req);
  if (denied) return denied;
  try {
    const snapshot = validateSnapshot(await req.json());
    const safety = await writeSnapshotFile("pre-restore");
    const counts = await restoreSnapshot(snapshot);
    return Response.json({ ok: true, safetyFile: safety.name, counts });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "تعذر الاسترداد" }, { status: 400 });
  }
}
