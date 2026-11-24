import { db } from "@/db";
import { asc } from "drizzle-orm";
import { paymentMethods } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(paymentMethods).orderBy(asc(paymentMethods.id));
  return Response.json(rows);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string };
    const name = (body.name ?? "").trim();
    if (!name) {
      return Response.json({ error: "اسم طريقة الدفع مطلوب" }, { status: 400 });
    }
    const inserted = await db.insert(paymentMethods).values({ name }).returning();
    return Response.json(inserted[0]);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "تعذر إضافة طريقة الدفع" },
      { status: 500 },
    );
  }
}