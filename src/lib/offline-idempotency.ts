import { db } from "@/db";
import { offlineSyncReceipts } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Persist results for requests replayed from the offline outbox so retrying a
 * network-interrupted sync does not create duplicate business documents. */
export async function withOfflineIdempotency(req: Request, run: () => Promise<Response>): Promise<Response> {
  const operationId = req.headers.get("X-Cash-You-Offline-Operation");
  if (!operationId || operationId.length > 100) return run();

  const existing = await db.select().from(offlineSyncReceipts).where(eq(offlineSyncReceipts.operationId, operationId)).limit(1);
  if (existing[0]) {
    return Response.json(JSON.parse(existing[0].responseBody), { status: existing[0].status });
  }

  const response = await run();
  if (!response.ok) return response;
  const responseBody = await response.clone().text();
  await db.insert(offlineSyncReceipts).values({ operationId, responseBody, status: response.status }).onConflictDoNothing();
  return response;
}
