"use client";

import { useEffect, useState, type FormEvent } from "react";
import { parseProjectRecords, PROJECT_STORAGE_KEY, projectExpenseSummary, recordProjectExpense, removeProjectExpense, type ProjectRecord } from "../../../modules/projects/daily-projects";
import { mutateProjectStorage } from "../../../modules/projects/browser-project-storage";
import styles from "./ProjectExpenses.module.css";

type LoadState = "loading" | "ready" | "missing" | "error";

export function SavedProjectExpenses({ id, locale, role, canMutate = true }: Readonly<{ id: string; locale: "ar" | "en"; role?: string; canMutate?: boolean }>) {
  const ar = locale === "ar";
  const contextQuery = queryFor(locale, role);
  const [state, setState] = useState<LoadState>("loading");
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const found = parseProjectRecords(localStorage.getItem(PROJECT_STORAGE_KEY)).find((item) => item.id === id);
      if (found) { setProject(found); setState("ready"); } else setState("missing");
    } catch { setState("error"); }
  }, [id]);

  async function persist(update: (stored: ProjectRecord) => ProjectRecord) {
    if (!project) throw new Error("PROJECT_NOT_FOUND");
    const updated = await mutateProjectStorage(localStorage, parseProjectRecords, (records) => {
      const index = records.findIndex((item) => item.id === project.id);
      if (index < 0) throw new Error("PROJECT_NOT_FOUND");
      const next = update(records[index]);
      records[index] = next;
      return { records, result: next };
    });
    setProject(updated);
  }

  async function saveExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const expectedUpdatedAt = project?.updatedAt ?? "";
    try {
      await persist((stored) => recordProjectExpense(stored, {
        reference: String(data.get("reference") ?? ""), occurredOn: String(data.get("occurredOn") ?? ""),
        category: String(data.get("category") ?? ""), vendor: String(data.get("vendor") ?? ""), amount: String(data.get("amount") ?? ""),
      }, new Date().toISOString(), expectedUpdatedAt));
      form.reset();
      setMessage(ar ? "تم حفظ المصروف في هذا المتصفح." : "Expense saved in this browser.");
    } catch {
      setMessage(ar ? "تعذر حفظ المصروف. تحقق من الحقول وأعد تحميل الصفحة إذا تغير المشروع في علامة تبويب أخرى." : "Expense could not be saved. Check the fields and reload if this project changed in another tab.");
    }
  }

  async function removeExpense(reference: string) {
    if (!window.confirm(ar ? `حذف المصروف ${reference} من هذا السجل المحلي لتصحيحه؟` : `Remove expense ${reference} from this local record so it can be corrected?`)) return;
    setMessage("");
    const expectedUpdatedAt = project?.updatedAt ?? "";
    try {
      await persist((stored) => removeProjectExpense(stored, reference, expectedUpdatedAt, new Date().toISOString()));
      setMessage(ar ? "حُذف المصروف ويمكنك إدخاله من جديد." : "Expense removed; you can enter it again.");
    } catch {
      setMessage(ar ? "تعذر حذف المصروف. أعد تحميل الصفحة وحاول مجدداً." : "Expense could not be removed. Reload the page and try again.");
    }
  }

  const route = `/projects/${encodeURIComponent(id)}/overview${contextQuery}`;
  if (state === "loading") return <main className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.state} role="status">{ar ? "جارٍ تحميل مصروفات المشروع…" : "Loading project expenses…"}</div></main>;
  if (state === "error") return <main className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.state} role="alert"><h1>{ar ? "تعذر فتح المصروفات" : "Expenses could not be opened"}</h1><p>{ar ? "بيانات المشروع المحفوظة في هذا المتصفح غير قابلة للقراءة. ارجع إلى المشاريع ولا تدخل بيانات جديدة قبل التحقق منها." : "The project data saved in this browser cannot be read. Return to Projects and do not enter new data until it is checked."}</p></div></main>;
  if (state === "missing" || !project) return <main className={styles.page} dir={ar ? "rtl" : "ltr"}><div className={styles.state}><h1>{ar ? "المشروع غير موجود" : "Project not found"}</h1><p>{ar ? "لا يوجد مشروع محفوظ بهذا الرابط في هذا المتصفح." : "No project saved for this link exists in this browser."}</p><a className={styles.outlined} href={`/projects${contextQuery}`}>{ar ? "العودة إلى المشاريع" : "Back to projects"}</a></div></main>;

  const eligible = project.status === "ACTIVE";
  const summary = projectExpenseSummary(project);
  const dateFormatter = new Intl.DateTimeFormat(ar ? "ar-EG" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const amountFormatter = new Intl.NumberFormat(ar ? "ar-EG" : "en-US", { maximumFractionDigits: 6 });

  return <main className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="expenses-title">
    <nav className={styles.breadcrumb} aria-label={ar ? "مسار التنقل" : "Breadcrumb"}><a href={`/projects${contextQuery}`}>{ar ? "المشاريع" : "Projects"}</a><span>/</span><a href={route}>{project.code}</a><span>/</span><strong>{ar ? "المصروفات" : "Expenses"}</strong></nav>
    <header className={styles.header}><div><p className={styles.eyebrow}>{project.code} · {project.customer}</p><h1 id="expenses-title">{ar ? "مصروفات المشروع" : "Project expenses"}</h1><p>{ar ? "سجل التكاليف المباشرة التي دُفعت فعلياً لهذا المشروع، ثم راجع السجل الواضح أدناه." : "Record direct costs actually paid for this project, then review the clear register below."}</p></div><a className={styles.outlined} href={route}>{ar ? "نظرة عامة على المشروع" : "Project overview"}</a></header>

    <aside className={styles.truth} aria-label={ar ? "حدود حفظ البيانات" : "Data storage limits"}><strong>{ar ? "محفوظ في هذا المتصفح فقط" : "Saved in this browser only"}</strong><span>{ar ? "لا تتم المزامنة أو النسخ الاحتياطي، ومسح بيانات المتصفح يحذف السجل. تسجيل المصروف لا ينفذ دفعة ولا يرسل رسالة أو مستنداً." : "There is no sync or backup, and clearing browser data removes the record. Recording an expense does not make a payment or send a message or document."}</span></aside>

    {!eligible ? <section className={styles.blocked}><p className={styles.eyebrow}>{ar ? "خطوة سابقة مطلوبة" : "Earlier step required"}</p><h2>{ar ? "أكمل إعداد المشروع أولاً" : "Complete project setup first"}</h2><p>{ar ? "يفتح تسجيل المصروفات عندما يصبح المشروع نشطاً. لا توجد بيانات تجريبية معروضة هنا." : "Expense entry opens when the project becomes active. No demo data is shown here."}</p><a className={styles.filled} href={route}>{ar ? "متابعة مسار المشروع" : "Continue project flow"}</a></section> : <>
      <section className={styles.summary} aria-label={ar ? "ملخص المصروفات" : "Expense summary"}><div><span>{ar ? "عدد المصروفات" : "Expenses recorded"}</span><strong>{summary.count}</strong></div><div><span>{ar ? "الإجمالي المسجل" : "Recorded total"}</span><strong><bdi>{amountFormatter.format(Number(summary.total))} {project.currency}</bdi></strong></div></section>

      {canMutate ? <section className={styles.card} aria-labelledby="new-expense-title"><div className={styles.cardHeading}><div><p className={styles.eyebrow}>{ar ? "إدخال جديد" : "New entry"}</p><h2 id="new-expense-title">{ar ? "تسجيل مصروف مباشر" : "Record a direct expense"}</h2></div><span className={styles.badge}>{ar ? "أدخلته أنت" : "Entered by you"}</span></div>
        <form className={styles.form} onSubmit={saveExpense}><div className={styles.grid}>
          <label>{ar ? "مرجع المصروف" : "Expense reference"}<input required name="reference" autoComplete="off" /></label>
          <label>{ar ? "تاريخ المصروف" : "Expense date"}<input required type="date" min={project.startDate} name="occurredOn" /></label>
          <label>{ar ? "فئة المصروف" : "Expense category"}<input required name="category" placeholder={ar ? "مثال: شحن أو فحص" : "For example: Freight or inspection"} /></label>
          <label>{ar ? "الجهة المدفوع لها" : "Paid to"}<input required name="vendor" autoComplete="organization" /></label>
          <label>{ar ? "المبلغ المدفوع" : "Amount paid"}<input required type="number" min="0.000001" step="any" name="amount" /></label>
          <label>{ar ? "العملة" : "Currency"}<input value={project.currency} readOnly aria-readonly="true" /></label>
        </div><div className={styles.formFooter}><span>{ar ? "سجل فقط ما دُفع فعلياً." : "Record only what was actually paid."}</span><button className={styles.filled} type="submit">{ar ? "حفظ المصروف" : "Save expense"}</button></div></form>
        {message ? <p className={styles.message} role="status">{message}</p> : null}
      </section> : <aside className={styles.readOnly} role="note"><strong>{ar ? "عرض فقط" : "Read-only view"}</strong><span>{ar ? "يمكنك مراجعة المصروفات، لكن هذا الدور لا يستطيع إضافتها أو حذفها." : "You can review expenses, but this role cannot add or remove them."}</span></aside>}

      <section className={styles.card} aria-labelledby="expense-register-title"><div className={styles.cardHeading}><div><p className={styles.eyebrow}>{ar ? "السجل المحفوظ" : "Saved register"}</p><h2 id="expense-register-title">{ar ? "المصروفات المسجلة" : "Recorded expenses"}</h2></div></div>
        {summary.count === 0 ? <div className={styles.empty}><h3>{ar ? "لا توجد مصروفات مسجلة" : "No expenses recorded"}</h3><p>{canMutate ? (ar ? "استخدم النموذج أعلاه لإضافة أول تكلفة مباشرة حقيقية لهذا المشروع." : "Use the form above to add the first real direct cost for this project.") : (ar ? "لا توجد مصروفات محفوظة لهذا المشروع في هذا المتصفح." : "No expenses are saved for this project in this browser.")}</p></div> : <ol className={styles.list}>{project.expenses?.map((expense) => <li key={expense.reference}><div className={styles.expenseMain}><span className={styles.category}>{expense.category}</span><h3>{expense.reference}</h3><p>{expense.vendor} · <time dateTime={expense.occurredOn}>{dateFormatter.format(new Date(`${expense.occurredOn}T00:00:00.000Z`))}</time></p></div><div className={styles.expenseAmount}><strong><bdi>{amountFormatter.format(Number(expense.amount))} {project.currency}</bdi></strong>{canMutate ? <button type="button" onClick={() => removeExpense(expense.reference)}>{ar ? "حذف للتصحيح" : "Remove to correct"}</button> : null}</div></li>)}</ol>}
      </section>
    </>}
  </main>;
}

function queryFor(locale: "ar" | "en", role?: string): string { const query = new URLSearchParams({ locale }); if (role) query.set("role", role); return `?${query.toString()}`; }
