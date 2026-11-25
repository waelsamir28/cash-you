/*
 * إدارة قاعدة البيانات المحلية لنسخة ويندوز.
 *
 * الفكرة:
 * كل من ياخد نسخة CASH YOU يجب أن يعمل فوراً بلا خطوات تثبيت:
 *  1) نبحث عن قاعدة محلية محفوظة على جهازه → نستخدمها.
 *  2) لا توجد → نشغّل PostgreSQL مدمج (مرفق مع البرنامج) على جهازه،
 *     ننشئ له قاعدة `cash_you` بكل جداولها، ونحفظ الرابط محلياً.
 *  3) PostgreSQL المدمج غير متاح (نسخة بلا مرفقات) → نبحث عن خادم
 *     PostgreSQL مثبّت على الجهاز (localhost) وننشئ عليه قاعدة `cash_you`.
 *
 * النتيجة: كل تثبيت مستقل تماماً — لا حساب مالك مشترك ولا بيانات مشتركة،
 * والمالك والكاشير يسجّلان دخولهما بأنفسهما، ثم يضيف العميل رابط
 * قاعدةه السحابية بنفسه من داخل البرنامج.
 */
const { app } = require("electron");
const { spawn } = require("node:child_process");
const {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} = require("node:fs");
const net = require("node:net");
const path = require("node:path");

/** اسم قاعدة العميل المحلية */
const LOCAL_DB_NAME = "cash_you";
/** مستخدم قاعدة البيانات المحلية */
const LOCAL_DB_USER = "cashyou";

/** آخر سبب فشل (يُعرض للعميل بدل رسالة عامة) */
let lastError = null;
/** هل شغّلنا الخادم عبر pg_ctl؟ */
let startedWithPgCtl = false;
/** مجلد بيانات الخادم العامل حالياً */
let runningDataDir = null;

/** مجلد بيانات المستخدم */
function userDataDir() {
  try {
    return app.getPath("userData");
  } catch {
    return path.join(process.cwd(), "electron");
  }
}

/** مجلد مجلد بيانات PostgreSQL المدمج */
function embeddedDataDir() {
  return path.join(userDataDir(), "pgdata");
}

/**
 * ملف كلمة مرور القاعدة المحلية.
 *
 * تعيش مع مجلد بيانات العنقود نفسه — لأن كلمة المرور مرتبطة بعنقود
 * PostgreSQL: لو فُصلت بينهما لفقد العميل الوصول إلى بياناته. ويُكتب
 * نسخة أخرى في مجلد بيانات المستخدم (للتوافق مع الإصدارات السابقة).
 */
function localSecretPath() {
  return path.join(embeddedDataDir(), "cash-you-local.json");
}

/** النسخة القديمة في مجلد بيانات المستخدم */
function legacySecretPath() {
  return path.join(userDataDir(), "cash-you-local.json");
}

/** يقرأ كلمة المرور المحفوظة (أو يولّد واحدة جديدة) */
function localPassword() {
  for (const file of [localSecretPath(), legacySecretPath()]) {
    try {
      const json = JSON.parse(readFileSync(file, "utf8"));
      if (typeof json.password === "string" && json.password) return json.password;
    } catch {
      /* ملف غير موجود أو غير صالح */
    }
  }
  return `cy_${require("node:crypto").randomBytes(12).toString("hex")}`;
}

/**
 * يحفظ كلمة المرور على جهاز العميل.
 * تُكتب داخل مجلد العنقود **بعد** تهيئته — لأن `initdb` يرفض مجلداً غير فارغ.
 */
function saveLocalSecret(password) {
  const content = `${JSON.stringify({ password, createdAt: new Date().toISOString() }, null, 2)}\n`;
  for (const file of [localSecretPath(), legacySecretPath()]) {
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, content, "utf8");
    } catch {
      /* لا يهم — سنستخدم كلمة المرور في الذاكرة */
    }
  }
}

/** منفذ حر على الجهاز */
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 5432;
      server.close(() => resolve(port));
    });
  });
}

