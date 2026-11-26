/**
 * اختبار مسارات وتشغيل قاعدة البيانات المحلية (PGlite) في بيئة سطح المكتب.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { Client } = require("pg");

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cash-you-pglite-"));
  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "electron") {
      return { app: { getPath: () => tmpDir } };
    }
    return origLoad.apply(this, arguments);
  };

  try {
    const localDb = require("../electron/local-db.cjs");
    const url = await localDb.startEmbeddedPostgres();
    if (!url) {
      throw new Error(`فشل تشغيل PGlite: ${localDb.embeddedDatabaseError()}`);
    }
    const client = new Client({ connectionString: url });
    await client.connect();
    const res = await client.query("SELECT 1+1 AS n, $1::text AS ar", ["كاش يو"]);
    if (res.rows[0]?.n !== 2 || res.rows[0]?.ar !== "كاش يو") {
      throw new Error("فشل استعلام PGlite");
    }
    await client.end();
    await localDb.stopEmbeddedPostgres();
    console.log("✅ PGlite يعمل بنجاح مع pg في بيئة سطح المكتب");
  } finally {
    Module._load = origLoad;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("❌ فشل اختبار PGlite:", err);
  process.exit(1);
});
