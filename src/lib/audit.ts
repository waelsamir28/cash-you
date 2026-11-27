import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";

type Writer = Pick<typeof db, "insert">;

/** يسجّل عملية حساسة في سجل النشاط. يُستدعى داخل نفس الترانزاكشن حتى لا تُكتب العملية بدون أثر. */
export async function writeAudit(
  writer: Writer,
  userName: string,
  action: string,
  entity: string,
  reference: string,
  details: string,
): Promise<void> {
  await writer.insert(auditLog).values({ userName, action, entity, reference, details });
}

export async function listAudit(limit = 300) {
  const rows = await db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(limit);
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    userName: row.userName,
    action: row.action,
    entity: row.entity,
    reference: row.reference,
    details: row.details,
  }));
}
