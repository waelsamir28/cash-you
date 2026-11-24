import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { appSessions, appUsers, usageCounters } from "@/db/schema";
import { ensureAuthSchema } from "@/lib/ensure-schema";
import {
  computeTrial,
  limitMessage,
  TRIAL_LIMITS,
  expiredMessage,
  type TrialLimitKey,
  type TrialStatus,
} from "@/lib/trial";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export type PublicUser = {
  id: number;
  username: string;
  fullName: string;
  role: "owner" | "cashier";
};

const SESSION_DAYS = 30;

/* ============================ كلمات المرور ============================ */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltText, hashText] = stored.split("$");
  if (scheme !== "scrypt" || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64");
  const actual = await scrypt(password, Buffer.from(saltText, "base64"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/* ============================ الجلسات ============================ */

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: number): Promise<string> {
  await ensureAuthSchema();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(appSessions).values({ token: tokenHash(token), userId, expiresAt });
  return token;
}

export function readBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, value] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value.trim() || null;
}

export function readSessionCookie(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const hit = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("cash_you_session="));
  return hit ? decodeURIComponent(hit.slice("cash_you_session=".length)) : null;
}

export function readSessionToken(req: Request): string | null {
  return readBearerToken(req) ?? readSessionCookie(req);
}

export async function getSessionUser(req: Request): Promise<PublicUser | null> {
  await ensureAuthSchema();
  const token = readSessionToken(req);
  if (!token) return null;
  const rows = await db
    .select({
      id: appUsers.id,
      username: appUsers.username,
      fullName: appUsers.fullName,
      role: appUsers.role,
    })
    .from(appSessions)
    .innerJoin(appUsers, eq(appUsers.id, appSessions.userId))
    .where(and(eq(appSessions.token, tokenHash(token)), gt(appSessions.expiresAt, new Date())))
    .limit(1);
  const user = rows[0];
  if (!user) return null;
  return { id: user.id, username: user.username, fullName: user.fullName, role: user.role === "cashier" ? "cashier" : "owner" };
}

export async function destroySession(req: Request): Promise<void> {
  const token = readSessionToken(req);
  if (!token) return;
  await db.delete(appSessions).where(eq(appSessions.token, tokenHash(token)));
}

export const sessionCookie = (token: string) =>
  `cash_you_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`;

export const clearedSessionCookie = () => "cash_you_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";

/* ============================ المستخدمون ============================ */

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export async function findUserByUsername(username: string) {
  await ensureAuthSchema();
  const rows = await db.select().from(appUsers).where(eq(appUsers.username, normalizeUsername(username))).limit(1);
  return rows[0] ?? null;
}

export async function listUsers(): Promise<PublicUser[]> {
  await ensureAuthSchema();
  const rows = await db.select().from(appUsers).orderBy(appUsers.id);
  return rows.map((u) => ({ id: u.id, username: u.username, fullName: u.fullName, role: u.role === "cashier" ? "cashier" : "owner" }));
}

/* ============================ الفترة التجريبية والحدود ============================ */

const TRIAL_KEY = "trial.startedAt";

/** يضمن بدء عدّاد الفترة التجريبية مرة واحدة فقط ويُعيد تاريخ البداية. */
export async function ensureTrialStarted(now = new Date()): Promise<Date> {
  await ensureAuthSchema();
  const { getSetting, setSetting } = await import("@/lib/data");
  const existing = await getSetting(TRIAL_KEY, "");
  if (existing) {
    const parsed = new Date(existing);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  await setSetting(TRIAL_KEY, now.toISOString());
  return now;
}

const COUNTER_FOR: Record<TrialLimitKey, string> = {
  products: "products.created",
  invoices: "invoices.created",
  customers: "customers.created",
  suppliers: "suppliers.created",
};

/** يقرأ عدادات الاستخدام المسجّلة في قاعدة البيانات. */
export async function readUsageCounters(): Promise<Record<TrialLimitKey, number>> {
  await ensureAuthSchema();
  const rows = await db.select().from(usageCounters);
  const byKey = new Map(rows.map((row) => [row.key, row.count]));
  return {
    products: byKey.get(COUNTER_FOR.products) ?? 0,
    invoices: byKey.get(COUNTER_FOR.invoices) ?? 0,
    customers: byKey.get(COUNTER_FOR.customers) ?? 0,
    suppliers: byKey.get(COUNTER_FOR.suppliers) ?? 0,
  };
}

/**
 * يزيد عدّاد الاستخدام بمقدار واحد.
 * العدّاد يحسب ما ينشئه المالك داخل البرنامج فقط، ولا يحسب البيانات التجريبية
 * التي تأتي مع التثبيت (أصناف/عملاء/موردين نموذجيين)، حتى تكون الـ 20 متاحة كاملة.
 */
export async function bumpUsageCounter(key: TrialLimitKey): Promise<void> {
  await ensureAuthSchema();
  const storedRow = await db
    .select({ count: usageCounters.count })
    .from(usageCounters)
    .where(eq(usageCounters.key, COUNTER_FOR[key]))
    .limit(1);
  const next = (storedRow[0]?.count ?? 0) + 1;
  await db
    .insert(usageCounters)
    .values({ key: COUNTER_FOR[key], count: next, updatedAt: new Date() })
    .onConflictDoUpdate({ target: usageCounters.key, set: { count: next, updatedAt: new Date() } });
}

export async function getTrialStatus(): Promise<TrialStatus> {
  const started = await ensureTrialStarted();
  const usage = await readUsageCounters();
  return computeTrial(started, usage);
}

/** يرفض العملية إذا انتهت المدة أو تم بلوغ حدّ المفتاح المطلوب. */
export async function assertTrialAllows(key: TrialLimitKey): Promise<void> {
  const status = await getTrialStatus();
  if (status.expired) throw new Error(expiredMessage());
  if (status.usage[key] >= TRIAL_LIMITS[key]) throw new Error(limitMessage(key));
}
