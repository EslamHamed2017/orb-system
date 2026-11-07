type DemoState = "blocked" | "exception" | "approved" | "invalidated" | "closed";

export function CloseReopenDialog({ locale, state }: Readonly<{ locale: "ar" | "en"; state: DemoState }>) {
  const ar = locale === "ar";
  if (state === "invalidated") return <section role="region" aria-labelledby="basis-changed-title" style={{ border: "2px solid var(--orb-color-error)", borderRadius: 16, padding: 16 }}>
    <h2 id="basis-changed-title">{ar ? "تغير أساس الإغلاق" : "Closure basis changed"}</h2>
    <p>{ar ? "أعيد فتح الإغلاق النهائي: تمت مراجعة المستند." : "Final close reopened: document revised."}</p>
    <p><bdi>{ar ? "التقييم ASSESSMENT-0015 غير صالح" : "Assessment ASSESSMENT-0015 invalidated"}</bdi> · {ar ? "انتهت موافقة الاستثناء" : "Exception approval expired"}</p>
    <a href="#closure-assessment-title">{ar ? "تحديث التقييم" : "Refresh assessment"}</a>
  </section>;
  if (state === "closed") return <section role="region" aria-labelledby="reopen-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
    <h2 id="reopen-title">{ar ? "إعادة فتح المشروع" : "Reopen project"}</h2>
    <p>{ar ? "إصدار المشروع 16" : "Project version 16"} · {ar ? "الموافقة: معتمدة" : "Approval: APPROVED"}</p>
    <label>{ar ? "سبب إعادة الفتح" : "Reopen reason"}<textarea readOnly defaultValue={ar ? "يتطلب رد العميل مراجعة التسوية" : "Customer refund requires settlement review"} style={{ display: "block", width: "100%", minHeight: 88 }} /></label>
    <p>{ar ? "الحالة المالية المعاد حسابها: مغلق ماليًا" : "Recomputed financial state: FINANCIALLY CLOSED"}</p>
    <button type="button">{ar ? "تطبيق إعادة الفتح" : "Apply reopen"}</button>
  </section>;
  return <>
    {state === "exception" && <section role="region" aria-labelledby="exception-title" style={{ border: "1px solid var(--orb-color-outline)", borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
      <h2 id="exception-title">{ar ? "طلب استثناء الإغلاق" : "Closure exception request"}</h2>
      <p><bdi>ROUTE_ITEM_INCOMPLETE</bdi></p><p>{ar ? "التقييم" : "Assessment"} <bdi>ASSESSMENT-0014</bdi> · {ar ? "إصدار المشروع 14" : "Project version 14"}</p>
      <label>{ar ? "سبب الاستثناء" : "Exception reason"}<textarea readOnly defaultValue={ar ? "تأخرت أدلة الجمارك من الجهة" : "Customs evidence delayed by authority"} style={{ display: "block", width: "100%", minHeight: 88 }} /></label>
      <p>{ar ? "الموافقة: قيد الانتظار" : "Approval: PENDING"}</p>
    </section>}
    <section role="region" aria-labelledby="final-close-title" style={{ background: "var(--orb-color-surface-container)", borderRadius: 16, padding: 16 }}>
      <h2 id="final-close-title">{ar ? "الإغلاق النهائي" : "Final close"}</h2>
      {state === "approved" ? <><p>{ar ? "تقييم حديث" : "Fresh assessment"} <bdi>ASSESSMENT-0015</bdi> · {ar ? "الموافقة: معتمدة" : "Approval: APPROVED"}</p><button type="button">{ar ? "تطبيق الإغلاق النهائي" : "Apply final close"}</button></>
        : <><p>{ar ? "7 موانع غير مغطاة" : "7 uncovered blockers"}</p><button type="button" disabled>{ar ? "تقديم الإغلاق النهائي" : "Submit final close"}</button></>}
    </section>
  </>;
}
