"use client";

import type { Bootstrap, Product } from "@/lib/types";
import { readOfflineBootstrap, saveOfflineBootstrap } from "@/lib/offline-cache";

const DB = "cash-you-offline-v1";
const QUEUE = "outbox";
const TEMP_ID = "cash-you.temp-id";
type Operation = { id: string; url: string; method: string; body: unknown; tempId?: number; refs?: { localId: number; resultPath: string }[]; createdAt: string };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("cache")) request.result.createObjectStore("cache");
      if (!request.result.objectStoreNames.contains(QUEUE)) request.result.createObjectStore(QUEUE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("تعذر فتح قاعدة البيانات المحلية"));
  });
}

async function allOperations(): Promise<Operation[]> {
  const db = await openDb();
  const rows = await new Promise<Operation[]>((resolve, reject) => {
    const request = db.transaction(QUEUE, "readonly").objectStore(QUEUE).getAll();
    request.onsuccess = () => resolve(request.result as Operation[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function storeOperation(operation: Operation) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE, "readwrite");
    tx.objectStore(QUEUE).put(operation);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  window.dispatchEvent(new CustomEvent("cash-you:sync-state", { detail: { pending: (await allOperations()).length } }));
}

async function removeOperation(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE, "readwrite");
    tx.objectStore(QUEUE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const temp = () => {
  const prior = Number(localStorage.getItem(TEMP_ID) ?? "0");
  const next = Math.min(-1, prior - 1);
  localStorage.setItem(TEMP_ID, String(next));
  return next;
};
const isoNow = () => new Date().toISOString();
const makeResponse = (value: unknown, queued = true) => new Response(JSON.stringify({ ...value as object, _offlineQueued: queued }), {
  status: 200,
  headers: { "Content-Type": "application/json", "X-Cash-You-Queued": String(queued) },
});

function treasury(data: Bootstrap, direction: string, source: string, reference: string, partyName: string, amount: number, notes: string) {
  if (amount <= 0) return;
  data.treasury.unshift({ id: temp(), direction, source, reference, partyName, amount: r2(amount), notes, createdAt: isoNow() });
  data.summary.treasury = r2(data.summary.treasury + (direction === "وارد" ? amount : -amount));
}

function applyOffline(data: Bootstrap, url: string, method: string, body: any): { result: any; tempId?: number; refs?: { localId: number; resultPath: string }[] } {
  const path = new URL(url, location.href).pathname;
  const now = isoNow();

  if (path === "/api/products") {
    if (method === "DELETE") {
      data.products = data.products.filter((p) => p.id !== Number(body.id));
      return { result: { ok: true } };
    }
    const id = body.id ?? temp();
    const prior = data.products.find((item) => item.id === id);
    const product: Product = { ...prior, ...body, id, sortOrder: prior?.sortOrder ?? data.products.length + 1 } as Product;
    data.products = prior ? data.products.map((item) => item.id === id ? product : item) : [...data.products, product];
    return { result: product, tempId: id < 0 ? id : undefined };
  }

  if (path === "/api/parties" || path === "/api/customers") {
    const kind = path.endsWith("/customers") ? "customer" : body.kind;
    const rows = kind === "supplier" ? data.suppliers : data.customers;
    const id = body.id ?? temp();
    const prior = rows.find((party) => party.id === id);
    const party = { id, name: body.name ?? "", phone: body.phone ?? "", address: body.address ?? "", openingBalance: Number(body.openingBalance ?? 0), balance: Number(body.balance ?? 0) };
    if (kind === "supplier") data.suppliers = prior ? data.suppliers.map((row) => row.id === id ? party : row) : [...data.suppliers, party];
    else data.customers = prior ? data.customers.map((row) => row.id === id ? party : row) : [...data.customers, party];
    return { result: party, tempId: id < 0 ? id : undefined };
  }

  if (path === "/api/payment-methods") {
    const methodRow = { id: temp(), name: String(body.name ?? "") };
    data.paymentMethods.push(methodRow);
    return { result: methodRow, tempId: methodRow.id };
  }

  if (path === "/api/invoices" && method === "PATCH") {
    const invoice = data.invoices.find((item) => item.number === Number(body.number));
    if (invoice) invoice.printed = true;
    return { result: { ok: true, number: body.number } };
  }

  if (path === "/api/invoices") {
    const items = Array.isArray(body.items) ? body.items : [];
    const subtotal = r2(items.reduce((sum: number, item: any) => sum + Math.max(0, Number(item.price) * Number(item.qty)), 0));
    const total = subtotal;
    const paid = r2(Math.max(0, Math.min(total, Number(body.installment?.downPayment ?? body.paid ?? 0))));
    const credit = body.installment ? 0 : r2(Math.max(0, Number(body.credit ?? 0)));
    const remaining = r2(total - paid);
    const number = data.nextInvoiceNumber;
    const id = temp();
    const customerName = String(body.customerName || "عميل نقدي");
    const createdAt = now;
    const customer = data.customers.find((row) => row.id === body.customerId);
    if (customer && remaining - credit !== 0) customer.balance = r2(customer.balance + remaining - credit);
    for (const item of items) {
      const product = data.products.find((row) => row.id === item.productId);
      if (product) product.stock = r2(product.stock - Number(item.qty));
    }
    data.invoices.unshift({ id, number, customerId: body.customerId ?? null, customerName, paymentMethod: body.paymentMethod ?? "نقدي", saleType: body.saleType ?? "نقدي", total, paid, remaining, itemsCount: items.length, createdAt });
    data.nextInvoiceNumber += 1;
    if (paid > 0) treasury(data, "وارد", "مبيعات", `بيع-${number}`, customerName, paid, "تم حفظ الفاتورة أثناء انقطاع الإنترنت");
    let installmentPlanId: number | undefined;
    const installmentIds: number[] = [];
    const refs: { localId: number; resultPath: string }[] = [];
    if (body.installment && customer) {
      const planId = temp();
      installmentPlanId = planId;
      refs.push({ localId: planId, resultPath: "installmentPlanId" });
      const months = Math.max(1, Number(body.installment.months));
      const interest = r2(remaining * Number(body.installment.interestRate ?? 0) / 100);
      if (customer) customer.balance = r2(customer.balance + interest);
      const planTotal = r2(remaining + interest);
      const monthly = r2(planTotal / months);
      data.installmentPlans.unshift({ id: planId, invoiceNumber: number, customerId: customer.id, customerName, principal: remaining, downPayment: paid, interestRate: Number(body.installment.interestRate ?? 0), interestValue: interest, months, monthlyAmount: monthly, firstDueDate: body.installment.firstDueDate, guarantorName: body.installment.guarantorName ?? "", guarantorPhone: body.installment.guarantorPhone ?? "" });
      const today = new Date().toISOString().slice(0, 10);
      for (let index = 0; index < months; index += 1) {
        const due = new Date(`${body.installment.firstDueDate}T12:00:00`);
        due.setMonth(due.getMonth() + index);
        const dueDate = due.toISOString().slice(0, 10);
        if (dueDate <= today) data.summary.dueInstallments += 1;
        const installmentId = temp();
        installmentIds.push(installmentId);
        refs.push({ localId: installmentId, resultPath: `installmentIds.${index}` });
        data.installments.push({ id: installmentId, planId, customerId: customer.id, customerName, sequence: index + 1, dueDate, amount: index === months - 1 ? r2(planTotal - monthly * (months - 1)) : monthly, status: "مستحق", paidAt: null, invoiceNumber: number });
      }
    }
    data.summary.todaySales = r2(data.summary.todaySales + total);
    return { result: { id, number, total, paid, remaining, customerName, createdAt, newCustomerBalance: customer?.balance ?? 0, nextInvoiceNumber: data.nextInvoiceNumber, installmentPlanId, installmentIds }, tempId: id, refs };
  }

  if (path === "/api/trade") {
    const items = Array.isArray(body.items) ? body.items : [];
    const subtotal = r2(items.reduce((sum: number, item: any) => {
      const product = data.products.find((row) => row.id === Number(item.productId));
      return sum + Number(item.qty) * Number(item.price ?? product?.price ?? 0);
    }, 0));
    const discountPercent = Math.max(0, Math.min(100, Number(body.discountPercent ?? 0)));
    const total = r2(subtotal - subtotal * discountPercent / 100);
    const paid = r2(Math.max(0, Math.min(total, Number(body.paid ?? 0))));
    const overpay = body.kind === "purchase" ? r2(Math.max(0, Number(body.paid ?? 0) - total)) : 0;
    const creditBack = overpay > 0 && body.overMode === "credit" ? overpay : 0;
    const party = body.kind === "salesReturn" ? data.customers.find((row) => row.id === Number(body.partyId)) : data.suppliers.find((row) => row.id === Number(body.partyId));
    const partyName = party?.name ?? "";
    const number = body.kind === "purchase" ? data.nextPurchaseNumber++ : Math.max(9001, ...data.returns.map((item) => item.number + 1));
    const id = temp();
    for (const item of items) {
      const product = data.products.find((row) => row.id === Number(item.productId));
      if (!product) continue;
      const qty = Number(item.qty);
      if (body.kind === "purchase" || body.kind === "salesReturn") product.stock = r2(product.stock + qty);
      else product.stock = r2(product.stock - qty);
      if (body.kind === "purchase") product.cost = Number(item.price);
    }
    if (party && body.kind === "purchase") party.balance = r2(party.balance + total - paid - creditBack);
    if (party && body.kind !== "purchase") party.balance = r2(party.balance - total + paid);
    if (body.kind === "purchase") {
      data.summary.todayPurchases = r2(data.summary.todayPurchases + total);
      data.purchases.unshift({ id, number, supplierId: Number(body.partyId), supplierName: partyName, total, paid, remaining: r2(total - paid), createdAt: now });
      treasury(data, "منصرف", "مشتريات", `شراء-${number}`, partyName, paid, "مزامنة مستند شراء مؤجل");
      if (overpay > 0 && body.overMode === "change") treasury(data, "وارد", "مشتريات", `شراء-${number}`, partyName, overpay, "باقي مسلَّم من المورد للزيادة في الدفع");
    } else {
      data.summary.todayReturns = r2(data.summary.todayReturns + total);
      data.returns.unshift({ id, number, kind: body.kind === "salesReturn" ? "مرتجع مبيعات" : "مرتجع مشتريات", referenceNumber: body.referenceNumber ?? null, partyName, total, cashAmount: paid, createdAt: now });
      treasury(data, body.kind === "salesReturn" ? "منصرف" : "وارد", body.kind === "salesReturn" ? "مرتجع مبيعات" : "مرتجع مشتريات", `مرتجع-${number}`, partyName, paid, "مزامنة مرتجع مؤجل");
    }
    return { result: { number, subtotal, discountPercent, total, paid, remaining: r2(total - paid), partyName }, tempId: id };
  }

  if (path === "/api/vouchers") {
    const isReceipt = body.kind === "receipt";
    const party = (isReceipt ? data.customers : data.suppliers).find((row) => row.id === Number(body.partyId));
    const number = Math.max(3001, ...data.vouchers.map((item) => item.number + 1));
    const amount = r2(Number(body.amount));
    if (party) party.balance = r2(party.balance - amount);
    const partyName = party?.name ?? "";
    data.vouchers.unshift({ id: temp(), number, kind: isReceipt ? "سند قبض من عميل" : "سند صرف لمورد", partyType: isReceipt ? "عميل" : "مورد", partyName, amount, notes: body.notes ?? "", createdAt: now });
    treasury(data, isReceipt ? "وارد" : "منصرف", isReceipt ? "سند قبض" : "سند صرف", `سند-${number}`, partyName, amount, body.notes ?? "");
    return { result: { number, partyName, amount } };
  }

  if (path === "/api/installments") {
    const row = data.installments.find((item) => item.id === Number(body.id));
    if (!row) return { result: { id: body.id, status: "مدفوع", paidAt: now } };
    row.status = "مدفوع"; row.paidAt = now;
    if (row.dueDate <= new Date().toISOString().slice(0, 10)) data.summary.dueInstallments = Math.max(0, data.summary.dueInstallments - 1);
    const customer = data.customers.find((item) => item.id === row.customerId);
    if (customer) customer.balance = r2(customer.balance - row.amount);
    const reference = `قسط-${row.planId}-${row.sequence}`;
    treasury(data, "وارد", "تحصيل أقساط", reference, row.customerName, row.amount, `القسط رقم ${row.sequence}`);
    return { result: { ...row, reference, paidAt: now } };
  }

  if (path === "/api/treasury") {
    if (body.action === "closeShift") {
      const shift = data.shifts.find((item) => item.status === "مفتوحة");
      if (!shift) return { result: { number: 0, nextNumber: 1, closingCash: data.summary.treasury } };
      const number = shift.number;
      shift.status = "مغلقة"; shift.closedAt = now; shift.closingCash = data.summary.treasury;
      const nextNumber = number + 1;
      data.shifts.unshift({ id: temp(), number: nextNumber, openedAt: now, closedAt: null, openingCash: shift.closingCash, closingCash: 0, sales: 0, purchases: 0, expenses: 0, receipts: 0, payments: 0, status: "مفتوحة" });
      return { result: { number, nextNumber, closingCash: shift.closingCash, openingCash: shift.openingCash, incoming: 0, outgoing: 0, sales: 0, purchases: 0, expenses: 0, receipts: 0, payments: 0 } };
    }
    const number = Math.max(1003, ...data.expenses.map((item) => item.number + 1));
    const amount = r2(Number(body.amount));
    data.expenses.unshift({ id: temp(), number, category: body.category, amount, notes: body.notes ?? "", createdAt: now });
    data.summary.todayExpenses = r2(data.summary.todayExpenses + amount);
    treasury(data, "منصرف", "مصروفات", `مصروف-${number}`, body.category, amount, body.notes ?? "");
    return { result: { number, amount } };
  }

  throw new Error(`العمل دون إنترنت غير مدعوم لهذا المسار: ${path}`);
}

function remap(value: any, ids: Map<number, number>): any {
  if (Array.isArray(value)) return value.map((item) => remap(item, ids));
  if (!value || typeof value !== "object") return typeof value === "number" && value < 0 ? ids.get(value) ?? value : value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, remap(child, ids)]));
}

let flushTask: Promise<{ synced: number; pending: number }> | null = null;

async function runOfflineQueue(): Promise<{ synced: number; pending: number }> {
  if (typeof navigator === "undefined" || !navigator.onLine) return { synced: 0, pending: (await allOperations()).length };
  const operations = await allOperations();
  const storedMap = JSON.parse(localStorage.getItem("cash-you.offline-id-map.v1") ?? "[]") as [number, number][];
  const idMap = new Map<number, number>(storedMap);
  let synced = 0;
  for (const operation of operations) {
    const response = await fetch(operation.url, {
      method: operation.method,
      headers: { "Content-Type": "application/json", "X-Cash-You-Offline-Operation": operation.id },
      body: JSON.stringify(remap(operation.body, idMap)),
    }).catch(() => null);
    if (!response?.ok) break;
    const result = await response.json().catch(() => ({}));
    if (operation.tempId && Number.isInteger(result.id) && result.id > 0) idMap.set(operation.tempId, result.id);
    for (const ref of operation.refs ?? []) {
      const mapped = ref.resultPath.split(".").reduce<any>((value, key) => value?.[key], result);
      if (Number.isInteger(mapped) && mapped > 0) idMap.set(ref.localId, mapped);
    }
    if (idMap.size) localStorage.setItem("cash-you.offline-id-map.v1", JSON.stringify([...idMap.entries()]));
    await removeOperation(operation.id);
    synced += 1;
  }
  const pending = (await allOperations()).length;
  window.dispatchEvent(new CustomEvent("cash-you:sync-state", { detail: { pending, synced } }));
  if (synced > 0) window.dispatchEvent(new Event("cash-you:sync-complete"));
  return { synced, pending };
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  let mustQueueBehindPending = false;
  if (method !== "GET" && navigator.onLine && (await allOperations()).length > 0) {
    const synced = await flushOfflineQueue();
    mustQueueBehindPending = synced.pending > 0;
  }
  try {
    if (mustQueueBehindPending) throw new Error("عمليات سابقة ما زالت تنتظر المزامنة");
    const response = await fetch(input, init);
    if (response.ok || method === "GET" || navigator.onLine) return response;
  } catch {
    if (method === "GET") {
      if (new URL(url, location.href).pathname === "/api/bootstrap") {
        const cached = await readOfflineBootstrap();
        if (cached) return new Response(JSON.stringify(cached), { status: 200, headers: { "Content-Type": "application/json", "X-Cash-You-Offline": "true" } });
      }
      throw new Error("لا يوجد اتصال بالخادم");
    }
  }
  if (method === "GET") throw new Error("لا يوجد اتصال بالخادم");
  const data = await readOfflineBootstrap();
  if (!data) throw new Error("لا توجد نسخة محلية محفوظة؛ اتصل بالإنترنت مرة واحدة أولًا");
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  const path = new URL(url, location.href).pathname;
  const { result, tempId, refs } = applyOffline(data, url, method, body);
  await saveOfflineBootstrap(data);
  const operation: Operation = {
    id: crypto.randomUUID(), url: path, method, body, tempId, refs, createdAt: new Date().toISOString(),
  };
  await storeOperation(operation);
  window.dispatchEvent(new Event("cash-you:offline-write"));
  return makeResponse(result);
}

export function flushOfflineQueue(): Promise<{ synced: number; pending: number }> {
  if (flushTask) return flushTask;
  flushTask = runOfflineQueue().finally(() => { flushTask = null; });
  return flushTask;
}

export async function pendingOfflineCount(): Promise<number> {
  return (await allOperations()).length;
}
