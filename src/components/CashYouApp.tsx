"use client";

import { apiFetch, flushOfflineQueue, pendingOfflineCount } from "@/lib/offline-sync";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bootstrap, Customer, InstallmentInput, InvoiceRow, ModuleKind, PaymentMethod, Product, SessionUser, TrialStatus } from "@/lib/types";
import { applyPrefs, loadPrefs, savePrefs, type UiPrefs } from "@/lib/ui-prefs";
import { computeTotals, emptyDraft, lineTotal, newLine, type Draft } from "@/lib/draft";
import { arDate, arTime, money, uid } from "@/lib/format";
import {
  isMuted,
  setMuted,
  sfxAdd,
  sfxCash,
  sfxError,
  sfxKey,
  sfxOutOfStock,
  sfxRemove,
  sfxSave,
  sfxScan,
  sfxToggle,
} from "@/lib/sound";
import { FloatingMenu, GlobalSearch, StatusBar, TabStrip, TitleBar, type Tab } from "@/components/Chrome";
import { OverpayDialog, SalePreviewDialog } from "@/components/SaleDialogs";
import { IdleLock } from "@/components/IdleLock";
import { DesktopUpdateToast } from "@/components/DesktopUpdateToast";
import { SettingsScreen } from "@/components/SettingsScreen";
import { PosScreen, type PosActions } from "@/components/PosScreen";
import { HomeScreen } from "@/components/HomeScreen";
import { ProductsScreen, PartiesScreen } from "@/components/ManagementScreens";
import { TradeScreen } from "@/components/TradeScreen";
import { ExpensesScreen, InstallmentsScreen, ReportsScreen, TreasuryScreen } from "@/components/FinanceScreens";
import { InstallmentDialog } from "@/components/InstallmentDialog";
import { UsersScreen } from "@/components/UsersScreen";
import { ActivationScreen } from "@/components/ActivationScreen";
import { BackupPanel } from "@/components/BackupPanel";
import { readOfflineBootstrap, saveOfflineBootstrap } from "@/lib/offline-cache";
import {
  CloseConfirm,
  CustomerDisplay,
  CustomerViewDialog,
  InvoiceDetail,
  ItemViewDialog,
  MinimizedBar,
  PromptDialog,
  ReceiptModal,
  ShutdownScreen,
  Toasts,
  WelcomeToast,
  type ReceiptData,
  type Toast,
  ShortcutsDialog,
} from "@/components/Overlays";

type Overlay =
  | { kind: "none" }
  | { kind: "customerScreen" }
  | { kind: "addCustomer" }
  | { kind: "addPayment" }
  | { kind: "productView"; product: Product }
  | { kind: "customerView"; customer: Customer }
  | { kind: "close" }
  | { kind: "receipt"; receipt: ReceiptData; autoPrint: boolean }
  | { kind: "preview" }
  | { kind: "overpay"; print: boolean }
  | { kind: "invoice"; invoice: InvoiceRow }
  | { kind: "installment"; print: boolean }
  | { kind: "backup" }
  | { kind: "shortcuts" };

