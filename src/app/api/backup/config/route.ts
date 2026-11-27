import { readBackupConfig, backupDir, storageStats, writeBackupConfig, type BackupConfig } from "@/lib/backup";
import { describeDatabase } from "@/lib/backup";
import { requireBackupOwner } from "@/lib/backup-guard";

export const dynamic = "force-dynamic";

function publicView() {
  const c = readBackupConfig();
  const token = c.telegram.token;
  return {
    auto: c.auto,
    dir: c.dir,
    resolvedDir: backupDir(c),
    telegram: {
      enabled: c.telegram.enabled,
      chatId: c.telegram.chatId,
      sendOnAuto: c.telegram.sendOnAuto,
      hasToken: Boolean(token),
      tokenHint: token ? `••••${token.slice(-4)}` : "",
    },
    whatsapp: c.whatsapp,
    lastRunAt: c.lastRunAt,
    lastStatus: c.lastStatus,
    lastFile: c.lastFile,
    database: describeDatabase(),
  };
}

export async function GET(req: Request) {
  const denied = await requireBackupOwner(req);
  if (denied) return denied;
  return Response.json({ ...publicView(), storage: await storageStats() });
}

export async function PUT(req: Request) {
  const denied = await requireBackupOwner(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Partial<{
    auto: Partial<BackupConfig["auto"]>;
    dir: string;
    telegram: Partial<Omit<BackupConfig["telegram"], "token">> & { token?: string };
    whatsapp: { phone?: string };
  }> | null;
  if (!body) return Response.json({ error: "بيانات غير صالحة" }, { status: 400 });

  const current = readBackupConfig();
  const next: BackupConfig = structuredClone(current);

  if (body.auto) {
    const unit = body.auto.unit === "hours" ? "hours" : body.auto.unit === "days" ? "days" : current.auto.unit;
    const every = Math.round(Number(body.auto.every ?? current.auto.every));
    const max = unit === "days" ? 365 : 8760;
    if (!Number.isFinite(every) || every < 1 || every > max) {
      return Response.json({ error: unit === "days" ? "المدة بين 1 و 365 يوم" : "المدة بين 1 و 8760 ساعة" }, { status: 400 });
    }
    next.auto = { enabled: Boolean(body.auto.enabled ?? current.auto.enabled), every, unit };
  }
  if (typeof body.dir === "string") {
    const dir = body.dir.trim();
    if (dir.length > 300) return Response.json({ error: "المسار طويل جداً" }, { status: 400 });
    next.dir = dir;
  }
  if (body.telegram) {
    const t = body.telegram;
    next.telegram = {
      enabled: Boolean(t.enabled ?? current.telegram.enabled),
      token: typeof t.token === "string" && t.token.trim() ? t.token.trim() : current.telegram.token,
      chatId: typeof t.chatId === "string" ? t.chatId.trim() : current.telegram.chatId,
      sendOnAuto: Boolean(t.sendOnAuto ?? current.telegram.sendOnAuto),
    };
    if (next.telegram.enabled && (!next.telegram.token || !next.telegram.chatId)) {
      return Response.json({ error: "لتفعيل تيليجرام لازم التوكن ورقم المحادثة" }, { status: 400 });
    }
  }
  if (body.whatsapp && typeof body.whatsapp.phone === "string") {
    const digits = body.whatsapp.phone.replace(/\D/g, "");
    if (digits && !/^(0\d{9,10}|20\d{9,10}|\d{10,15})$/.test(digits)) {
      return Response.json({ error: "اكتب رقم واتساب صحيح" }, { status: 400 });
    }
    next.whatsapp = { phone: digits };
  }

  writeBackupConfig(next);
  return Response.json({ ok: true, config: publicView() });
}
