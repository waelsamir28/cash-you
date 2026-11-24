import { addExpense, closeShift } from "@/lib/operations";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === "closeShift") return Response.json(await closeShift(body.notes));
    return Response.json(await addExpense(body));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "تعذر تنفيذ العملية" }, { status: 400 });
  }
}