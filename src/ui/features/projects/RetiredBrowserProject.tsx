import { EnterpriseStyles, ErpPageHeader } from "../admin/EnterpriseUx";

/**
 * Shown where the app used to read projects saved only in this browser. Those were test records; real projects,
 * shipments, invoices, money and expenses live in the shared database. `feature` names a part that is not on the
 * database yet (claims, project closure), so users know where to go instead.
 */
export function RetiredBrowserProject({ locale, feature, projectId }: { readonly locale: "en" | "ar"; readonly feature?: "claims" | "closure"; readonly projectId?: string }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const q = `?locale=${locale}`;
  const title = feature === "claims" ? t("Claims", "المطالبات") : feature === "closure" ? t("Project closure", "إغلاق المشروع") : t("Project not found", "المشروع غير موجود");
  const description = feature === "claims"
    ? t("Claims are moving to the shared database and are not available for this project yet. Record the issue on the shipment notes meanwhile.", "المطالبات تنتقل إلى قاعدة البيانات المشتركة وغير متاحة لهذا المشروع بعد. سجّل المشكلة في ملاحظات الشحنة مؤقتاً.")
    : feature === "closure"
      ? t("Project closure is moving to the shared database and is not available for this project yet.", "إغلاق المشروع ينتقل إلى قاعدة البيانات المشتركة وغير متاح لهذا المشروع بعد.")
      : t("This link points to a project that was only saved in a browser during testing. Projects now live in the shared database.", "هذا الرابط لمشروع كان محفوظاً في المتصفح فقط أثناء التجربة. المشاريع الآن في قاعدة البيانات المشتركة.");
  return <section className="orb-erp" dir={ar ? "rtl" : "ltr"} aria-labelledby="retired-title">
    <EnterpriseStyles/>
    <ErpPageHeader titleId="retired-title" eyebrow={t("Projects", "المشاريع")} title={title} description={description}/>
    <p>{projectId && feature ? <a href={`/projects/${projectId}/overview${q}`}>{t("Back to the project", "العودة إلى المشروع")}</a> : <a href={`/projects${q}`}>{t("Open projects", "فتح المشاريع")}</a>}</p>
  </section>;
}
