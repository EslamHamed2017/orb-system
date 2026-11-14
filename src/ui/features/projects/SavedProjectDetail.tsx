"use client";
import { useEffect, useState, type FormEvent } from "react";
import { completeProjectSetup, customerReceivableSummary, markCustomerShipmentReviewed, parseProjectRecords, PROJECT_STORAGE_KEY, projectNextAction, projectStatusLabel, recordCustomerCollection, recordCustomerInvoice, recordCustomerShipment, recordSupplierInvoice, recordSupplierPayment, recordSupplierShipment, resetCustomerFinance, resetSupplierFinance, type ProjectRecord } from "../../../modules/projects/daily-projects";
import styles from "./Projects.module.css";

type LoadState = "loading" | "ready" | "missing" | "error";
type LifecycleItem = Readonly<{ label: string; status: string }>;

export function SavedProjectDetail({ id, locale }: { readonly id: string; readonly locale: "ar" | "en" }) {
  const ar = locale === "ar";
  const [state, setState] = useState<LoadState>("loading");
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [editingSetup, setEditingSetup] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    try {
      const found = parseProjectRecords(localStorage.getItem(PROJECT_STORAGE_KEY)).find((item) => item.id === id);
      if (found) { setProject(found); setState("ready"); } else setState("missing");
    } catch { setState("error"); }
  }, [id]);

  function persistProject(update: (record: ProjectRecord) => ProjectRecord): ProjectRecord {
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    const records = parseProjectRecords(localStorage.getItem(PROJECT_STORAGE_KEY));
    const index = records.findIndex((item) => item.id === project.id);
    if (index < 0) throw new Error("PROJECT_NOT_FOUND");
    const updated = update(records[index]);
    records[index] = updated;
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(records));
    setProject(updated);
    return updated;
  }

  function saveSupplierShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    try {
      const form = new FormData(event.currentTarget);
      persistProject((stored) => recordSupplierShipment(stored, {
        reference: String(form.get("shipmentReference") ?? ""),
        expectedArrival: String(form.get("expectedArrival") ?? ""),
        quantity: String(form.get("shipmentQuantity") ?? ""),
      }, new Date().toISOString()));
    } catch {
      setSaveError(ar ? "تعذر حفظ شحنة المورد. تحقق من المرجع والتاريخ وأن الكمية لا تتجاوز كمية المشروع." : "Supplier shipment could not be saved. Check the reference, date, and that quantity does not exceed the project quantity.");
    }
  }

  function saveCustomerShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    try {
      const form = new FormData(event.currentTarget);
      persistProject((stored) => recordCustomerShipment(stored, {
        reference: String(form.get("customerShipmentReference") ?? ""),
        plannedDispatchDate: String(form.get("plannedDispatchDate") ?? ""),
        quantity: String(form.get("customerShipmentQuantity") ?? ""),
      }, new Date().toISOString()));
    } catch {
      setSaveError(ar ? "تعذر حفظ شحنة العميل. تحقق من المرجع والتاريخ وأن الكمية موجبة ولا تتجاوز كمية شحنة المورد." : "Customer shipment could not be saved. Check the reference, date, and that quantity is positive and does not exceed the supplier shipment quantity.");
    }
  }

  function reviewCustomerShipment() {
    setSaveError("");
    try {
      persistProject((stored) => markCustomerShipmentReviewed(stored, new Date().toISOString()));
    } catch {
      setSaveError(ar ? "تعذر حفظ مراجعة التسليم. أعد تحميل الصفحة وتحقق من حالة المشروع." : "Handover review could not be saved. Reload the page and check the project state.");
    }
  }

  function saveSupplierInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    try {
      const form = new FormData(event.currentTarget);
      persistProject((stored) => recordSupplierInvoice(stored, {
        reference: String(form.get("supplierInvoiceReference") ?? ""),
        invoiceDate: String(form.get("supplierInvoiceDate") ?? ""),
        amount: String(form.get("supplierInvoiceAmount") ?? ""),
      }, new Date().toISOString()));
      requestAnimationFrame(() => document.getElementById("supplier-finance")?.scrollIntoView({ block: "start" }));
    } catch {
      setSaveError(ar ? "تعذر حفظ فاتورة المورد. تحقق من المرجع والتاريخ وأن القيمة موجبة ولا تتجاوز قيمة المشروع." : "Supplier invoice could not be saved. Check the reference, date, and that the amount is positive and does not exceed the project value.");
    }
  }

  function saveSupplierPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    try {
      const form = new FormData(event.currentTarget);
      persistProject((stored) => recordSupplierPayment(stored, {
        reference: String(form.get("supplierPaymentReference") ?? ""),
        paymentDate: String(form.get("supplierPaymentDate") ?? ""),
        amount: String(form.get("supplierPaymentAmount") ?? ""),
      }, new Date().toISOString()));
      requestAnimationFrame(() => document.getElementById("supplier-finance")?.scrollIntoView({ block: "start" }));
    } catch {
      setSaveError(ar ? "تعذر حفظ دفعة المورد. تحقق من المرجع والتاريخ وأن القيمة تطابق قيمة الفاتورة بالكامل." : "Supplier payment could not be saved. Check the reference, date, and that the amount exactly matches the full invoice amount.");
    }
  }

  function saveCustomerInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    try {
      const form = new FormData(event.currentTarget);
      const expectedUpdatedAt = project?.updatedAt ?? "";
      persistProject((stored) => recordCustomerInvoice(stored, {
        reference: String(form.get("customerInvoiceReference") ?? ""),
        invoiceDate: String(form.get("customerInvoiceDate") ?? ""),
        amount: String(form.get("customerInvoiceAmount") ?? ""),
      }, new Date().toISOString(), expectedUpdatedAt));
      requestAnimationFrame(() => document.getElementById("customer-finance")?.scrollIntoView({ block: "start" }));
    } catch {
      setSaveError(ar ? "تعذر حفظ فاتورة العميل. تحقق من المرجع والتاريخ وأن القيمة موجبة ولا تتجاوز قيمة المشروع." : "Customer invoice could not be saved. Check the reference, date, and that the amount is positive and does not exceed the project value.");
    }
  }

  function saveCustomerCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    try {
      const form = new FormData(event.currentTarget);
      const expectedUpdatedAt = project?.updatedAt ?? "";
      persistProject((stored) => recordCustomerCollection(stored, {
        reference: String(form.get("customerCollectionReference") ?? ""),
        collectionDate: String(form.get("customerCollectionDate") ?? ""),
        amount: String(form.get("customerCollectionAmount") ?? ""),
      }, new Date().toISOString(), expectedUpdatedAt));
      event.currentTarget.reset();
      requestAnimationFrame(() => document.getElementById("customer-finance")?.scrollIntoView({ block: "start" }));
    } catch {
      setSaveError(ar ? "تعذر حفظ التحصيل. تحقق من المرجع والتاريخ وأن القيمة لا تتجاوز الرصيد المتبقي." : "Customer collection could not be saved. Check the reference, date, and that the amount does not exceed the remaining balance.");
    }
  }

  function correctCustomerFinance() {
    const confirmed = window.confirm(project?.customerCollections?.length
      ? (ar ? "هل تريد حذف فاتورة العميل والتحصيلات المسجلة لإعادة إدخالها؟ ستبقى بيانات المورد كما هي." : "Remove the customer invoice and recorded collections so you can enter them again? Supplier finance will remain unchanged.")
      : (ar ? "هل تريد حذف فاتورة العميل المسجلة وإعادة إدخالها؟ ستبقى بيانات المورد كما هي." : "Remove the recorded customer invoice so you can enter it again? Supplier finance will remain unchanged."));
    if (!confirmed) return;
    setSaveError("");
    try {
      const expectedUpdatedAt = project?.updatedAt ?? "";
      persistProject((stored) => resetCustomerFinance(stored, expectedUpdatedAt, new Date().toISOString()));
      requestAnimationFrame(() => document.getElementById("customer-finance")?.scrollIntoView({ block: "start" }));
    } catch {
      setSaveError(ar ? "تعذر فتح بيانات العميل المالية للتصحيح. أعد تحميل الصفحة وحاول مجدداً." : "Customer finance could not be reopened for correction. Reload the page and try again.");
    }
  }

  function correctSupplierFinance() {
    const confirmed = window.confirm(project?.customerInvoice
      ? (ar ? "سيؤدي تصحيح بيانات المورد إلى حذف فاتورة العميل والتحصيلات التابعة لها من هذا السجل المحلي. هل تريد المتابعة؟" : "Correcting supplier finance will also remove the dependent customer invoice and collections from this local record. Continue?")
      : project?.supplierPayment
        ? (ar ? "هل تريد حذف الفاتورة والدفعة المسجلتين وإعادة إدخالهما؟" : "Remove the recorded invoice and payment so you can enter them again?")
        : (ar ? "هل تريد حذف الفاتورة المسجلة وإعادة إدخالها؟" : "Remove the recorded invoice so you can enter it again?"));
    if (!confirmed) return;
    setSaveError("");
    try {
      const expectedUpdatedAt = project?.updatedAt ?? "";
      persistProject((stored) => resetSupplierFinance(stored, expectedUpdatedAt, new Date().toISOString()));
      requestAnimationFrame(() => document.getElementById("supplier-finance")?.scrollIntoView({ block: "start" }));
    } catch {
      setSaveError(ar ? "تعذر فتح البيانات المالية للتصحيح. أعد تحميل الصفحة وحاول مجدداً." : "Finance details could not be reopened for correction. Reload the page and try again.");
    }
  }

  function saveSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    if (!project) return;
    try {
      const form = new FormData(event.currentTarget);
      persistProject((stored) => completeProjectSetup(stored, {
        customer: String(form.get("setupCustomer") ?? ""),
        supplier: String(form.get("supplier") ?? ""),
        salesContractReference: String(form.get("salesContractReference") ?? ""),
        purchaseContractReference: String(form.get("purchaseContractReference") ?? ""),
      }, new Date().toISOString()));
      setEditingSetup(false);
    } catch {
      setSaveError(ar ? "تعذر حفظ الإعداد. أكمل جميع بيانات الأطراف والعقود وحاول مجدداً." : "Setup could not be saved. Complete all party and contract fields, then try again.");
    }
  }

  if (state === "loading") return <section className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.stateCard} role="status">{ar ? "جارٍ تحميل المشروع…" : "Loading project…"}</div></section>;
  if (state === "error") return <section className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.stateCard} role="alert"><h1>{ar ? "تعذر فتح المشروع" : "Project could not be opened"}</h1><p>{ar ? "تحقق من التخزين المحلي وأعد تحميل الصفحة." : "Check browser storage and reload the page."}</p></div></section>;
  if (state === "missing" || !project) return <section className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.stateCard}><h1>{ar ? "المشروع غير موجود" : "Project not found"}</h1><p>{ar ? "لم يتم العثور على مشروع محفوظ بهذا الرابط في هذا المتصفح." : "No saved project for this link was found in this browser."}</p><a className={styles.outlinedButton} href={`/projects?locale=${locale}`}>{ar ? "العودة إلى المشاريع" : "Back to projects"}</a></div></section>;

  const next = projectNextAction(project, locale);
  const receivable = customerReceivableSummary(project);
  const tasks: LifecycleItem[] = (ar ? [
    "العميل والمورد", "عقود البيع والشراء", "شحنات المورد والعميل", "الفواتير والمدفوعات", "المصروفات", "المطالبات", "الإغلاق وإعادة الفتح",
  ] : [
    "Customer and supplier", "Sales and purchase contracts", "Supplier and customer shipments", "Invoices and payments", "Expenses", "Claims", "Closure and reopening",
  ]).map((label, index) => ({ label, status: index < 2 && project.status !== "SETUP"
    ? (ar ? "اكتمل الإعداد" : "Setup complete")
    : index === 2 && project.customerShipmentReviewedAt
      ? (ar ? "اكتملت مراجعة تسليم الشحنة" : "Shipment handover reviewed")
      : index === 2 && project.customerShipment
      ? (ar ? "سُجلت شحنتا المورد والعميل" : "Supplier and customer shipments recorded")
      : index === 2 && project.supplierShipment
        ? (ar ? "سُجلت شحنة المورد" : "Supplier shipment recorded")
        : index === 3 && project.customerInvoice && receivable.complete
          ? (ar ? "اكتملت فواتير المورد والعميل والتحصيل" : "Supplier and customer finance recorded")
          : index === 3 && project.customerInvoice
            ? (ar ? "فاتورة العميل مسجلة والتحصيل جارٍ" : "Customer invoice recorded; collection in progress")
            : index === 3 && project.supplierPayment
              ? (ar ? "اكتملت بيانات المورد؛ فاتورة العميل مطلوبة" : "Supplier finance recorded; customer invoice due")
              : index === 3 && project.supplierInvoice
                ? (ar ? "سُجلت فاتورة المورد" : "Supplier invoice recorded")
                : (ar ? "لم يبدأ" : "Not started") }));
  const shipmentArrival = project.supplierShipment ? new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${project.supplierShipment.expectedArrival}T00:00:00.000Z`)) : "";
  const dateFormatter = new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const customerDispatch = project.customerShipment ? dateFormatter.format(new Date(`${project.customerShipment.plannedDispatchDate}T00:00:00.000Z`)) : "";
  const invoiceDate = project.supplierInvoice ? dateFormatter.format(new Date(`${project.supplierInvoice.invoiceDate}T00:00:00.000Z`)) : "";
  const paymentDate = project.supplierPayment ? dateFormatter.format(new Date(`${project.supplierPayment.paymentDate}T00:00:00.000Z`)) : "";
  const customerInvoiceDate = project.customerInvoice ? dateFormatter.format(new Date(`${project.customerInvoice.invoiceDate}T00:00:00.000Z`)) : "";
  const customerCollected = receivable.collected;
  const customerBalance = receivable.remaining;
  const amountFormatter = new Intl.NumberFormat(ar ? "ar-EG" : "en-US", { maximumFractionDigits: 6 });
  const nextHref = next ? (() => {
    const [nextPath, nextHash] = next.href.split("#");
    return `${nextPath}?locale=${locale}${nextHash ? `#${nextHash}` : ""}`;
  })() : null;
  const storageWarning = ar
    ? "البيانات موجودة في هذا المتصفح فقط، ولا تتم مزامنتها أو نسخها احتياطياً، ومسح بيانات المتصفح يحذفها."
    : "Data exists only in this browser. It is not synchronized or backed up. Clearing browser data removes it.";
  const finalTitle = project.status === "CLOSED" ? (ar ? "المشروع مغلق" : "Project closed") : (ar ? "اكتمل التحصيل المسجل" : "Recorded collection complete");
  const finalDetail = project.status === "CLOSED"
    ? (ar ? "هذا المشروع مغلق. راجع البيانات المسجلة أدناه؛ لا يفترض ORB وجود أي حركة مالية غير مسجلة." : "This project is closed. Review the recorded details below; ORB does not assume any unrecorded financial movement exists.")
    : (ar ? "تم تسجيل فاتورة العميل والتحصيل الكامل في هذا المتصفح فقط. لم يتصل ORB بالبنك ولم ينفذ تحويلاً." : "The customer invoice and full collection are recorded in this browser only. ORB did not connect to a bank or execute a transfer.");

  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="project-title">
    <header className={styles.overviewHeader}><div className={styles.overviewTop}><div><p className={styles.code}>{project.code}</p><h1 id="project-title">{project.customer}</h1><p className={styles.subtitle}>{project.reference} · <bdi>{project.origin} → {project.destination}</bdi></p><div className={styles.statusRow}><span className={styles.status}>{projectStatusLabel(project.status, locale)}</span><span className={styles.browserBadge}>{ar ? "محفوظ في هذا المتصفح" : "Saved in this browser"}</span></div></div><div className={styles.overviewActions}>{project.status === "SETUP" ? <button className={styles.filledButton} type="button" onClick={() => setEditingSetup(true)}>{ar ? "إكمال إعداد المشروع" : "Complete project setup"}</button> : next && nextHref ? <a className={styles.filledButton} href={nextHref}>{next.label}</a> : <span className={styles.browserBadge}>{finalTitle}</span>}</div></div></header>
    <section className={styles.nextAction}><p>{next ? (ar ? "الإجراء التالي" : "Next action") : (ar ? "حالة المسار" : "Flow status")}</p><h2>{next ? next.label : finalTitle}</h2><span>{next ? next.detail : finalDetail}</span></section>
    {project.status === "SETUP" && editingSetup ? <section className={styles.setupEditor} aria-labelledby="setup-editor-title">
      <div><p className={styles.eyebrow}>{ar ? "الخطوة الأولى" : "First lifecycle step"}</p><h2 id="setup-editor-title">{ar ? "إكمال إعداد المشروع" : "Complete project setup"}</h2><p className={styles.muted}>{ar ? "أكد طرفي المشروع ومرجعي عقد البيع والشراء. لا يتم إرسال أي بيانات خارج هذا المتصفح." : "Confirm both project parties and the sales and purchase contract references. Nothing is sent outside this browser."}</p></div>
      <form className={styles.setupForm} onSubmit={saveSetup}>{saveError ? <div className={styles.error} role="alert">{saveError}</div> : null}<div className={styles.formGrid}>
        <label>{ar ? "العميل" : "Customer"}<input required name="setupCustomer" defaultValue={project.customer} autoComplete="organization" /></label>
        <label>{ar ? "المورد" : "Supplier"}<input required name="supplier" defaultValue={project.supplier ?? ""} autoComplete="organization" /></label>
        <label>{ar ? "مرجع عقد البيع" : "Sales contract reference"}<input required name="salesContractReference" defaultValue={project.contractReference} /></label>
        <label>{ar ? "مرجع عقد الشراء" : "Purchase contract reference"}<input required name="purchaseContractReference" defaultValue={project.purchaseContractReference ?? ""} /></label>
      </div><div className={styles.actions}><button className={styles.textButton} type="button" onClick={() => { setEditingSetup(false); setSaveError(""); }}>{ar ? "إلغاء" : "Cancel"}</button><button className={styles.filledButton} type="submit">{ar ? "حفظ الإعداد" : "Save setup"}</button></div></form>
    </section> : null}
    {project.status === "ACTIVE" ? <section className={styles.shipmentTask} id="supplier-shipment" aria-labelledby="supplier-shipment-title">
      <div><p className={styles.eyebrow}>{project.supplierShipment ? (ar ? "شحنة محفوظة" : "Saved shipment") : (ar ? "الخطوة التشغيلية التالية" : "Next operational step")}</p><div className={styles.taskTitle}><h2 id="supplier-shipment-title">{project.supplierShipment ? (ar ? "شحنة المورد المسجلة" : "Recorded supplier shipment") : (ar ? "تسجيل شحنة المورد" : "Record supplier shipment")}</h2>{project.supplierShipment ? <span className={styles.browserBadge}>{ar ? "أدخلتها أنت" : "Entered by you"}</span> : null}</div><p className={styles.muted}>{project.supplierShipment ? (project.customerShipmentReviewedAt ? (ar ? "تظل شحنة المورد المسجلة جزءاً من سجل المشروع أثناء تسجيل الفاتورة والدفعة." : "The recorded supplier shipment remains part of the project record while invoice and payment details are recorded.") : project.customerShipment ? (ar ? "شحنة المورد محفوظة مع شحنة العميل المسجلة ضمن هذا المسار المحدود." : "The supplier shipment is saved with the recorded customer shipment in this bounded flow.") : (ar ? "شحنة المورد محفوظة وتدعم تسجيل شحنة العميل التالية." : "The supplier shipment is saved and supports recording the customer shipment next.")) : (ar ? "سجل أول شحنة واردة من المورد. لا يتم إرسال أي بيانات أو رسائل خارجية." : "Record the first inbound supplier shipment. No data or messages are sent externally.")}</p></div>
      <p className={styles.truthNote}><strong>{storageWarning}</strong></p>
      {project.supplierShipment ? <dl className={styles.shipmentFacts} aria-live="polite"><div><dt>{ar ? "مرجع الشحنة" : "Shipment reference"}</dt><dd>{project.supplierShipment.reference}</dd></div><div><dt>{ar ? "الوصول المتوقع" : "Expected arrival"}</dt><dd><time dateTime={project.supplierShipment.expectedArrival}>{shipmentArrival}</time></dd></div><div><dt>{ar ? "الكمية المخططة" : "Planned quantity"}</dt><dd><bdi>{project.supplierShipment.quantity} {project.unit}</bdi></dd></div></dl> : <form className={styles.setupForm} onSubmit={saveSupplierShipment}>{saveError ? <div className={styles.error} role="alert">{saveError}</div> : null}<div className={styles.formGrid}><label>{ar ? "مرجع شحنة المورد" : "Supplier shipment reference"}<input required name="shipmentReference" /></label><label>{ar ? "تاريخ الوصول المتوقع" : "Expected arrival date"}<input required type="date" name="expectedArrival" /></label><label>{ar ? "الكمية المخططة" : "Planned quantity"}<input required type="number" min="0.000001" max={project.quantity} step="any" name="shipmentQuantity" /></label><label>{ar ? "الوحدة" : "Unit"}<input value={project.unit} readOnly aria-readonly="true" /></label></div><div className={styles.actions}><button className={styles.filledButton} type="submit">{ar ? "حفظ شحنة المورد" : "Save supplier shipment"}</button></div></form>}
    </section> : null}
    {project.status === "ACTIVE" && project.supplierShipment ? <section className={styles.shipmentTask} id="customer-shipment" aria-labelledby="customer-shipment-title">
      <div><p className={styles.eyebrow}>{project.customerShipmentReviewedAt ? (ar ? "اكتملت مراجعة التسليم" : "Handover reviewed") : project.customerShipment ? (ar ? "خطوة المراجعة" : "Review step") : (ar ? "الخطوة التشغيلية التالية" : "Next operational step")}</p><div className={styles.taskTitle}><h2 id="customer-shipment-title">{project.customerShipment ? (ar ? "شحنة العميل المسجلة" : "Recorded customer shipment") : (ar ? "تسجيل شحنة العميل" : "Record customer shipment")}</h2>{project.customerShipment ? <span className={styles.browserBadge}>{ar ? "أدخلتها أنت" : "Entered by you"}</span> : null}</div><p className={styles.muted}>{project.customerShipmentReviewedAt ? (ar ? "تمت مراجعة تسليم الشحنة. سجّل فاتورة المورد ودفعتها في القسم التالي." : "Shipment handover has been reviewed. Record the supplier invoice and payment in the next section.") : project.customerShipment ? (ar ? "راجع بيانات الشحنة المسجلة ثم أكمل مراجعة التسليم." : "Review the recorded shipment details, then complete the handover review.") : (ar ? "سجل أول شحنة مرسلة إلى العميل. لا يتم إرسال بيانات أو رسائل أو تنفيذ أي إجراء خارجي." : "Record the first shipment to the customer. No data, messages, or external actions are sent or performed.")}</p></div>
      <p className={styles.truthNote}><strong>{storageWarning}</strong></p>
      {project.customerShipment ? <><dl className={styles.shipmentFacts} aria-live="polite"><div><dt>{ar ? "مرجع شحنة العميل" : "Customer shipment reference"}</dt><dd>{project.customerShipment.reference}</dd></div><div><dt>{ar ? "تاريخ الإرسال المخطط" : "Planned dispatch date"}</dt><dd><time dateTime={project.customerShipment.plannedDispatchDate}>{customerDispatch}</time></dd></div><div><dt>{ar ? "الكمية" : "Quantity"}</dt><dd><bdi>{project.customerShipment.quantity} {project.unit}</bdi></dd></div></dl>{saveError ? <div className={styles.error} role="alert">{saveError}</div> : null}{!project.customerShipmentReviewedAt ? <div className={styles.actions}><button className={styles.filledButton} type="button" onClick={reviewCustomerShipment}>{ar ? "تأكيد مراجعة التسليم" : "Mark handover reviewed"}</button></div> : null}</> : <form className={styles.setupForm} onSubmit={saveCustomerShipment}>{saveError ? <div className={styles.error} role="alert">{saveError}</div> : null}<div className={styles.formGrid}><label>{ar ? "مرجع شحنة العميل" : "Customer shipment reference"}<input required name="customerShipmentReference" /></label><label>{ar ? "تاريخ الإرسال المخطط" : "Planned dispatch date"}<input required type="date" name="plannedDispatchDate" /></label><label>{ar ? "الكمية" : "Quantity"}<input required type="number" min="0.000001" max={project.supplierShipment.quantity} step="any" name="customerShipmentQuantity" /></label><label>{ar ? "الوحدة" : "Unit"}<input value={project.unit} readOnly aria-readonly="true" /></label></div><div className={styles.actions}><button className={styles.filledButton} type="submit">{ar ? "حفظ شحنة العميل" : "Save customer shipment"}</button></div></form>}
    </section> : null}
    {project.status === "ACTIVE" && project.customerShipmentReviewedAt ? <section className={styles.financeTask} id="supplier-finance" aria-labelledby="supplier-finance-title">
      <div><p className={styles.eyebrow}>{project.supplierPayment ? (ar ? "بيانات مالية محفوظة" : "Saved finance record") : project.supplierInvoice ? (ar ? "الخطوة المالية التالية" : "Next finance step") : (ar ? "الخطوة المالية الأولى" : "First finance step")}</p><div className={styles.taskTitle}><h2 id="supplier-finance-title">{project.supplierPayment ? (ar ? "تم تسجيل الفاتورة والدفعة" : "Invoice and payment recorded") : project.supplierInvoice ? (ar ? "تسجيل دفعة المورد" : "Record supplier payment") : (ar ? "تسجيل فاتورة المورد" : "Record supplier invoice")}</h2>{project.supplierInvoice ? <span className={styles.browserBadge}>{ar ? "أدخلتها أنت" : "Entered by you"}</span> : null}</div><p className={styles.muted}>{project.supplierPayment ? (ar ? "اكتمل هذا المسار المالي اليومي الصغير. الدفعة مسجلة فقط؛ لم يبدأ ORB أي تحويل خارجي ولم ينفذه." : "This small daily finance flow is complete. The payment is recorded only; ORB did not initiate or execute an external transfer.") : project.supplierInvoice ? (ar ? "سجّل الدفعة الكاملة لهذه الفاتورة. هذا يسجل الواقعة فقط ولا يتصل بالبنك." : "Record the full payment for this invoice. This records the event only and does not connect to a bank.") : (ar ? "سجّل فاتورة المورد من المستند الذي استلمته. لا يتم رفع المستند أو إرسال أي رسالة." : "Record the supplier invoice from the document you received. No document is uploaded and no message is sent.")}</p></div>
      <p className={styles.truthNote}><strong>{storageWarning}</strong></p>
      {project.supplierInvoice ? <dl className={styles.financeFacts} aria-live="polite"><div><dt>{ar ? "مرجع الفاتورة" : "Invoice reference"}</dt><dd>{project.supplierInvoice.reference}</dd></div><div><dt>{ar ? "تاريخ الفاتورة" : "Invoice date"}</dt><dd><time dateTime={project.supplierInvoice.invoiceDate}>{invoiceDate}</time></dd></div><div><dt>{ar ? "قيمة الفاتورة" : "Invoice amount"}</dt><dd><bdi>{project.supplierInvoice.amount} {project.currency}</bdi></dd></div>{project.supplierPayment ? <><div><dt>{ar ? "مرجع الدفعة" : "Payment reference"}</dt><dd>{project.supplierPayment.reference}</dd></div><div><dt>{ar ? "تاريخ الدفعة" : "Payment date"}</dt><dd><time dateTime={project.supplierPayment.paymentDate}>{paymentDate}</time></dd></div><div><dt>{ar ? "قيمة الدفعة" : "Payment amount"}</dt><dd><bdi>{project.supplierPayment.amount} {project.currency}</bdi></dd></div></> : null}</dl> : null}
      {project.supplierPayment ? <><p className={styles.recordOnly}>{ar ? "مسجلة فقط — لم يبدأ ORB أي تحويل بنكي ولم ينفذه" : "Recorded only — ORB did not initiate or execute a bank transfer"}</p>{saveError ? <div className={styles.error} role="alert">{saveError}</div> : null}<div className={styles.correctionAction}><button className={styles.outlinedButton} type="button" onClick={correctSupplierFinance}>{ar ? "تصحيح الفاتورة أو الدفعة" : "Correct invoice or payment"}</button></div></> : project.supplierInvoice ? <form className={styles.setupForm} onSubmit={saveSupplierPayment}>{saveError ? <div className={styles.error} role="alert">{saveError}</div> : null}<div className={styles.formGrid}><label>{ar ? "مرجع الدفعة" : "Payment reference"}<input required name="supplierPaymentReference" /></label><label>{ar ? "تاريخ الدفعة" : "Payment date"}<input required type="date" min={project.supplierInvoice.invoiceDate} name="supplierPaymentDate" /></label><label>{ar ? "قيمة الدفعة الكاملة" : "Full payment amount"}<input required type="number" min="0.000001" step="any" name="supplierPaymentAmount" defaultValue={project.supplierInvoice.amount} /></label><label>{ar ? "العملة" : "Currency"}<input value={project.currency} readOnly aria-readonly="true" /></label></div><div className={styles.actions}><button className={styles.outlinedButton} type="button" onClick={correctSupplierFinance}>{ar ? "تصحيح الفاتورة" : "Correct invoice"}</button><button className={styles.filledButton} type="submit">{ar ? "حفظ دفعة المورد" : "Save supplier payment"}</button></div></form> : <form className={styles.setupForm} onSubmit={saveSupplierInvoice}>{saveError ? <div className={styles.error} role="alert">{saveError}</div> : null}<div className={styles.formGrid}><label>{ar ? "مرجع فاتورة المورد" : "Supplier invoice reference"}<input required name="supplierInvoiceReference" /></label><label>{ar ? "تاريخ الفاتورة" : "Invoice date"}<input required type="date" min={project.customerShipment?.plannedDispatchDate} name="supplierInvoiceDate" /></label><label>{ar ? "قيمة الفاتورة" : "Invoice amount"}<input required type="number" min="0.000001" max={project.value} step="any" name="supplierInvoiceAmount" /></label><label>{ar ? "العملة" : "Currency"}<input value={project.currency} readOnly aria-readonly="true" /></label></div><div className={styles.actions}><button className={styles.filledButton} type="submit">{ar ? "حفظ فاتورة المورد" : "Save supplier invoice"}</button></div></form>}
    </section> : null}
    {project.status === "ACTIVE" && project.supplierPayment ? <section className={styles.financeTask} id="customer-finance" aria-labelledby="customer-finance-title">
      <div><p className={styles.eyebrow}>{receivable.complete && project.customerInvoice ? (ar ? "اكتمل التحصيل المسجل" : "Recorded collection complete") : project.customerInvoice ? (ar ? "التحصيلات الواردة" : "Incoming collections") : (ar ? "الخطوة المالية التالية" : "Next finance step")}</p><div className={styles.taskTitle}><h2 id="customer-finance-title">{receivable.complete && project.customerInvoice ? (ar ? "تم تحصيل فاتورة العميل" : "Customer invoice collected") : project.customerInvoice ? (ar ? "تسجيل تحصيل من العميل" : "Record customer collection") : (ar ? "تسجيل فاتورة العميل" : "Record customer invoice")}</h2>{project.customerInvoice ? <span className={styles.browserBadge}>{ar ? "أدخلتها أنت" : "Entered by you"}</span> : null}</div><p className={styles.muted}>{receivable.complete && project.customerInvoice ? (ar ? "تم تسجيل كامل قيمة الفاتورة كتحصيلات واردة. لم يتصل ORB بالبنك ولم ينفذ تحويلاً." : "The full invoice value is recorded as received collections. ORB did not connect to a bank or execute a transfer.") : project.customerInvoice ? (ar ? "سجل الأموال التي استلمتها فعلياً فقط. يمكن إضافة تحصيلات جزئية حتى يساوي الرصيد صفراً." : "Record only funds actually received. Add partial collections until the balance reaches zero.") : (ar ? "سجل فاتورة البيع الصادرة للعميل. لا يتم إرسال فاتورة أو رسالة من ORB." : "Record the sales invoice issued to the customer. ORB does not send an invoice or message.")}</p></div>
      <p className={styles.truthNote}><strong>{storageWarning}</strong></p>
      {project.customerInvoice ? <><dl className={styles.financeFacts} aria-live="polite"><div><dt>{ar ? "مرجع فاتورة العميل" : "Customer invoice reference"}</dt><dd>{project.customerInvoice.reference}</dd></div><div><dt>{ar ? "تاريخ الفاتورة" : "Invoice date"}</dt><dd><time dateTime={project.customerInvoice.invoiceDate}>{customerInvoiceDate}</time></dd></div><div><dt>{ar ? "قيمة الفاتورة" : "Invoice amount"}</dt><dd><bdi>{project.customerInvoice.amount} {project.currency}</bdi></dd></div><div><dt>{ar ? "المحصل" : "Collected"}</dt><dd><bdi>{amountFormatter.format(Number(customerCollected))} {project.currency}</bdi></dd></div><div><dt>{ar ? "الرصيد المتبقي" : "Remaining balance"}</dt><dd><bdi>{amountFormatter.format(Number(customerBalance))} {project.currency}</bdi></dd></div></dl>{(project.customerCollections ?? []).length > 0 ? <div><h3>{ar ? "التحصيلات المسجلة" : "Recorded collections"}</h3><ol className={styles.collectionList}>{project.customerCollections?.map((item) => <li key={item.reference}><span><strong>{item.reference}</strong><time dateTime={item.collectionDate}>{dateFormatter.format(new Date(`${item.collectionDate}T00:00:00.000Z`))}</time></span><bdi>{item.amount} {project.currency}</bdi></li>)}</ol></div> : null}</> : null}
      {saveError ? <div className={styles.error} role="alert">{saveError}</div> : null}
      {project.customerInvoice ? !receivable.complete ? <form className={styles.setupForm} onSubmit={saveCustomerCollection}><div className={styles.formGrid}><label>{ar ? "مرجع التحصيل" : "Collection reference"}<input required name="customerCollectionReference" /></label><label>{ar ? "تاريخ التحصيل" : "Collection date"}<input required type="date" min={project.customerInvoice.invoiceDate} name="customerCollectionDate" /></label><label>{ar ? "المبلغ المستلم" : "Amount received"}<input required type="number" min="0.000001" max={customerBalance} step="any" name="customerCollectionAmount" /></label><label>{ar ? "العملة" : "Currency"}<input value={project.currency} readOnly aria-readonly="true" /></label></div><div className={styles.actions}><button className={styles.outlinedButton} type="button" onClick={correctCustomerFinance}>{ar ? "تصحيح فاتورة العميل" : "Correct customer invoice"}</button><button className={styles.filledButton} type="submit">{ar ? "حفظ التحصيل" : "Save collection"}</button></div></form> : <><p className={styles.recordOnly}>{ar ? "مسجل فقط — لم يتصل ORB بالبنك ولم ينفذ أي تحويل" : "Recorded only — ORB did not connect to a bank or execute a transfer"}</p><div className={styles.correctionAction}><button className={styles.outlinedButton} type="button" onClick={correctCustomerFinance}>{ar ? "تصحيح فاتورة العميل أو التحصيلات" : "Correct customer invoice or collections"}</button></div></> : <form className={styles.setupForm} onSubmit={saveCustomerInvoice}><div className={styles.formGrid}><label>{ar ? "مرجع فاتورة العميل" : "Customer invoice reference"}<input required name="customerInvoiceReference" /></label><label>{ar ? "تاريخ الفاتورة" : "Invoice date"}<input required type="date" min={project.customerShipment?.plannedDispatchDate} name="customerInvoiceDate" /></label><label>{ar ? "قيمة الفاتورة" : "Invoice amount"}<input required type="number" min="0.000001" max={project.value} step="any" defaultValue={project.value} name="customerInvoiceAmount" /></label><label>{ar ? "العملة" : "Currency"}<input value={project.currency} readOnly aria-readonly="true" /></label></div><div className={styles.actions}><button className={styles.filledButton} type="submit">{ar ? "حفظ فاتورة العميل" : "Save customer invoice"}</button></div></form>}
    </section> : null}
    <div className={styles.detailGrid}><section className={styles.panel} id="lifecycle"><header className={styles.panelHeader}><div><h2>{ar ? "مسار دورة العمل" : "Lifecycle tasks"}</h2><p className={styles.muted}>{project.supplierPayment ? (ar ? "تم حفظ إعداد المشروع والشحنات وفاتورة المورد ودفعتها بالكامل في هذا المتصفح." : "Project setup, shipments, supplier invoice, and full payment are saved in this browser.") : project.supplierInvoice ? (ar ? "تم حفظ فاتورة المورد. سجّل الدفعة الكاملة لإكمال هذا المسار المالي الصغير." : "The supplier invoice is saved. Record its full payment to complete this small finance flow.") : project.customerShipmentReviewedAt ? (ar ? "اكتملت مراجعة التسليم. سجّل فاتورة المورد للانتقال إلى الدفعة." : "Shipment handover is reviewed. Record the supplier invoice to move to payment.") : project.customerShipment ? (ar ? "تم حفظ إعداد المشروع وشحنتي المورد والعميل في هذا المتصفح. راجع تسليم الشحنة لإكمال المسار المحدود." : "Project setup and both supplier and customer shipments are saved in this browser. Review the shipment handover to complete the bounded flow.") : project.supplierShipment ? (ar ? "تم حفظ إعداد المشروع وشحنة المورد. سجل شحنة العميل للانتقال إلى المراجعة التشغيلية التالية." : "Project setup and the supplier shipment are saved. Record the customer shipment to move to the next operational review.") : (ar ? "تم حفظ إعداد المشروع فقط. سجل شحنة المورد للانتقال إلى الخطوة التشغيلية التالية." : "Project setup is saved. Record the supplier shipment to move to the next operational step.")}</p></div></header><ol className={styles.lifecycle}>{tasks.map((task, index) => <li key={`${task.label}-${index}`}><span>{index + 1}</span><div><h3>{task.label}</h3><p>{task.status}</p></div></li>)}</ol></section>
      <aside className={styles.panel} id="project-data"><header className={styles.panelHeader}><h2>{ar ? "بيانات المشروع" : "Project data"}</h2></header><dl className={styles.detailFacts}><div><dt>{ar ? "العميل" : "Customer"}</dt><dd>{project.customer}</dd></div><div><dt>{ar ? "المورد" : "Supplier"}</dt><dd>{project.supplier || (ar ? "لم يُدخل بعد" : "Not entered yet")}</dd></div><div><dt>{ar ? "مرجع عقد البيع" : "Sales contract reference"}</dt><dd>{project.contractReference}</dd></div><div><dt>{ar ? "مرجع عقد الشراء" : "Purchase contract reference"}</dt><dd>{project.purchaseContractReference || (ar ? "لم يُدخل بعد" : "Not entered yet")}</dd></div><div><dt>{ar ? "السلعة" : "Commodity"}</dt><dd>{project.commodity}</dd></div><div><dt>{ar ? "الكمية" : "Quantity"}</dt><dd><bdi>{project.quantity} {project.unit}</bdi></dd></div><div><dt>{ar ? "السعر لكل وحدة" : "Unit price"}</dt><dd><bdi>{project.unitPrice} {project.currency}</bdi></dd></div><div><dt>{ar ? "تاريخ البدء" : "Start date"}</dt><dd><time dateTime={project.startDate}>{project.startDate}</time></dd></div></dl><p className={styles.truthNote}>{project.supplierPayment ? (ar ? "سُجلت فاتورة المورد ودفعتها بالكامل فقط؛ لا توجد مصروفات أو مطالبات مسجلة بعد." : "The supplier invoice and full payment are recorded; no expenses or claims are recorded yet.") : project.supplierInvoice ? (ar ? "سُجلت فاتورة المورد؛ لم تُسجل دفعتها أو أي مصروفات بعد." : "The supplier invoice is recorded; its payment and any expenses are not recorded yet.") : project.customerShipment ? (ar ? "سُجلت كميتا شحنتي المورد والعميل فقط؛ لا توجد فواتير أو مدفوعات أو مصروفات مسجلة بعد." : "Only supplier and customer shipment quantities are recorded; no invoices, payments, or expenses are recorded yet.") : project.supplierShipment ? (ar ? "سُجلت كمية شحنة المورد فقط؛ لا توجد فواتير أو مدفوعات أو مصروفات مسجلة بعد." : "Only the supplier shipment quantity is recorded; no invoices, payments, or expenses are recorded yet.") : (ar ? "لا توجد أرقام تشغيلية أو مالية مسجلة لهذا المشروع حتى الآن." : "No operational or financial figures are recorded for this project yet.")}</p></aside></div>
  </section>;
}
