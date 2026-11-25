import type { NextConfig } from "next";

/**
 * بناء standalone مطلوب لنسخة ويندوز:
 * ينتج مجلد .next/standalone فيه خادم Next جاهز يعمل بـ `node server.js`
 * على جهاز العميل — وهو ما يتيح تشغيل «قاعدة محلية» على جهاز العميل نفسه.
 *
 * نُفعّله عبر متغير بيئة في نسخة ويندوز فقط، حتى لا يتأثر النشر السحابي.
 */
const nextConfig: NextConfig = {
  output: process.env.CASH_YOU_STANDALONE === "1" ? "standalone" : undefined,
};

export default nextConfig;
