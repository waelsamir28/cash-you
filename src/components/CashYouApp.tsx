"use client";

import { apiFetch, flushOfflineQueue, pendingOfflineCount } from "@/lib/offline-sync";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bootstrap, Customer, InstallmentInput, InvoiceRow, ModuleKind, PaymentMethod, Product, SessionUser, TrialStatus } from "@/lib/types";
import { computeTotals, emptyDraft, lineTotal, newLine, type Draft } from "@/lib/draft";
import { arDate, arTime, money, uid } from "@/lib/format";
import {
  isMuted,
  setMuted,
  sfxAdd,
  sfxCash,
  sfxError,
  sfxKey,
  sfxRemove,
  sfxSave,
  sfxScan,
  sfxToggle,
} from "@/lib/sound";
import { StatusBar, TabStrip, TitleBar, type Tab } from "@/components/Chrome";
import { PosScreen, type PosActions } from "@/components/PosScreen";
import { HomeScreen } from "@/components/HomeScreen";
import { ProductsScreen, PartiesScreen } from "@/components/ManagementScreens";
import { TradeScreen } from "@/components/TradeScreen";
import { ExpensesScreen, InstallmentsScreen, ReportsScreen, TreasuryScreen } from "@/components/FinanceScreens";
import { InstallmentDialog } from "@/components/InstallmentDialog";
import { UsersScreen } from "@/components/UsersScreen";
import { SupportScreen } from "@/components/SupportScreen";
import { SettingsScreen } from "@/components/SettingsScreen";

import { IcoX } from "@/components/icons";
import { appCssVars, fontOf, mergeSettings, show, themeOf, type ShopSettings } from "@/lib/settings";
import { ActivationScreen } from "@/components/ActivationScreen";
import { DatabaseScreen } from "@/components/DatabaseScreen";
import { readOfflineBootstrap, saveOfflineBootstrap } from "@/lib/offline-cache";
import { loadDbConfig, type DbMode } from "@/lib/db-connection";
import { readDeviceCode } from "@/lib/device";
import {
  CloseConfirm,
  CustomerDisplay,
  DiscountDialog,
  InvoiceDetail,
  MinimizedBar,
  OverpayModal,
  QuickProductModal,
  PromptDialog,
  ReceiptModal,
  ShutdownScreen,
  Toasts,
  WelcomeToast,
  type ReceiptData,
  type Toast,
} from "@/components/Overlays";