export default function CashYouApp({
  initial,
  user,
  onLogout,
}: {
  initial: Bootstrap;
  user: SessionUser | null;
  onLogout: () => Promise<void> | void;
}) {
  const [data, setData] = useState<Bootstrap>(initial);
  const [tabs, setTabs] = useState<Tab[]>([
    { id: "home", kind: "home", title: "الرئيسية" },
    { id: "inv-1", kind: "invoice", title: "فاتورة مبيعات" },
  ]);
  /* يفتح البرنامج على الشاشة الرئيسية، وتبقى فاتورة المبيعات تبويباً جاهزاً */
  const [activeId, setActiveId] = useState("home");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({
    "inv-1": emptyDraft(initial.nextInvoiceNumber),
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [muted, setMutedState] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>({ kind: "none" });
  const [minimized, setMinimized] = useState(false);
  const [shutdown, setShutdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trial, setTrial] = useState<TrialStatus | null>(initial.trial ?? null);
  const [welcome, setWelcome] = useState(true);
  const [trialOpen, setTrialOpen] = useState(false);
  const [syncPending, setSyncPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [prefs, setPrefs] = useState<UiPrefs>(() => loadPrefs());
  const [searchOpen, setSearchOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsFocus, setSettingsFocus] = useState<{ tab: string; nonce: number } | null>(null);

  /* ---------------- تفضيلات الواجهة (الثيم والألوان والأزرار) ---------------- */
  useEffect(() => {
    applyPrefs(prefs);
  }, [prefs]);
  const updatePrefs = useCallback((next: UiPrefs) => {
    setPrefs(next);
    savePrefs(next);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggleFullscreen = useCallback(() => {
    sfxKey();
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
    else void document.exitFullscreen?.().catch(() => undefined);
  }, []);

  const barcodeRef = useRef<HTMLInputElement | null>(null);
  const seq = useRef(1);

  /* ---------------- الساعة الحية ---------------- */
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    void saveOfflineBootstrap(data).catch(() => undefined);
  }, [data]);

  /* ---------------- التنبيهات ---------------- */
  const toast = useCallback(
    (kind: Toast["kind"], text: string, undo?: () => void) => {
      const id = uid();
      setToasts((prev) => [...prev.slice(-3), { id, kind, text, undo }]);
      window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), undo ? 6500 : 4200);
    },
    [],
  );
  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* ---------------- التبويب النشط ---------------- */
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const draft = drafts[activeId] ?? drafts["inv-1"] ?? emptyDraft(data.nextInvoiceNumber);
  const totals = useMemo(() => computeTotals(draft), [draft]);

  /* تركيز خانة الباركود تلقائياً عند فتح أو تبديل فاتورة */
  const activeKind = activeTab?.kind;
  useEffect(() => {
    if (activeKind !== "invoice") return;
    const t = window.setTimeout(() => barcodeRef.current?.focus(), 90);
    return () => window.clearTimeout(t);
  }, [activeId, activeKind]);

  /** تعديل مسودة فاتورة بعينها (قد تكون غير النشطة) */
  const updateDraftOf = useCallback((id: string, fn: (cur: Draft) => Draft) => {
    setDrafts((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: fn(cur) };
    });
  }, []);

  const patch = useCallback(
    (p: Partial<Draft>) => {
      setDrafts((prev) => {
        const cur = prev[activeId];
        if (!cur) return prev;
        return { ...prev, [activeId]: { ...cur, ...p } };
      });
    },
    [activeId],
  );

  /* ---------------- إدارة التبويبات ---------------- */
  const openInvoiceTab = useCallback(() => {
    seq.current += 1;
    const id = `inv-${seq.current}`;
    const openCount = tabs.filter((t) => t.kind === "invoice").length;
    setDrafts((prev) => ({
      ...prev,
      [id]: emptyDraft(data.nextInvoiceNumber + openCount),
    }));
    setTabs((prev) => [...prev, { id, kind: "invoice", title: "فاتورة مبيعات" }]);
    setActiveId(id);
    sfxKey();
    window.setTimeout(() => barcodeRef.current?.focus(), 60);
    return id;
  }, [data.nextInvoiceNumber, tabs]);

  const openLastInvoice = () => {
    sfxKey();
    const last = data.invoices[0];
    if (!last) {
      toast("warn", "لا توجد فواتير محفوظة بعد");
      return;
    }
    setOverlay({ kind: "invoice", invoice: last });
  };

  const openModule = useCallback((kind: ModuleKind, title: string) => {
    if (kind === "invoice") { openInvoiceTab(); return; }
    if (kind === "home") { setActiveId("home"); sfxKey(); return; }
    if (kind === "backup") { setOverlay({ kind: "backup" }); sfxKey(); return; }
    const id = `module-${kind}-${title}`;
    setTabs((prev) => prev.some((t) => t.id === id) ? prev : [...prev, { id, kind, title }]);
    setActiveId(id);
    sfxKey();
  }, [openInvoiceTab]);

  /** فتح الإعدادات على قسم بعينه (مثلاً تخصيص القائمة) */
  const openSettings = useCallback(
    (tab: string) => {
      setSettingsFocus({ tab, nonce: Date.now() });
      openModule("settings", "الإعدادات");
    },
    [openModule],
  );

  const refreshData = useCallback(async () => {
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
      if (!res.ok) throw new Error("تعذر تحديث البيانات من قاعدة البيانات");
      const fresh = (await res.json()) as Bootstrap;
      setData(fresh);
      void saveOfflineBootstrap(fresh).catch(() => undefined);
    } catch (error) {
      const cached = await readOfflineBootstrap().catch(() => null);
      if (!cached) throw error;
      setData(cached);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const updateOnline = () => setOnline(navigator.onLine);
    const updatePending = (event: Event) => {
      const count = (event as CustomEvent<{ pending: number }>).detail?.pending;
      if (typeof count === "number") setSyncPending(count);
    };
    const sync = async () => {
      updateOnline();
      const initialPending = await pendingOfflineCount().catch(() => 0);
      if (alive) setSyncPending(initialPending);
      if (!navigator.onLine) return;
      const result = await flushOfflineQueue().catch(() => ({ synced: 0, pending: initialPending }));
      if (!alive) return;
      setSyncPending(result.pending);
      if (result.synced > 0) await refreshData().catch(() => undefined);
    };
    window.addEventListener("online", sync);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("cash-you:sync-state", updatePending);
    void sync();
    return () => {
      alive = false;
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("cash-you:sync-state", updatePending);
    };
  }, [refreshData]);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (next.length === 0) return prev;
        return next;
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setActiveId((cur) => (cur === id ? "home" : cur));
      sfxKey();
    },
    [],
  );

  /* ---------------- إضافة الأصناف ---------------- */
  const addProductTo = useCallback(
    (id: string, p: Product, qty = 1) => {
      updateDraftOf(id, (cur) => {
        const existing = cur.items.find((li) => li.productId === p.id);
        if (existing) {
          return {
            ...cur,
            items: cur.items.map((li) => (li.uid === existing.uid ? { ...li, qty: li.qty + qty } : li)),
            lastAddedUid: existing.uid,
          };
        }
        const li = newLine(p.id, p.code, p.name, p.unit, p.price);
        return { ...cur, items: [...cur.items, { ...li, qty }], lastAddedUid: li.uid };
      });
      if (p.stock <= 0) sfxOutOfStock();
      else sfxAdd();
      if (p.stock <= 0) toast("warn", `تنبيه: رصيد الصنف «${p.name}» نفد من المخزون`);
    },
    [updateDraftOf, toast],
  );

  const addProduct = useCallback((p: Product, qty = 1) => addProductTo(activeId, p, qty), [activeId, addProductTo]);

  /** إضافة صنف من أي مكان (البحث العام): يفتح فاتورة جديدة إن لم تكن فاتورة نشطة */
  const addProductAnywhere = useCallback(
    (p: Product) => {
      if (activeTab?.kind === "invoice") addProductTo(activeId, p);
      else addProductTo(openInvoiceTab(), p);
    },
    [activeTab, activeId, addProductTo, openInvoiceTab],
  );

  const addByCode = useCallback(
    (raw: string) => {
      const term = raw.trim();
      if (!term) return false;
      const hit =
        data.products.find((p) => p.code === term) ??
        data.products.find((p) => p.code.endsWith(term)) ??
        data.products.find((p) => p.name.includes(term));
      if (!hit) {
        sfxError();
        toast("err", `لا يوجد صنف بالكود «${term}»`);
        return false;
      }
      sfxScan();
      addProduct(hit);
      return true;
    },
    [data.products, addProduct, toast],
  );

  const updateLine = useCallback(
    (lineUid: string, p: Partial<{ qty: number; price: number }>) => {
      setDrafts((prev) => {
        const cur = prev[activeId];
        if (!cur) return prev;
        return {
          ...prev,
          [activeId]: {
            ...cur,
            items: cur.items.map((li) => (li.uid === lineUid ? { ...li, ...p } : li)),
          },
        };
      });
    },
    [activeId],
  );

  const removeLine = useCallback(
    (lineUid: string) => {
      const cur = drafts[activeId];
      if (!cur) return;
      const removed = cur.items.find((li) => li.uid === lineUid);
      const index = cur.items.findIndex((li) => li.uid === lineUid);
      if (!removed) return;
      setDrafts((prev) => ({
        ...prev,
        [activeId]: { ...cur, items: cur.items.filter((li) => li.uid !== lineUid) },
      }));
      sfxRemove();
      toast("warn", `تم حذف «${removed.name}» من الفاتورة`, () => {
        setDrafts((prev) => {
          const c = prev[activeId];
          if (!c) return prev;
          const items = [...c.items];
          items.splice(Math.min(index, items.length), 0, removed);
          return { ...prev, [activeId]: { ...c, items } };
        });
        sfxAdd();
      });
    },
    [activeId, drafts, toast],
  );

  const payFull = useCallback(() => {
    if (draft.items.length === 0) {
      sfxError();
      toast("warn", "أضف أصنافاً إلى الفاتورة أولاً");
      return;
    }
    patch({ paidText: String(computeTotals(draft).total) });
    sfxCash();
    toast("ok", `تم تسجيل دفع كامل بمبلغ ${money(computeTotals(draft).total)} جنيه`);
  }, [draft, patch, toast]);

  const newInvoice = useCallback(() => {
    if (activeTab?.kind !== "invoice") {
      openInvoiceTab();
      return;
    }
    if (draft.items.length === 0) {
      sfxKey();
      toast("info", "الفاتورة الحالية فارغة — جاهزة للمسح الضوئي");
      barcodeRef.current?.focus();
      return;
    }
    openInvoiceTab();
    toast("ok", "تم فتح فاتورة جديدة في تبويب مستقل");
  }, [activeTab, draft.items.length, openInvoiceTab, toast]);

  /* ---------------- الحفظ ---------------- */
  const save = useCallback(
    async (print: boolean, installment?: InstallmentInput, opts?: { skipPreview?: boolean; overMode?: "change" | "credit" }) => {
      if (saving) return;
      if (activeTab?.kind !== "invoice") {
        toast("warn", "افتح تبويب فاتورة مبيعات أولاً");
        return;
      }
      if (draft.items.length === 0) {
        sfxError();
        toast("err", "لا يمكن حفظ فاتورة بدون أصناف");
        return;
      }
      if (draft.saleType === "تقسيط" && !installment) {
        if (!draft.customerId) {
          sfxError();
          toast("err", "اختر عميلاً محدداً قبل البيع بالتقسيط");
          return;
        }
        setOverlay({ kind: "installment", print });
        return;
      }
      // «حفظ وطباعة»: تظهر المعاينة أولاً، ولا يُحفظ شيء قبل ضغط «طباعة»
      if (print && !installment && !opts?.skipPreview) {
        setOverlay({ kind: "preview" });
        return;
      }
      const snapshot = draft;
      const t = computeTotals(snapshot);
      // المدفوع أكبر من الفاتورة: يختار المستخدم تسليم الباقي أو تنزيله على الحساب
      const extra = Math.round((t.paid - t.total) * 100) / 100;
      const fixedMode = prefs.overpay.mode === "ask" ? undefined : prefs.overpay.mode;
      const requested = opts?.overMode ?? fixedMode;
      // التنزيل على الحساب يحتاج عميلاً مسجلاً؛ بدونه يُسلَّم الباقي نقداً
      const overMode = requested === "credit" && snapshot.customerId === null ? "change" : requested;
      if (!installment && snapshot.saleType !== "تقسيط" && extra > 0 && !overMode) {
        setOverlay({ kind: "overpay", print });
        return;
      }
      const credit = !installment && extra > 0 && overMode === "credit" ? extra : 0;
      setSaving(true);
      try {
        const res = await apiFetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: snapshot.customerId,
            customerName: snapshot.customerName,
            paymentMethod: snapshot.paymentMethod,
            saleType: snapshot.saleType,
            paid: Math.min(t.total, t.paid),
            credit,
            printed: false,
            installment,
            items: snapshot.items.map((li) => ({
              productId: li.productId,
              code: li.code,
              name: li.name,
              unit: li.unit,
              qty: li.qty,
              price: li.price,
            })),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "تعذر حفظ الفاتورة");

        const receipt: ReceiptData = {
          number: json.number,
          createdAt: json.createdAt,
          customerName: snapshot.customerName,
          paymentMethod: snapshot.paymentMethod,
          saleType: snapshot.saleType,
          subtotal: t.subtotal,
          total: json.total,
          paid: json.paid,
          remaining: json.remaining,
          previousBalance: json.previousBalance ?? null,
          overpayCredit: json.overpayCredit ?? 0,
          items: snapshot.items.map((li) => ({
            name: li.name,
            code: li.code,
            qty: li.qty,
            price: li.price,
            total: lineTotal(li),
            unit: li.unit,
          })),
        };

        const newRow: InvoiceRow = {
          id: json.id,
          number: json.number,
          customerId: snapshot.customerId,
          customerName: snapshot.customerName,
          paymentMethod: snapshot.paymentMethod,
          saleType: snapshot.saleType,
          total: json.total,
          paid: json.paid,
          remaining: json.remaining,
          itemsCount: snapshot.items.length,
          createdAt: json.createdAt,
        };

        // تنبيه عند وصول صنف إلى حد التنبيه (من فوق الحد إلى الحد أو أقل) بعد هذه الفاتورة
        const soldQty = new Map<string, number>();
        snapshot.items.forEach((li) => {
          if (li.productId) soldQty.set(String(li.productId), (soldQty.get(String(li.productId)) ?? 0) + li.qty);
        });
        const reachedLimit = data.products
          .filter((p) => soldQty.has(String(p.id)) && p.stock > p.minStockLimit && p.stock - (soldQty.get(String(p.id)) ?? 0) <= p.minStockLimit)
          .map((p) => p.name);
        if (reachedLimit.length) toast("warn", `وصل للحد الأدنى: ${reachedLimit.join("، ")}`);

        setData((prev) => {
          const stockMap = new Map<string, number>();
          snapshot.items.forEach((li) => {
            if (li.productId) stockMap.set(String(li.productId), (stockMap.get(String(li.productId)) ?? 0) + li.qty);
          });
          return {
            ...prev,
            nextInvoiceNumber: json.nextInvoiceNumber,
            invoices: [newRow, ...prev.invoices].slice(0, 40),
            products: prev.products.map((p) =>
              stockMap.has(String(p.id)) ? { ...p, stock: p.stock - (stockMap.get(String(p.id)) ?? 0) } : p,
            ),
            customers: prev.customers.map((c) =>
              c.id === snapshot.customerId ? { ...c, balance: json.newCustomerBalance } : c,
            ),
          };
        });

        setDrafts((prev) => ({
          ...prev,
          [activeId]: {
            ...emptyDraft(json.number),
            number: json.number,
            customerId: snapshot.customerId,
            customerName: snapshot.customerName,
            paymentMethod: snapshot.paymentMethod,
            saleType: snapshot.saleType,
          },
        }));

        await refreshData();
        sfxSave();
        // Both save actions show the saved receipt so the user can print or cancel.
        setOverlay({ kind: "receipt", receipt, autoPrint: print });
        window.setTimeout(() => barcodeRef.current?.focus(), 80);
      } catch (err) {
        sfxError();
        toast("err", err instanceof Error ? err.message : "تعذر حفظ الفاتورة");
      } finally {
        setSaving(false);
      }
    },
    [activeId, activeTab, draft, saving, toast, refreshData, prefs.overpay.mode, data.products],
  );

  /* ---------------- اختصارات لوحة المفاتيح ---------------- */
  const saveRef = useRef(save);
  const newRef = useRef(newInvoice);
  const payRef = useRef(payFull);
  const kindRef = useRef<Tab["kind"] | undefined>(activeTab?.kind);
  useEffect(() => {
    saveRef.current = save;
    newRef.current = newInvoice;
    payRef.current = payFull;
    kindRef.current = activeTab?.kind;
  }, [save, newInvoice, payFull, activeTab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const keys = ["F1", "F3", "F4", "F5", "F10", "F12"];
      if (keys.includes(e.key)) {
        e.preventDefault();
        if (shutdown || minimized) return;
        if (e.key === "F1") {
          sfxKey();
          setOverlay({ kind: "shortcuts" });
          return;
        }
        if (e.key === "F3") {
          sfxKey();
          barcodeRef.current?.focus();
          barcodeRef.current?.select();
        }
        if (e.key === "F4") newRef.current();
        if (kindRef.current !== "invoice") return;
        if (e.key === "F5") void saveRef.current(false);
        if (e.key === "F10") void saveRef.current(true);
        if (e.key === "F12") payRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        sfxKey();
        setSearchOpen(true);
      }
      if (e.key === "Escape" && searchOpen) setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shutdown, minimized, searchOpen]);

  /* ---------------- أزرار النافذة ---------------- */
  const onWindowAction = useCallback((a: "min" | "close") => {
    sfxKey();
    if (a === "min") setMinimized(true);
    if (a === "close") setOverlay({ kind: "close" });
  }, []);

  const toggleMute = useCallback(() => {
    const next = !isMuted();
    setMuted(next);
    setMutedState(next);
    if (!next) sfxToggle();
  }, []);

  /* ---------------- إجراءات شاشة البيع ---------------- */
  const actions: PosActions = useMemo(
    () => ({
      patch,
      addProduct,
      addByCode,
      updateLine,
      removeLine,
      save: (p: boolean) => void save(p),
      newInvoice,
      payFull,
      openCustomerScreen: () => {
        sfxToggle();
        setOverlay({ kind: "customerScreen" });
      },
      quickAddCustomer: () => {
        sfxKey();
        setOverlay({ kind: "addCustomer" });
      },
      quickAddPayment: () => {
        sfxKey();
        setOverlay({ kind: "addPayment" });
      },
    }),
    [patch, addProduct, addByCode, updateLine, removeLine, save, newInvoice, payFull],
  );

  /* ---------------- إضافة عميل / طريقة دفع ---------------- */
  const submitCustomer = async (v: Record<string, string>) => {
    try {
      const res = await apiFetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: v.name, phone: v.phone, balance: Number(v.balance) || 0 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "تعذر إضافة العميل");
      const c = json as Customer;
      setData((prev) => ({ ...prev, customers: [...prev.customers, c] }));
      patch({ customerId: c.id, customerName: c.name });
      setOverlay({ kind: "none" });
      sfxSave();
      toast("ok", `تمت إضافة العميل «${c.name}» واختياره في الفاتورة`);
    } catch (err) {
      sfxError();
      toast("err", err instanceof Error ? err.message : "تعذر إضافة العميل");
    }
  };

  const submitPayment = async (v: Record<string, string>) => {
    try {
      const res = await apiFetch("/api/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: v.name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "تعذر إضافة طريقة الدفع");
      const m = json as PaymentMethod;
      setData((prev) => ({ ...prev, paymentMethods: [...prev.paymentMethods, m] }));
      patch({ paymentMethod: m.name });
      setOverlay({ kind: "none" });
      sfxSave();
      toast("ok", `تمت إضافة طريقة الدفع «${m.name}»`);
    } catch (err) {
      sfxError();
      toast("err", err instanceof Error ? err.message : "تعذر إضافة طريقة الدفع");
    }
  };

  const stamp = { date: arDate(now), time: arTime(now) };

  if (shutdown) {
    return (
      <ShutdownScreen
        onRestart={() => {
          setShutdown(false);
          setOverlay({ kind: "none" });
          sfxSave();
        }}
      />
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-ink-950 overflow-hidden">
      <TitleBar
        shopName={data.shop.name}
        muted={muted}
        onToggleMute={toggleMute}
        onWindowAction={onWindowAction}
        minimized={minimized}
        trial={trial}
        onOpenActivation={() => openModule("activation", "تفعيل النسخة")}
        onLogout={() => void onLogout()}
        onOpenSearch={() => {
          sfxKey();
          setSearchOpen(true);
        }}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
      {(!online || syncPending > 0) && (
        <div className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-black ${online ? "bg-amber-100 text-amber-900" : "bg-cash-red text-white"}`}>
          <span className={`h-2 w-2 rounded-full ${online ? "bg-amber-600" : "bg-white animate-pulse"}`} />
          <span>{online ? `عمليات محفوظة محليًا بانتظار المزامنة: ${syncPending}` : `غير متصل بالإنترنت — سيُزامن تلقائيًا عند عودة الاتصال${syncPending ? ` · ${syncPending} عملية معلقة` : ""}`}</span>
        </div>
      )}

      <TabStrip
        tabs={tabs}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id);
          sfxKey();
        }}
        onClose={closeTab}
        onNew={openInvoiceTab}
        menuOpen={menuOpen}
        onToggleMenu={() => {
          sfxKey();
          setMenuOpen((v) => !v);
        }}
      />

      <FloatingMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onPick={(kind, label) => (kind === "lastInvoice" ? openLastInvoice() : openModule(kind, label))}
        onCustomize={() => openSettings("menu")}
        showIcons={prefs.menu.icons}
      />

      <div className="flex-1 min-h-0 flex">
        <main className="flex-1 min-w-0 flex flex-col">
        <div key={activeTab?.id ?? "none"} className="cy-page-in flex-1 min-h-0 flex flex-col">
          {activeTab?.kind === "home" && (
            <HomeScreen
              data={data}
              onNewInvoice={openInvoiceTab}
              onOpenInvoice={(i) => setOverlay({ kind: "invoice", invoice: i })}
              onOpenModule={openModule}
            />
          )}

          {activeTab?.kind === "settings" && (
            <SettingsScreen
              key={settingsFocus?.nonce ?? 0}
              data={data}
              prefs={prefs}
              onChange={updatePrefs}
              refresh={refreshData}
              notify={toast}
              focus={settingsFocus}
              user={user}
            />
          )}
          {activeTab?.kind === "products" && <ProductsScreen data={data} refresh={refreshData} notify={toast} />}
          {activeTab?.kind === "parties" && <PartiesScreen key={activeTab.id} initialKind={activeTab.title === "الموردون" ? "supplier" : "customer"} data={data} refresh={refreshData} notify={toast} />}
          {(activeTab?.kind === "purchase" || activeTab?.kind === "salesReturn" || activeTab?.kind === "purchaseReturn") && (
            <TradeScreen key={activeTab.id} kind={activeTab.kind} data={data} refresh={refreshData} notify={toast} stamp={stamp} overpay={prefs.overpay} />
          )}
          {activeTab?.kind === "installments" && <InstallmentsScreen data={data} refresh={refreshData} notify={toast} />}
          {activeTab?.kind === "expenses" && <ExpensesScreen data={data} refresh={refreshData} notify={toast} />}
          {activeTab?.kind === "treasury" && <TreasuryScreen data={data} refresh={refreshData} notify={toast} />}
          {activeTab?.kind === "reports" && <ReportsScreen data={data} />}
          {activeTab?.kind === "users" && user && <UsersScreen user={user} notify={toast} />}
          {activeTab?.kind === "activation" && user && (
            <ActivationScreen
              user={user}
              trial={trial}
              notify={toast}
              onUpdated={(next) => {
                setTrial(next);
                void refreshData().catch(() => undefined);
              }}
            />
          )}

          {activeTab?.kind === "invoice" && (
            <PosScreen
              key={activeTab.id}
              data={data}
              draft={draft}
              totals={totals}
              actions={actions}
              barcodeRef={barcodeRef}
              saving={saving}
            />
          )}
        </div>
        </main>
      </div>

      <StatusBar
        dateText={stamp.date}
        timeText={stamp.time}
        user={user}
        trial={trial}
        onOpenActivation={() => openModule("activation", "تفعيل النسخة")}
      />

      {/* ---------------- الطبقات العلوية ---------------- */}
      <IdleLock minutes={prefs.lock.idleMinutes} />
      <DesktopUpdateToast />
      {overlay.kind === "customerScreen" && (
        <CustomerDisplay
          draft={draft}
          totals={totals}
          shopName={data.shop.name}
          onClose={() => setOverlay({ kind: "none" })}
        />
      )}

      {overlay.kind === "addCustomer" && (
        <PromptDialog
          title="إضافة عميل جديد"
          subtitle="سيتم اختيار العميل تلقائياً في الفاتورة الحالية"
          fields={[
            { key: "name", label: "اسم العميل", placeholder: "مثال: مكتبة الأمل", required: true },
            { key: "phone", label: "رقم التليفون", placeholder: "01xxxxxxxxx" },
            { key: "balance", label: "الرصيد الافتتاحي", placeholder: "0.00", type: "number" },
          ]}
          submitLabel="حفظ العميل"
          onClose={() => setOverlay({ kind: "none" })}
          onSubmit={(v) => void submitCustomer(v)}
        />
      )}

      {overlay.kind === "addPayment" && (
        <PromptDialog
          title="إضافة طريقة دفع"
          subtitle="مثال: محفظة فودافون كاش"
          fields={[{ key: "name", label: "اسم طريقة الدفع", placeholder: "اكتب الاسم...", required: true }]}
          submitLabel="إضافة"
          onClose={() => setOverlay({ kind: "none" })}
          onSubmit={(v) => void submitPayment(v)}
        />
      )}

      {overlay.kind === "productView" && (
        <ItemViewDialog
          product={overlay.product}
          categoryName={data.categories.find((c) => c.id === overlay.product.categoryId)?.name ?? "—"}
          onAdd={() => {
            addProductAnywhere(overlay.product);
            setOverlay({ kind: "none" });
          }}
          onClose={() => setOverlay({ kind: "none" })}
        />
      )}

      {overlay.kind === "customerView" && (
        <CustomerViewDialog
          customer={overlay.customer}
          onUse={() => {
            const id = activeTab?.kind === "invoice" ? activeId : openInvoiceTab();
            updateDraftOf(id, (cur) => ({
              ...cur,
              customerId: overlay.customer.id,
              customerName: overlay.customer.name,
            }));
            setOverlay({ kind: "none" });
            sfxKey();
          }}
          onClose={() => setOverlay({ kind: "none" })}
        />
      )}

      {searchOpen && (
        <GlobalSearch
          data={data}
          hueName={(catId) => data.categories.find((c) => c.id === catId)?.name ?? "—"}
          onClose={() => setSearchOpen(false)}
          onViewProduct={(p) => {
            setSearchOpen(false);
            setOverlay({ kind: "productView", product: p });
          }}
          onAddProduct={(p) => {
            setSearchOpen(false);
            addProductAnywhere(p);
          }}
          onViewCustomer={(c) => {
            setSearchOpen(false);
            setOverlay({ kind: "customerView", customer: c });
          }}
          onViewInvoice={(i) => {
            setSearchOpen(false);
            setOverlay({ kind: "invoice", invoice: i });
          }}
        />
      )}

      {overlay.kind === "installment" && (
        <InstallmentDialog
          total={totals.total}
          customerName={draft.customerName}
          onClose={() => setOverlay({ kind: "none" })}
          onSubmit={(cfg) => {
            setOverlay({ kind: "none" });
            void save(overlay.kind === "installment" ? overlay.print : false, cfg);
          }}
        />
      )}

      {overlay.kind === "receipt" && (
        <ReceiptModal
          receipt={overlay.receipt}
          shop={data.shop}
          prefs={prefs.receipt}
          autoPrint={overlay.autoPrint}
          onClose={() => setOverlay({ kind: "none" })}
        />
      )}

      {overlay.kind === "preview" && (
        <SalePreviewDialog
          receipt={{
            number: draft.number,
            createdAt: new Date().toISOString(),
            customerName: draft.customerName,
            paymentMethod: draft.paymentMethod,
            saleType: draft.saleType,
            subtotal: totals.subtotal,
            total: totals.total,
            paid: totals.paid,
            remaining: totals.remaining,
            previousBalance: draft.customerId ? (data.customers.find((c) => c.id === draft.customerId)?.balance ?? null) : null,
            items: draft.items.map((li) => ({
              name: li.name,
              code: li.code,
              qty: li.qty,
              price: li.price,
              total: lineTotal(li),
              unit: li.unit,
            })),
          }}
          shop={data.shop}
          prefs={prefs.receipt}
          busy={saving}
          onClose={() => setOverlay({ kind: "none" })}
          onConfirm={() => {
            setOverlay({ kind: "none" });
            void save(true, undefined, { skipPreview: true });
          }}
        />
      )}

      {overlay.kind === "overpay" && (
        <OverpayDialog
          previousBalance={data.customers.find((c) => c.id === draft.customerId)?.balance ?? 0}
          total={totals.total}
          paid={totals.paid}
          partyName={draft.customerName}
          creditAllowed={draft.customerId !== null}
          prefs={prefs.overpay}
          onClose={() => setOverlay({ kind: "none" })}
          onPick={(mode) => {
            const print = overlay.print;
            setOverlay({ kind: "none" });
            void save(print, undefined, { skipPreview: true, overMode: mode });
          }}
        />
      )}

      {overlay.kind === "invoice" && (
        <InvoiceDetail invoice={overlay.invoice} onClose={() => setOverlay({ kind: "none" })} />
      )}

      {overlay.kind === "shortcuts" && <ShortcutsDialog onClose={() => setOverlay({ kind: "none" })} />}

      {overlay.kind === "backup" && (
        <BackupPanel
          notify={toast}
          onClose={() => setOverlay({ kind: "none" })}
          onOpenDbSettings={() => {
            setOverlay({ kind: "none" });
            openSettings("database");
          }}
        />
      )}

      {overlay.kind === "close" && (
        <CloseConfirm
          dirty={draft.items.length > 0}
          onCancel={() => setOverlay({ kind: "none" })}
          onConfirm={() => {
            setOverlay({ kind: "none" });
            setShutdown(true);
          }}
        />
      )}

      {minimized && <MinimizedBar data={data} onRestore={() => setMinimized(false)} />}

      <Toasts toasts={toasts} onDismiss={dismiss} />

      {welcome && prefs.showWelcome && !prefs.hidden.welcome && (
        <WelcomeToast
          shopName={data.shop.name}
          logo={data.shop.logo}
          name={user?.fullName ?? "بك"}
          detail={
            trial?.licensed
              ? `تم تسجيل الدخول بنجاح — نسخة مفعّلة${trial.license?.daysLeft ? ` · متبقٍ ${trial.license.daysLeft} يوم` : ""}`
              : `تم تسجيل الدخول بنجاح — نسخة تجريبية${trial ? ` · متبقٍ ${trial.daysLeft} يوم` : ""}`
          }
          onDone={() => setWelcome(false)}
        />
      )}

      {trial && !trial.licensed && trial.expired && (
        <div className="fixed inset-x-0 top-0 z-[110] flex items-center justify-center gap-3 bg-cash-red px-4 py-1.5 text-center text-[11.5px] font-black text-white cy-no-print">
          <span>انتهت الفترة التجريبية — لا يمكن إضافة أصناف أو فواتير جديدة.</span>
          <button
            onClick={() => openModule("activation", "تفعيل النسخة")}
            className="rounded-md bg-white px-2.5 py-0.5 text-[11px] font-black text-cash-red transition hover:brightness-95"
          >
            تفعيل النسخة الآن
          </button>
        </div>
      )}
    </div>
  );
}
