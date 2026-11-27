import { db } from "@/db";
import { guardPermission, isDenied } from "@/lib/permission-guard";
import { asc } from "drizzle-orm";
import { customers } from "@/db/schema";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(customers).orderBy(asc(customers.id));
  return Response.json(rows);
}

export async function POST(req: Request) {
  return withOfflineIdempotency(req, async () => {
    const guard = await guardPermission(req, ["sales", "parties"]);
    if (isDenied(guard)) return guard;
    try {
      const body = (await req.json()) as { name?: string; phone?: string; balance?: number };
      const name = (body.name ?? "").trim();
      if (!name) return Response.json({ error: "اسم العميل مطلوب" }, { status: 400 });
      const inserted = await db.insert(customers).values({ name, phone: (body.phone ?? "").trim(), balance: Number(body.balance ?? 0) || 0 }).returning();
      return Response.json(inserted[0]);
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : "تعذر إضافة العميل" }, { status: 500 });
    }
  });
}
