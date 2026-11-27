import { runBackup } from "@/lib/backup";
import { requireBackupOwner } from "@/lib/backup-guard";

export const dynamic = "force-dynamic";

/** نسخة فورية محفوظة على الجهاز، ويمكن إرسالها لتيليجرام في نفس الوقت */
export async function POST(req: Request) {
  const denied = await requireBackupOwner(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { sendTelegram?: boolean };
  try {
    const result = await runBackup("manual", { sendTelegram: Boolean(body.sendTelegram) });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "تعذر تنفيذ النسخة" }, { status: 500 });
  }
}
