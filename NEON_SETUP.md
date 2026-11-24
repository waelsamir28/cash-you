# ربط CASH YOU بقاعدة Neon

1. أنشئ قاعدة PostgreSQL في Neon، وانسخ **Pooled connection string** من لوحة Neon.
2. انسخ `.env.example` إلى `.env.local`، وضع الرابط في `DATABASE_URL` مع `sslmode=require`.
3. أنشئ الجداول على قاعدة Neon:

   ```bash
   npm run db:push
   ```

4. شغّل التطبيق محليًا:

   ```bash
   npm run dev
   ```

5. عند نشر Next.js، أضف `DATABASE_URL` كمتغير بيئة خاص في إعدادات الاستضافة. لا تضع الرابط في كود المتصفح، ولا ترفع `.env.local` إلى Git.

> اتصال Neon يتم من خادم Next.js فقط، ولا يُرسل رابط قاعدة البيانات إلى واجهة المتصفح. في تطبيق Windows تُحفظ نسخة عمل محلية في IndexedDB وتُضاف العمليات المنفذة دون اتصال إلى طابور مزامنة؛ تُرسل بالتتابع عند عودة الاتصال. لهذا السبب يلزم تشغيل `npm run db:push` بعد إضافة مخطط `offline_sync_receipts` قبل استخدام المزامنة.
