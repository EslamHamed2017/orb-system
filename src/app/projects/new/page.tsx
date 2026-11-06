export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ locale?: string }> }) {
  const query = await searchParams; const ar = query.locale === "ar";
  return <section aria-labelledby="new-project-title" style={{ display: "grid", gap: 16 }}>
    <header><p aria-live="polite">{ar ? "الخطوة 1 من 3" : "Step 1 of 3"}</p><h1 id="new-project-title">{ar ? "مشروع جديد" : "New project"}</h1><p>{ar ? "العميل ← عقد البيع والمسار والتحملات ← المراجعة والإنشاء" : "Customer → sales contract, route and tolerances → review and create"}</p></header>
    <form style={{ display: "grid", gap: 16, maxWidth: 720 }}>
      <fieldset style={{ display: "grid", gap: 12 }}><legend>{ar ? "العميل والمراجع" : "Customer and references"}</legend>
        <label>{ar ? "العميل" : "Customer"}<select required defaultValue="" style={{ display: "block", minHeight: 48, width: "100%" }}><option value="" disabled>{ar ? "اختر العميل" : "Choose customer"}</option><option value="demo">{ar ? "عميل تجريبي" : "Demo customer"}</option></select></label>
        <label>{ar ? "مرجع المشروع" : "Project reference"}<input required name="projectReference" style={{ display: "block", minHeight: 48, width: "100%" }} /></label>
        <label>{ar ? "مرجع عقد البيع" : "Sales contract reference"}<input required name="contractReference" style={{ display: "block", minHeight: 48, width: "100%" }} /></label>
      </fieldset>
      <fieldset style={{ display: "grid", gap: 12 }}><legend>{ar ? "عقد البيع" : "Sales contract"}</legend>
        <label>{ar ? "الكمية" : "Quantity"}<input required type="number" min="0.001" step="0.001" style={{ display: "block", minHeight: 48, width: "100%" }} /></label>
        <label>{ar ? "العملة" : "Currency"}<select defaultValue="AED" style={{ display: "block", minHeight: 48, width: "100%" }}><option>AED</option><option>USD</option><option>SAR</option></select></label>
        <label>{ar ? "تحمل الكمية" : "Quantity tolerance"}<input aria-describedby="zero-tolerance" type="number" defaultValue="0" min="0" step="0.001" style={{ display: "block", minHeight: 48, width: "100%" }} /></label>
        <label>{ar ? "تحمل السعر" : "Price tolerance"}<input aria-describedby="zero-tolerance" type="number" defaultValue="0" min="0" step="0.001" style={{ display: "block", minHeight: 48, width: "100%" }} /></label>
        <p id="zero-tolerance">{ar ? "التحمل الافتراضي صفر؛ أي تجاوز يتطلب موافقة ثابتة." : "Default tolerance is zero; any breach requires fixed approval."}</p>
      </fieldset>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><a href={`/projects?locale=${ar ? "ar" : "en"}`} style={{ alignItems: "center", display: "inline-flex" }}>{ar ? "إلغاء" : "Cancel"}</a><button type="button">{ar ? "التالي: المراجعة" : "Next: review"}</button></div>
    </form>
  </section>;
}
