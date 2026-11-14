"use client";
import { useEffect, useState, type FormEvent } from "react";
import { completeProjectSetup, parseProjectRecords, PROJECT_STORAGE_KEY, projectNextAction, projectStatusLabel, type ProjectRecord } from "../../../modules/projects/daily-projects";
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

  function saveSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError("");
    if (!project) return;
    try {
      const form = new FormData(event.currentTarget);
      const records = parseProjectRecords(localStorage.getItem(PROJECT_STORAGE_KEY));
      const index = records.findIndex((item) => item.id === project.id);
      if (index < 0) throw new Error("PROJECT_NOT_FOUND");
      const updated = completeProjectSetup(records[index], {
        customer: String(form.get("setupCustomer") ?? ""),
        supplier: String(form.get("supplier") ?? ""),
        salesContractReference: String(form.get("salesContractReference") ?? ""),
        purchaseContractReference: String(form.get("purchaseContractReference") ?? ""),
      }, new Date().toISOString());
      records[index] = updated;
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(records));
      setProject(updated);
      setEditingSetup(false);
    } catch {
      setSaveError(ar ? "تعذر حفظ الإعداد. أكمل جميع بيانات الأطراف والعقود وحاول مجدداً." : "Setup could not be saved. Complete all party and contract fields, then try again.");
    }
  }

  if (state === "loading") return <section className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.stateCard} role="status">{ar ? "جارٍ تحميل المشروع…" : "Loading project…"}</div></section>;
  if (state === "error") return <section className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.stateCard} role="alert"><h1>{ar ? "تعذر فتح المشروع" : "Project could not be opened"}</h1><p>{ar ? "تحقق من التخزين المحلي وأعد تحميل الصفحة." : "Check browser storage and reload the page."}</p></div></section>;
  if (state === "missing" || !project) return <section className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.stateCard}><h1>{ar ? "المشروع غير موجود" : "Project not found"}</h1><p>{ar ? "لم يتم العثور على مشروع محفوظ بهذا الرابط في هذا المتصفح." : "No saved project for this link was found in this browser."}</p><a className={styles.outlinedButton} href={`/projects?locale=${locale}`}>{ar ? "العودة إلى المشاريع" : "Back to projects"}</a></div></section>;

  const next = projectNextAction(project.status, locale, project.id);
  const tasks: LifecycleItem[] = (ar ? [
    "العميل والمورد", "عقود البيع والشراء", "شحنات المورد والعميل", "الفواتير والمدفوعات", "المصروفات", "المطالبات", "الإغلاق وإعادة الفتح",
  ] : [
    "Customer and supplier", "Sales and purchase contracts", "Supplier and customer shipments", "Invoices and payments", "Expenses", "Claims", "Closure and reopening",
  ]).map((label, index) => ({ label, status: index < 2 && project.status !== "SETUP" ? (ar ? "اكتمل الإعداد" : "Setup complete") : (ar ? "لم يبدأ" : "Not started") }));
  const [nextPath, nextHash] = next.href.split("#");
  const nextHref = `${nextPath}?locale=${locale}${nextHash ? `#${nextHash}` : ""}`;

  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="project-title">
    <header className={styles.overviewHeader}><div className={styles.overviewTop}><div><p className={styles.code}>{project.code}</p><h1 id="project-title">{project.customer}</h1><p className={styles.subtitle}>{project.reference} · <bdi>{project.origin} → {project.destination}</bdi></p><div className={styles.statusRow}><span className={styles.status}>{projectStatusLabel(project.status, locale)}</span><span className={styles.browserBadge}>{ar ? "محفوظ في هذا المتصفح" : "Saved in this browser"}</span></div></div><div className={styles.overviewActions}>{project.status === "SETUP" ? <button className={styles.filledButton} type="button" onClick={() => setEditingSetup(true)}>{ar ? "إكمال إعداد المشروع" : "Complete project setup"}</button> : <a className={styles.filledButton} href={nextHref}>{next.label}</a>}</div></div></header>
    <section className={styles.nextAction}><p>{ar ? "الإجراء التالي" : "Next action"}</p><h2>{next.label}</h2><span>{next.detail}</span></section>
    {project.status === "SETUP" && editingSetup ? <section className={styles.setupEditor} aria-labelledby="setup-editor-title">
      <div><p className={styles.eyebrow}>{ar ? "الخطوة الأولى" : "First lifecycle step"}</p><h2 id="setup-editor-title">{ar ? "إكمال إعداد المشروع" : "Complete project setup"}</h2><p className={styles.muted}>{ar ? "أكد طرفي المشروع ومرجعي عقد البيع والشراء. لا يتم إرسال أي بيانات خارج هذا المتصفح." : "Confirm both project parties and the sales and purchase contract references. Nothing is sent outside this browser."}</p></div>
      <form className={styles.setupForm} onSubmit={saveSetup}>{saveError ? <div className={styles.error} role="alert">{saveError}</div> : null}<div className={styles.formGrid}>
        <label>{ar ? "العميل" : "Customer"}<input required name="setupCustomer" defaultValue={project.customer} autoComplete="organization" /></label>
        <label>{ar ? "المورد" : "Supplier"}<input required name="supplier" defaultValue={project.supplier ?? ""} autoComplete="organization" /></label>
        <label>{ar ? "مرجع عقد البيع" : "Sales contract reference"}<input required name="salesContractReference" defaultValue={project.contractReference} /></label>
        <label>{ar ? "مرجع عقد الشراء" : "Purchase contract reference"}<input required name="purchaseContractReference" defaultValue={project.purchaseContractReference ?? ""} /></label>
      </div><div className={styles.actions}><button className={styles.textButton} type="button" onClick={() => { setEditingSetup(false); setSaveError(""); }}>{ar ? "إلغاء" : "Cancel"}</button><button className={styles.filledButton} type="submit">{ar ? "حفظ الإعداد" : "Save setup"}</button></div></form>
    </section> : null}
    <div className={styles.detailGrid}><section className={styles.panel} id="lifecycle"><header className={styles.panelHeader}><div><h2>{ar ? "مسار دورة العمل" : "Lifecycle tasks"}</h2><p className={styles.muted}>{ar ? "تم حفظ إعداد المشروع فقط. تظل الخطوات اللاحقة غير متاحة حتى يتم ربطها ببيانات تشغيلية موثوقة." : "Only project setup is saved. Later steps remain unavailable until they are connected to authoritative operational data."}</p></div></header><ol className={styles.lifecycle}>{tasks.map((task, index) => <li key={`${task.label}-${index}`}><span>{index + 1}</span><div><h3>{task.label}</h3><p>{task.status}</p></div></li>)}</ol></section>
      <aside className={styles.panel} id="project-data"><header className={styles.panelHeader}><h2>{ar ? "بيانات المشروع" : "Project data"}</h2></header><dl className={styles.detailFacts}><div><dt>{ar ? "العميل" : "Customer"}</dt><dd>{project.customer}</dd></div><div><dt>{ar ? "المورد" : "Supplier"}</dt><dd>{project.supplier || (ar ? "لم يُدخل بعد" : "Not entered yet")}</dd></div><div><dt>{ar ? "مرجع عقد البيع" : "Sales contract reference"}</dt><dd>{project.contractReference}</dd></div><div><dt>{ar ? "مرجع عقد الشراء" : "Purchase contract reference"}</dt><dd>{project.purchaseContractReference || (ar ? "لم يُدخل بعد" : "Not entered yet")}</dd></div><div><dt>{ar ? "السلعة" : "Commodity"}</dt><dd>{project.commodity}</dd></div><div><dt>{ar ? "الكمية" : "Quantity"}</dt><dd><bdi>{project.quantity} {project.unit}</bdi></dd></div><div><dt>{ar ? "السعر لكل وحدة" : "Unit price"}</dt><dd><bdi>{project.unitPrice} {project.currency}</bdi></dd></div><div><dt>{ar ? "تاريخ البدء" : "Start date"}</dt><dd><time dateTime={project.startDate}>{project.startDate}</time></dd></div></dl><p className={styles.truthNote}>{ar ? "لا توجد أرقام تشغيلية أو مالية مسجلة لهذا المشروع حتى الآن." : "No operational or financial figures are recorded for this project yet."}</p></aside></div>
  </section>;
}