/** أسماء حزم PostgreSQL المدمج حسب النظام */
const EMBEDDED_PACKAGES = {
  "win32-x64": "@embedded-postgres/windows-x64",
  "linux-x64": "@embedded-postgres/linux-x64",
  "linux-arm64": "@embedded-postgres/linux-arm64",
  "linux-arm": "@embedded-postgres/linux-arm",
  "linux-ia32": "@embedded-postgres/linux-ia32",
  "linux-ppc64": "@embedded-postgres/linux-ppc64",
  "darwin-x64": "@embedded-postgres/darwin-x64",
  "darwin-arm64": "@embedded-postgres/darwin-arm64",
};

/**
 * إصلاح المسار داخل حزمة Electron.
 *
 * حزمة `@embedded-postgres/<system>` تحسب مسار ثنائياتها من موقع وحدتها:
 *   path.resolve(__dirname, "..", "native", "bin", "initdb.exe")
 * وبعد التغليف يصبح `__dirname` داخل `resources/app.asar`، فينتج مسار
 * مثل: `...\resources\app.asar\node_modules\@embedded-postgres\windows-x64\native\bin\initdb.exe`
 * وهذا الملف غير موجود لأن electron-builder ينقل الملفات الأصلية إلى
 * `resources/app.asar.unpacked`، والملف داخل ASAR ليس ملفاً حقيقياً على القرص.
 * لذلك يفشل التشغيل بـ ENOENT.
 *
 * الحل: نُعيد توجيه أي مسار يمرّ بـ `app.asar` إلى `app.asar.unpacked`
 * (حيث الثنائيات الفعلية + كل DLL بجوارها).
 */
function unpackedPath(filePath) {
  if (typeof filePath !== "string" || !filePath) return filePath;
  const marker = `${path.sep}app.asar${path.sep}`;
  if (!filePath.includes(marker)) return filePath;
  const redirected = filePath.replace(marker, `${path.sep}app.asar.unpacked${path.sep}`);
  return existsSync(redirected) ? redirected : filePath;
}

/** جذر حزمة النظام (`<...>/native/bin` ← `<...>`) */
function binariesRoot(binDir) {
  return path.resolve(binDir, "..");
}

/**
 * إعادة إنشاء روابط `lib/*.so` المطلوبة على لينكس/ماك.
 *
 * المكتبة تفعل ذلك في `initialise()`/`start()`، وبما أننا نتولّى التشغيل
 * بأنفسنا صرنا مسؤولين عنه. على ويندوز لا توجد روابط (الملف `[]`) فتُترك
 * الدالة فوراً. أي فشل هنا لا يوقف التشغيل — الثنائيات تعمل غالباً بدونها.
 */
function restoreSymlinks(root) {
  if (process.platform === "win32") return;
  try {
    const manifestFile = path.join(root, "native", "pg-symlinks.json");
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    for (const { source, target } of manifest) {
      const targetPath = path.resolve(root, target);
      if (existsSync(targetPath)) continue;
      const sourcePath = path.resolve(root, source);
      if (!existsSync(sourcePath)) continue;
      try {
        mkdirSync(path.dirname(targetPath), { recursive: true });
        symlinkSync(path.basename(sourcePath), targetPath);
      } catch {
        /* رابط موجود أو لا صلاحية — لا يهم */
      }
    }
  } catch {
    /* لا ملف روابط لهذه الحزمة */
  }
}

/**
 * مجلدات مرشحة تحتوي ثنائيات PostgreSQL المدمج، بترتيب الأولوية.
 *
 * نبحث عن الثنائيات على القرص مباشرة ولا نحمّل حزمة النظام عبر `import()`:
 *  - `import()` لحزمة ESM داخل `app.asar` غير موثوقة، وقد تفشل على ويندوز.
 *  - المسار بعد التغليف معروف ومحدد: `app.asar.unpacked`، أو مجلد التطوير.
 *
 * مواضع `__dirname` الممكنة:
 *   تغليف: <resources>/app.asar/electron   → الجذر المطلوب <resources>
 *   تطوير: <project>/electron             → الجذر المطلوب <project>
 * لذلك نصعد مستويين ونفحص كل أب، مع `process.resourcesPath` كضمان.
 */
