"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { parseProjectRecords, PROJECT_CLAIM_TYPES, PROJECT_STORAGE_KEY, projectClaimSummary, recordProjectClaim, resolveProjectClaim, type ProjectClaimType, type ProjectRecord } from "../../../modules/projects/daily-projects";
import { mutateProjectStorage } from "../../../modules/projects/browser-project-storage";
import styles from "./ProjectClaims.module.css";

type LoadState = "loading" | "ready" | "missing" | "error";
const typeLabels: Record<ProjectClaimType, Readonly<{ en: string; ar: string }>> = {
  QUANTITY: { en: "Quantity", ar: "الكمية" }, WEIGHT: { en: "Weight", ar: "الوزن" }, QUALITY: { en: "Quality", ar: "الجودة" },
  DELIVERY: { en: "Delivery", ar: "التسليم" }, PRICE: { en: "Price", ar: "السعر" }, DOCUMENT: { en: "Document", ar: "المستندات" },
};

export function SavedProjectClaims({ id, locale }: Readonly<{ id: string; locale: "ar" | "en" }>) {
  const ar = locale === "ar";
  const [state, setState] = useState<LoadState>("loading");
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [externalChange, setExternalChange] = useState(false);

  const load = useCallback((external = false) => {
    try {
      const found = parseProjectRecords(localStorage.getItem(PROJECT_STORAGE_KEY)).find((item) => item.id === id);
      if (found) { setProject(found); setState("ready"); if (external) setExternalChange(true); }
      else setState("missing");
    } catch { setState("error"); }
  }, [id]);

  useEffect(() => {
    load();
    const refresh = (event: StorageEvent) => { if (event.key === PROJECT_STORAGE_KEY) load(true); };
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [load]);

  async function saveClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setFailed(false); setExternalChange(false);
    if (!project) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const expectedUpdatedAt = project.updatedAt;
    try {
      const updated = await mutateProjectStorage(localStorage, parseProjectRecords, (records) => {
        const index = records.findIndex((item) => item.id === project.id);
        if (index < 0) throw new Error("PROJECT_NOT_FOUND");
        const next = recordProjectClaim(records[index], {
          reference: String(data.get("reference") ?? ""), type: String(data.get("type") ?? "") as ProjectClaimType,
          claimDate: String(data.get("claimDate") ?? ""), claimant: String(data.get("claimant") ?? ""), respondent: String(data.get("respondent") ?? ""),
          description: String(data.get("description") ?? ""), amount: String(data.get("amount") ?? ""),
        }, new Date().toISOString(), expectedUpdatedAt);
        records[index] = next;
        return { records, result: next };
      });
      setProject(updated);
      form.reset();
      setMessage(ar ? "تم حفظ المطالبة في هذا المتصفح." : "Claim saved in this browser.");
    } catch {
      load(true); setFailed(true); setMessage(ar ? "تعذر الحفظ بسبب بيانات غير صالحة أو تغيير أحدث في علامة تبويب أخرى. راجع السجل وحاول مجدداً." : "Save failed because the entry is invalid or a newer change was saved in another tab. Review the refreshed register and try again.");
    }
  }

  async function resolveClaim(event: FormEvent<HTMLFormElement>, reference: string) {
    event.preventDefault(); setMessage(""); setFailed(false); setExternalChange(false);
    if (!project) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const expectedUpdatedAt = project.updatedAt;
    try {
      const updated = await mutateProjectStorage(localStorage, parseProjectRecords, (records) => {
        const index = records.findIndex((item) => item.id === project.id);
        if (index < 0) throw new Error("PROJECT_NOT_FOUND");
        const next = resolveProjectClaim(records[index], { reference, resolutionNote: String(data.get("resolutionNote") ?? ""), resolutionDate: String(data.get("resolutionDate") ?? "") }, new Date().toISOString(), expectedUpdatedAt);
        records[index] = next;
        return { records, result: next };
      });
      setProject(updated);
      setMessage(ar ? "تم حل المطالبة وحفظ تفاصيل الحل." : "Claim resolved with resolution details saved.");
    } catch {
      load(true); setFailed(true); setMessage(ar ? "تعذر الحل بسبب بيانات غير صالحة أو تغيير أحدث في علامة تبويب أخرى." : "Resolution failed because the details are invalid or a newer change was saved in another tab.");
    }
  }

  const overview = `/projects/${encodeURIComponent(id)}/overview?locale=${locale}`;
  if (state === "loading") return <main className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.state} role="status">{ar ? "جارٍ تحميل مطالبات المشروع…" : "Loading project claims…"}</div></main>;
  if (state === "error") return <main className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.state} role="alert"><h1>{ar ? "تعذر فتح المطالبات" : "Claims could not be opened"}</h1><p>{ar ? "بيانات المشروع المحفوظة في هذا المتصفح غير قابلة للقراءة." : "The project data saved in this browser cannot be read."}</p></div></main>;
  if (state === "missing" || !project) return <main className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.state}><h1>{ar ? "المشروع غير موجود" : "Project not found"}</h1><p>{ar ? "لا يوجد مشروع محفوظ بهذا الرابط في هذا المتصفح." : "No project saved for this link exists in this browser."}</p><a className={styles.outlined} href={`/projects?locale=${locale}`}>{ar ? "العودة إلى المشاريع" : "Back to projects"}</a></div></main>;

  const summary = projectClaimSummary(project);
  const setupBlocked = project.status === "SETUP";
  const readOnly = project.status === "CLOSED";
  const date = new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const parties = [project.customer, project.supplier!];

  return <main className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="claims-title">
    <nav className={styles.breadcrumb} aria-label={ar ? "مسار التنقل" : "Breadcrumb"}><a href={`/projects?locale=${locale}`}>{ar ? "المشاريع" : "Projects"}</a><span aria-hidden="true">/</span><a href={overview}>{project.code}</a><span aria-hidden="true">/</span><strong>{ar ? "المطالبات" : "Claims"}</strong></nav>
    <header className={styles.header}><div><p className={styles.eyebrow}>{project.code} · {project.customer}</p><h1 id="claims-title">{ar ? "مطالبات المشروع" : "Project claims"}</h1><p>{ar ? "سجل مشكلة تجارية بين العميل والمورد وحلها مع تفاصيل مؤرخة." : "Record a business issue between the project customer and supplier, then resolve it with dated details."}</p></div><a className={styles.outlined} href={overview}>{ar ? "نظرة عامة على المشروع" : "Project overview"}</a></header>
    <aside className={styles.truth}><strong>{ar ? "تخزين متصفح فقط" : "Browser-only storage"}</strong><span>{ar ? "هذه البيانات ليست متعددة المستخدمين ولا مدعومة بخادم، ولا تتم مزامنتها أو نسخها احتياطياً. قفل المتصفح يقلل التعارض فقط بين العمليات المتعاونة في المتصفح نفسه، ولا يوفر معاملات خادم." : "This is not multi-user or server-backed. Data is not synchronized or backed up. The lock only reduces conflicts among cooperating writers in the same browser; it is not a server transaction."}</span></aside>
    {externalChange ? <p className={styles.message} role="status">{ar ? "تغير السجل في علامة تبويب أخرى وتم تحديث هذه الصفحة. راجع البيانات قبل المتابعة." : "Another tab changed this register. This view was refreshed; review it before continuing."}</p> : null}
    {message ? <p className={failed ? styles.error : styles.message} role={failed ? "alert" : "status"}>{message}</p> : null}

    {setupBlocked ? <section className={styles.blocked}><p className={styles.eyebrow}>{ar ? "الإعداد مطلوب" : "Setup required"}</p><h2>{ar ? "أكمل إعداد المشروع أولاً" : "Complete project setup first"}</h2><p>{ar ? "يجب تأكيد العميل والمورد والعقود قبل تسجيل المطالبات." : "Confirm the customer, supplier, and contracts before recording claims."}</p><a className={styles.filled} href={overview}>{ar ? "متابعة إعداد المشروع" : "Continue project setup"}</a></section> : <>
      <section className={styles.summary} aria-label={ar ? "ملخص المطالبات" : "Claim summary"}><div><span>{ar ? "مفتوحة" : "Open"}</span><strong>{summary.open}</strong></div><div><span>{ar ? "محلولة" : "Resolved"}</span><strong>{summary.resolved}</strong></div></section>
      {readOnly ? <aside className={styles.readOnly} role="note"><strong>{ar ? "عرض فقط" : "Read-only view"}</strong><span>{ar ? "المشروع مغلق؛ يمكنك مراجعة المطالبات المحفوظة فقط." : "This project is closed; you can only review saved claims."}</span></aside> : <section className={styles.card} aria-labelledby="new-claim-title"><div className={styles.cardHeading}><div><p className={styles.eyebrow}>{ar ? "إدخال جديد" : "New entry"}</p><h2 id="new-claim-title">{ar ? "تسجيل مطالبة" : "Record a claim"}</h2></div><span className={styles.badge}>{ar ? "مفتوحة" : "Open"}</span></div>
        <form className={styles.form} onSubmit={saveClaim}><div className={styles.grid}>
          <label>{ar ? "مرجع المطالبة" : "Claim reference"}<input required name="reference" autoComplete="off" /></label>
          <label>{ar ? "تاريخ المطالبة" : "Claim date"}<input required type="date" min={project.startDate} name="claimDate" /></label>
          <label>{ar ? "نوع المطالبة" : "Claim type"}<select required name="type" defaultValue=""><option value="" disabled>{ar ? "اختر النوع" : "Choose type"}</option>{PROJECT_CLAIM_TYPES.map((type) => <option key={type} value={type}>{typeLabels[type][locale]}</option>)}</select></label>
          <label>{ar ? "مقدم المطالبة" : "Claimant"}<select required name="claimant" defaultValue=""><option value="" disabled>{ar ? "اختر الطرف" : "Choose party"}</option>{parties.map((party) => <option key={party} value={party}>{party}</option>)}</select></label>
          <label>{ar ? "الطرف المطالب ضده" : "Respondent"}<select required name="respondent" defaultValue=""><option value="" disabled>{ar ? "اختر الطرف" : "Choose party"}</option>{parties.map((party) => <option key={party} value={party}>{party}</option>)}</select></label>
          <label>{ar ? "المبلغ الاختياري" : "Optional amount"}<input inputMode="decimal" pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?" name="amount" /></label>
          <label className={styles.wide}>{ar ? "الوصف" : "Description"}<textarea required minLength={3} name="description" rows={4} /></label>
        </div><div className={styles.formFooter}><span>{ar ? "يجب أن يكون الطرفان العميل والمورد وأن يختلفا." : "The parties must be the customer and supplier, and must differ."}</span><button className={styles.filled} type="submit">{ar ? "حفظ المطالبة" : "Save claim"}</button></div></form>
      </section>}
      <section className={styles.card} aria-labelledby="claims-register-title"><div className={styles.cardHeading}><div><p className={styles.eyebrow}>{ar ? "السجل المحفوظ" : "Saved register"}</p><h2 id="claims-register-title">{ar ? "المطالبات المسجلة" : "Recorded claims"}</h2></div></div>
        {summary.count === 0 ? <div className={styles.empty}><h3>{ar ? "لا توجد مطالبات مسجلة" : "No claims recorded"}</h3><p>{ar ? "لا توجد مشكلة تجارية مسجلة لهذا المشروع." : "No business issue is recorded for this project."}</p></div> : <ol className={styles.list}>{project.claims?.map((claim) => <li key={claim.reference}><div><span className={styles.badge}>{typeLabels[claim.type][locale]} · {claim.status === "OPEN" ? (ar ? "مفتوحة" : "Open") : (ar ? "محلولة" : "Resolved")}</span><h3>{claim.reference}</h3><p>{ar ? "من" : "From"} <strong>{claim.claimant}</strong> · {ar ? "ضد" : "Against"} <strong>{claim.respondent}</strong></p><p>{claim.description}</p><small>{ar ? "تاريخ المطالبة" : "Claim date"}: <time dateTime={claim.claimDate}>{date.format(new Date(`${claim.claimDate}T00:00:00.000Z`))}</time></small>{claim.status === "RESOLVED" ? <div className={styles.resolution}><strong>{ar ? "تفاصيل الحل" : "Resolution"}</strong><p>{claim.resolutionNote}</p><small><time dateTime={claim.resolutionDate}>{claim.resolutionDate}</time> · <time dateTime={claim.resolvedAt}>{date.format(new Date(claim.resolvedAt!))}</time></small></div> : !readOnly ? <form className={styles.resolveForm} onSubmit={(event) => resolveClaim(event, claim.reference)} aria-label={`${ar ? "حل المطالبة" : "Resolve claim"} ${claim.reference}`}><label>{ar ? "تاريخ الحل" : "Resolution date"}<input required type="date" min={claim.claimDate} name="resolutionDate" /></label><label>{ar ? "ملاحظة الحل" : "Resolution note"}<textarea required name="resolutionNote" minLength={1} rows={2} /></label><button className={styles.outlined} type="submit">{ar ? "تأكيد الحل" : "Confirm resolution"}</button></form> : null}</div>{claim.amount ? <strong><bdi>{claim.amount} {project.currency}</bdi></strong> : <span>{ar ? "لا يوجد مبلغ" : "No amount"}</span>}</li>)}</ol>}
      </section>
    </>}
  </main>;
}
