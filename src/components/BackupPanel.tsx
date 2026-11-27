"use client";

import { useCallback, useEffect, useState } from "react";
import { IcoCheck, IcoDownload, IcoPrint, IcoSliders, IcoUsers, IcoWarn, IcoX } from "@/components/icons";

type Notify = (kind: "ok" | "warn" | "err" | "info", text: string) => void;

type Config = {
  auto: { enabled: boolean; every: number; unit: "hours" | "days" };
  dir: string;
  resolvedDir: string;
  telegram: { enabled: boolean; chatId: string; sendOnAuto: boolean; hasToken: boolean; tokenHint: string };
  whatsapp: { phone: string };
  lastRunAt: string | null;
  lastStatus: string;
  lastFile: string | null;
  database: {
    engine: string;
    mode: "cloud" | "local" | null;
    source: "file" | "env" | "bundled" | "none";
    host: string;
    port: string;
    database: string;
    location: string;
    maskedUrl: string | null;
  };
};

type BackupFile = { name: string; size: number; createdAt: string };

const TABS = [
  { id: "db", label: "قاعدة البيانات" },
  { id: "export", label: "تصدير واسترداد" },
  { id: "auto", label: "النسخ التلقائي" },
  { id: "telegram", label: "تيليجرام" },
  { id: "whatsapp", label: "واتساب" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const SUPPORT_PHONE = "01222355769";

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function nameFromHeader(res: Response, fallback: string): string {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = /filename="([^"]+)"/.exec(cd);
  return m?.[1] ?? fallback;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  return `${(bytes / 1024 / 1024).toFixed(2)} ميجابايت`;
}

/** تحويل رقم الواتساب إلى الصيغة الدولية (مصر 20) */
function whatsappNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) return `20${digits.slice(1)}`;
  return digits;
}

