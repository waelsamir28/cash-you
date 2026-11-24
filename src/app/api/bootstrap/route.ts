import { getBootstrap } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getBootstrap();
    return Response.json(data);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "خطأ غير معروف" },
      { status: 500 },
    );
  }
}