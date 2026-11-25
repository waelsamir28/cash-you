/*
 * مزامنة البيانات بين قاعدة العميل على جهازه وقاعدته في السحابة.
 *
 * يعمل على الخادم (Route Handler) لأنه يتعامل مع `pg` مباشرة.
 *
 * body: { action: "sync", localUrl }
 *
 * قواعد العزل:
 *  - في وضع المستأجرين: القاعدة السحابية تُحدَّد من جلسة العميل الحالية —
 *    لا يستطيع العميل توجيه مزامنته إلى قاعدة عميل آخر.
 *  - البصمة (customer.identity) تُقارن بين القاعدتين: إن اختلفتا امتنع
 *    نقل الحسابات والإعدادات، وإن اختلفت القاعدة السحابية عن عميل الجلسة
 *    رُفضت العملية كلها.
 */
import { syncByUrl } from "@/lib/db-sync";
import { withTenant } from "@/lib/tenant-routes";
import { currentTenantContext, tenantModeEnabled } from "@/db/tenant-context";
import { tenantConnectionOptions } from "@/db/tenant-pool";
import { ensureDatabaseSchema } from "@/lib/ensure-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withTenant(async (req: Request) => {
  try {
    const body = (await req.json()) as {
      action?: string;
      localUrl?: string;
      cloudUrl?: string;
    };

    const localUrl = String(body.localUrl ?? "").trim();
    if (!localUrl) {
      return Response.json(
        { ok: false, message: "يلزم رابط القاعدة المحلية" },
        { status: 400 },
      );
    }
    if (!/^postgres(ql)?:\/\//i.test(localUrl)) {
      return Response.json(
        { ok: false, message: "رابط القاعدة المحلية يجب أن يبدأ بـ postgresql://" },
        { status: 400 },
      );
    }

    /* في وضع المستأجرين: القاعدة السحابية = قاعدة عميلنا نحن، لا غير */
    let cloudUrl = String(body.cloudUrl ?? "").trim();
    let expectedIdentity: string | null = null;
    let cloudOptions: { options?: string } | undefined;

    if (tenantModeEnabled()) {
      const tenant = currentTenantContext()?.tenant;
      if (!tenant || tenant.kind === "legacy") {
        return Response.json(
          { ok: false, message: "لا توجد قاعدة سحابية مرتبطة بحسابك" },
          { status: 400 },
        );
      }
      await ensureDatabaseSchema();
      const options = tenantConnectionOptions(tenant);
      cloudUrl = options.connectionString;
      cloudOptions = options.options ? { options: options.options } : undefined;
      expectedIdentity = tenant.key;
    } else {
      if (!cloudUrl) {
        return Response.json(
          { ok: false, message: "يلزم رابط القاعدة السحابية" },
          { status: 400 },
        );
      }
      if (!/^postgres(ql)?:\/\//i.test(cloudUrl)) {
        return Response.json(
          { ok: false, message: "رابط القاعدة السحابية يجب أن يبدأ بـ postgresql://" },
          { status: 400 },
        );
      }
    }

    if (localUrl === cloudUrl) {
      return Response.json(
        { ok: false, message: "الرابطان متطابقان — لا حاجة للمزامنة" },
        { status: 400 },
      );
    }

    const report = await syncByUrl(localUrl, cloudUrl, "both", expectedIdentity, cloudOptions);
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
});
