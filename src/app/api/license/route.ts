import { readLicense } from "@/lib/activation";
import { getSessionUser, getTrialStatus } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

/**
 * حالة الترخيص الحالية للنسخة (للعرض فقط).
 * ⚠️ لا يُعاد أبداً كود التفعيل المتوقع: إرجاعه من الخادم يجعل أي شخص
 * قادراً على توليد كود صالح دون المفتاح السري.
 */
export const GET = withTenant(async (req: Request) => {
  try {
    const current = await getSessionUser(req);
    if (!current) return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401 });

    const [trial, license] = await Promise.all([getTrialStatus(), readLicense()]);
    return Response.json({ trial, license });
  } catch {
    return Response.json({ error: "تعذر قراءة حالة الترخيص" }, { status: 500 });
  }
});