export function BackupPanel({
  notify,
  onClose,
  onOpenDbSettings,
}: {
  notify: Notify;
  onClose: () => void;
  onOpenDbSettings: () => void;
}) {
  const [tab, setTab] = useState<TabId>("db");
  const [cfg, setCfg] = useState<Config | null>(null);
  const [loadError, setLoadError] = useState("");
  const [files, setFiles] = useState<BackupFile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  /* نماذج الإدخال تُملأ من الإعدادات المحفوظة */
  const [autoForm, setAutoForm] = useState({ enabled: false, every: 1, unit: "days" as "hours" | "days", dir: "" });
  const [tgForm, setTgForm] = useState({ enabled: false, token: "", chatId: "", sendOnAuto: false });
  const [phone, setPhone] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [waLink, setWaLink] = useState("");

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/backup/config?t=${Date.now()}`, { cache: "no-store" });
      const json = (await res.json()) as Config & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "تعذر تحميل إعدادات النسخ");
      setCfg(json);
      setLoadError("");
      setAutoForm({ enabled: json.auto.enabled, every: json.auto.every, unit: json.auto.unit, dir: json.dir });
      setTgForm((prev) => ({ ...prev, enabled: json.telegram.enabled, chatId: json.telegram.chatId, sendOnAuto: json.telegram.sendOnAuto }));
      setPhone(json.whatsapp.phone);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "تعذر تحميل إعدادات النسخ");
    }
    try {
      const res = await fetch(`/api/backup/list?t=${Date.now()}`, { cache: "no-store" });
      const json = (await res.json()) as { backups?: BackupFile[] };
      setFiles(json.backups ?? []);
    } catch {
      /* نتجاهل فشل القائمة */
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(t);
  }, [reload]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* ---------------- الإجراءات ---------------- */

  const saveConfig = async (patch: Record<string, unknown>, okText: string) => {
    setBusy("save");
    try {
      const res = await fetch("/api/backup/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "تعذر الحفظ");
      notify("ok", okText);
      await reload();
    } catch (error) {
      notify("err", error instanceof Error ? error.message : "تعذر الحفظ");
    } finally {
      setBusy(null);
    }
  };

  const runNow = async (sendTelegram: boolean) => {
    setBusy(sendTelegram ? "tg-now" : "run");
    try {
      const res = await fetch("/api/backup/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendTelegram }),
      });
      const json = (await res.json()) as { error?: string; name?: string; telegramError?: string };
      if (!res.ok) throw new Error(json.error ?? "تعذر تنفيذ النسخة");
      if (json.telegramError) notify("warn", `تم حفظ النسخة، لكن تيليجرام: ${json.telegramError}`);
      else notify("ok", sendTelegram ? "تم إرسال النسخة لتيليجرام" : `تم حفظ النسخة: ${json.name}`);
      await reload();
      return json;
    } catch (error) {
      notify("err", error instanceof Error ? error.message : "تعذر تنفيذ النسخة");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const exportNow = async () => {
    setBusy("export");
    try {
      const res = await fetch(`/api/backup/export?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "تعذر التصدير");
      }
      saveBlob(await res.blob(), nameFromHeader(res, "cash-you-backup.json"));
      notify("ok", "تم تصدير النسخة وتنزيلها على جهازك");
    } catch (error) {
      notify("err", error instanceof Error ? error.message : "تعذر التصدير");
    } finally {
      setBusy(null);
    }
  };

  const restoreNow = async () => {
    if (!restoreFile) return;
    const ok = window.confirm(
      "سيتم استبدال كل البيانات الحالية بالنسخة المختارة.\nقبلها هيتعمل نسخة أمان تلقائياً.\n\nهل تريد المتابعة؟",
    );
    if (!ok) return;
    setBusy("restore");
    try {
      const text = await restoreFile.text();
      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const json = (await res.json()) as { error?: string; safetyFile?: string };
      if (!res.ok) throw new Error(json.error ?? "تعذر الاسترداد");
      notify("ok", `تم الاسترداد بنجاح. نسخة الأمان: ${json.safetyFile}`);
      window.setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      notify("err", error instanceof Error ? error.message : "تعذر الاسترداد");
      setBusy(null);
    }
  };

  const downloadFile = async (name: string) => {
    try {
      const res = await fetch(`/api/backup/file?name=${encodeURIComponent(name)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("تعذر تنزيل الملف");
      saveBlob(await res.blob(), name);
    } catch (error) {
      notify("err", error instanceof Error ? error.message : "تعذر تنزيل الملف");
    }
  };

  const sendWhatsapp = async () => {
    const number = whatsappNumber(phone);
    if (number.length < 11) {
      notify("warn", "اكتب رقم واتساب صحيح أولاً");
      return;
    }
    setBusy("wa");
    setWaLink("");
    try {
      await fetch("/api/backup/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp: { phone } }),
      });
      const made = await runNow(false);
      if (!made?.name) return;
      const name = made.name;
      const res = await fetch(`/api/backup/file?name=${encodeURIComponent(name)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("تعذر تجهيز الملف للإرسال");
      const blob = await res.blob();
      const file = new File([blob], name, { type: "application/json" });
      const text = `نسخة احتياطية من كاش يو — ${name}`;
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try {
          await nav.share({ files: [file], title: "نسخة كاش يو", text });
          notify("ok", "تم فتح نافذة المشاركة بالنسخة");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }
      saveBlob(blob, name);
      const url = `https://wa.me/${number}?text=${encodeURIComponent(`${text}\n(ارفق ملف النسخة من مجلد التنزيلات)`)}`;
      setWaLink(url);
      window.open(url, "_blank", "noopener");
      notify("info", "الملف اتنزل على جهازك — ارفقه في محادثة واتساب");
    } catch (error) {
      notify("err", error instanceof Error ? error.message : "تعذر الإرسال على واتساب");
    } finally {
      setBusy(null);
    }
  };

  /* ---------------- العرض ---------------- */

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-ink-950/60 backdrop-blur-sm p-3 cy-no-print" dir="rtl" role="dialog" aria-modal="true" aria-label="النسخ الاحتياطي">
      <div className="relative w-[min(96vw,880px)] max-h-[92vh] flex flex-col overflow-hidden rounded-[24px] border border-line bg-paper shadow-[0_40px_120px_-30px_rgba(0,0,0,.9)]">
        {/* الترويسة */}
        <header className="relative shrink-0 bg-ink-800 px-5 pt-4 pb-3 text-center text-white">
          <div className="pointer-events-none absolute inset-0 cy-aurora opacity-80" />
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="absolute top-3 left-3 w-8 h-8 grid place-items-center rounded-lg bg-white/10 hover:bg-cash-red transition-colors"
          >
            <IcoX className="w-3.5 h-3.5" />
          </button>
          <div className="relative">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-amber-brand/20 text-amber-brand">
              <IcoDownload className="w-5 h-5" />
            </div>
            <h2 className="mt-2 text-[17px] font-black">النسخ الاحتياطي</h2>
            <p className="mt-0.5 text-[11.5px] font-bold text-slate-300">احفظ بياناتك واسترجعها في أي وقت — على جهازك وتيليجرام وواتساب</p>
          </div>

          {/* التبويبات */}
          <nav className="relative mt-3 flex flex-wrap items-center justify-center gap-1.5" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`h-8 px-3.5 rounded-full text-[12px] font-black cy-press transition-colors ${
                  tab === t.id ? "bg-amber-brand text-ink-900 shadow-md" : "bg-white/10 text-slate-200 hover:bg-white/20"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        {/* المحتوى */}
        <div className="flex-1 min-h-0 overflow-y-auto cy-scroll p-4 sm:p-5">
          {loadError && (
            <div className="mb-3 rounded-xl border border-cash-red/40 bg-red-50 p-3 text-center text-[12px] font-bold text-cash-red">
              {loadError}
            </div>
          )}

          {tab === "db" && <DbTab cfg={cfg} onOpenDbSettings={onOpenDbSettings} />}

          {tab === "export" && (
            <Stack>
              <Intro
                title="تصدير واسترداد"
                text="التصدير بيحفظ نسخة كاملة من بياناتك في ملف واحد على جهازك. الاسترداد بيرجّع الملف ده مكان البيانات الحالية، وقبلها بيعمل نسخة أمان تلقائياً."
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Card title="تصدير نسخة" text="نزّل ملف النسخة الكاملة على جهازك.">
                  <Btn onClick={() => void exportNow()} busy={busy === "export"} tone="dark">
                    <IcoDownload className="w-4 h-4" /> تصدير وتنزيل النسخة
                  </Btn>
                </Card>
                <Card title="استرداد نسخة" text="اختار ملف نسخة سابقة (JSON) ثم استرجعه.">
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
                    className="w-full text-[12px] font-bold text-ink-700 file:mr-2 file:h-8 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:font-black file:text-ink-800"
                  />
                  <Btn onClick={() => void restoreNow()} busy={busy === "restore"} disabled={!restoreFile} tone="red">
                    <IcoWarn className="w-4 h-4" /> استرداد من الملف المختار
                  </Btn>
                </Card>
              </div>
              <Card title="النسخ المحفوظة على الجهاز" text={`المجلد: ${cfg?.resolvedDir ?? "—"}`}>
                {files.length === 0 ? (
                  <p className="text-center text-[12px] font-bold text-slate-500">لا توجد نسخ محفوظة بعد</p>
                ) : (
                  <ul className="grid gap-1.5 max-h-[220px] overflow-y-auto cy-scroll">
                    {files.map((f) => (
                      <li key={f.name} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper-2 px-2.5 py-1.5">
                        <button onClick={() => void downloadFile(f.name)} className="text-[11.5px] font-bold text-ink-800 hover:text-amber-700 truncate" dir="ltr">
                          {f.name}
                        </button>
                        <span className="shrink-0 text-[10.5px] font-bold text-slate-500 cy-num">
                          {fmtSize(f.size)} · {fmtDate(f.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </Stack>
          )}

          {tab === "auto" && (
            <Stack>
              <Intro
                title="النسخ التلقائي"
                text="البرنامج بيحفظ نسخة تلقائياً في المدة اللي تحددها طالما البرنامج شغال، ويحتفظ بآخر 30 نسخة تلقائية."
              />
              <Card title="الجدولة" text="اختار كل كام مدة تتعمل نسخة، ومكان الحفظ.">
                <Toggle label="تفعيل النسخ التلقائي" checked={autoForm.enabled} onChange={(v) => setAutoForm({ ...autoForm, enabled: v })} />
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <span className="text-[12px] font-black text-ink-700">كل</span>
                  <input
                    type="number"
                    min={1}
                    max={autoForm.unit === "days" ? 365 : 8760}
                    value={autoForm.every}
                    onChange={(e) => setAutoForm({ ...autoForm, every: Math.max(1, Number(e.target.value) || 1) })}
                    className="h-9 w-20 rounded-lg border border-line bg-white text-center text-[13px] font-black cy-num outline-none focus:border-amber-brand"
                  />
                  <select
                    value={autoForm.unit}
                    onChange={(e) => setAutoForm({ ...autoForm, unit: e.target.value as "hours" | "days" })}
                    className="h-9 rounded-lg border border-line bg-white px-2 text-[12.5px] font-black outline-none focus:border-amber-brand"
                  >
                    <option value="hours">ساعة</option>
                    <option value="days">يوم</option>
                  </select>
                </div>
                <label className="mt-3 flex flex-col gap-1 text-center">
                  <span className="text-[11px] font-black text-slate-500">مجلد حفظ النسخ (اتركه فاضي للمجلد الافتراضي)</span>
                  <input
                    value={autoForm.dir}
                    onChange={(e) => setAutoForm({ ...autoForm, dir: e.target.value })}
                    placeholder={cfg?.resolvedDir ?? ""}
                    dir="ltr"
                    className="h-9 rounded-lg border border-line bg-paper-2 px-2.5 text-[12px] font-bold text-ink-900 outline-none focus:border-amber-brand focus:bg-white"
                  />
                </label>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <Btn
                    onClick={() =>
                      void saveConfig(
                        { auto: { enabled: autoForm.enabled, every: autoForm.every, unit: autoForm.unit }, dir: autoForm.dir.trim() },
                        "تم حفظ إعدادات النسخ التلقائي",
                      )
                    }
                    busy={busy === "save"}
                    tone="dark"
                  >
                    <IcoCheck className="w-4 h-4" /> حفظ الإعدادات
                  </Btn>
                  <Btn onClick={() => void runNow(false)} busy={busy === "run"} tone="light">
                    <IcoPrint className="w-4 h-4" /> تشغيل نسخة الآن
                  </Btn>
                </div>
              </Card>
              <Card title="آخر تنفيذ" text="">
                <p className="text-center text-[12.5px] font-black text-ink-900">{cfg?.lastStatus ?? "—"}</p>
                <p className="mt-1 text-center text-[11.5px] font-bold text-slate-500">
                  آخر وقت: <span className="cy-num">{fmtDate(cfg?.lastRunAt ?? null)}</span>
                  {cfg?.lastFile && <> · الملف: <span dir="ltr">{cfg.lastFile}</span></>}
                </p>
              </Card>
            </Stack>
          )}

          {tab === "telegram" && (
            <Stack>
              <Intro
                title="نسخة على تيليجرام"
                text="البوت بيبعت ملف النسخة لمحادثتك على تيليجرام. ده بيحميك لو الجهاز اتعطل."
              />
              <Card title="خطوات الإعداد" text="">
                <ol className="mx-auto grid max-w-[560px] gap-1.5 text-center text-[12px] font-bold text-ink-700">
                  <li>١ — افتح @BotFather في تيليجرام، واعمل بوت جديد، وانسخ التوكن اللي هيديهولك.</li>
                  <li>٢ — ابعت أي رسالة للبوت من حسابك.</li>
                  <li>٣ — افتح الرابط ده بعد ما تستبدل التوكن: <span dir="ltr" className="font-mono text-[11px] text-amber-800">api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</span> وهتلاقي رقم المحادثة <span dir="ltr" className="font-mono">chat id</span>.</li>
                  <li>٤ — حط التوكن ورقم المحادثة تحت واحفظ.</li>
                </ol>
              </Card>
              <Card title="الإعدادات" text="الملف لازم يكون أقل من 50 ميجا عشان تيليجرام يقبله.">
                <Toggle label="تفعيل الإرسال لتيليجرام" checked={tgForm.enabled} onChange={(v) => setTgForm({ ...tgForm, enabled: v })} />
                <Toggle label="إرسال تلقائي مع كل نسخة مجدولة" checked={tgForm.sendOnAuto} onChange={(v) => setTgForm({ ...tgForm, sendOnAuto: v })} />
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-center">
                    <span className="text-[11px] font-black text-slate-500">
                      توكن البوت {cfg?.telegram.hasToken ? `(محفوظ ${cfg.telegram.tokenHint})` : ""}
                    </span>
                    <input
                      type="password"
                      value={tgForm.token}
                      onChange={(e) => setTgForm({ ...tgForm, token: e.target.value })}
                      placeholder={cfg?.telegram.hasToken ? "اتركه فاضي للإبقاء على المحفوظ" : "123456:ABC..."}
                      dir="ltr"
                      className="h-9 rounded-lg border border-line bg-paper-2 px-2.5 text-[12px] font-bold text-ink-900 outline-none focus:border-amber-brand focus:bg-white"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-center">
                    <span className="text-[11px] font-black text-slate-500">رقم المحادثة (chat id)</span>
                    <input
                      value={tgForm.chatId}
                      onChange={(e) => setTgForm({ ...tgForm, chatId: e.target.value })}
                      placeholder="123456789"
                      dir="ltr"
                      className="h-9 rounded-lg border border-line bg-paper-2 px-2.5 text-[12px] font-bold text-ink-900 outline-none focus:border-amber-brand focus:bg-white"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <Btn
                    onClick={() =>
                      void saveConfig(
                        {
                          telegram: {
                            enabled: tgForm.enabled,
                            chatId: tgForm.chatId.trim(),
                            sendOnAuto: tgForm.sendOnAuto,
                            ...(tgForm.token.trim() ? { token: tgForm.token.trim() } : {}),
                          },
                        },
                        "تم حفظ إعدادات تيليجرام",
                      ).then(() => setTgForm((p) => ({ ...p, token: "" })))
                    }
                    busy={busy === "save"}
                    tone="dark"
                  >
                    <IcoCheck className="w-4 h-4" /> حفظ الإعدادات
                  </Btn>
                  <Btn onClick={() => void runNow(true)} busy={busy === "tg-now"} tone="blue">
                    <IcoPrint className="w-4 h-4" /> إرسال نسخة الآن لتيليجرام
                  </Btn>
                </div>
              </Card>
            </Stack>
          )}

          {tab === "whatsapp" && (
            <Stack>
              <Intro
                title="إرسال النسخة على واتساب"
                text="واتساب ما بيسمحش بإرفاق ملف من الروابط. البرنامج بيجهّز النسخة، ولو جهازك بيدعم المشاركة بيفتح نافذة الإرسال بالملف مباشرة، وإلا بينزّل الملف ويفتح المحادثة عشان ترفقه بنفسك."
              />
              <Card title="رقم الواتساب" text="اكتب الرقم اللي هتبعت عليه النسخة. ممكن يكون رقمك أو رقم المالك.">
                <div className="mx-auto flex max-w-[420px] flex-wrap items-center justify-center gap-2">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    inputMode="tel"
                    dir="ltr"
                    className="h-10 flex-1 min-w-[180px] rounded-xl border-2 border-amber-brand/60 bg-white px-3 text-center text-[14px] font-black cy-num outline-none focus:border-amber-brand"
                  />
                  <span className="text-[11px] font-bold text-slate-500">الصيغة المصرية أو الدولية</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <Btn onClick={() => void sendWhatsapp()} busy={busy === "wa"} tone="green">
                    <IcoUsers className="w-4 h-4" /> تجهيز النسخة وإرسالها على واتساب
                  </Btn>
                  {waLink && (
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-10 px-4 rounded-xl bg-white border border-line grid place-items-center text-[12.5px] font-black text-ink-800 hover:bg-slate-50"
                    >
                      فتح محادثة واتساب
                    </a>
                  )}
                </div>
              </Card>
              <p className="text-center text-[11px] font-bold text-slate-500">
                <IcoSliders className="inline w-3.5 h-3.5 align-[-2px] ml-1" />
                الرقم بيتحفظ مع الإعدادات، ولا يتم إرسال أي شيء إلا عند الضغط على الزر.
              </p>
            </Stack>
          )}
        </div>

        {/* الفوتر */}
        <footer className="shrink-0 border-t border-line bg-white px-4 py-2.5 text-center text-[11.5px] font-bold text-slate-600">
          <span>الدعم الفني: </span>
          <span className="font-black text-ink-900">م / وائل الجمال</span>
          <span className="mx-2 text-slate-300">|</span>
          <span dir="ltr" className="cy-num font-black tracking-[0.06em] text-amber-800">{SUPPORT_PHONE}</span>
        </footer>
      </div>
    </div>
  );
}

/* ---------------- تبويب قاعدة البيانات ---------------- */

function DbTab({ cfg, onOpenDbSettings }: { cfg: Config | null; onOpenDbSettings: () => void }) {
  const db = cfg?.database;
  const modeText = db?.mode === "cloud" ? "سحابي (Neon)" : db?.mode === "local" ? "محلي على هذا الجهاز" : "غير مضبوط بعد";
  const sourceText =
    db?.source === "bundled" ? "PostgreSQL المدمج مع البرنامج"
      : db?.source === "file" ? "ملف الإعدادات"
      : db?.source === "env" ? "متغير البيئة DATABASE_URL"
      : "غير مضبوط";
  const serverText = db && db.host !== "—" ? `${db.host}:${db.port}` : "—";
  const rows: [string, string, boolean][] = [
    ["نوع القاعدة", db?.engine ?? "PostgreSQL", false],
    ["نوع الربط", modeText, false],
    ["اسم القاعدة", db?.database ?? "—", false],
    ["الخادم", serverText, true],
    ["مكان البيانات", db?.location ?? "—", true],
    ["مصدر الإعداد", sourceText, false],
    ["مكان ملفات النسخ", cfg?.resolvedDir ?? "—", true],
  ];
  return (
    <Stack>
      <Intro
        title="قاعدة البيانات"
        text="كل بياناتك (الأصناف والفواتير والعملاء والمستخدمون) محفوظة في قاعدة بيانات PostgreSQL. هنا تشوف نوعها ومكانها وحالتها."
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value, ltr]) => (
          <div key={label} className="rounded-xl border border-line bg-white px-3 py-2.5 text-center shadow-sm">
            <p className="text-[11px] font-black text-slate-500">{label}</p>
            <p className="mt-0.5 break-all text-[13px] font-black text-ink-900" dir={ltr ? "ltr" : "rtl"}>
              {value}
            </p>
          </div>
        ))}
      </div>
      {db?.maskedUrl && (
        <div className="rounded-xl border border-line bg-paper-2 px-3 py-2 text-center">
          <p className="text-[11px] font-black text-slate-500">الرابط المستخدم (كلمة المرور مخفية)</p>
          <p className="mt-0.5 break-all font-mono text-[11.5px] text-ink-800" dir="ltr">{db.maskedUrl}</p>
        </div>
      )}
      <p className="text-center text-[11.5px] font-bold leading-6 text-slate-500">
        {db?.source === "bundled"
          ? "القاعدة المدمجة بتتشغّل تلقائياً على هذا الجهاز، وبياناتك محفوظة في مجلد البيانات فوق."
          : "تغيير الرابط بيتم من الإعدادات، ويتطبق بعد إعادة تشغيل البرنامج."}
        <br />
        لتغيير القاعدة إلى سحابية (Neon) استخدم زر تغيير الرابط، ويتطبق بعد إعادة التشغيل.
      </p>
      <div className="flex justify-center">
        <Btn onClick={onOpenDbSettings} tone="light">
          <IcoSliders className="w-4 h-4" /> تغيير رابط القاعدة
        </Btn>
      </div>
    </Stack>
  );
}

/* ---------------- عناصر مساعدة ---------------- */

function Stack({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3">{children}</div>;
}

function Intro({ title, text }: { title: string; text: string }) {
  return (
    <div className="text-center">
      <h3 className="text-[15px] font-black text-ink-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-[640px] text-[12.5px] font-bold leading-7 text-slate-600">{text}</p>
    </div>
  );
}

function Card({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-3.5 text-center shadow-sm">
      <h4 className="text-[13.5px] font-black text-ink-900">{title}</h4>
      {text && <p className="mt-0.5 text-[11.5px] font-bold text-slate-500">{text}</p>}
      <div className="mt-2.5 grid gap-2">{children}</div>
    </section>
  );
}

const BTN_TONES: Record<"dark" | "light" | "red" | "blue" | "green", string> = {
  dark: "bg-ink-800 text-white hover:bg-ink-900",
  light: "bg-slate-200 text-ink-800 hover:bg-slate-300",
  red: "bg-cash-red text-white hover:brightness-110",
  blue: "bg-cash-cyan text-ink-900 hover:brightness-105",
  green: "bg-cash-green-deep text-white hover:brightness-110",
};

function Btn({
  children,
  onClick,
  tone,
  busy,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: keyof typeof BTN_TONES;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={`h-10 px-4 rounded-xl text-[12.5px] font-black inline-flex items-center justify-center gap-1.5 shadow-sm cy-press disabled:opacity-50 disabled:cursor-not-allowed transition ${BTN_TONES[tone]}`}
    >
      {busy ? "جارٍ التنفيذ..." : children}
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-2 rounded-lg border border-line bg-paper-2 px-2.5 h-10 cy-press"
    >
      <span className="text-[12px] font-bold text-ink-700">{label}</span>
      <span className={`relative w-9 h-5 rounded-full transition-colors ${checked ? "bg-cash-green" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "right-0.5" : "right-[18px]"}`} />
      </span>
    </button>
  );
}
