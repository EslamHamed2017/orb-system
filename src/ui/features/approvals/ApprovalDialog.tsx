export function ApprovalDialog({ locale }: Readonly<{ locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  const hash = "7069e1419e028a9d1eb82af5753b67e69982964da7619e3683067a7a68c5b468";
  return <section role="region" aria-labelledby="approval-review-title" className="orb-approval-review">
    <style>{`
      .orb-approval-review{display:grid;gap:18px}
      .orb-approval-review h2,.orb-approval-review p{margin:0}
      .orb-approval-review__summary{font-size:1.1rem;font-weight:750}
      .orb-approval-review__facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0}
      .orb-approval-review__facts>div,.orb-approval-review__change{background:var(--orb-color-surface-container);border-radius:12px;padding:14px;min-inline-size:0}
      .orb-approval-review__change{display:grid;grid-template-columns:minmax(8rem,.55fr) minmax(0,1fr) minmax(0,1fr);gap:12px;align-items:start}
      .orb-approval-review__change strong{color:var(--orb-color-on-surface-variant);font-size:.78rem}
      .orb-approval-review__technical{border-block-start:1px solid var(--orb-color-outline-variant);padding-block-start:14px}
      .orb-approval-review__technical summary{color:var(--orb-color-primary);cursor:pointer;font-weight:750}
      .orb-approval-review__technical dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .orb-approval-review__technical dd{overflow-wrap:anywhere}
      @media(max-width:600px){.orb-approval-review__facts,.orb-approval-review__technical dl{grid-template-columns:1fr}.orb-approval-review__change{grid-template-columns:1fr;gap:6px}}
    `}</style>
    <div>
      <h2 id="approval-review-title">{ar ? "مراجعة إرسال مستندات العميل" : "Review customer document delivery"}</h2>
      <p className="orb-approval-review__summary">{ar ? "إرسال مستندات الشحن إلى العميل" : "Send shipping documents to the customer"}</p>
    </div>

    <div role="status">
      <strong>{ar ? "خدمة الموافقات غير متصلة" : "Approval service is not connected"}</strong>
      <p>{ar
        ? "هذا الطلب للمعاينة فقط. لم يتم إرسال أي رسالة، ولن يظهر زر القرار حتى تتصل الخدمة الآمنة."
        : "This request is preview-only. Nothing has been sent, and decision controls will remain hidden until the secure service is connected."}</p>
    </div>

    <dl className="orb-approval-review__facts">
      <div><dt>{ar ? "الطلب" : "Request"}</dt><dd>{ar ? "إرسال حزمة مستندات شحن" : "Send a shipping-document package"}</dd></div>
      <div><dt>{ar ? "مرجع الحزمة" : "Package reference"}</dt><dd><bdi>ORB-MAN-0007</bdi></dd></div>
      <div><dt>{ar ? "مقدم الطلب" : "Requested by"}</dt><dd>{ar ? "مستخدم العمليات" : "Operations user"}</dd></div>
      <div><dt>{ar ? "الدور المطلوب" : "Required role"}</dt><dd>{ar ? "مالك النظام" : "System owner"}</dd></div>
      <div><dt>{ar ? "الحالة" : "Status"}</dt><dd>{ar ? "بانتظار القرار" : "Awaiting decision"}</dd></div>
      <div><dt>{ar ? "تاريخ الطلب" : "Requested"}</dt><dd>{ar ? "٧ نوفمبر ٢٠٢٦، ١٠:٣٠ ص" : "7 Nov 2026, 10:30 AM"}</dd></div>
    </dl>

    <div>
      <h3>{ar ? "ما الذي تغير؟" : "What changed?"}</h3>
      <div className="orb-approval-review__change">
        <strong>{ar ? "قائمة المستلمين" : "Recipient list"}</strong>
        <span>{ar ? "قبل: فريق العمليات" : "Before: Operations team"}</span>
        <span>{ar ? "بعد: فريق استيراد العميل" : "After: Customer import team"}</span>
      </div>
    </div>

    <div role="note">
      <strong>{ar ? "تحقق قبل الموافقة" : "Check before approving"}</strong>
      <p>{ar
        ? "تغير المستلم بعد المراجعة السابقة. تأكد من صحة الجهة المستلمة والمرفقات؛ ولا يجوز لمقدم الطلب اعتماد طلبه."
        : "The recipient changed after the previous review. Verify the recipient and attachments; the requester cannot approve their own request."}</p>
    </div>

    <p><strong>{ar ? "المرفقات غير متاحة" : "Attachments are unavailable"}</strong> · {ar
      ? "ستظهر حزمة المستندات هنا بعد اتصال خدمة الموافقات."
      : "The document package will appear here after the approval service is connected."}</p>

    <details className="orb-approval-review__technical">
      <summary>{ar ? "التفاصيل التقنية" : "Technical details"}</summary>
      <dl>
        <div><dt>{ar ? "رمز الإجراء" : "Action code"}</dt><dd><bdi>EXTERNAL_SEND</bdi></dd></div>
        <div><dt>{ar ? "نوع الموضوع" : "Subject type"}</dt><dd><bdi>OUTBOUND_MANIFEST</bdi></dd></div>
        <div><dt>{ar ? "مرجع الموضوع" : "Subject reference"}</dt><dd>ORB-MAN-0007</dd></div>
        <div><dt>{ar ? "إصدار الربط" : "Binding version"}</dt><dd>3</dd></div>
        <div><dt>{ar ? "حقل المصدر" : "Source field"}</dt><dd><bdi>orderedToRecipients</bdi></dd></div>
        <div><dt>{ar ? "عنوان المستلم" : "Recipient address"}</dt><dd><bdi>customer@example.test</bdi></dd></div>
        <div><dt>{ar ? "تجزئة الموضوع" : "Subject hash"}</dt><dd><bdi>{hash}</bdi></dd></div>
        <div><dt>{ar ? "معرف الدليل" : "Evidence ID"}</dt><dd><bdi>EVIDENCE-0007 · SHA-256 · 128 bytes</bdi></dd></div>
      </dl>
    </details>
  </section>;
}
