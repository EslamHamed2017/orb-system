export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  const query = await searchParams; const ar = query.locale === "ar";
  return <section aria-labelledby="projects-title" style={{ display: "grid", gap: 16 }}>
    <header><p>{ar ? "مساحة العمل التشغيلية" : "Operational workspace"}</p><h1 id="projects-title">{ar ? "المشاريع" : "Projects"}</h1></header>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <label>{ar ? "بحث بالمشروع أو المرجع" : "Search project or reference"}<input type="search" style={{ display: "block", minHeight: 48 }} /></label>
      <label>{ar ? "الحالة" : "Status"}<select defaultValue="active" style={{ display: "block", minHeight: 48 }}><option value="active">{ar ? "نشط" : "Active"}</option><option value="closed">{ar ? "مغلق" : "Closed"}</option></select></label>
      <a href={`/projects/new?locale=${ar ? "ar" : "en"}`} style={{ alignItems: "center", display: "inline-flex" }}>{ar ? "مشروع جديد" : "New project"}</a>
    </div>
    <div role="status" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}><h2>{ar ? "لا توجد مشاريع بعد" : "No projects yet"}</h2><p>{ar ? "أنشئ مشروعاً مع مسودة عقد بيع واحدة في معاملة ذرية." : "Create a project with one sales-contract draft in one atomic transaction."}</p></div>
  </section>;
}