type Overlay =
  | { kind: "none" }
  | { kind: "customerScreen" }
  | { kind: "addCustomer" }
  | { kind: "addPayment" }
  | { kind: "close" }
  | { kind: "receipt"; receipt: ReceiptData }
  /** العميل دفع أكثر من الفاتورة: تسليم الباقي أو تنزيله من الحساب */
  | { kind: "overpay"; receipt: ReceiptData; previousBalance: number }
  /** كود ممسوح غير موجود في المخزن: نافذة إضافة صنف سريع */
  | { kind: "quickProduct"; code: string }
  /** صفحة ربط قاعدة البيانات */
  | { kind: "database" }
  | { kind: "invoice"; invoice: InvoiceRow }
  | { kind: "installment"; print: boolean };

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
  const [activeId, setActiveId] = useState("inv-1");
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
  const [settings, setSettings] = useState<ShopSettings>(() => mergeSettings(initial.settings));
  const theme = themeOf(settings.theme);
  const [welcome, setWelcome] = useState(() => mergeSettings(initial.settings).welcomeEnabled);
  const [trialOpen, setTrialOpen] = useState(false);
  const [syncPending, setSyncPending] = useState(0);
  const [online, setOnline] = useState(true);
  /* معلومات تشخيص لصفحة الدعم الفني */
  const [dbMode, setDbMode] = useState<DbMode>("cloud");
  const [deviceId, setDeviceId] = useState<string>("");
  const [now, setNow] = useState(() => new Date());

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

  const openModule = useCallback((kind: ModuleKind, title: string) => {
    if (kind === "invoice") { openInvoiceTab(); return; }
    if (kind === "home") { setActiveId("home"); sfxKey(); return; }
    /* صفحة كود VB.NET مخفية من الواجهة نهائياً */
    if (kind === "source") return;
    const id = `module-${kind}-${title}`;
    setTabs((prev) => prev.some((t) => t.id === id) ? prev : [...prev, { id, kind, title }]);
    setActiveId(id);
    sfxKey();
  }, [openInvoiceTab]);

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

  /* معلومات التشخيص: معرّف الجهاز ونوع قاعدة البيانات */
  useEffect(() => {
    let alive = true;
    void readDeviceCode()
      .then((d) => {
        if (alive) setDeviceId(d.code);
      })
      .catch(() => undefined);
    void loadDbConfig()
      .then((cfg) => {
        if (alive) setDbMode(cfg.mode);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
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
  const addProduct = useCallback(
    (p: Product, qty = 1) => {
      setDrafts((prev) => {
        const cur = prev[activeId];
        if (!cur) return prev;
        const existing = cur.items.find((li) => li.productId === p.id);
        let items;
        let lastUid: string;
        if (existing) {
          lastUid = existing.uid;
          items = cur.items.map((li) =>
            li.uid === existing.uid ? { ...li, qty: li.qty + qty } : li,
          );
        } else {
          const li = newLine(p.id, p.code, p.name, p.unit, p.price);
          lastUid = li.uid;
          items = [...cur.items, li];
        }
        return { ...prev, [activeId]: { ...cur, items, lastAddedUid: lastUid } };
      });
      sfxAdd();
      if (p.stock <= 0) toast("warn", `تنبيه: رصيد الصنف «${p.name}» نفد من المخزون`);
    },
    [activeId, toast],
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
        /* كود غير مسجل: نافذة إضافة صنف سريع في منتصف الشاشة */
        setOverlay({ kind: "quickProduct", code: term });
        return false;
      }
      sfxScan();
      addProduct(hit);
      return true;
    },
    [data.products, addProduct],
  );

  const updateLine = useCallback(
    (lineUid: string, p: Partial<{ qty: number; price: number; discount: number }>) => {
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
    async (print: boolean, installment?: InstallmentInput) => {
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
      setSaving(true);
      const snapshot = draft;
      const t = computeTotals(snapshot);
      /* رصيد العميل قبل هذه الفاتورة — نحتاجه لو دفع أكثر من الإجمالي */
      const prevCustomerBalance = data.customers.find((c) => c.id === snapshot.customerId)?.balance ?? 0;
      try {
        const res = await apiFetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: snapshot.customerId,
            customerName: snapshot.customerName,
            paymentMethod: snapshot.paymentMethod,
            saleType: snapshot.saleType,
            discountPercent: snapshot.discountPercent,
            paid: t.paid,
            printed: false,
            installment,
            items: snapshot.items.map((li) => ({
              productId: li.productId,
              code: li.code,
              name: li.name,
              unit: li.unit,
              qty: li.qty,
              price: li.price,
              discount: li.discount,
            })),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "تعذر حفظ الفاتورة");

        const receipt: ReceiptData = {
          number: json.number,
          createdAt: json.createdAt,
          customerId: snapshot.customerId,
          customerName: snapshot.customerName,
          paymentMethod: snapshot.paymentMethod,
          saleType: snapshot.saleType,
          discountPercent: snapshot.discountPercent,
          subtotal: t.subtotal,
          total: json.total,
          paid: json.paid,
          /* إن كان المدفوع أكبر، نُظهر الباقي سالباً ليعرضه الإيصال بوضوح */
          remaining: json.paid > json.total ? Math.round((json.total - json.paid) * 100) / 100 : json.remaining,
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
        /* العميل دفع أكثر من قيمة الفاتورة: اسأله أولاً ماذا يفعل بالباقي */
        if (t.remaining < 0) {
          setOverlay({ kind: "overpay", receipt, previousBalance: prevCustomerBalance });
        } else {
          /* كلاهما يعرضان الإيصال — وهو الشاشة العائمة بشكل الفاتورة + زر طباعة + زر إلغاء */
          setOverlay({ kind: "receipt", receipt });
        }
        window.setTimeout(() => barcodeRef.current?.focus(), 80);
      } catch (err) {
        sfxError();
        toast("err", err instanceof Error ? err.message : "تعذر حفظ الفاتورة");
      } finally {
        setSaving(false);
      }
    },
    [activeId, activeTab, draft, saving, toast, refreshData, data.customers],
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
      const keys = ["F3", "F4", "F5", "F10", "F11", "F12"];
      if (keys.includes(e.key)) {
        e.preventDefault();
        if (shutdown || minimized) return;
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
        document.getElementById("cy-global-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shutdown, minimized]);

  /* ---------------- أزرار النافذة ---------------- */
  const onWindowAction = useCallback((a: "min" | "max" | "close") => {
    sfxKey();
    if (a === "min") setMinimized(true);
    if (a === "close") setOverlay({ kind: "close" });
    if (a === "max") {
      const el = document.documentElement;
      if (!document.fullscreenElement) void el.requestFullscreen?.().catch(() => undefined);
      else void document.exitFullscreen?.().catch(() => undefined);
    }
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
      /* الخصم أُزيل نهائياً — تُبقي الواجهة الدالة للتوافق فقط */
      openDiscount: () => toast("warn", "الخصم أُزيل من البرنامج نهائياً"),
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
    [patch, addProduct, addByCode, updateLine, removeLine, save, newInvoice, payFull, toast],
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
    <div
      className="cy-app-shell h-[100dvh] w-full max-w-full flex flex-col bg-ink-950 overflow-hidden"
      style={appCssVars(settings) as React.CSSProperties}
      data-theme={theme.id}
      data-motion={settings.motion}
      data-align={settings.centerText ? "center" : "right"}
    >
      <TitleBar
        data={data}
        muted={muted}
        onToggleMute={toggleMute}
        onPickProduct={(p) => {
          if (activeTab?.kind !== "invoice") {
            const id = openInvoiceTab();
            window.setTimeout(() => {
              setDrafts((prev) => {
                const cur = prev[id];
                if (!cur) return prev;
                const li = newLine(p.id, p.code, p.name, p.unit, p.price);
                return { ...prev, [id]: { ...cur, items: [...cur.items, li], lastAddedUid: li.uid } };
              });
              sfxAdd();
            }, 30);
          } else {
            addProduct(p);
          }
        }}
        onPickInvoice={(i) => setOverlay({ kind: "invoice", invoice: i })}
        onWindowAction={onWindowAction}
        minimized={minimized}
        user={user}
        trial={trial}
        onOpenActivation={() => openModule("activation", "تفعيل النسخة")}
        onLogout={() => void onLogout()}
      />
      {(!online || syncPending > 0) && (
        <div className={`flex items-center gap-2 px-3 py-1.5 text-[11px] font-black ${online ? "bg-amber-100 text-amber-900" : "bg-cash-red text-white"}`}>
          <span className={`h-2 w-2 rounded-full ${online ? "bg-amber-600" : "bg-white animate-pulse"}`} />
          <span>{online ? `عمليات محفوظة محليًا بانتظار المزامنة: ${syncPending}` : `غير متصل بالإنترنت — سيُزامن تلقائيًا عند عودة الاتصال${syncPending ? ` · ${syncPending} عملية معلقة` : ""}`}</span>
        </div>
      )}

      {show(settings, "tabStrip") && <TabStrip
        tabs={tabs}
        activeId={activeId}
        onSelect={(id) => {
          setActiveId(id);
          sfxKey();
        }}
        onClose={closeTab}
        onNew={openInvoiceTab}
        activeKind={activeTab?.kind}
        onPickModule={(kind, label) => openModule(kind, label)}
        menuLabels={settings.menuShowLabels}
        showMenu={show(settings, "rail")}
      />}

      <div className="flex-1 min-h-0 min-w-0 flex overflow-hidden">

        <main className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
          <div key={activeId} className="cy-page flex-1 min-h-0 flex flex-col" data-motion={settings.pageMotion}>
          {activeTab?.kind === "home" && (
            <HomeScreen
              data={data}
              onNewInvoice={openInvoiceTab}
              onOpenInvoice={(i) => setOverlay({ kind: "invoice", invoice: i })}
              onOpenModule={openModule}
            />
          )}

          {activeTab?.kind === "products" && <ProductsScreen data={data} refresh={refreshData} notify={toast} />}
          {activeTab?.kind === "parties" && <PartiesScreen key={activeTab.id} initialKind={activeTab.title === "الموردون" ? "supplier" : "customer"} data={data} refresh={refreshData} notify={toast} />}
          {(activeTab?.kind === "purchase" || activeTab?.kind === "salesReturn" || activeTab?.kind === "purchaseReturn") && (
            <TradeScreen key={activeTab.id} kind={activeTab.kind} data={data} refresh={refreshData} notify={toast} stamp={stamp} settings={settings} />
          )}
          {activeTab?.kind === "installments" && <InstallmentsScreen data={data} refresh={refreshData} notify={toast} />}
          {activeTab?.kind === "expenses" && <ExpensesScreen data={data} refresh={refreshData} notify={toast} />}
          {activeTab?.kind === "treasury" && <TreasuryScreen data={data} refresh={refreshData} notify={toast} />}
          {activeTab?.kind === "reports" && <ReportsScreen data={data} />}
          {activeTab?.kind === "users" && user && <UsersScreen user={user} notify={toast} />}
          {activeTab?.kind === "support" && (
            <SupportScreen
              appVersion={data.appVersion}
              deviceId={deviceId}
              licensed={trial?.licensed}
              daysLeft={trial?.daysLeft}
              localDb={dbMode === "local"}
              pendingSync={syncPending}
              tenantKey={data.tenant?.key}
              tenantIsolated={data.tenant?.isolated}
            />
          )}
          {activeTab?.kind === "settings" && user && (
            <SettingsScreen
              user={user}
              initial={settings}
              notify={toast}
              onPreview={(next) => setSettings(next)}
              onSaved={(next) => {
                setSettings(next);
                setData((prev) => ({ ...prev, settings: next, shop: { name: next.shopName, phone: next.shopPhone } }));
              }}
            />
          )}
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
              stamp={stamp}
              settings={settings}
            />
          )}
          </div>
        </main>
      </div>

      {show(settings, "footer") && <StatusBar
        clock={now}
        dateText={stamp.date}
        timeText={stamp.time}
        invoiceNumber={draft.number}
        itemsCount={draft.items.length}
        user={user}
        trial={trial}
        onOpenActivation={() => openModule("activation", "تفعيل النسخة")}
        onOpenDatabase={() => setOverlay({ kind: "database" })}
        onOpenSync={() => setOverlay({ kind: "database" })}
        showBadge={show(settings, "statusBadge")}
      />}

      {/* ---------------- الطبقات العلوية ---------------- */}
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

      {overlay.kind === "database" && (
        <div className="fixed inset-0 z-[150] overflow-hidden bg-paper" dir="rtl">
          <button
            onClick={() => setOverlay({ kind: "none" })}
            className="absolute left-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-lg bg-ink-800 text-white shadow hover:bg-ink-900"
            aria-label="إغلاق"
          >
            <IcoX className="h-4 w-4" />
          </button>
          <DatabaseScreen notify={toast} />
        </div>
      )}

      {overlay.kind === "quickProduct" && (
        <QuickProductModal
          initialCode={overlay.code}
          categories={data.categories}
          onClose={() => setOverlay({ kind: "none" })}
          onSaved={(product) => {
            setOverlay({ kind: "none" });
            void refreshData();
            addProduct(product);
            toast("ok", `تمت إضافة «${product.name}» للفاتورة`);
          }}
        />
      )}

      {overlay.kind === "overpay" && (
        <OverpayModal
          previousBalance={overlay.previousBalance}
          invoiceTotal={overlay.receipt.total}
          paid={overlay.receipt.paid}
          customerName={overlay.receipt.customerName}
          /* تسليم الباقي نقداً: يخرج من الدرج ويبقى رصيد العميل كما هو */
          onHandOver={async () => {
            const rec = overlay.receipt;
            const change = Math.round((rec.paid - rec.total) * 100) / 100;
            setOverlay({ kind: "receipt", receipt: rec });
            if (change <= 0) return;
            try {
              await apiFetch("/api/invoices/overpay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ invoiceNumber: rec.number, action: "handOver", amount: change }),
              });
              toast("ok", `سُلّم للعميل ${money(change)} نقداً وخرجت من الدرج`);
              await refreshData();
            } catch (err) {
              toast("err", err instanceof Error ? err.message : "تعذر تسجيل الباقي");
            }
          }}
          /* تنزيل الباقي من الحساب: يقلّل مديونية العميل */
          onCredit={async () => {
            const rec = overlay.receipt;
            const change = Math.round((rec.paid - rec.total) * 100) / 100;
            setOverlay({ kind: "receipt", receipt: rec });
            if (change <= 0) return;
            if (!rec.customerId) {
              toast("warn", "عميل نقدي — لا يوجد حساب لتنزيل الباقي فيه");
              return;
            }
            try {
              await apiFetch("/api/invoices/overpay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ invoiceNumber: rec.number, action: "credit", amount: change }),
              });
              toast("ok", `تم تنزيل ${money(change)} من حساب العميل`);
              await refreshData();
            } catch (err) {
              toast("err", err instanceof Error ? err.message : "تعذر تنزيل الباقي من الحساب");
            }
          }}
          onClose={() => setOverlay({ kind: "receipt", receipt: overlay.receipt })}
        />
      )}

      {overlay.kind === "receipt" && (
        <ReceiptModal
          receipt={overlay.receipt}
          shop={{ name: settings.shopName, phone: settings.shopPhone }}
          paper={settings.invoicePaper}
          logo={settings.shopLogo}
          address={settings.shopAddress}
          receiptFooter={settings.invoiceFooter}
          thanks={settings.invoiceThanks}
          accent={theme.vars.accent}
          style={settings.receiptStyle}
          fontStack={fontOf(settings.font).stack}
          onClose={() => setOverlay({ kind: "none" })}
        />
      )}

      {overlay.kind === "invoice" && (
        <InvoiceDetail invoice={overlay.invoice} onClose={() => setOverlay({ kind: "none" })} />
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

      {welcome && settings.welcomeEnabled && (
        <WelcomeToast
          name={user?.fullName ?? "بك"}
          logo={show(settings, "welcomeLogo") ? settings.shopLogo : ""}
          shopName={settings.shopName}
          muted={muted}
          onToggleMute={toggleMute}
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