function binarySearchRoots() {
  const roots = [__dirname];
  let current = __dirname;
  for (let depth = 0; depth < 3; depth += 1) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
    roots.push(current);
  }
  try {
    roots.push(process.resourcesPath);
  } catch {
    /* غير متاح خارج Electron */
  }
  return [...new Set(roots.filter(Boolean))];
}

/**
 * مسارات ثنائيات PostgreSQL المدمج حسب النظام.
 *
 * نحسب المسار بأنفسنا من `app.asar.unpacked` (حيث electron-builder يضع
 * الملفات الأصلية) بدل الاعتماد على مسار الحزمة المشتق من موقع وحدتها،
 * وهو مسار داخل `app.asar` غير موجود على القرص — سبب عطل الإصدار 1.3.0.
 */
async function embeddedBinaries() {
  const pkg = EMBEDDED_PACKAGES[`${process.platform}-${process.arch}`];
  if (!pkg) return null;

  const exe = (name) => (process.platform === "win32" ? `${name}.exe` : name);
  const names = { postgres: exe("postgres"), initdb: exe("initdb"), pgCtl: exe("pg_ctl") };

  for (const root of binarySearchRoots()) {
    const candidates = [
      /* 1) تغليف: <resources>/app.asar.unpacked ★ المسار الصحيح */
      path.join(root, "app.asar.unpacked", "node_modules", pkg, "native", "bin"),
      /* 2) تغليف غير مفكوك: <resources>/app/(asar غير موجود) — احتياط */
      path.join(root, "app", "node_modules", pkg, "native", "bin"),
      /* 3) تطوير: <project>/node_modules */
      path.join(root, "node_modules", pkg, "native", "bin"),
    ];
    for (const binDir of candidates) {
      if (!existsSync(binDir)) continue;
      const resolved = {
        postgres: path.join(binDir, names.postgres),
        initdb: path.join(binDir, names.initdb),
        pgCtl: path.join(binDir, names.pgCtl),
      };
      if (!existsSync(resolved.postgres)) continue;
      restoreSymlinks(binariesRoot(binDir));
      return { ...resolved, binDir };
    }
  }

  /*
   * آخر محاولة: الحزمة نفسها عبر import (تغطي تركيباً غير تقليدي)،
   * مع تصحيح المسار إن كان داخل ASAR.
   */
  try {
    const mod = await import(pkg);
    const resolved = {
      postgres: unpackedPath(mod.postgres),
      initdb: unpackedPath(mod.initdb),
      pgCtl: unpackedPath(mod.pg_ctl),
    };
    if (!resolved.postgres || !existsSync(resolved.postgres)) return null;
    const binDir = path.dirname(resolved.postgres);
    restoreSymlinks(binariesRoot(binDir));
    return { ...resolved, binDir };
  } catch {
    return null;
  }
}

/**
 * ينفّذ أمراً ويعيد مخرجاته (يرمي خطأً واضحاً عند الفشل)
 */
function runCommand(command, args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    /*
     * ننتظر حدث `exit` (خروج العملية) لا `close` (إغلاق المخرجات) — لأن
     * الخادم الذي يشغّله `pg_ctl` قد يبقي على مقابض المخرجات مفتوحة،
     * فيتأخر `close` إلى ما لا نهاية.
     */
    const child = spawn(command, args, {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    let settled = false;
    child.stdout?.on("data", (buf) => {
      out += buf.toString();
    });
    child.stderr?.on("data", (buf) => {
      err += buf.toString();
    });
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(reject, new Error(`انتهت مهلة الأمر: ${path.basename(command)}`));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      finish(reject, error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        finish(resolve, { out, err });
        return;
      }
      finish(
        reject,
        new Error(
          `فشل ${path.basename(command)} (رمز ${code}): ${(err || out).trim().slice(-800)}`,
        ),
      );
    });
  });
}

