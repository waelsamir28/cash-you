/**
 * إدارة قاعدة البيانات المحلية لنسخة سطح المكتب من CASH YOU.
 *
 * يستخدم محرك PGlite المدمج (WebAssembly PostgreSQL) مثل FATORA:
 *   - يعمل مباشرة داخل Node.js بدون أي ملفات exe خارجية أو initdb.exe
 *   - يحفظ البيانات في مجلد بيانات التطبيق (%APPDATA%\CASH YOU\database)
 *   - يفتح منفذ TCP محلي عبر PGLiteSocketServer ليتصل به Next.js/Drizzle بشكل طبيعي
 */
const { app } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require("pg");

const LOCAL_DB_NAME = "postgres";
const LOCAL_USER = "postgres";
const DEFAULT_PORT = 54329;

let pgliteDb = null;
let socketServer = null;
let activePort = null;
let lastError = null;

function logDiagnostic(message) {
  try {
    const dir = app.getPath("userData");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      path.join(dir, "cash-you-diagnostics.log"),
      `[${new Date().toISOString()}] ${message}\n`,
      "utf8",
    );
  } catch {
    /* تجاهل */
  }
}

function localPassword() {
  const dir = app.getPath("userData");
  const file = path.join(dir, ".local-db-secret");
  try {
    if (fs.existsSync(file)) {
      const existing = fs.readFileSync(file, "utf8").trim();
      if (existing.length >= 16) return existing;
    }
  } catch {
    /* تجاهل */
  }
  const secret = crypto.randomBytes(24).toString("hex");
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, secret, { mode: 0o600 });
  } catch {
    /* تجاهل */
  }
  return secret;
}

async function ensureDatabaseExists() {
  return true;
}

function hasRunningEmbeddedInstance() {
  return Boolean(pgliteDb && socketServer && activePort);
}

function embeddedDatabaseError() {
  return lastError;
}

async function startEmbeddedPostgres() {
  lastError = null;
  if (hasRunningEmbeddedInstance()) {
    return `postgresql://${LOCAL_USER}:${encodeURIComponent(localPassword())}@127.0.0.1:${activePort}/${LOCAL_DB_NAME}`;
  }

  try {
    const dataDir = path.join(app.getPath("userData"), "database");
    fs.mkdirSync(dataDir, { recursive: true });
    logDiagnostic(`Starting PGlite at ${dataDir}`);

    const { PGlite } = await import("@electric-sql/pglite");
    const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");

    pgliteDb = new PGlite(dataDir);
    await pgliteDb.waitReady;

    // إنشاء الجداول تلقائياً إذا كانت قاعدة البيانات جديدة
    try {
      const schemaCandidates = [
        path.join(process.resourcesPath || "", "standalone", "src", "db", "full-schema.ts"),
        path.join(__dirname, "..", "src", "db", "full-schema.ts"),
      ];
      const schemaFile = schemaCandidates.find((p) => p && fs.existsSync(p));
      if (schemaFile) {
        const raw = fs.readFileSync(schemaFile, "utf8");
        const m = raw.match(/export const FULL_SCHEMA_SQL = `([\s\S]*?)`;/);
        if (m && m[1]) {
          await pgliteDb.exec(m[1]);
          logDiagnostic("PGlite schema initialized from full-schema.ts");
        }
      }
    } catch (schemaErr) {
      logDiagnostic(`PGlite schema init warning: ${schemaErr instanceof Error ? schemaErr.message : String(schemaErr)}`);
    }

    socketServer = new PGLiteSocketServer({
      db: pgliteDb,
      port: 0,
      host: "127.0.0.1",
    });
    await socketServer.start();

    const addr = socketServer.server?.address?.();
    activePort = typeof addr === "object" && addr && addr.port ? addr.port : DEFAULT_PORT;

    logDiagnostic(`PGlite listening on 127.0.0.1:${activePort}`);
    return `postgresql://${LOCAL_USER}:${encodeURIComponent(localPassword())}@127.0.0.1:${activePort}/${LOCAL_DB_NAME}`;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    logDiagnostic(`PGlite failed: ${lastError}`);
    await stopEmbeddedPostgres();
    return null;
  }
}

async function stopEmbeddedPostgres() {
  try {
    if (socketServer) {
      await socketServer.stop();
    }
  } catch {
    /* تجاهل */
  }
  socketServer = null;
  activePort = null;
  try {
    if (pgliteDb) {
      await pgliteDb.close();
    }
  } catch {
    /* تجاهل */
  }
  pgliteDb = null;
}

async function useInstalledPostgres() {
  const candidates = [
    process.env.DATABASE_URL,
    "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
  ].filter(Boolean);

  for (const url of candidates) {
    try {
      const client = new Client({ connectionString: url, connectionTimeoutMillis: 2000 });
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return url;
    } catch {
      /* جرب التالي */
    }
  }
  return null;
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
