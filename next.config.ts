import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // نسخة سطح المكتب تُبنى كخادم مستقل (standalone) يشغّله Electron محلياً؛ الموقع المنشور لا يتغير.
  ...(process.env.CASH_YOU_DESKTOP_BUILD === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
