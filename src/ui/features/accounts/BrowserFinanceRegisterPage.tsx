"use client";

import { useEffect, useMemo, useState } from "react";
import { parseProjectRecords, PROJECT_STORAGE_KEY, type ProjectRecord } from "../../../modules/projects/daily-projects";
import { buildBrowserFinanceRows, type BrowserFinanceKind, type BrowserFinanceState } from "./browser-finance-register";
import styles from "./BrowserFinanceRegisterPage.module.css";

type Locale = "en" | "ar";
type LoadState = "loading" | "ready" | "storageError" | "corruptError";

const copy = {
  en: {
    supplierInvoices: { eyebrow: "Supplier costs", title: "Supplier invoices", description: "Review supplier invoices saved inside each project.", empty: "No saved supplier invoices yet." },
    supplierPayments: { eyebrow: "Supplier settlement", title: "Supplier payments", description: "Review payments you recorded against saved supplier invoices.", empty: "No saved supplier payments yet." },
    salesInvoices: { eyebrow: "Customer billing", title: "Customer invoices", description: "Review customer invoices saved inside each project.", empty: "No saved customer invoices yet." },
    collections: { eyebrow: "Customer receipts", title: "Collections", description: "Review customer receipts you recorded against saved invoices.", empty: "No saved collections yet." },
    expenses: { eyebrow: "Project costs", title: "Expenses", description: "Review direct operating expenses saved against projects.", empty: "No saved expenses yet." },
  },
  ar: {
    supplierInvoices: { eyebrow: "تكاليف الموردين", title: "فواتير الموردين", description: "راجع فواتير الموردين المحفوظة داخل كل مشروع.", empty: "لا توجد فواتير موردين محفوظة بعد." },
    supplierPayments: { eyebrow: "تسوية الموردين", title: "دفعات الموردين", description: "راجع الدفعات التي سجلتها على فواتير الموردين المحفوظة.", empty: "لا توجد دفعات موردين محفوظة بعد." },
    salesInvoices: { eyebrow: "فواتير العملاء", title: "فواتير العملاء", description: "راجع فواتير العملاء المحفوظة داخل كل مشروع.", empty: "لا توجد فواتير عملاء محفوظة بعد." },
    collections: { eyebrow: "متحصلات العملاء", title: "التحصيلات", description: "راجع المبالغ المستلمة التي سجلتها على فواتير العملاء.", empty: "لا توجد تحصيلات محفوظة بعد." },
    expenses: { eyebrow: "تكاليف المشاريع", title: "المصروفات", description: "راجع مصروفات التشغيل المباشرة المحفوظة على المشاريع.", empty: "لا توجد مصروفات محفوظة بعد." },
  },
} as const;

