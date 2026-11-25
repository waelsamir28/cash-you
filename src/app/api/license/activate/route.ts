import { activateWithCode, isActivationPlan } from "@/lib/activation";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * تفعيل الفترة التجريبية بكود HMAC-SHA256.
 * متاح للمالك فقط، لأن التفعيل يعدّل ترخيص البرنامج.
 */
export async function POST(req: Request) {
  try {
    const current = await getSessionUser(req);
    if (!current) return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
    if (current.role !== "owner") {
      return Response.json({ error: "التفعيل متاح لحساب المالك فقط" }, { status: 403 });
    }

    const body = (await req.json()) as { code?: string; deviceCode?: string; days?: number };
    const code = String(body.code ?? "").trim();
    const deviceCode = String(body.deviceCode ?? "").trim();
    const days = Number(body.days);

    if (!code) return Response.json({ error: "أدخل كود التفعيل" }, { status: 400 });
    if (!deviceCode) return Response.json({ error: "كود الجهاز مطلوب" }, { status: 400 });
    if (!isActivationPlan(days)) {
      return Response.json({ error: "المدة غير مدعومة" }, { status: 400 });
    }

    const result = await activateWithCode({ code, deviceCode, days });
    if (!result.ok) return Response.json({ error: result.message, reason: result.reason }, { status: 400 });

    return Response.json({
      ok: true,
      message: `تم تفعيل النسخة بنجاح لمدة ${result.days} يوماً.`,
      license: result.license,
      trial: await currentTrial(),
    });
  } catch {
    return Response.json({ error: "تعذر تنفيذ التفعيل" }, { status: 500 });
  }
}

async function currentTrial() {
  const { getTrialStatus } = await import("@/lib/auth");
  return getTrialStatus();
}
