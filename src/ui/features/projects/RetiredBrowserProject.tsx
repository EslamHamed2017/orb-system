import { EnterpriseStyles, ErpPageHeader } from "../admin/EnterpriseUx";

/**
 * Shown where the app used to read projects saved only in this browser. Those were test records; real projects
 * and everything on them live in the shared database.
 */
export function RetiredBrowserProject({ locale }: { readonly locale: "en" | "ar" }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  return <section className="orb-erp" dir={ar ? "rtl" : "ltr"} aria-labelledby="retired-title">
    <EnterpriseStyles/>
    <ErpPageHeader titleId="retired-title" eyebrow={t("Projects", "المشاريع")} title={t("Project not found", "المشروع غير موجود")}
      description={t("This link points to a project that was only saved in a browser during testing. Projects now live in the shared database.", "هذا الرابط لمشروع كان محفوظاً في المتصفح فقط أثناء التجربة. المشاريع الآن محفوظة في قاعدة البيانات المشتركة.")}/>
    <p><a href={`/projects?locale=${locale}`}>{t("Open projects", "فتح المشاريع")}</a></p>
  </section>;
}
