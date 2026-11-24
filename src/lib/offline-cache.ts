import type { Bootstrap } from "@/lib/types";

const DB_NAME = "cash-you-offline-v1";
const STORE_NAME = "cache";
const BOOTSTRAP_KEY = "bootstrap";

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
      if (!request.result.objectStoreNames.contains("outbox")) request.result.createObjectStore("outbox", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("تعذر فتح التخزين المحلي"));
  });
}

export async function saveOfflineBootstrap(value: Bootstrap): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, BOOTSTRAP_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("تعذر حفظ نسخة العمل المحلية"));
    tx.onabort = () => reject(tx.error ?? new Error("تم إلغاء حفظ نسخة العمل المحلية"));
  });
  db.close();
}

export async function readOfflineBootstrap(): Promise<Bootstrap | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openOfflineDb();
  const value = await new Promise<Bootstrap | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(BOOTSTRAP_KEY);
    request.onsuccess = () => resolve(request.result as Bootstrap | undefined);
    request.onerror = () => reject(request.error ?? new Error("تعذر قراءة البيانات المحلية"));
  });
  db.close();
  if (!value || !Array.isArray(value.products) || !Array.isArray(value.invoices)) return null;
  return value;
}