/**
 * حجج `initdb` المناسبة لـ PostgreSQL 19.
 *
 * PostgreSQL 19 أزال الاستثناء القديم على ويندوز الذي كان يسمح بـ `UTF8`
 * مع أي لغة، فصار لا بد من تطابق اللغة والترميز. أسماء اللغات التقليدية
 * على ويندوز (`en-US`, `English_United States.1252`) ترميزها صفحة ترميز
 * أحادية/ثنائية البايت، فترفض `--encoding=UTF8` بخطأ `encoding mismatch`.
 *
 * الحل الأنسب للعربية بلا الاعتماد على لغة النظام: مزوّد اللغة `builtin`
 * بلغة `C.UTF-8` (مدمج في PostgreSQL 19 نفسه، يعمل على ويندوز ولا يحتاج
 * أي حزمة لغة من النظام) مع `UTF8` للترميز. هذا يخزّن العربية والإنجليزية
 * بشكل صحيح ويوحّد الترتيب بين كل الأجهزة.
 *
 * ويبقى `--lc-messages=C` حتى تظل رسائل `initdb` إنجليزية ثابتة كما تعتمد
 * عليها المكتبة في متابعة التقدّم.
 */
function initdbArgs(databaseDir, passwordFile, useBuiltinLocale = true) {
  const base = [
    `--pgdata=${databaseDir}`,
    `--auth=password`,
    `--username=${LOCAL_DB_USER}`,
    `--pwfile=${passwordFile}`,
    `--encoding=UTF8`,
  ];
  const locale = useBuiltinLocale
    ? [`--locale-provider=builtin`, `--builtin-locale=C.UTF-8`, `--lc-messages=C`]
    : /* احتياطي لإصدار أقدم لا يعرف builtin: لغة C الصرفة تقبل UTF8 */ [
        `--no-locale`,
        `--lc-messages=C`,
      ];
  return [...base, ...locale];
}

/**
 * مهّد عنقود PostgreSQL المدمج بتشغيل `initdb` بأنفسنا.
 *
 * لماذا لا نستخدم `EmbeddedPostgres.initialise()`؟
 * لأنها تُشغّل مسار `initdb` المشتق من موقع الوحدة داخل ASAR، وهو مسار
 * غير موجود بعد التغليف (سبب فشل الإصدار 1.3.0 بـ ENOENT). كذلك لا تتيح
 * ضبط الترميز/اللغة، وهو ما يحتاجه PostgreSQL 19 على ويندوز.
 *
 * نُنفّذ هنا نفس الخطوات التي تقوم بها المكتبة: كتابة كلمة المرور في ملف
 * مؤقت، تشغيل `initdb`، ثم حذف الملف في كل الأحوال.
 */
