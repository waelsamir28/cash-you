import { getSetting, setSetting } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { mergeSettings, type ShopSettings } from "@/lib/settings";
import { withTenant } from "@/lib/tenant-routes";

export const dynamic = "force-dynamic";

const KEY = "app.settings.v1";

/** قراءة إعدادات البرنامج (تُدمج مع الافتراضية دائماً) */
export const GET = withTenant(async () => {
  try {
    const raw = await getSetting(KEY, "");
    let parsed: unknown = null;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    return Response.json({ settings: mergeSettings(parsed) });
  } catch {
    return Response.json({ error: "تعذر قراءة الإعدادات" }, { status: 500 });
  }
});

/** حفظ الإعدادات — للمالك فقط */
export const PUT = withTenant(async (req: Request) => {
  try {
    const current = await getSessionUser(req);
    if (!current) return Response.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
    if (current.role !== "owner") {
      return Response.json({ error: "تعديل الإعدادات متاح للمالك فقط" }, { status: 403 });
    }

    const body = (await req.json()) as Partial<ShopSettings>;
    const merged = mergeSettings(body);

    /* حد أقصى لحجم الشعار حتى لا تتضخم قاعدة البيانات */
    if (merged.shopLogo.length > 700_000) {
      return Response.json({ error: "حجم الشعار كبير جداً — استخدم صورة أصغر من 500 كيلوبايت" }, { status: 400 });
    }

    await setSetting(KEY, JSON.stringify(merged));

    /* مزامنة بيانات المحل مع المفاتيح القديمة حتى تظهر في الفاتورة فوراً */
    await setSetting("shop_name", merged.shopName);
    await setSetting("shop_phone", merged.shopPhone);

    return Response.json({ ok: true, settings: merged });
  } catch {
    return Response.json({ error: "تعذر حفظ الإعدادات" }, { status: 500 });
  }
});
