/*
 * مزامنة البيانات بين قاعدة محلية وقاعدة سحابية.
 *
 * يعمل على الخادم (Route Handler) لأنه يتعامل مع `pg` مباشرة.
 *
 * body: { action: "sync", direction: "push" | "pull" | "both", localUrl, cloudUrl }
 */
import { syncByUrl } from "@/lib/db-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      direction?: "push" | "pull" | "both";
      localUrl?: string;
      cloudUrl?: string;
    };

    const direction = body.direction === "push" ? "push" : body.direction === "pull" ? "pull" : "both";
    const localUrl = String(body.localUrl ?? "").trim();
    const cloudUrl = String(body.cloudUrl ?? "").trim();

    if (!localUrl || !cloudUrl) {
      return Response.json(
        { ok: false, message: "يلزم رابط القاعدتين: المحلية والسحابية" },
        { status: 400 },
      );
    }
    if (localUrl === cloudUrl) {
      return Response.json(
        { ok: false, message: "الرابطان متطابقان — لا حاجة للمزامنة" },
        { status: 400 },
      );
    }
    for (const [label, url] of [["المحلية", localUrl], ["السحابية", cloudUrl]] as const) {
      if (!/^postgres(ql)?:\/\//i.test(url)) {
        return Response.json(
          { ok: false, message: `رابط القاعدة ${label} يجب أن يبدأ بـ postgresql://` },
          { status: 400 },
        );
      }
    }

    const report = await syncByUrl(localUrl, cloudUrl, direction);
    return Response.json(report, { status: report.ok ? 200 : 500 });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        message: err instanceof Error ? err.message : "تعذّر تنفيذ المزامنة",
        copied: 0,
        pushed: 0,
        pulled: 0,
        details: [],
      },
      { status: 500 },
    );
  }
}
