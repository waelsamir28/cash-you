import { createSnapshot } from "@/lib/backup";
import { requireBackupOwner } from "@/lib/backup-guard";

export const dynamic = "force-dynamic";

/** تصدير نسخة كاملة كملف JSON يتنزل على جهاز المستخدم */
export async function GET(req: Request) {
  const denied = await requireBackupOwner(req);
  if (denied) return denied;
  try {
    const snapshot = await createSnapshot();
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const name = `cash-you-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-manual.json`;
    return new Response(JSON.stringify(snapshot), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "تعذر التصدير" }, { status: 500 });
  }
}
