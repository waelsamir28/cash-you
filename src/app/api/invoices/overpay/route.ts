import { settleOverpay } from "@/lib/data";
import { withOfflineIdempotency } from "@/lib/offline-idempotency";

export const dynamic = "force-dynamic";

/**
 * معالجة دفع العميل مبلغاً أكبر من قيمة الفاتورة.
 *
 * - `handOver` (تسليم الباقي نقداً): لا يُعدَّل رصيد العميل — يُخرج مبلغ من الخزينة.
 * - `credit`   (تنزيل من حسابه): يُخصم الباقي من مديونية العميل السابقة.
 */
export async function POST(req: Request) {
  return withOfflineIdempotency(req, async () => {
    try {
      const body = (await req.json()) as {
        invoiceNumber?: number;
        action?: "handOver" | "credit";
        amount?: number;
      };
      const invoiceNumber = Number(body.invoiceNumber);
      if (!Number.isInteger(invoiceNumber) || invoiceNumber <= 0) {
        return Response.json({ error: "رقم الفاتورة غير صالح" }, { status: 400 });
      }
      if (body.action !== "handOver" && body.action !== "credit") {
        return Response.json({ error: "اختر طريقة معالجة الباقي" }, { status: 400 });
      }
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return Response.json({ error: "قيمة الباقي غير صالحة" }, { status: 400 });
      }
      const saved = await settleOverpay({
        invoiceNumber,
        action: body.action,
        amount,
      });
      return Response.json(saved);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "تعذر معالجة الباقي" },
        { status: 400 },
      );
    }
  });
}
