"use client";

import { ModuleShell, ModuleTitle, Panel, Field, inputCls, btnCls } from "@/components/ModuleUI";
import { IcoPhone, IcoCheck, IcoLogo } from "@/components/icons";

/**
 * صفحة الدعم الفني.
 *
 * تعرض بيانات التواصل، ومعلومات النسخة (رقم الإصدار / الجهاز / التفعيل)،
 * وخطوات شائعة لحل المشكلات — مع زر نسخ بيانات التواصل وأدوات التشخيص.
 */

const SUPPORT_PHONE = "01222355769";
const SUPPORT_NAME = "م / وائل الجمال";

type Props = {
  /** رقم إصدار البرنامج */
  appVersion?: string;
  /** معرّف الجهاز (لعرضه في طلب الدعم) */
  deviceId?: string;
  /** هل النسخة مفعّلة؟ */
  licensed?: boolean;
  /** عدد الأيام المتبقية في التفعيل */
  daysLeft?: number;
  /** هل يعمل بقاعدة بيانات محلية؟ */
  localDb?: boolean;
  /** عدد العمليات المعلّقة للمزامنة */
  pendingSync?: number;
};

function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Field label={label} className="flex-1 min-w-0">
        <div className={`${inputCls} flex items-center ${mono ? "cy-num" : ""}`}>{value}</div>
      </Field>
      <button
        type="button"
        className={`${btnCls} mt-[22px] shrink-0 bg-ink-800 text-white`}
        onClick={() => {
          void navigator.clipboard?.writeText(value).catch(() => undefined);
        }}
        title={`نسخ ${label}`}
      >
        نسخ
      </button>
    </div>
  );
}

export function SupportScreen({
  appVersion,
  deviceId,
  licensed,
  daysLeft,
  localDb,
  pendingSync,
}: Props) {
  const diagnosis = [
    { label: "إصدار البرنامج", value: appVersion || "غير معروف" },
    { label: "معرّف الجهاز", value: deviceId || "غير متاح" },
    { label: "حالة التفعيل", value: licensed ? `مفعّلة — متبقٍ ${daysLeft ?? 0} يوم` : "غير مفعّلة" },
    { label: "مصدر البيانات", value: localDb ? "قاعدة بيانات محلية على هذا الجهاز" : "قاعدة بيانات سحابية" },
    { label: "عمليات معلّقة للمزامنة", value: String(pendingSync ?? 0) },
  ];

  const steps = [
    {
      title: "البرنامج لا يفتح أو يعلّق",
      body: "أغلق البرنامج من قائمة (X) ثم افتحه مرة أخرى. إن استمرت المشكلة، افتح «ربط قاعدة البيانات» وتأكد أن الاتصال ناجح.",
    },
    {
      title: "رسالة «غير متصل بالإنترنت»",
      body: "إن كنت تعمل على قاعدة سحابية تحقق من اتصال الإنترنت. وإن كنت تستخدم قاعدة محلية فهذا طبيعي — البرنامج يعمل بدون إنترنت.",
    },
    {
      title: "البيانات لا تظهر بعد المزامنة",
      body: "اضغط زر «مزامنة الآن» في شريط الحالة أسفل الشاشة. إن بقيت عمليات معلّقة، أعد تشغيل البرنامج بعد التأكد من الاتصال.",
    },
    {
      title: "نسيت كلمة المرور",
      body: "سجّل الدخول بحساب المالك، ثم افتح «المستخدمون» لتعديل كلمة المرور أو إضافة مستخدم جديد.",
    },
  ];

  return (
    <ModuleShell>
      <ModuleTitle
        title="الدعم الفني"
        subtitle="كل ما تحتاجه来解决 المشكلة أو التواصل معنا"
        badge="CASH YOU"
      />

      <div className="mt-2 grid grid-cols-1 items-start gap-2 xl:grid-cols-[1fr_360px]">
        <div className="space-y-2">
          {/* ---------- بيانات التواصل ---------- */}
          <Panel title="بيانات التواصل" hint="اضغط «نسخ» لنسخ الرقم">
            <div className="p-3 space-y-2.5">
              <CopyField label="المسؤول" value={SUPPORT_NAME} />
              <CopyField label="رقم التليفون / واتساب" value={SUPPORT_PHONE} mono />
              <p className="rounded-lg border border-line bg-paper-2 px-3 py-2 text-[11.5px] font-bold leading-5 text-slate-600">
                عند طلب الدعم أرسل: إصدار البرنامج، معرّف الجهاز (نسخه من الأسفل)،
                وخطوات إعادة إنتاج المشكلة مع صورة للشاشة.
              </p>
            </div>
          </Panel>

          {/* ---------- خطوات شائعة ---------- */}
          <Panel title="حلول سريعة" hint="جرّبها قبل التواصل">
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {steps.map((s) => (
                <div key={s.title} className="rounded-lg border border-line bg-paper-2 p-3">
                  <p className="flex items-center gap-1.5 text-[12.5px] font-black text-ink-800">
                    <IcoCheck className="h-3.5 w-3.5 text-cash-green" />
                    {s.title}
                  </p>
                  <p className="mt-1.5 text-[11.5px] font-semibold leading-5 text-slate-600">{s.body}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* ---------- تشخيص ---------- */}
        <div className="space-y-2">
          <Panel title="معلومات تشخيص" hint="انسخها وأرسلها للدعم">
            <div className="p-3 space-y-2">
              {diagnosis.map((d) => (
                <div key={d.label} className="flex items-center justify-between gap-2 border-b border-dashed border-line pb-1.5 last:border-b-0">
                  <span className="text-[11.5px] font-bold text-slate-500">{d.label}</span>
                  <span className="cy-num truncate text-[12px] font-black text-ink-900">{d.value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="عن البرنامج">
            <div className="p-3 flex flex-col items-center gap-2 text-center">
              <IcoLogo className="h-14 w-14" />
              <p className="text-[13px] font-black text-ink-800">CASH YOU — كاش يو</p>
              <p className="text-[11.5px] font-semibold leading-5 text-slate-500">
                نظام المبيعات ونقاط البيع
                <br />
                تصميم وتنفيذ {SUPPORT_NAME}
              </p>
              <a
                href={`tel:${SUPPORT_PHONE}`}
                className={`${btnCls} w-full bg-cash-green text-white flex items-center justify-center gap-2`}
              >
                <IcoPhone className="h-4 w-4" />
                اتصل الآن
              </a>
            </div>
          </Panel>
        </div>
      </div>
    </ModuleShell>
  );
}