export function BrowserFinanceRegisterPage({ locale, kind, projectId, role }: { readonly locale: Locale; readonly kind: BrowserFinanceKind; readonly projectId?: string; readonly role?: string }) {
  const ar = locale === "ar";
  const text = copy[locale][kind];
  const [state, setState] = useState<LoadState>("loading");
  const [projects, setProjects] = useState<readonly ProjectRecord[]>([]);
  useEffect(() => {
    const load = () => {
      let raw: string | null;
      try { raw = localStorage.getItem(PROJECT_STORAGE_KEY); } catch { setState("storageError"); return; }
      try { setProjects(parseProjectRecords(raw)); setState("ready"); } catch { setState("corruptError"); }
    };
    const refresh = (event: StorageEvent) => { if (event.key === PROJECT_STORAGE_KEY) load(); };
    load();
    addEventListener("storage", refresh);
    return () => removeEventListener("storage", refresh);
  }, []);
  const rows = useMemo(() => buildBrowserFinanceRows(projects, kind, projectId), [projects, kind, projectId]);
  const selectedProject = projectId ? projects.find((project) => project.id === projectId) : undefined;
  const manageHref = selectedProject ? taskHrefFor(kind, selectedProject.id, locale, role) : `/projects${queryFor(locale, role)}`;
  const projectMissing = state === "ready" && Boolean(projectId) && !selectedProject;

  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="finance-register-title">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>{text.eyebrow}</p><h1 id="finance-register-title">{text.title}</h1><p>{text.description}</p></div>
      <a className={styles.hubLink} href={`/accounts${queryFor(locale, role)}`}>{ar ? "العمل المالي" : "Finance work"}</a>
    </header>
    <aside className={styles.truthNote}><strong>{ar ? "محفوظة في هذا المتصفح فقط" : "Stored only in this browser"}</strong><span>{ar ? "هذه سجلات تشغيلية أدخلتها أنت. لا تتم مزامنتها، ولا ينفذ ORB أي تحويل بنكي أو تواصل خارجي من هذه الصفحة." : "These are operational records you entered. They are not synchronized, and ORB does not make a bank transfer or contact anyone from this page."}</span></aside>
    {projectId && selectedProject ? <div className={styles.scope}><span>{ar ? "المشروع" : "Project"}</span><strong><bdi>{selectedProject.code}</bdi> · <bdi>{selectedProject.customer}</bdi></strong></div> : null}
    {state === "loading" ? <section className={styles.stateCard} role="status">{ar ? "جارٍ تحميل السجلات المحفوظة…" : "Loading saved records…"}</section> : null}
    {state === "storageError" ? <section className={styles.stateCard} role="alert"><h2>{ar ? "المتصفح منع فتح السجلات" : "Browser storage is unavailable"}</h2><p>{ar ? "اسمح بالتخزين المحلي لهذا الموقع ثم أعد تحميل الصفحة." : "Allow local storage for this site, then reload the page."}</p><button type="button" onClick={() => location.reload()}>{ar ? "إعادة المحاولة" : "Try again"}</button></section> : null}
    {state === "corruptError" ? <section className={styles.stateCard} role="alert"><h2>{ar ? "بيانات المشاريع المحفوظة غير صالحة" : "Saved project data is invalid"}</h2><p>{ar ? "لا تضف أو تغيّر سجلات الآن. استعد نسخة محلية سليمة، أو راجع المسؤول قبل مسح بيانات المتصفح." : "Do not add or change records now. Restore a known-good local backup, or ask an administrator before clearing browser data."}</p></section> : null}
    {projectMissing ? <section className={styles.stateCard} role="alert"><h2>{ar ? "المشروع المطلوب غير موجود" : "Project not found"}</h2><p>{ar ? "قد يكون المشروع حُذف أو أن الرابط يخص متصفحاً آخر." : "The project may have been removed, or this link may belong to another browser."}</p><a className={styles.primaryAction} href={`/projects${queryFor(locale, role)}`}>{ar ? "عرض المشاريع المحفوظة" : "View saved projects"}</a></section> : null}
    {state === "ready" && !projectMissing && rows.length === 0 ? <section className={styles.stateCard}><h2>{ar ? "لا توجد سجلات محفوظة بعد" : "No saved records yet"}</h2><p>{text.empty}</p><a className={styles.primaryAction} href={manageHref}>{selectedProject ? (ar ? "فتح مهمة المشروع" : "Open project task") : (ar ? "اختيار مشروع" : "Choose a project")}</a></section> : null}
    {state === "ready" && !projectMissing && rows.length > 0 ? <section aria-labelledby="saved-records-title"><div className={styles.sectionHeading}><div><h2 id="saved-records-title">{ar ? "السجلات المحفوظة" : "Saved records"}</h2><p>{recordCount(rows.length, locale)}</p></div></div><div className={styles.recordGrid}>{rows.map((row) => <article className={styles.recordCard} key={`${row.projectId}-${kind}-${row.reference}`}>
      <header><div><p className={styles.recordType}>{stateLabel(row.state, locale)}</p><h3><bdi>{row.reference}</bdi></h3></div><strong className={styles.amount}><bdi dir="ltr">{row.amount} {row.currency}</bdi></strong></header>
      <dl><div><dt>{ar ? "المشروع" : "Project"}</dt><dd><bdi>{row.projectCode}</bdi> · <bdi>{row.projectReference}</bdi></dd></div><div><dt>{partyLabel(kind, locale)}</dt><dd><bdi>{row.party}</bdi></dd></div><div><dt>{ar ? "التاريخ" : "Date"}</dt><dd><bdi dir="ltr">{row.occurredOn}</bdi></dd></div>{row.detail ? <div><dt>{detailLabel(kind, row.state, locale)}</dt><dd><bdi>{row.detail}</bdi>{kind === "salesInvoices" ? <> <bdi>{row.currency}</bdi></> : null}</dd></div> : null}</dl>
      <a className={styles.recordAction} href={localizeHref(row.taskHref, locale, role)}>{ar ? "فتح مهمة المشروع" : "Open project task"}</a>
    </article>)}</div></section> : null}
  </section>;
}

function queryFor(locale: Locale, role?: string): string { const query = new URLSearchParams({ locale }); if (role) query.set("role", role); return `?${query.toString()}`; }
function localizeHref(href: string, locale: Locale, role?: string): string { const [path, fragment] = href.split("#", 2); return `${path}${queryFor(locale, role)}${fragment ? `#${fragment}` : ""}`; }
function taskHrefFor(kind: BrowserFinanceKind, projectId: string, locale: Locale, role?: string): string { const encoded = encodeURIComponent(projectId); return localizeHref(kind === "expenses" ? `/projects/${encoded}/expenses` : `/projects/${encoded}/overview#${kind === "supplierInvoices" || kind === "supplierPayments" ? "supplier-finance" : "customer-finance"}`, locale, role); }
function recordCount(count: number, locale: Locale): string { return locale === "en" ? `${count} saved record${count === 1 ? "" : "s"}` : `${count} ${count === 1 ? "سجل محفوظ" : "سجلات محفوظة"}`; }
function stateLabel(state: BrowserFinanceState, locale: Locale): string { const labels = { en: { awaitingPayment: "Payment needed", paid: "Paid in full", awaitingCollection: "Collection needed", partiallyCollected: "Partially collected", collected: "Collected in full", recorded: "Recorded" }, ar: { awaitingPayment: "الدفع مطلوب", paid: "مدفوعة بالكامل", awaitingCollection: "التحصيل مطلوب", partiallyCollected: "مُحصّلة جزئيًا", collected: "مُحصّلة بالكامل", recorded: "مسجلة" } } as const; return labels[locale][state]; }
function partyLabel(kind: BrowserFinanceKind, locale: Locale): string { const supplier = kind === "supplierInvoices" || kind === "supplierPayments"; const expense = kind === "expenses"; return locale === "ar" ? supplier ? "المورد" : expense ? "الجهة المدفوع لها" : "العميل" : supplier ? "Supplier" : expense ? "Payee" : "Customer"; }
function detailLabel(kind: BrowserFinanceKind, state: BrowserFinanceState, locale: Locale): string { if (kind === "expenses") return locale === "ar" ? "الفئة" : "Category"; if (state === "partiallyCollected" || state === "awaitingCollection") return locale === "ar" ? "المتبقي" : "Remaining"; return locale === "ar" ? "التفاصيل" : "Details"; }
