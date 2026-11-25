/**
 * اختبار عزل المستأجرين عبر HTTP (نفس ما يراه العميل في المتصفح).
 *
 * التشغيل:
 *   node tools/test-tenant-http.cjs
 *
 * وضع المستأجرين مفعل افتراضياً — الاختبار يتحقق من ذلك.
 *
 * يشغّل خادم Next على منفذ محلي، ثم:
 *  1) يسجّل عميلين مختلفين في متصفحين مستقلين.
 *  2) يتأكد أن كل عميل يرى بياناته فقط.
 *  3) يتأكد أن فترة التجربة والترخيص منفصلة.
 *  4) يتأكد أن عميلاً آخر لا يستطيع إنشاء حساب في قاعدة عميل.
 */
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { Client } = require("pg");

const BASE_URL = process.env.TENANT_TEST_BASE ?? "postgresql://postgres:postgres@127.0.0.1:5432/tenant_test";
const PORT = Number(process.env.TENANT_TEST_PORT ?? 3400 + Math.floor(Math.random() * 400));
const ORIGIN = `http://127.0.0.1:${PORT}`;

function cookieJar() {
  const jar = new Map();
  return {
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    absorb(response) {
      const raw = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
      for (const line of raw) {
        const [pair] = line.split(";");
        const idx = pair.indexOf("=");
        if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      }
    },
  };
}

