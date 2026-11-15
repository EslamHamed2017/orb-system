"use client";
import { useEffect, useState, type FormEvent } from "react";
import { assessProjectClosure, closeProject, customerReceivableSummary, parseProjectRecords, PROJECT_STORAGE_KEY, projectStatusLabel, reopenProject, reviewReopenedProject, type ProjectClosureBlocker, type ProjectRecord } from "../../../modules/projects/daily-projects";
import { mutateProjectStorage } from "../../../modules/projects/browser-project-storage";
import styles from "./ProjectClosure.module.css";

type LoadState = "loading" | "ready" | "missing" | "error";
const blockerCopy: Record<ProjectClosureBlocker, { en: string; ar: string }> = {
  SHIPMENT_HANDOVER: { en: "Review the customer shipment handover", ar: "مراجعة تسليم شحنة العميل" },
  SUPPLIER_PAYMENT: { en: "Record the supplier invoice payment", ar: "تسجيل سداد فاتورة المورد" },
  CUSTOMER_COLLECTION: { en: "Record full collection of the customer invoice", ar: "تسجيل التحصيل الكامل لفاتورة العميل" },
  OPEN_CLAIMS: { en: "Resolve all open project claims", ar: "حل جميع مطالبات المشروع المفتوحة" },
  REOPEN_REVIEW: { en: "Review and confirm the work that caused reopening", ar: "مراجعة وتأكيد العمل الذي استدعى إعادة الفتح" },
};