async function initialiseCluster(binaries, databaseDir, password) {
  if (!binaries?.initdb || !existsSync(binaries.initdb)) {
    throw new Error("ملف initdb غير موجود في الحزمة");
  }
  const passwordFile = path.join(
    require("node:os").tmpdir(),
    `cash-you-pg-${require("node:crypto").randomBytes(6).toString("hex")}`,
  );
  writeFileSync(passwordFile, `${password}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    try {
      await runCommand(binaries.initdb, initdbArgs(databaseDir, passwordFile, true), 180000);
      return;
    } catch (err) {
      /*
       * إن كان الإصدار لا يعرف `--locale-provider` فلا تُترك محاولة فاشلة
       * خلفها مجلد بيانات نصف مهيأ — ننظّفه قبل المحاولة الاحتياطية.
       */
      const message = err instanceof Error ? err.message : String(err);
      const unsupported =
        /locale-provider|builtin-locale|unrecognized option|invalid option/i.test(message);
      if (!unsupported) throw err;
      process.stdout.write(
        "[local-db] builtin locale غير مدعوم في هذه النسخة — إعادة المحاولة بلغة C\n",
      );
      for (const entry of readdirSync(databaseDir)) {
        rmSync(path.join(databaseDir, entry), { recursive: true, force: true });
      }
      await runCommand(binaries.initdb, initdbArgs(databaseDir, passwordFile, false), 180000);
    }
  } finally {
    try {
      unlinkSync(passwordFile);
    } catch {
      /* الملف حُذف أو لم يُنشأ */
    }
  }
}

/** آخر أسطر سجل الخادم (لإ diagnosing الفشل) */
function tailServerLog(databaseDir, lines = 12) {
  try {
    const content = readFileSync(path.join(databaseDir, "server.log"), "utf8");
    return content.split(/\r?\n/).filter(Boolean).slice(-lines).join("\n");
  } catch {
    return "";
  }
}

/**
 * تشغيل الخادم عبر `pg_ctl` — **ضروري على ويندوز**:
 * `postgres.exe` يرفض العمل داخل جلسة إدارية ("Execution of PostgreSQL by a user
 * with administrative permissions is not permitted")، بينما `pg_ctl` يشغّله
 * بتوكن محدود فيعمل حتى مع صلاحيات المدير.
 */
async function startWithPgCtl(binaries, databaseDir, port, adminUrl) {
  const pgCtl = binaries.pgCtl;
  if (!pgCtl || !existsSync(pgCtl)) throw new Error("pg_ctl غير متوفر");
  const logFile = path.join(databaseDir, "server.log");
  try {
    await runCommand(
      pgCtl,
      [
        "-D",
        databaseDir,
        "-l",
        logFile,
        "-o",
        `-p ${port} -h 127.0.0.1`,
        "-w",
        "-t",
        "60",
        "start",
      ],
      60000,
    );
  } catch (err) {
    /*
     * `pg_ctl` قد لا يُنهي عمليته حتى لو اشتغل الخادم — فالحكم الحقيقي
     * هو: هل الخادم يستجيب؟ إن كان يعمل نعتبر المهمة ناجحة.
     */
    if (!(await canConnect(adminUrl, 5000))) {
      const log = tailServerLog(databaseDir);
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`${message}${log ? `\nسجل الخادم:\n${log}` : ""}`);
    }
  }
  if (!(await canConnect(adminUrl, 8000))) {
    const log = tailServerLog(databaseDir);
    throw new Error(
      `لم يستجب الخادم المحلي${log ? `\nسجل الخادم:\n${log}` : ""}`,
    );
  }
}

/** إيقاف الخادم عبر `pg_ctl` (أرخص من القتل القسري) */
async function stopWithPgCtl(binaries, databaseDir) {
  if (!binaries?.pgCtl || !existsSync(binaries.pgCtl)) return;
  try {
    await runCommand(
      binaries.pgCtl,
      ["-D", databaseDir, "stop", "-m", "fast", "-w", "-t", "30"],
      60000,
    );
  } catch {
    /* الخادم قد يكون متوقفاً أصلاً */
  }
}

/**
 * يقرأ معلومات postmaster.pid (المنفذ و pid) لمجلد بيانات PostgreSQL.
 */
function readPostmasterInfo(databaseDir) {
  try {
    const raw = readFileSync(path.join(databaseDir, "postmaster.pid"), "utf8");
    const lines = raw.split(/\r?\n/);
    const pid = Number.parseInt(lines[0], 10);
    const port = Number.parseInt(lines[3], 10);
    if (!Number.isFinite(pid) || !Number.isFinite(port)) return null;
    return { pid, port };
  } catch {
    return null;
  }
}

/** هل العملية ما زالت حيّة؟ */
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    /* EPERM = العملية موجودة لكن ليس لنا صلاحية الإشارة إليها */
    return Boolean(err && err.code === "EPERM");
  }
}

/** هل تعمل نسخة PostgreSQL المدمجة حالياً على مجلد بياناتنا؟ */
function hasRunningEmbeddedInstance() {
  const info = readPostmasterInfo(embeddedDataDir());
  return Boolean(info && isProcessAlive(info.pid));
}

/** هل يمكن الاتصال بهذا الرابط؟ */
async function canConnect(url, timeout = 4000) {
  let Client;
  try {
    Client = require("pg").Client;
  } catch {
    return false;
  }
  const client = new Client({ connectionString: url, connectionTimeoutMillis: timeout });
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * يوقف PostgreSQL المدمج (سواء الذي شغّلناه أو نسخة تولّيناها من تشغيل سابق).
 * يُستدعى عند إغلاق التطبيق حتى لا يبقى خادم يعمل في خلفية الجهاز.
 */
async function stopEmbeddedPostgres() {
  const dataDir = runningDataDir;
  runningDataDir = null;
  const owned = startedWithPgCtl;
  startedWithPgCtl = false;
  if (owned && dataDir) {
    const binaries = await embeddedBinaries();
    await stopWithPgCtl(binaries, dataDir);
  }
}

/**
 * يشغّل PostgreSQL المدمج على جهاز العميل وينشئ قاعدة `cash_you`.
 * يعيد رابط الاتصال أو null إن تعذّر.
 */
async function startEmbeddedPostgres() {
  const binaries = await embeddedBinaries();
  if (!binaries) return null;

  const password = localPassword();
  const databaseDir = embeddedDataDir();

  try {
    mkdirSync(databaseDir, { recursive: true });
  } catch {
    return null;
  }

  /*
   * إن كان هناك خادم من تشغيل سابق:
   *  - ما زال يعمل → نستخدمه على نفس البيانات (بلا فقد لأي حساب).
   *  - لم يعد يعمل → ننظّف ملف postmaster.pid ونبدأ خادماً جديداً بمنفذ جديد.
   */
  const existing = readPostmasterInfo(databaseDir);
  if (existing) {
    if (isProcessAlive(existing.pid)) {
      const reuseUrl = `postgresql://${LOCAL_DB_USER}:${password}@127.0.0.1:${existing.port}/${LOCAL_DB_NAME}`;
      if (await canConnect(reuseUrl)) {
        /* نتولّاه: نوقفه عند الخروج مثل أي خادم شغّلناه */
        startedWithPgCtl = true;
        runningDataDir = databaseDir;
        await ensureDatabaseExists(reuseUrl);
        process.stdout.write(
          `[local-db] reusing the running local database on port ${existing.port}\n`,
        );
        return reuseUrl;
      }
      /* خادم سابق لا يمكن استخدامه → نغلقه ونبدأ من جديد */
      await stopWithPgCtl(binaries, databaseDir);
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    try {
      unlinkSync(path.join(databaseDir, "postmaster.pid"));
    } catch {
      /* ملف غير موجود — لا بأس */
    }
  }

  const port = await freePort();

  try {
    /*
     * تهيئة العنقود مرة واحدة فقط.
     *
     * نتولّى `initdb` بأنفسنا (لا عبر `EmbeddedPostgres.initialise()`) لأن
     * المكتبة تشغّل مسار `initdb` المشتق من موقعها داخل `app.asar`، وهو
     * غير موجود بعد التغليف — وهو سبب فشل الإصدار 1.3.0 على ويندوز.
     * كذلك نحتاج ضبط `--encoding=UTF8` مع لغة UTF-8 حقيقية لتوافق
     * PostgreSQL 19 على ويندوز.
     */
    if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
      await initialiseCluster(binaries, databaseDir, password);
    }
    /* كلمة المرور تُحفظ بعد التهيئة (initdb يتطلب مجلداً فارغاً) */
    saveLocalSecret(password);

    /*
     * نشغّل الخادم عبر `pg_ctl` على كل الأنظمة — لا عبر `postgres.exe` مباشرة:
     *  - على ويندوز: `postgres.exe` يرفض العمل داخل جلسة إدارية
     *    ("Execution of PostgreSQL by a user with administrative permissions
     *    is not permitted")، وهو شائع جداً عند العملاء. أما `pg_ctl` فيشغّله
     *    بتوكن محدود فيعمل دائماً.
     *  - على غيره: `EmbeddedPostgres.start()` تشغّل مسار `postgres` المشتق
     *    من موقع الوحدة، وهو مسار داخل ASAR غير موجود بعد التغليف — نفس
     *    عيب `initdb` الذي أسقط الإصدار 1.3.0. و`pg_ctl` يأخذ مساراً
     *    حقيقياً نُمرّره بأنفسنا.
     */
    await startWithPgCtl(
      binaries,
      databaseDir,
      port,
      `postgresql://${LOCAL_DB_USER}:${password}@127.0.0.1:${port}/postgres`,
    );
    startedWithPgCtl = true;
    runningDataDir = databaseDir;

    /* إنشاء قاعدة العميل (إن لم تكن موجودة) */
    const url = `postgresql://${LOCAL_DB_USER}:${password}@127.0.0.1:${port}/${LOCAL_DB_NAME}`;
    await ensureDatabaseExists(url);
    return url;
  } catch (err) {
    lastError = err && err.message ? err.message : String(err);
    process.stdout.write(`[local-db] تعذّر تشغيل PostgreSQL المدمج: ${lastError}\n`);
    return null;
  }
}

