"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createBrowserCustomer, CUSTOMER_STORAGE_KEY, CustomerStorageError, readBrowserCustomers, setBrowserCustomerStatus, updateBrowserCustomer } from "../../../modules/masters/browser-customer-storage";
import styles from "./ProductsMasterPage.module.css";
import { filterCustomers, summarizeCustomers, type CustomerDirectoryRecord, type CustomerStatusFilter } from "./customer-directory";

type Locale = "en" | "ar";
type Notice = { readonly kind: "success" | "error"; readonly text: string } | null;

export function CustomersPage({ locale, query = "", status = "ALL", role }: { readonly locale: Locale; readonly query?: string; readonly status?: CustomerStatusFilter; readonly role?: string }) {
  const ar = locale === "ar";
  const roleSuffix = role ? `&role=${encodeURIComponent(role)}` : "";
  const [customers, setCustomers] = useState<readonly CustomerDirectoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState<"corrupt" | "unavailable" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDirectoryRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const registrationRef = useRef<HTMLDetailsElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => { try { setCustomers(readBrowserCustomers(window.localStorage)); setReadError(null); } catch (error) { setCustomers([]); setReadError(error instanceof CustomerStorageError && error.code === "CORRUPT_DATA" ? "corrupt" : "unavailable"); } finally { setLoading(false); } };
    const sync = (event: StorageEvent) => { if (event.key === CUSTOMER_STORAGE_KEY || event.key === null) load(); };
    load(); window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (notice && feedbackRef.current) {
      feedbackRef.current.focus({ preventScroll: true });
      feedbackRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [notice]);

  const summary = summarizeCustomers(customers);
  const visibleCustomers = filterCustomers(customers, query, status);

  function storageError(error: unknown) {
    if (error instanceof CustomerStorageError && error.code === "DUPLICATE_REFERENCE") return ar ? "مرجع العميل مستخدم بالفعل." : "That customer reference is already in use.";
    if (error instanceof CustomerStorageError && error.code === "INVALID_CUSTOMER") return ar ? "راجع الحقول وأدخل رمز دولة من حرفين وبريداً إلكترونياً صالحاً." : "Check every field, use a two-letter country code, and enter a valid email.";
    return ar ? "تعذر حفظ بيانات العميل في هذا المتصفح." : "Customer data could not be saved in this browser.";
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(null);
    const form = event.currentTarget, data = new FormData(form);
    setSubmitting(true);
    const input = { reference: String(data.get("reference") ?? ""), legalNameEn: String(data.get("legalNameEn") ?? ""), legalNameAr: String(data.get("legalNameAr") ?? ""),
      countryCode: String(data.get("countryCode") ?? ""), contactName: String(data.get("contactName") ?? ""), email: String(data.get("email") ?? ""), phone: String(data.get("phone") ?? "") };
    try {
      if (editingCustomer) await updateBrowserCustomer(window.localStorage, editingCustomer.id, input);
      else await createBrowserCustomer(window.localStorage, input);
      setCustomers(readBrowserCustomers(window.localStorage)); form.reset(); setEditingCustomer(null);
      setNotice({ kind: "success", text: editingCustomer ? (ar ? "تم حفظ التعديلات." : "Changes saved.") : (ar ? "تم حفظ العميل." : "Customer saved.") });
    } catch (error) { setNotice({ kind: "error", text: storageError(error) }); } finally { setSubmitting(false); }
  }

  function startEditing(customer: CustomerDirectoryRecord) {
    setEditingCustomer(customer); setNotice(null);
    if (registrationRef.current) { registrationRef.current.open = true; requestAnimationFrame(() => registrationRef.current?.querySelector<HTMLInputElement>("input:not([readonly])")?.focus()); }
  }

  async function changeStatus(customer: CustomerDirectoryRecord) {
    setNotice(null);
    try {
      await setBrowserCustomerStatus(window.localStorage, customer.id, !customer.active);
      setCustomers(readBrowserCustomers(window.localStorage));
      setNotice({ kind: "success", text: customer.active ? (ar ? "تمت أرشفة العميل." : "Customer archived.") : (ar ? "تمت إعادة تفعيل العميل." : "Customer reactivated.") });
    } catch (error) { setNotice({ kind: "error", text: storageError(error) }); }
  }

  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="customers-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>{ar ? "السجلات الأساسية" : "Essential masters"}</p><h1 id="customers-title">{ar ? "العملاء" : "Customers"}</h1><p className={styles.subtitle}>{ar ? "سجّل بيانات العملاء التي تحتاجها المشاريع والفواتير اليومية من دون سجلات نموذجية.":"Register the customer details needed by daily projects and invoices, without sample records."}</p></div><button className={styles.primary} type="button" aria-controls="customer-registration" data-operation-id="createCustomer" disabled={Boolean(readError)} onClick={() => { if (registrationRef.current) { registrationRef.current.open = true; registrationRef.current.querySelector<HTMLInputElement>("input")?.focus(); } }}><span aria-hidden="true">＋</span>{ar ? "إضافة عميل" : "Add customer"}</button></header>
    <aside className={styles.localScope}><span aria-hidden="true">●</span><div><strong>{ar ? "محفوظ في ملف هذا المتصفح" : "Saved in this browser profile"}</strong><p>{ar ? "يبقى دليل العملاء في ملف هذا المتصفح، ويمكن لأي شخص يستخدمه رؤيته. لا تتم مزامنته أو نسخه احتياطياً، ومسح بيانات الموقع يحذفه.":"This customer directory stays in this browser profile. Anyone using this profile can see it. It is not synchronized or backed up, and clearing site data deletes it."}</p></div></aside>
    <div className={styles.summary} aria-label={ar ? "ملخص العملاء" : "Customer summary"}><div className={styles.kpi}><span>{ar ? "كل العملاء" : "All customers"}</span><strong>{summary.total}</strong></div><div className={styles.kpi}><span>{ar ? "نشطون" : "Active"}</span><strong>{summary.active}</strong></div><div className={styles.kpi}><span>{ar ? "مؤرشفون" : "Archived"}</span><strong>{summary.inactive}</strong></div></div>
    <form className={`${styles.card} ${styles.toolbar}`} method="get"><input type="hidden" name="locale" value={locale}/>{role && <input type="hidden" name="role" value={role}/>}<label>{ar ? "بحث" : "Search"}<input type="search" name="q" defaultValue={query} placeholder={ar ? "المرجع أو الاسم أو جهة الاتصال" : "Reference, name or contact"}/></label><label>{ar ? "الحالة" : "Status"}<select name="status" defaultValue={status}><option value="ALL">{ar ? "كل الحالات" : "All statuses"}</option><option value="ACTIVE">{ar ? "نشط" : "Active"}</option><option value="INACTIVE">{ar ? "مؤرشف" : "Archived"}</option></select></label><button type="submit">{ar ? "تطبيق" : "Apply"}</button></form>
    <section className={`${styles.card} ${styles.mobileDirectory}`} aria-labelledby="customer-directory-title"><header className={styles.tableHeader}><div><h2 id="customer-directory-title">{ar ? "دليل العملاء" : "Customer directory"}</h2><p className={styles.muted}>{ar ? `${visibleCustomers.length} عميل مطابق` : `${visibleCustomers.length} matching customers`}</p></div><a href={`/masters/customers?locale=${locale}${roleSuffix}`}>{ar ? "مسح المرشحات" : "Clear filters"}</a></header>
      {loading ? <div className={styles.empty} role="status">{ar ? "جارٍ تحميل العملاء…" : "Loading customers…"}</div> : readError ? <div className={styles.errorState} role="alert"><h3>{readError === "corrupt" ? (ar ? "بيانات العملاء المحفوظة تالفة" : "Saved customer data is corrupt") : (ar ? "تعذر الوصول إلى مساحة تخزين العملاء" : "Customer storage is unavailable")}</h3><p>{ar ? "لم نعرض بيانات نموذجية بدلاً منها. لا تمسح بيانات الموقع قبل حفظ نسخة منها أو التواصل مع المسؤول.":"No sample data was substituted. Do not clear site data before preserving a copy or contacting the administrator."}</p></div> : visibleCustomers.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th scope="col">{ar ? "العميل" : "Customer"}</th><th scope="col">{ar ? "الدولة" : "Country"}</th><th scope="col">{ar ? "جهة الاتصال" : "Contact"}</th><th scope="col">{ar ? "الحالة" : "Status"}</th><th scope="col">{ar ? "الإجراء" : "Action"}</th></tr></thead><tbody>{visibleCustomers.map((customer) => <tr key={customer.id}><td data-label={ar ? "العميل" : "Customer"}><div className={styles.product}><strong>{ar ? customer.legalNameAr : customer.legalNameEn}</strong><span><bdi>{customer.reference}</bdi> · {ar ? customer.legalNameEn : customer.legalNameAr}</span></div></td><td data-label={ar ? "الدولة" : "Country"}><bdi>{customer.countryCode}</bdi></td><td data-label={ar ? "جهة الاتصال" : "Contact"}><div className={styles.product}><strong>{customer.contactName}</strong><span><bdi>{customer.email}</bdi><br/><bdi>{customer.phone}</bdi></span></div></td><td data-label={ar ? "الحالة" : "Status"}><span className={styles.status} data-status={customer.active ? "ACTIVE" : "INACTIVE"}>{ar ? (customer.active ? "نشط" : "مؤرشف") : (customer.active ? "Active" : "Archived")}</span></td><td data-label={ar ? "الإجراء" : "Action"}><div className={styles.rowActions}><button className={styles.lifecycleAction} type="button" data-operation-id="updateCustomer" onClick={() => startEditing(customer)}>{ar ? "تعديل" : "Edit"}</button><button className={styles.lifecycleAction} type="button" data-operation-id="updateCustomer" onClick={() => changeStatus(customer)}>{customer.active ? (ar ? "أرشفة" : "Archive") : (ar ? "إعادة التفعيل" : "Reactivate")}</button></div></td></tr>)}</tbody></table></div> : <div className={styles.empty} role="status"><h3>{customers.length === 0 ? (ar ? "لم يُسجل أي عميل بعد" : "No customers registered yet") : (ar ? "لا يوجد عملاء مطابقون" : "No matching customers")}</h3><p className={styles.muted}>{customers.length === 0 ? (ar ? "أضف أول عميل لبدء دليل العمل الحقيقي.":"Add the first customer to start your real working directory.") : (ar ? "غيّر البحث أو الحالة وحاول مرة أخرى.":"Change the search or status and try again.")}</p>{customers.length === 0 && <button className={styles.emptyAction} type="button" data-operation-id="createCustomer" onClick={() => { if (registrationRef.current) { registrationRef.current.open = true; registrationRef.current.scrollIntoView({ behavior: "smooth" }); requestAnimationFrame(() => registrationRef.current?.querySelector<HTMLInputElement>("input")?.focus()); } }}>{ar ? "إضافة أول عميل" : "Add first customer"}</button>}</div>}
    </section>
    {notice && <div ref={feedbackRef} className={notice.kind === "error" ? styles.errorNotice : styles.successNotice} role={notice.kind === "error" ? "alert" : "status"} tabIndex={-1}>{notice.text}</div>}
    {!readError && <details ref={registrationRef} id="customer-registration" className={`${styles.card} ${styles.registration}`}><summary>{editingCustomer ? (ar ? "تعديل بيانات العميل" : "Edit customer details") : (ar ? "فتح نموذج إضافة العميل" : "Open customer registration form")}</summary><h2>{editingCustomer ? (ar ? "تصحيح بيانات العميل" : "Correct customer details") : (ar ? "بيانات العميل" : "Customer details")}</h2><p className={styles.muted}>{ar ? "مرجع العميل ثابت بعد الإنشاء. أدخل بيانات اتصال عملية لتجنب السجلات غير القابلة للاستخدام.":"The customer reference is immutable after creation. Enter usable contact details to avoid incomplete records."}</p><form key={editingCustomer?.id ?? "new"} className={styles.formGrid} onSubmit={handleCreate} aria-busy={submitting}><label>{ar ? "المرجع" : "Reference"}<input name="reference" required readOnly={Boolean(editingCustomer)} defaultValue={editingCustomer?.reference}/></label><label>{ar ? "الاسم القانوني بالإنجليزية" : "English legal name"}<input name="legalNameEn" required dir="ltr" defaultValue={editingCustomer?.legalNameEn}/></label><label>{ar ? "الاسم القانوني بالعربية" : "Arabic legal name"}<input name="legalNameAr" required dir="rtl" defaultValue={editingCustomer?.legalNameAr}/></label><label>{ar ? "رمز الدولة" : "Country code"}<input name="countryCode" required minLength={2} maxLength={2} defaultValue={editingCustomer?.countryCode}/></label><label>{ar ? "جهة الاتصال" : "Contact name"}<input name="contactName" required defaultValue={editingCustomer?.contactName}/></label><label>{ar ? "البريد الإلكتروني" : "Email"}<input name="email" type="email" required dir="ltr" defaultValue={editingCustomer?.email}/></label><label>{ar ? "الهاتف" : "Phone"}<input name="phone" type="tel" required dir="ltr" defaultValue={editingCustomer?.phone}/></label><div className={styles.formActions}><button type="submit" disabled={submitting} data-operation-id={editingCustomer ? "updateCustomer" : "createCustomer"}>{submitting ? (ar ? "جارٍ الحفظ…" : "Saving…") : editingCustomer ? (ar ? "حفظ التعديلات" : "Save changes") : (ar ? "حفظ العميل" : "Save customer")}</button>{editingCustomer && <button className={styles.secondaryAction} type="button" disabled={submitting} onClick={() => { setEditingCustomer(null); setNotice(null); }}>{ar ? "إلغاء التعديل" : "Cancel edit"}</button>}</div></form></details>}
  </section>;
}
