import { getTrialStatus } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getTrialStatus());
  } catch {
    return Response.json({ error: "تعذر قراءة حالة الفترة التجريبية" }, { status: 500 });
  }
}