/** آخر سبب فشل لتشغيل القاعدة المدمجة (لعرضه في شاشة الإعداد) */
function embeddedDatabaseError() {
  return lastError;
}

/** خوادم PostgreSQL المحلية الشائعة على جهاز العميل */
const LOCAL_SERVERS = [
  { host: "127.0.0.1", port: 5432, user: "postgres", password: "postgres" },
  { host: "127.0.0.1", port: 5432, user: "postgres", password: "password" },
  { host: "localhost", port: 5432, user: "postgres", password: "postgres" },
  { host: "127.0.0.1", port: 5433, user: "postgres", password: "postgres" },
];

/**
 * يبحث عن خادم PostgreSQL مثبّت على الجهاز وينشئ عليه قاعدة `cash_you`.
 * يعيد رابط الاتصال أو null.
 */
async function useInstalledPostgres() {
  let Client;
  try {
    Client = require("pg").Client;
  } catch {
    return null;
  }

  for (const server of LOCAL_SERVERS) {
    const adminUrl = `postgresql://${server.user}:${server.password}@${server.host}:${server.port}/postgres`;
    const client = new Client({ connectionString: adminUrl, connectionTimeoutMillis: 3000 });
    try {
      await client.connect();
      const exists = await client.query("select 1 from pg_database where datname = $1", [
        LOCAL_DB_NAME,
      ]);
      if (!exists.rowCount) {
        await client.query(`create database "${LOCAL_DB_NAME}"`);
      }
      await client.end();
      return `postgresql://${server.user}:${server.password}@${server.host}:${server.port}/${LOCAL_DB_NAME}`;
    } catch {
      await client.end().catch(() => undefined);
    }
  }
  return null;
}

