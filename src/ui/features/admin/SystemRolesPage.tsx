import { EnterpriseStyles, ErpPageHeader } from "./EnterpriseUx";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { roleCatalog } from "../../../modules/access/role-catalog.ts";

type Locale = "en" | "ar";

/** Server-rendered, read-only view of the three roles the server actually enforces. */
export function SystemRolesPage({ locale, query = "" }: { readonly locale: Locale; readonly query?: string }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const roles = roleCatalog();
  const operations = [...new Set(roles.flatMap((role) => role.operationIds))].sort();
  const needle = query.trim().toLowerCase();
  const rows = needle ? operations.filter((id) => id.toLowerCase().includes(needle)) : operations;
  return <section aria-labelledby="roles-title" dir={ar ? "rtl" : "ltr"} className="orb-erp orb-roles">
    <EnterpriseStyles/><style>{`
      .orb-roles .role-cards{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-block:16px}
      .orb-roles .role-card{border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:16px}.orb-roles .role-card h3{margin:0 0 6px}
      .orb-roles .table-wrap{overflow-x:auto}.orb-roles table{inline-size:100%;border-collapse:collapse}.orb-roles th,.orb-roles td{text-align:start;padding:8px 10px;border-block-end:1px solid var(--orb-color-outline-variant);font-size:.85rem}
      .orb-roles td.mark{text-align:center;font-weight:800}
    `}</style>
    <ErpPageHeader titleId="roles-title" eyebrow={t("Access administration", "إدارة الوصول")} title={t("Roles and permissions", "الأدوار والصلاحيات")}
      description={t("ORB enforces three fixed roles on the server. A user can hold more than one. Assign roles from Users and access.", "يطبق ORB ثلاثة أدوار ثابتة على الخادم، ويمكن للمستخدم أن يحمل أكثر من دور. توزيع الأدوار يتم من شاشة المستخدمين.")}
      meta={<a className="orb-button-filled" href={`/admin/users?locale=${locale}`}>{t("Users and access", "المستخدمون والوصول")}</a>}/>
    <div className="role-cards">{roles.map((role) => <article className="role-card" key={role.code}>
      <h3>{ar ? role.nameAr : role.nameEn}</h3><p className="orb-muted">{ar ? role.descriptionAr : role.descriptionEn}</p>
      <p><strong>{role.operationIds.length}</strong> {t("allowed operations", "عملية مسموحة")}</p>
    </article>)}</div>
    <form method="get" className="orb-toolbar"><input type="hidden" name="locale" value={locale}/>
      <label>{t("Search operations", "بحث في العمليات")}<input type="search" name="q" defaultValue={query} dir="ltr"/></label><button type="submit">{t("Search", "بحث")}</button>
    </form>
    <div className="table-wrap"><table><thead><tr><th>{t("Operation", "العملية")}</th>{roles.map((role) => <th key={role.code}>{ar ? role.nameAr : role.nameEn}</th>)}</tr></thead>
      <tbody>{rows.map((id) => <tr key={id}><td><code>{id}</code></td>{roles.map((role) => <td className="mark" key={role.code} aria-label={role.operationIds.includes(id) ? t("Allowed", "مسموح") : t("Not allowed", "غير مسموح")}>{role.operationIds.includes(id) ? "✓" : "—"}</td>)}</tr>)}</tbody>
    </table></div>
  </section>;
}
