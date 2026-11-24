"use client";

const DEVICE_STORAGE_KEY = "cash-you.device-id.v1";
const LICENSE_STORAGE_KEY = "cash-you.activation.v1";

export type DeviceIdentity = { code: string; isWindowsDesktop: boolean };
export type LicensePayload = {
  v: 1;
  app: "cash-you";
  device: string;
  plan: "1y" | "2y" | "life";
  owner?: string;
  issuedAt: string;
  activationBased: true;
};

type StoredLicense = { code: string; activatedAt: string };

function bytesFromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

function pemBytes(value: string): Uint8Array {
  const body = value.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  return Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
}

function base64UrlText(value: string): Uint8Array {
  return bytesFromBase64Url(value);
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function fallbackDeviceCode(): string {
  let value = localStorage.getItem(DEVICE_STORAGE_KEY);
  if (!value) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
    localStorage.setItem(DEVICE_STORAGE_KEY, value);
  }
  return `CYD-${value.match(/.{1,4}/g)?.join("-") ?? value}`;
}

export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  if (typeof window !== "undefined" && window.cashYou?.getDeviceCode) {
    return { code: await window.cashYou.getDeviceCode(), isWindowsDesktop: true };
  }
  return { code: fallbackDeviceCode(), isWindowsDesktop: false };
}

export async function verifyActivationCode(code: string, deviceCode: string): Promise<LicensePayload> {
  const [prefix, payloadText, signatureText, extra] = code.trim().split(".");
  if (prefix !== "CY1" || !payloadText || !signatureText || extra) {
    throw new Error("صيغة كود التفعيل غير صحيحة");
  }
  const publicPem = process.env.NEXT_PUBLIC_ACTIVATION_PUBLIC_KEY?.replace(/\\n/g, "\n");
  if (!publicPem?.includes("BEGIN PUBLIC KEY")) {
    throw new Error("مفتاح التحقق العام غير مضبوط في إعدادات البرنامج");
  }

  const publicKey = await crypto.subtle.importKey(
    "spki",
    asArrayBuffer(pemBytes(publicPem)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const validSignature = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    asArrayBuffer(bytesFromBase64Url(signatureText)),
    asArrayBuffer(base64UrlText(payloadText)),
  );
  if (!validSignature) throw new Error("التوقيع غير صحيح؛ الكود غير صادر من أداة الترخيص الخاصة بك");

  let payload: LicensePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlText(payloadText))) as LicensePayload;
  } catch {
    throw new Error("بيانات كود التفعيل غير صالحة");
  }
  if (payload.v !== 1 || payload.app !== "cash-you" || payload.device !== deviceCode) {
    throw new Error("هذا الكود لا يخص هذا الجهاز أو هذا البرنامج");
  }
  if (!(payload.plan === "1y" || payload.plan === "2y" || payload.plan === "life") || payload.activationBased !== true) {
    throw new Error("نوع الترخيص غير مدعوم");
  }
  return payload;
}

async function readStoredLicense(): Promise<StoredLicense | null> {
  if (window.cashYou?.getActivationRecord) {
    const raw = await window.cashYou.getActivationRecord();
    return raw ? JSON.parse(raw) as StoredLicense : null;
  }
  const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
  return raw ? JSON.parse(raw) as StoredLicense : null;
}

async function saveStoredLicense(value: StoredLicense): Promise<void> {
  const serialized = JSON.stringify(value);
  if (window.cashYou?.saveActivationRecord) {
    await window.cashYou.saveActivationRecord(serialized);
    return;
  }
  localStorage.setItem(LICENSE_STORAGE_KEY, serialized);
}

export async function activate(code: string, deviceCode: string): Promise<LicensePayload> {
  const payload = await verifyActivationCode(code, deviceCode);
  const already = await readStoredLicense().catch(() => null);
  const normalized = code.trim();
  const stored: StoredLicense = { code: normalized, activatedAt: already?.code === normalized ? already.activatedAt : new Date().toISOString() };
  await saveStoredLicense(stored);
  return payload;
}

function expiresAt(activatedAt: string, plan: LicensePayload["plan"]): Date | null {
  if (plan === "life") return null;
  const end = new Date(activatedAt);
  end.setUTCFullYear(end.getUTCFullYear() + (plan === "1y" ? 1 : 2));
  return end;
}

export async function readActiveLicense(deviceCode: string): Promise<{
  payload: LicensePayload;
  activatedAt: string;
  expiresAt: string | null;
} | null> {
  try {
    const stored = await readStoredLicense();
    if (!stored) return null;
    const payload = await verifyActivationCode(stored.code, deviceCode);
    const end = expiresAt(stored.activatedAt, payload.plan);
    if (end && end.getTime() <= Date.now()) return null;
    return { payload, activatedAt: stored.activatedAt, expiresAt: end?.toISOString() ?? null };
  } catch {
    return null;
  }
}

declare global {
  interface Window {
    cashYou?: {
      configureAppUrl?: (url: string) => Promise<{ ok: boolean; error?: string }>;
      getDeviceCode: () => Promise<string>;
      getActivationRecord?: () => Promise<string | null>;
      saveActivationRecord?: (record: string) => Promise<boolean>;
    };
  }
}