async function call(jar, route, options = {}) {
  const res = await fetch(`${ORIGIN}${route}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      cookie: jar.header(),
      ...(options.headers ?? {}),
    },
  });
  jar.absorb(res);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json, headers: res.headers };
}

function waitForServer(url, timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(`${url}/api/health`);
        if (res.ok) return resolve();
      } catch {
        /* لسه ما بدأش */
      }
      if (Date.now() - started > timeoutMs) return reject(new Error("الخادم لم يبدأ"));
      setTimeout(tick, 400);
    };
    void tick();
  });
}

/** قاعدة نظيفة لكل تشغيل */
async function resetDatabase() {
  const url = new URL(BASE_URL);
  const adminUrl = new URL(BASE_URL);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`drop database if exists "${url.pathname.slice(1)}" with (force)`);
  await admin.query(`create database "${url.pathname.slice(1)}"`);
  await admin.end();
}

/** هل وضع المستأجرين متعدد العملاء؟ */
const MULTI = (process.env.CASH_YOU_TENANT_MODE ?? "1").trim() !== "0";

async function main() {
  await resetDatabase();

  const child = spawn("npx", ["next", "dev", "--port", String(PORT)], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      DATABASE_URL: BASE_URL,
      /* وضع المستأجرين مفعل افتراضياً — لا نضبطه هنا purposely */
      CASH_YOU_TENANT_UNIT: process.env.CASH_YOU_TEN_UNIT ?? "database",
      ...(process.env.CASH_YOU_TENANT_MODE
        ? { CASH_YOU_TENANT_MODE: process.env.CASH_YOU_TENANT_MODE }
        : {}),
    },
    stdio: "ignore",
    detached: true,
  });

  try {
    await waitForServer(ORIGIN);

    /* ---------- 0) المالك الأصلي (أنت) على القاعدة الأساسية ---------- */
    const jarDev = cookieJar();
    const regDev = await call(jarDev, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "dev_owner", fullName: "المالك الأصلي", password: "123456" }),
    });
    assert.equal(regDev.status, 200, `فشل تسجيل المالك الأصلي: ${JSON.stringify(regDev.json)}`);
    console.log("✓ المالك الأصلي على القاعدة الأساسية:", regDev.json.user.username);

    /* ---------- 1) العميل الأول يسجّل ---------- */
    if (!MULTI) {
      /* وضع قاعدة واحدة (سطح المكتب): المالك الأول يملك القاعدة، ولا يُسمح
         بإنشاء حساب جديد إلا من المالك — والبيانات مشتركة داخل القاعدة. */
      const staffS = await call(jarDev, "/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username: "staff_solo", fullName: "موظف", password: "123456" }),
      });
      assert.equal(staffS.status, 200, `فشل إضافة الموظف: ${JSON.stringify(staffS.json)}`);
      const usersS = await call(jarDev, "/api/auth/users");
      assert.deepEqual(
        (usersS.json.users ?? []).map((u) => u.username),
        ["dev_owner", "staff_solo"],
        "الحسابات داخل القاعدة الواحدة",
      );
      const strangerS = await call(cookieJar(), "/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ username: "stranger", fullName: "غريب", password: "123456" }),
      });
      assert.equal(strangerS.status, 403, "لا يُسمح بإنشاء حساب من زائر");
      console.log("✓ وضع قاعدة واحدة: المالك يضيف موظفيه فقط");
      console.log("\n✅ كل اختبارات عزل المستأجرين عبر HTTP نجحت");
      return;
    }

    const jarA = cookieJar();
    const regA = await call(jarA, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "owner_a", fullName: "عميل أ", password: "123456" }),
    });
    assert.equal(regA.status, 200, `فشل تسجيل العميل أ: ${JSON.stringify(regA.json)}`);
    console.log("✓ العميل أ سجّل:", regA.json.user.username, "/", regA.json.user.role);

    const tenantA = jarA.header().match(/cy_tenant=([^;]+)/)?.[1];
    assert.ok(tenantA, "يجب أن يُحفظ كوكي المستأجر");
    console.log("✓ مستأجر العميل أ:", tenantA);

    /* ---------- 2) العميل الثاني يسجّل ---------- */
    const jarB = cookieJar();
    const regB = await call(jarB, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "owner_b", fullName: "عميل ب", password: "123456" }),
    });
    assert.equal(regB.status, 200, `فشل تسجيل العميل ب: ${JSON.stringify(regB.json)}`);
    const tenantB = jarB.header().match(/cy_tenant=([^;]+)/)?.[1];
    assert.ok(tenantB, "يجب أن يُحفظ كوكي المستأجر للعميل ب");
    assert.notEqual(tenantA, tenantB, "كل عميل له مستأجر مختلف");
    console.log("✓ العميل ب سجّل على مستأجر مختلف:", tenantB);

    /* ---------- 3) بيانات منفصلة ---------- */
    const addProd = await call(jarA, "/api/products", {
      method: "POST",
      body: JSON.stringify({
        code: "A-1",
        name: "صنف العميل أ",
        categoryId: 0,
        unit: "قطعة",
        price: 10,
        wholesalePrice: 8,
        cost: 6,
        stock: 5,
        minStockLimit: 1,
      }),
    });
    console.log("  add product:", addProd.status, JSON.stringify(addProd.json).slice(0, 200));
    const bootA = await call(jarA, "/api/bootstrap");
    const bootB = await call(jarB, "/api/bootstrap");
    console.log("  bootstrap A keys:", Object.keys(bootA.json ?? {}).join(","));
    console.log("  bootstrap A products:", JSON.stringify(bootA.json.products ?? bootA.json.items ?? []).slice(0, 300));
    const namesA = (bootA.json.products ?? []).map((p) => p.name);
    const namesB = (bootB.json.products ?? []).map((p) => p.name);
    assert.ok(namesA.includes("صنف العميل أ"), "العميل أ يرى صنفه");
    assert.ok(!namesB.includes("صنف العميل أ"), "العميل ب لا يرى صنف العميل أ");
    console.log("✓ البيانات منفصلة (أ:", namesA.length, "صنف / ب:", namesB.length, "صنف)");

    /* ---------- 4) التجربة والترخيص منفصلان ---------- */
    const trialA = await call(jarA, "/api/trial");
    const trialB = await call(jarB, "/api/trial");
    assert.ok(trialA.json.startedAt, "الفترة التجريبية بدأت للعميل أ");
    assert.ok(trialB.json.startedAt, "الفترة التجريبية بدأت للعميل ب");
    assert.notEqual(
      trialA.json.startedAt,
      trialB.json.startedAt,
      "كل عميل له بداية تجربة مستقلة",
    );
    console.log("✓ الفترة التجريبية مستقلة لكل عميل");

    /* ---------- 5) المستخدمون مستقلون ---------- */
    const usersA = await call(jarA, "/api/auth/users");
    const usersB = await call(jarB, "/api/auth/users");
    const listA = (usersA.json.users ?? []).map((u) => u.username);
    const listB = (usersB.json.users ?? []).map((u) => u.username);
    assert.deepEqual(listA, ["owner_a"], "العميل أ يرى حسابه فقط");
    assert.deepEqual(listB, ["owner_b"], "العميل ب يرى حسابه فقط");
    console.log("✓ الحسابات مستقلة (أ:", listA.join(","), "/ ب:", listB.join(","), ")");

    /* ---------- 6) زائر بلا جلسة يحصل على قاعدة مستقلة جديدة ---------- */
    const jarD = cookieJar();
    const regD = await call(jarD, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "owner_d", fullName: "عميل د", password: "123456" }),
    });
    assert.equal(regD.status, 200, `فشل تسجيل العميل د: ${JSON.stringify(regD.json)}`);
    const tenantD = jarD.header().match(/cy_tenant=([^;]+)/)?.[1];
    assert.ok(tenantD && tenantD !== tenantA && tenantD !== tenantB, "الزائر يحصل على وحدة جديدة");
    const usersAAfter = await call(jarA, "/api/auth/users");
    assert.deepEqual(
      (usersAAfter.json.users ?? []).map((u) => u.username),
      ["owner_a"],
      "قاعدة العميل أ لم تتأثر بالتسجيل الجديد",
    );
    console.log("✓ زائر جديد لا يستطيع الدخول إلى قاعدة عميل آخر");

    /* ---------- 6ب) المالك يضيف موظفاً داخل قاعدة عميله ---------- */
    const staff = await call(jarA, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username: "staff_a", fullName: "موظف", password: "123456", role: "cashier" }),
    });
    assert.equal(staff.status, 200, `فشل إضافة الموظف: ${JSON.stringify(staff.json)}`);
    const usersAWithStaff = await call(jarA, "/api/auth/users");
    assert.deepEqual(
      (usersAWithStaff.json.users ?? []).map((u) => u.username),
      ["owner_a", "staff_a"],
      "الموظف يُضاف داخل قاعدة المالك",
    );
    console.log("✓ المالك يضيف موظفيه داخل قاعدة عميله فقط");

    /* ---------- 7) تسجيل الدخول من جهاز جديد يربط العميل بقاعدته ---------- */
    const jarC = cookieJar();
    const loginC = await call(jarC, "/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "owner_a", password: "123456" }),
    });
    assert.equal(loginC.status, 200, `فشل الدخول: ${JSON.stringify(loginC.json)}`);
    const tenantC = jarC.header().match(/cy_tenant=([^;]+)/)?.[1];
    assert.equal(tenantC, tenantA, "تسجيل الدخول يربط المتصفح بقاعدة صاحب الحساب");
    const bootC = await call(jarC, "/api/bootstrap");
    assert.ok(
      (bootC.json.products ?? []).map((p) => p.name).includes("صنف العميل أ"),
      "العميل أ يرى بياناته من جهاز جديد",
    );
    console.log("✓ الدخول من جهاز جديد يربط العميل بقاعدته");

    console.log("\n✅ كل اختبارات عزل المستأجرين عبر HTTP نجحت");
  } finally {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}

main().catch((err) => {
  console.error("❌ فشل الاختبار:", err.message);
  console.error(err.stack);
  process.exit(1);
});
