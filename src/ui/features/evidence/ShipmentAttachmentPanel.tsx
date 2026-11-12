import s from "../shipments/operations.module.css";

export type ShipmentAttachment = Readonly<{
  id: string;
  originalFilename: string;
  purpose: string;
  mediaType: string;
  uploadedAt: string;
  verificationState: "PENDING" | "VERIFIED" | "REJECTED";
}>;

export function ShipmentAttachmentPanel({
  locale,
  projectId,
  subjectType,
  subjectId,
  attachments = [],
  canUpload,
}: Readonly<{
  locale: "ar" | "en";
  projectId: string;
  subjectType: "SALES_SHIPMENT" | "SUPPLIER_CONTAINER";
  subjectId: string;
  attachments?: readonly ShipmentAttachment[];
  canUpload: boolean;
}>) {
  const ar = locale === "ar";
  const isContainer = subjectType === "SUPPLIER_CONTAINER";
  const headingId = `shipment-attachments-${subjectType.toLowerCase()}-${subjectId}`;
  const listEndpoint = `/api/evidence?projectId=${encodeURIComponent(projectId)}&subjectType=${subjectType}&subjectId=${encodeURIComponent(subjectId)}`;
  const subjectLabel = ar ? (isContainer ? "حاوية الموردين" : "شحنة البيع") : (isContainer ? "supplier container" : "sales shipment");

  return <section
    id={headingId}
    dir={ar ? "rtl" : "ltr"}
    className={s.card}
    aria-labelledby={`${headingId}-title`}
    data-backend-endpoint={`/api/evidence?projectId=${projectId}&subjectType=${subjectType}&subjectId=${subjectId}`}
  >
    <div className={s.sectionHeader}>
      <div>
        <p className={s.eyebrow}>{ar ? "سجل المستندات" : "Document record"}</p>
        <h2 id={`${headingId}-title`}>{ar ? "مرفقات" : "Attachments"}</h2>
        <p>{ar ? `ملفات غير قابلة للتغيير ومرتبطة بـ${subjectLabel} وتخضع لصلاحيات المشروع.` : `Immutable files linked to this ${subjectLabel} and protected by project permissions.`}</p>
      </div>
      <span className={s.chip}><bdi>{attachments.length}</bdi> {ar ? "ملف" : attachments.length === 1 ? "file" : "files"}</span>
    </div>

    <div aria-live="polite">
      {attachments.length === 0 ? <p className={s.notice}>{ar ? "لا توجد مرفقات لهذه المعاملة بعد." : "No attachments have been added to this transaction yet."}</p> :
        <div className={s.tableScroll}><table>
          <caption>{ar ? `المرفقات المرتبطة بـ${subjectLabel}` : `Attachments linked to the ${subjectLabel}`}</caption>
          <thead><tr><th scope="col">{ar ? "الملف" : "File"}</th><th scope="col">{ar ? "الغرض" : "Purpose"}</th><th scope="col">{ar ? "الحالة" : "Status"}</th><th scope="col">{ar ? "تاريخ الرفع" : "Uploaded"}</th><th scope="col">{ar ? "الإجراءات" : "Actions"}</th></tr></thead>
          <tbody>{attachments.map((attachment) => <tr key={attachment.id}>
            <th scope="row"><bdi>{attachment.originalFilename}</bdi><span className={s.helper}>{attachment.mediaType}</span></th>
            <td>{attachment.purpose}</td><td>{attachment.verificationState}</td><td><bdi>{attachment.uploadedAt}</bdi></td>
            <td><div className={s.actions}><a href={`/evidence/${attachment.id}?locale=${locale}`}>{ar ? "التفاصيل" : "Details"}</a><a href={`/api/evidence/${attachment.id}/content?disposition=attachment`}>{ar ? "تنزيل" : "Download"}</a></div></td>
          </tr>)}</tbody>
        </table></div>}
    </div>

    {canUpload && <form action="/api/evidence" method="post" encType="multipart/form-data" data-operation-id="uploadEvidence" className={s.formGrid}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="subjectType" value={subjectType} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <label>{ar ? "الغرض" : "Purpose"}<input name="purpose" required maxLength={200} placeholder={ar ? "مثال: مستندات الشحن المعتمدة" : "For example: approved shipping documents"} /></label>
      <label>{ar ? "الملف" : "File"}<input name="file" type="file" required accept="application/pdf,image/jpeg,image/png" /></label>
      <div className={`${s.actions} ${s.full}`}><button className={s.primary} type="submit">{ar ? "رفع والتحقق" : "Upload and verify"}</button></div>
    </form>}
    {!canUpload && <p className={s.helper}>{ar ? "عرض فقط للمرفقات — لا تملك صلاحية الرفع." : "Read-only attachments — you do not have upload permission."}</p>}
    <a className={s.helper} href={listEndpoint}>{ar ? "فتح قائمة المرفقات المصرح بها" : "Open authorized attachment list"}</a>
  </section>;
}
