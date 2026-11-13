import styles from "./ProjectContextNavigation.module.css";
import { buildProjectContextLinks, projectContextCopy, type ProjectContextDestination, type ProjectContextLocale } from "./project-context-links";

export function ProjectContextNavigation({ locale, projectId, current, recordId }: Readonly<{ locale: ProjectContextLocale; projectId: string; current: ProjectContextDestination; recordId?: string }>) {
  const text = projectContextCopy[locale];
  const root = `/projects/${encodeURIComponent(projectId)}`;
  const suffix = `?locale=${locale}`;
  const destinations = buildProjectContextLinks(locale, projectId);
  const section = text[current];
  return <div className={styles.context} dir={locale === "ar" ? "rtl" : "ltr"} data-project-context-navigation>
    <nav aria-label={text.breadcrumb}><ol className={styles.breadcrumb}>
      <li><a href={`/projects${suffix}`}>{text.project}</a></li>
      <li><a href={`${root}/overview${suffix}`}><bdi>{projectId}</bdi></a></li>
      <li className={styles.current} aria-current={recordId ? undefined : "page"}>{section}</li>
      {recordId ? <li className={styles.current} aria-current="page"><bdi>{recordId}</bdi></li> : null}
    </ol></nav>
    <nav aria-label={text.related}><ul className={styles.related}>{destinations.map(({ key, label, href }) =>
      <li key={key}><a href={href} aria-current={current === key || (key === "shipments" && (current === "supplierContainer" || current === "salesShipment")) || (key === "activity" && current === "audit") ? "page" : undefined}>{label}</a></li>
    )}</ul></nav>
  </div>;
}
