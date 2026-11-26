import { setSetting } from "@/lib/data";

export const dynamic = "force-dynamic";

const MAX_LOGO_CHARS = 350_000; // ~256 KB بعد الترميز

/** تحديث بيانات المحل والشعار (تُحفظ في جدول settings). */
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: unknown;
      phone?: unknown;
      address?: unknown;
      logo?: unknown;
    };
    const name = String(body.name ?? "").trim();
    if (!name) return Response.json({ error: "اسم المحل مطلوب" }, { status: 400 });
    const phone = String(body.phone ?? "").trim().slice(0, 30);
    const address = String(body.address ?? "").trim().slice(0, 200);
    const logo = String(body.logo ?? "");
    if (logo && !/^data:image\/(png|jpeg|webp|gif);base64,/.test(logo)) {
      return Response.json({ error: "صيغة الشعار غير مدعومة" }, { status: 400 });
    }
    if (logo.length > MAX_LOGO_CHARS) {
      return Response.json({ error: "حجم الشعار كبير — اختر صورة أصغر" }, { status: 400 });
    }
    await setSetting("shop_name", name.slice(0, 120));
    await setSetting("shop_phone", phone);
    await setSetting("shop_address", address);
    await setSetting("shop_logo", logo);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "تعذر حفظ بيانات المحل" },
      { status: 400 },
    );
  }
}
