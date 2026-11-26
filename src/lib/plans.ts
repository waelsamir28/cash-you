/** خطط بيع التفعيل ومعلومات النظام — تُعرض في صفحة التفعيل */
import type { ActivationPlan } from "@/lib/activation";

export const SALES_CONTACT = "01222355769";
export const SYSTEM_NAME = "CASH YOU · POS";
export const SYSTEM_VERSION = "1.1";

export type SalePlan = {
  days: ActivationPlan;
  title: string;
  price: number;
  duration: string;
  highlight?: boolean;
  features: string[];
};

export const SALE_PLANS: SalePlan[] = [
  {
    days: 365,
    title: "سنة",
    price: 1000,
    duration: "صالحة لمدة 12 شهر",
    features: ["كل وحدات البرنامج (المبيعات والمشتريات والخزينة والتقارير)", "أصناف وفواتير ومستخدمون بلا قيود", "تحديثات البرنامج خلال السنة", "دعم فني بالتليفون"],
  },
  {
    days: 730,
    title: "سنتين",
    price: 1500,
    duration: "صالحة لمدة 24 شهر",
    highlight: true,
    features: ["كل مميزات خطة السنة", "توفير مقارنة بسعر سنتين منفصلتين", "أولوية في الدعم الفني", "تحديثات السنتين"],
  },
  {
    days: 36500,
    title: "مدى الحياة",
    price: 2500,
    duration: "بدون انتهاء",
    features: ["كل مميزات البرنامج بدون انتهاء", "تحديثات مدى الحياة", "أولوية قصوى في الدعم الفني", "مناسب للمحلات طويلة المدى"],
  },
];
