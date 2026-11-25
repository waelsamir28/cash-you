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

  const url =
    process.env.LOCAL_TEST_DB_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/final_test";
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

  /* الأصول الثابتة لازم تُخدَم — وإلا ظهرت الصفحة بلا تنسيق ولا سكربتات */
  const html = await fetch(localUrl).then((r) => r.text()).catch(() => "");
  const chunk = html.match(/_next\/static\/chunks\/[^"']+?\.(?:js|css)/)?.[0];
  if (chunk) {
    const url = `${localUrl}/${chunk.replace(/^\//, "")}`;
    const asset = await fetch(url).then((r) => r.status).catch(() => 0);
    console.log("6) الأصل الثابت:", chunk, "->", asset);
    if (asset !== 200) console.log("   ✗ الأصول الثابتة لا تُخدَم من الخادم المحلي");
  } else {
    console.log("6) لم يُعثر على أصل ثابت في الصفحة");
  }

  /* وضع المستأجرين يجب أن يكون معطّلاً على الخادم المحلي */
  const tenants = await fetch(`${localUrl}/api/bootstrap`)
    .then((r) => r.text())
    .then((t) => t.length)
    .catch(() => 0);
  console.log("7) استجابة bootstrap:", tenants, "بايت");

  stopLocalServer();
  console.log("8) أُوقف الخادم بنجاح");
})();
