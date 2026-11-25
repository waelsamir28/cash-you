"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "@/lib/types";
import { IcoCheck, IcoUsers, IcoWarn } from "@/components/icons";
import { btnCls, Empty, Field, inputCls, ModuleShell, ModuleTitle, Panel } from "@/components/ModuleUI";

/**
 * شاشة المستخدمين (للمالك فقط):
 * - تعرض كل الحسابات الموجودة على الجهاز.
 * - تسمح للمالك بإضافة موظف جديد (كاشير) بكلمة مرور.
 */
export function UsersScreen({
  user,
  notify,
}: {
  user: SessionUser;
  notify: (kind: "ok" | "err", message: string) => void;
}) {
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ fullName: "", username: "", password: "", role: "cashier" as "owner" | "manager" | "cashier" });
  const [busy, setBusy] = useState(false);
  const [permUser, setPermUser] = useState<SessionUser | null>(null);
  const [permKinds, setPermKinds] = useState<string[]>([]);
  const [permBusy, setPermBusy] = useState(false);

  const ALL_SCREENS = [
    { kind: "invoice", label: "فاتورة مبيعات" },
    { kind: "invoiceHistory", label: "سجل الفواتير" },
    { kind: "purchase", label: "فاتورة مشتريات" },
    { kind: "products", label: "الأصناف والمخازن" },
    { kind: "parties", label: "العملاء والموردون" },
    { kind: "installments", label: "نظام التقسيط" },
    { kind: "expenses", label: "المصروفات" },
    { kind: "treasury", label: "الخزينة" },
    { kind: "reports", label: "التقارير والأرباح" },
    { kind: "dashboard", label: "لوحة المالك" },
    { kind: "backup", label: "النسخ الاحتياطي" },
    { kind: "settings", label: "الإعدادات" },
    { kind: "users", label: "المستخدمون" },
  ];

  useEffect(() => {
    if (!permUser) return;
    (async () => {
      const res = await fetch(`/api/permissions?userId=${permUser.id}`);
      const json = await res.json();
      setPermKinds(json.permissions?.length ? json.permissions : ALL_SCREENS.map((s) => s.kind));
    })();
  }, [permUser]);

  const savePerms = async () => {
    if (!permUser) return;
    setPermBusy(true);
    const res = await fetch("/api/permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: permUser.id, kinds: permKinds }),
    });
    setPermBusy(false);
    if (res.ok) { notify("ok", `تم حفظ صلاحيات ${permUser.fullName}`); setPermUser(null); }
    else notify("err", "تعذر الحفظ");
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/users?t=${Date.now()}`, { cache: "no-store" });
      const json = (await res.json()) as { users?: SessionUser[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "تعذر تحميل المستخدمين");
      setUsers(json.users ?? []);
    } catch (error) {
      notify("err", error instanceof Error ? error.message : "تعذر تحميل المستخدمين");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const submit = async () => {
    if (busy) return;
    if (!form.fullName.trim()) return notify("err", "الاسم الكامل مطلوب");
    if (!form.username.trim()) return notify("err", "اسم المستخدم مطلوب");
    if (form.password.length < 6) return notify("err", "كلمة المرور يجب ألا تقل عن 6 أحرف");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fullName: form.fullName, username: form.username, password: form.password, role: form.role }),
      });
      const json = (await res.json()) as { user?: SessionUser; error?: string };
      if (!res.ok || !json.user) throw new Error(json.error ?? "تعذر إنشاء الحساب");
      notify("ok", `تم إنشاء حساب ${json.user.fullName} بنجاح`);
      setForm({ fullName: "", username: "", password: "", role: "cashier" });
      await load();
    } catch (error) {
      notify("err", error instanceof Error ? error.message : "تعذر إنشاء الحساب");
    } finally {
      setBusy(false);
    }
  };

  const isOwner = user.role === "owner";

  return (
    <ModuleShell>
      <ModuleTitle
        title="المستخدمون والصلاحيات"
        subtitle="حساب المالك هو المسؤول عن البرنامج، ويمكنه إضافة حساب موظف للكاشير"
        badge={isOwner ? "مالك" : "كاشير"}
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-ink-800 px-3 py-1.5 text-[11.5px] font-black text-white">
            <IcoUsers className="h-3.5 w-3.5" />
            {users.length} حساب
          </span>
        }
      />

      <div className="mt-2 grid grid-cols-1 items-start gap-2 xl:grid-cols-[380px_1fr]">
        <Panel title="إضافة حساب جديد" hint={isOwner ? "يستطيع الدخول من شاشة تسجيل الدخول مباشرة" : "متاح للمالك فقط"}>
          {isOwner ? (
            <div className="space-y-2.5 p-3">
              <Field label="الاسم الكامل">
                <input
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className={inputCls}
                  placeholder="مثال: محمد أحمد"
                />
              </Field>
              <Field label="اسم المستخدم (إنجليزي)">
                <input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                  className={`${inputCls} font-mono`}
                  dir="ltr"
                  placeholder="mohamed"
                />
              </Field>
              <Field label="كلمة المرور">
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className={inputCls}
                  dir="ltr"
                  placeholder="6 أحرف على الأقل"
                />
              </Field>
              <Field label="نوع الحساب">
                <div className="flex gap-2">
                  {(["cashier", "manager", "owner"] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, role }))}
                      className={`h-9 flex-1 rounded-lg border text-[12px] font-black transition ${
                        form.role === role
                          ? "border-amber-brand bg-amber-soft text-amber-800"
                          : "border-line bg-paper-2 text-slate-500"
                      }`}
                    >
                      {role === "owner" ? "مالك" : role === "manager" ? "مدير" : "كاشير"}
                    </button>
                  ))}
                </div>
              </Field>
              <button
                onClick={() => void submit()}
                disabled={busy}
                className={`${btnCls} flex w-full items-center justify-center gap-2 bg-cash-green text-white`}
              >
                <IcoCheck />
                {busy ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
              </button>
            </div>
          ) : (
            <div className="p-5 text-center">
              <IcoWarn className="mx-auto h-8 w-8 text-amber-brand" />
              <p className="mt-2 text-[12.5px] font-bold text-slate-600">
                إضافة الحسابات متاحة لحساب المالك فقط.
              </p>
            </div>
          )}
        </Panel>

        <Panel title="الحسابات المسجّلة" hint="يمكن تسجيل الدخول بأي حساب من هذه القائمة">
          <div className="max-h-[620px] overflow-auto cy-scroll">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-ink-800 text-white">
                <tr>
                  {["الحالة", "النوع", "اسم المستخدم", "الاسم"].map((h) => (
                    <th key={h} className="border-l border-white/10 px-2 py-2.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((row, index) => (
                  <tr key={row.id} className={`${index % 2 ? "bg-paper-2" : "bg-white"} border-b border-slate-200`}>
                    <td className="p-1.5 text-center">
                      {row.id === user.id ? (
                        <span className="rounded bg-cash-green/15 px-2 py-1 text-[10.5px] font-black text-cash-green-deep">
                          أنت الآن
                        </span>
                      ) : (
                        <span className="rounded bg-slate-100 px-2 py-1 text-[10.5px] font-bold text-slate-500">نشط</span>
                      )}
                    </td>
                    <td className="p-1.5 text-center">
                      <span
                        className={`rounded px-2 py-1 text-[10.5px] font-black ${
                          row.role === "owner" ? "bg-amber-soft text-amber-800" : row.role === "manager" ? "bg-cash-cyan/15 text-cash-cyan" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.role === "owner" ? "مالك" : row.role === "manager" ? "مدير" : "كاشير"}
                      </span>
                    </td>
                    <td className="p-1.5 text-center font-mono text-amber-800" dir="ltr">
                      {row.username}
                    </td>
                    <td className="px-2 py-1.5 font-bold text-ink-800">{row.fullName}</td>
                    <td className="p-1.5 text-center">
                      <button onClick={() => setPermUser(row)} className="h-7 px-2 rounded bg-ink-700 text-white font-bold text-[11px]">الصلاحيات</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users.length && !loading && <Empty text="لا توجد حسابات بعد" />}
            {loading && <p className="p-4 text-center text-[12px] font-bold text-slate-500">جارٍ تحميل الحسابات...</p>}
          </div>
        </Panel>
      </div>
      {permUser && (
        <div className="fixed inset-0 z-[80] bg-ink-950/70 grid place-items-center p-3" dir="rtl" onClick={(e) => e.target === e.currentTarget && setPermUser(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white overflow-hidden cy-pop">
            <div className="bg-ink-800 text-white px-4 py-3 font-black">صلاحيات الشاشات — {permUser.fullName}</div>
            <div className="p-4 grid grid-cols-2 gap-2 max-h-[50vh] overflow-auto cy-scroll">
              {ALL_SCREENS.map((s) => (
                <label key={s.kind} className="flex items-center gap-2 rounded-lg bg-paper-2 border border-line px-3 py-2.5 cursor-pointer font-bold text-[12.5px]">
                  <input
                    type="checkbox"
                    checked={permKinds.includes(s.kind)}
                    onChange={(e) => setPermKinds((k) => e.target.checked ? [...k, s.kind] : k.filter((x) => x !== s.kind))}
                    className="h-4 w-4 accent-amber-500"
                  />
                  {s.label}
                </label>
              ))}
            </div>
            <div className="p-4 pt-0 flex gap-2">
              <button onClick={() => void savePerms()} disabled={permBusy} className={`${btnCls} flex-1 bg-ink-800 text-white`}>{permBusy ? "جاري الحفظ..." : "حفظ الصلاحيات"}</button>
              <button onClick={() => setPermUser(null)} className={`${btnCls} flex-1 bg-slate-200 text-ink-700`}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </ModuleShell>
  );
}
