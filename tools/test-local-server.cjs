/*
 * اختبار وحدة تشغيل الخادم المحلي (electron/local-server.cjs).
 * يشغّل خادم Next standalone على منفذ محلي، يفحص جاهزيته، ثم يوقفه.
 */
const { startLocalServer, hasLocalServer, stopLocalServer } = require("../electron/local-server.cjs");

(async () => {
  console.log("1) standalone موجود:", hasLocalServer());
  if (!hasLocalServer()) {
    console.log("   (تُخطى اختبارات التشغيل — شغّل tools/build-desktop-assets.cjs أولاً)");
    return;
  }

  const url = "postgresql://waelsamir:secret123@localhost:5432/final_test";
  const started = Date.now();
  const localUrl = await startLocalServer(url);
  console.log("2) رابط الخادم المحلي:", localUrl, `(${Date.now() - started}ms)`);

  if (!localUrl) {
    console.log("   فشل التشغيل — تحقق من سجل الخادم أعلاه");
    stopLocalServer();
    return;
  }

  const health = await fetch(`${localUrl}/api/health`).then((r) => r.json()).catch((e) => ({ error: String(e) }));
  console.log("3) /api/health:", JSON.stringify(health));

  const settings = await fetch(`${localUrl}/api/settings`)
    .then((r) => r.json())
    .then((j) => j.settings?.shopName)
    .catch((e) => `error: ${e}`);
  console.log("4) اسم المحل من القاعدة المحلية:", settings);

  const home = await fetch(localUrl).then((r) => r.status).catch((e) => `error: ${e}`);
  console.log("5) الصفحة الرئيسية HTTP:", home);

  stopLocalServer();
  console.log("6) أُوقف الخادم بنجاح");
})();
