import { localizedDomainTerms } from "../../platform/i18n/domain-terminology";

export const ar = {
  language: "العربية",
  primaryNavigation: "التنقل الرئيسية",
  today: "اليوم",
  projects: "المشاريع",
  approvals: "الموافقات",
  more: "المزيد",
  close: "إغلاق",
  menuTitle: "وجهات إضافية",
  shellTitle: "عمليات التجارة",
  reference: "ORB-R1",
  domain: localizedDomainTerms("ar"),
  states: {
    loading: { title: "جارٍ التحميل", detail: "جارٍ تحميل أحدث بيانات العمليات." },
    empty: { title: "لا توجد بيانات بعد", detail: "أنشئ أول سجل تشغيلي.", action: "عرض المشاريع" },
    error: { title: "تعذر التحميل", detail: "فشل الطلب دون فقدان عملك.", action: "إعادة المحاولة" },
    "permission-denied": { title: "الصلاحية مطلوبة", detail: "دورك الثابت لا يسمح بعرض هذا المحتوى.", action: "العودة إلى اليوم" },
    offline: { title: "أنت غير متصل", detail: "أعد الاتصال قبل إجراء تغيير مضبوط.", action: "إعادة الاتصال" },
    "stale-version": { title: "يوجد إصدار أحدث", detail: "قارن وأعد التحميل بدلاً من الاستبدال.", action: "تحميل أحدث إصدار" },
  },
} as const;