export function SavedProjectClosure({ id, locale }: { readonly id: string; readonly locale: "ar" | "en" }) {
  const ar = locale === "ar";
  const [state, setState] = useState<LoadState>("loading");
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const found = parseProjectRecords(localStorage.getItem(PROJECT_STORAGE_KEY)).find((item) => item.id === id);
      if (found) { setProject(found); setState("ready"); } else setState("missing");
    } catch { setState("error"); }
  }, [id]);

  async function persist(update: (stored: ProjectRecord) => ProjectRecord) {
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    const next = await mutateProjectStorage(localStorage, parseProjectRecords, (records) => {
      const index = records.findIndex((item) => item.id === project.id);
      if (index < 0) throw new Error("PROJECT_NOT_FOUND");
      const updated = update(records[index]);
      records[index] = updated;
      return { records, result: updated };
    });
    setProject(next);
  }

  async function submitClose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    const form = new FormData(event.currentTarget), expected = project?.updatedAt ?? "";
    try {
      await persist((stored) => closeProject(stored, { closedOn: String(form.get("closedOn") ?? ""), note: String(form.get("note") ?? "") }, new Date().toISOString(), expected));
      setNotice(ar ? "تم إغلاق المشروع" : "Project closed");
    } catch { setError(ar ? "تعذر إغلاق المشروع. أعد تحميل الصفحة وتحقق من الجاهزية والتاريخ والملاحظة." : "Project could not be closed. Reload and check readiness, date, and note."); }
  }

  async function confirmReopenReview() {
    setError(""); setNotice("");
    const expected = project?.updatedAt ?? "";
    try {
      await persist((stored) => reviewReopenedProject(stored, new Date().toISOString(), expected));
      setNotice(ar ? "تمت مراجعة العمل بعد إعادة الفتح" : "Reopened work reviewed");
    } catch { setError(ar ? "تعذر تأكيد المراجعة. أعد تحميل الصفحة وحاول مجدداً." : "The review could not be confirmed. Reload and try again."); }
  }

  async function submitReopen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    const form = new FormData(event.currentTarget), expected = project?.updatedAt ?? "";
    try {
      await persist((stored) => reopenProject(stored, { reopenedOn: String(form.get("reopenedOn") ?? ""), reason: String(form.get("reason") ?? "") }, new Date().toISOString(), expected));
      setNotice(ar ? "تمت إعادة فتح المشروع" : "Project reopened");
    } catch { setError(ar ? "تعذرت إعادة فتح المشروع. أعد تحميل الصفحة وتحقق من التاريخ والسبب." : "Project could not be reopened. Reload and check the date and reason."); }
  }

  if (state === "loading") return <section className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.card} role="status">{ar ? "جارٍ تحميل حالة الإغلاق…" : "Loading closure status…"}</div></section>;
  if (state === "error") return <section className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.card} role="alert"><h1>{ar ? "تعذر فتح حالة الإغلاق" : "Closure status could not be opened"}</h1><p>{ar ? "تحقق من بيانات هذا المتصفح وأعد تحميل الصفحة." : "Check this browser's data and reload the page."}</p></div></section>;
  if (state === "missing" || !project) return <section className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.card}><h1>{ar ? "المشروع غير موجود" : "Project not found"}</h1><a className={styles.secondary} href={`/projects?locale=${locale}`}>{ar ? "العودة إلى المشاريع" : "Back to projects"}</a></div></section>;

  if (project.status === "CLOSED" && !project.closure) return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="legacy-closure-title"><header className={styles.header}><p className={styles.eyebrow}>{project.code} · {ar ? "دورة حياة المشروع" : "Project lifecycle"}</p><h1 id="legacy-closure-title">{ar ? "المشروع مغلق" : "Project closed"}</h1><p className={styles.subtitle}>{ar ? "هذا سجل مغلق قديم ولا يحتوي على تاريخ أو ملاحظة إغلاق محفوظة. لا يمكن إعادة فتحه من هذا العرض دون اختلاق بيانات." : "This older closed record has no saved closure date or note. It cannot be reopened from this view without inventing data."}</p></header><section className={styles.card}><h2>{ar ? "تفاصيل الإغلاق غير متاحة" : "Closure details unavailable"}</h2><p className={styles.muted}>{ar ? "تظل بيانات المشروع الأصلية متاحة للمراجعة." : "The original project data remains available for review."}</p><div className={styles.actions}><a className={styles.secondary} href={`/projects/${encodeURIComponent(project.id)}/overview?locale=${locale}`}>{ar ? "العودة إلى المشروع" : "Back to project"}</a></div></section></section>;

  const assessment = assessProjectClosure(project);
  const receivable = customerReceivableSummary(project);
  const checks = [
    { done: Boolean(project.customerShipmentReviewedAt), label: ar ? "تمت مراجعة تسليم شحنة العميل" : "Customer shipment handover reviewed" },
    { done: Boolean(project.supplierPayment), label: ar ? "تم تسجيل سداد المورد" : "Supplier payment recorded" },
    { done: receivable.complete, label: ar ? "تم تسجيل التحصيل الكامل من العميل" : "Customer invoice fully collected" },
    { done: !(project.claims ?? []).some((claim) => claim.status === "OPEN"), label: ar ? "لا توجد مطالبات مفتوحة" : "No open claims" },
  ];
  const closed = project.status === "CLOSED";
  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="closure-title">
    <header className={styles.header}><div className={styles.headerRow}><div><p className={styles.eyebrow}>{project.code} · {ar ? "دورة حياة المشروع" : "Project lifecycle"}</p><h1 id="closure-title">{closed ? (ar ? "إغلاق المشروع" : "Project closure") : (ar ? "إغلاق المشروع" : "Close project")}</h1></div><span className={styles.badge} data-ready={closed || assessment.ready}>{closed ? (ar ? "المشروع مغلق" : "Project closed") : assessment.ready ? (ar ? "جاهز للإغلاق" : "Ready to close") : (ar ? "يحتاج إلى عمل" : "Work required")}</span></div><p className={styles.subtitle}>{ar ? `حالة ${project.customer}: ${projectStatusLabel(project.status, locale)}. يعرض ORB البيانات المسجلة في هذا المتصفح فقط.` : `${project.customer} is ${projectStatusLabel(project.status, locale).toLowerCase()}. ORB shows only records saved in this browser.`}</p></header>
    {notice && <p className={styles.notice} role="status">{notice}</p>}{error && <p className={styles.error} role="alert">{error}</p>}
    {!closed && project.closure?.reopenedAt && <section className={styles.card} aria-labelledby="reopened-work-title"><h2 id="reopened-work-title">{ar ? "العمل بعد إعادة الفتح" : "Reopened work"}</h2><dl className={styles.facts}><div><dt>{ar ? "الإغلاق السابق" : "Previous closure"}</dt><dd><bdi>{project.closure.closedOn}</bdi> · {project.closure.note}</dd></div><div><dt>{ar ? "سبب إعادة الفتح" : "Reopen reason"}</dt><dd>{project.closure.reopenReason}</dd></div></dl><p className={styles.muted}>{ar ? "سجل أي مصروفات أو مطالبات أو تعديلات لازمة في المشروع، ثم أكد أنك راجعت العمل قبل محاولة الإغلاق مجدداً." : "Record any required expenses, claims, or project changes, then confirm the work was reviewed before attempting closure again."}</p>{!project.closure.reopenReviewedAt ? <div className={styles.actions}><a className={styles.secondary} href={`/projects/${encodeURIComponent(project.id)}/overview?locale=${locale}`}>{ar ? "فتح المشروع" : "Open project"}</a><button className={styles.primary} type="button" onClick={confirmReopenReview}>{ar ? "تأكيد مراجعة العمل" : "Mark reopened work reviewed"}</button></div> : <p className={styles.notice}>{ar ? "تمت مراجعة العمل بعد إعادة الفتح" : "Reopened work reviewed"}</p>}</section>}
    <div className={styles.grid}><section className={styles.card} aria-labelledby="readiness-title"><h2 id="readiness-title">{ar ? "مراجعة الجاهزية" : "Readiness review"}</h2><p className={styles.muted}>{ar ? "الإغلاق لا يرسل رسالة ولا ينفذ دفعة. إنه يسجل قرارك على البيانات الموجودة في هذا المتصفح." : "Closing sends no message and makes no payment. It records your decision against data in this browser."}</p><ul className={styles.checklist}>{checks.map((check) => <li key={check.label}><span className={check.done ? styles.check : styles.block}>{check.done ? "✓" : "!"}</span><span>{check.label}</span></li>)}</ul>{assessment.blockers.length > 0 && <div><strong>{ar ? "المطلوب قبل الإغلاق" : "Required before closing"}</strong><ul>{assessment.blockers.map((blocker) => <li key={blocker}>{blockerCopy[blocker][locale]}</li>)}</ul></div>}</section>
    <section className={styles.card} aria-labelledby="action-title"><h2 id="action-title">{closed ? (ar ? "إعادة فتح المشروع" : "Reopen project") : (ar ? "تسجيل الإغلاق" : "Record closure")}</h2>{closed && project.closure ? <><dl className={styles.facts}><div><dt>{ar ? "تاريخ الإغلاق" : "Closed on"}</dt><dd><bdi>{project.closure.closedOn}</bdi></dd></div><div><dt>{ar ? "ملاحظة الإغلاق" : "Closure note"}</dt><dd>{project.closure.note}</dd></div></dl><form className={styles.form} onSubmit={submitReopen}><div className={styles.field}><label htmlFor="reopenedOn">{ar ? "تاريخ إعادة الفتح" : "Reopen date"}</label><input id="reopenedOn" name="reopenedOn" type="date" min={project.closure.closedOn} required /></div><div className={styles.field}><label htmlFor="reason">{ar ? "سبب إعادة الفتح" : "Reason for reopening"}</label><textarea id="reason" name="reason" minLength={3} required /></div><p className={styles.warning}>{ar ? "أعد الفتح فقط عند وجود عمل جديد موثق. ستبقى ملاحظة الإغلاق السابقة ظاهرة." : "Reopen only for documented new work. The previous closure note remains visible."}</p><div className={styles.actions}><a className={styles.secondary} href={`/projects/${encodeURIComponent(project.id)}/overview?locale=${locale}`}>{ar ? "العودة إلى المشروع" : "Back to project"}</a><button className={styles.primary} type="submit">{ar ? "إعادة فتح المشروع" : "Reopen project"}</button></div></form></> : <form className={styles.form} onSubmit={submitClose}><div className={styles.field}><label htmlFor="closedOn">{ar ? "تاريخ الإغلاق" : "Closure date"}</label><input id="closedOn" name="closedOn" type="date" min={project.startDate} required /></div><div className={styles.field}><label htmlFor="note">{ar ? "ملاحظة الإغلاق" : "Closure note"}</label><textarea id="note" name="note" minLength={3} required /></div><p className={styles.warning}>{ar ? "راجع أي التزامات غير مسجلة قبل الإغلاق. ORB لا يفترض وجود دفعات أو اتصالات خارجية غير مسجلة." : "Review any unrecorded obligations before closing. ORB does not assume unrecorded payments or external communications exist."}</p><div className={styles.actions}><a className={styles.secondary} href={`/projects/${encodeURIComponent(project.id)}/overview?locale=${locale}`}>{ar ? "العودة إلى المشروع" : "Back to project"}</a><button className={styles.primary} type="submit" disabled={!assessment.ready}>{ar ? "إغلاق المشروع" : "Close project"}</button></div></form>}</section></div>
  </section>;
}
