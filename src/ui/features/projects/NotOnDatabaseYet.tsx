import { EnterpriseStyles, ErpPageHeader } from "../admin/EnterpriseUx";
import { ProjectContextNavigation } from "../../navigation/ProjectContextNavigation";
import type { ProjectContextDestination } from "../../navigation/project-context-links";

/** A project section that has no live data behind it yet. Says so plainly instead of showing sample figures. */
export function NotOnDatabaseYet({ locale, projectId, current, title }: { readonly locale: "en" | "ar"; readonly projectId: string; readonly current: ProjectContextDestination; readonly title: readonly [string, string] }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  return <section className="orb-erp" dir={ar ? "rtl" : "ltr"} aria-labelledby="not-yet-title">
    <EnterpriseStyles/>
    <ProjectContextNavigation locale={locale} projectId={projectId} current={current}/>
    <ErpPageHeader titleId="not-yet-title" eyebrow={t("Project", "المشروع")} title={ar ? title[1] : title[0]}
      description={t("This section is not connected to the project's live records yet, so it shows nothing rather than sample figures.", "هذا القسم غير مرتبط بسجلات المشروع الفعلية بعد، لذلك لا يعرض شيئاً بدلاً من أرقام تجريبية.")}/>
    <p><a href={`/projects/${projectId}/overview?locale=${locale}`}>{t("Back to the project", "العودة إلى المشروع")}</a></p>
  </section>;
}