/**
 * يضمن وجود قاعدة البيانات (ينشئها إن لم تكن موجودة).
 * يعمل على أي رابط قاعدة: يربط بقاعدة `postgres` الصيانة ويُنشئ القاعدة.
 */
async function ensureDatabaseExists(url) {
  let Client;
  try {
    Client = require("pg").Client;
  } catch {
    return { ok: true, message: "تم" };
  }
  try {
    const target = new URL(url);
    const dbName = target.pathname.replace(/^\//, "");
    if (!dbName) return { ok: true, message: "تم" };

    const admin = new URL(url);
    admin.pathname = "/postgres";
    const client = new Client({ connectionString: admin.toString(), connectionTimeoutMillis: 8000 });
    await client.connect();
    const exists = await client.query("select 1 from pg_database where datname = $1", [dbName]);
    if (!exists.rowCount) {
      await client.query(`create database "${dbName.replace(/"/g, '""')}"`);
      await client.end();
      return { ok: true, message: `تم إنشاء قاعدة البيانات «${dbName}»` };
    }
    await client.end();
    return { ok: true, message: "قاعدة البيانات موجودة" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "تعذر إنشاء قاعدة البيانات";
    return { ok: false, message };
  }
}

module.exports = {
  LOCAL_DB_NAME,
  localPassword,
  ensureDatabaseExists,
  hasRunningEmbeddedInstance,
  startEmbeddedPostgres,
  embeddedDatabaseError,
  stopEmbeddedPostgres,
  useInstalledPostgres,
};
