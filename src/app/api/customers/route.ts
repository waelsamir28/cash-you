import { db } from "@/db";
import { asc } from "drizzle-orm";
import { customers } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(customers).orderBy(asc(customers.id));
  return Response.json(rows);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; phone?: string; balance?: number };
    const name = (body.name ?? "").trim();
    if (!name) {
      return Response.json({ error: "اسم العميل مطلوب" }, { status: 400 });
    }
    const inserted = await db
      .insert(customers)
      .values({
        name,
        phone: (body.phone ?? "").trim(),
        balance: Number(body.balance ?? 0) || 0,
      })
      .returning();
    return Response.json(inserted[0]);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "تعذر إضافة العميل" },
      { status: 500 },
    );
  }
}