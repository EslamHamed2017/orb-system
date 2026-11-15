"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createBrowserSupplier, SUPPLIER_STORAGE_KEY, SupplierStorageError, readBrowserSuppliers, setBrowserSupplierStatus, updateBrowserSupplier } from "../../../modules/masters/browser-supplier-storage";
import styles from "./ProductsMasterPage.module.css";
import { filterSuppliers, summarizeSuppliers, type SupplierDirectoryRecord, type SupplierStatusFilter } from "./supplier-directory";

type Locale = "en" | "ar";
type Notice = { readonly kind: "success" | "error"; readonly text: string } | null;

export function SuppliersPage({ locale, query = "", status = "ALL", role }: { readonly locale: Locale; readonly query?: string; readonly status?: SupplierStatusFilter; readonly role?: string }) {
  const ar = locale === "ar";
  const roleSuffix = role ? `&role=${encodeURIComponent(role)}` : "";
  const [suppliers, setSuppliers] = useState<readonly SupplierDirectoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [editingSupplier, setEditingSupplier] = useState<SupplierDirectoryRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const registrationRef = useRef<HTMLDetailsElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => { try { setSuppliers(readBrowserSuppliers(window.localStorage)); setReadError(false); } catch { setReadError(true); } finally { setLoading(false); } };
    const sync = (event: StorageEvent) => { if (event.key === SUPPLIER_STORAGE_KEY) load(); };
    load(); window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => { if (notice) feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [notice]);

  const summary = summarizeSuppliers(suppliers);
  const visibleSuppliers = filterSuppliers(suppliers, query, status);

  function storageError(error: unknown) {
    if (error instanceof SupplierStorageError && error.code === "DUPLICATE_REFERENCE") return ar ? "مرجع المورد مستخدم بالفعل." : "That supplier reference is already in use.";
    if (error instanceof SupplierStorageError && error.code === "INVALID_SUPPLIER") return ar ? "راجع الحقول وأدخل رمز دولة من حرفين وبريداً إلكترونياً صالحاً." : "Check every field, use a two-letter country code, and enter a valid email.";
    return ar ? "تعذر حفظ بيانات المورد في هذا المتصفح." : "Supplier data could not be saved in this browser.";
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(null);
    const form = event.currentTarget, data = new FormData(form);
    setSubmitting(true);
    const input = { reference: String(data.get("reference") ?? ""), legalNameEn: String(data.get("legalNameEn") ?? ""), legalNameAr: String(data.get("legalNameAr") ?? ""),
      countryCode: String(data.get("countryCode") ?? ""), contactName: String(data.get("contactName") ?? ""), email: String(data.get("email") ?? ""), phone: String(data.get("phone") ?? "") };
    try {
      if (editingSupplier) await updateBrowserSupplier(window.localStorage, editingSupplier.id, input);
      else await createBrowserSupplier(window.localStorage, input);
      setSuppliers(readBrowserSuppliers(window.localStorage)); form.reset(); setEditingSupplier(null);
      setNotice({ kind: "success", text: editingSupplier ? (ar ? "تم حفظ التعديلات." : "Changes saved.") : (ar ? "تم حفظ المورد." : "Supplier saved.") });
    } catch (error) { setNotice({ kind: "error", text: storageError(error) }); } finally { setSubmitting(false); }
  }

  function startEditing(supplier: SupplierDirectoryRecord) {
    setEditingSupplier(supplier); setNotice(null);
    if (registrationRef.current) { registrationRef.current.open = true; requestAnimationFrame(() => registrationRef.current?.querySelector<HTMLInputElement>("input:not([readonly])")?.focus()); }
  }

  async function changeStatus(supplier: SupplierDirectoryRecord) {
    try { await setBrowserSupplierStatus(window.localStorage, supplier.id, !supplier.active); setSuppliers(readBrowserSuppliers(window.localStorage)); }
    catch (error) { setNotice({ kind: "error", text: storageError(error) }); }
  }

  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="suppliers-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>{ar ? "السجلات الأساسية" : "Essential masters"}</p><h1 id="suppliers-title">{ar ? "الموردون" : "Suppliers"}</h1><p className={styles.subtitle}>{ar ? "احتفظ ببيانات الموردين التي تستخدمها يومياً من دون سجلات نموذجية.":"Keep the supplier contacts you use in daily work, without sample records."}</p></div><button className={styles.primary} type="button" aria-controls="supplier-registration" data-operation-id="createSupplier" onClick={() => { if (registrationRef.current) { registrationRef.current.open = true; registrationRef.current.querySelector<HTMLInputElement>("input")?.focus(); } }}><span aria-hidden="true">＋</span>{ar ? "إضافة مورد" : "Add supplier"}</button></header>
    <aside className={styles.localScope}><span aria-hidden="true">●</span><div><strong>{ar ? "محفوظ في هذا المتصفح" : "Saved in this browser"}</strong><p>{ar ? "يبقى هذا الدليل في ملف المتصفح الحالي، ويمكن لأي شخص يستخدمه رؤيته. لا تتم مزامنته أو نسخه احتياطياً، ومسح بيانات الموقع يحذفه.":"This directory stays in this browser profile. Anyone using this profile can see it. It is not synchronized or backed up, and clearing site data deletes it."}</p></div></aside>
    <div className={styles.summary} aria-label={ar ? "ملخص الموردين" : "Supplier summary"}><div className={styles.kpi}><span>{ar ? "كل الموردين" : "All suppliers"}</span><strong>{summary.total}</strong></div><div className={styles.kpi}><span>{ar ? "نشطون" : "Active"}</span><strong>{summary.active}</strong></div><div className={styles.kpi}><span>{ar ? "مؤرشفون" : "Archived"}</span><strong>{summary.inactive}</strong></div></div>
    <form className={`${styles.card} ${styles.toolbar}`} method="get"><input type="hidden" name="locale" value={locale}/>{role && <input type="hidden" name="role" value={role}/>}<label>{ar ? "بحث" : "Search"}<input type="search" name="q" defaultValue={query} placeholder={ar ? "المرجع أو الاسم أو جهة الاتصال" : "Reference, name or contact"}/></label><label>{ar ? "الحالة" : "Status"}<select name="status" defaultValue={status}><option value="ALL">{ar ? "كل الحالات" : "All statuses"}</option><option value="ACTIVE">{ar ? "نشط" : "Active"}</option><option value="INACTIVE">{ar ? "مؤرشف" : "Archived"}</option></select></label><button type="submit">{ar ? "تطبيق" : "Apply"}</button></form>
    <section className={`${styles.card} ${styles.mobileDirectory}`} aria-labelledby="supplier-directory-title"><header className={styles.tableHeader}><div><h2 id="supplier-directory-title">{ar ? "دليل الموردين" : "Supplier directory"}</h2><p className={styles.muted}>{ar ? `${visibleSuppliers.length} مورد مطابق` : `${visibleSuppliers.length} matching suppliers`}</p></div><a href={`/masters/suppliers?locale=${locale}${roleSuffix}`}>{ar ? "مسح المرشحات" : "Clear filters"}</a></header>
      {loading ? <div className={styles.empty} role="status">{ar ? "جارٍ تحميل الموردين…" : "Loading suppliers…"}</div> : readError ? <div className={styles.errorState} role="alert"><h3>{ar ? "تعذر قراءة بيانات الموردين المحفوظة" : "Saved supplier data could not be read"}</h3><p>{ar ? "لم نعرض بيانات نموذجية بدلاً منها. لا تمسح بيانات الموقع قبل حفظ نسخة منها أو التواصل مع المسؤول.":"No sample data was substituted. Do not clear site data before preserving a copy or contacting the administrator."}</p></div> : visibleSuppliers.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{ar ? "المورد" : "Supplier"}</th><th>{ar ? "الدولة" : "Country"}</th><th>{ar ? "جهة الاتصال" : "Contact"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "الإجراء" : "Action"}</th></tr></thead><tbody>{visibleSuppliers.map((supplier) => <tr key={supplier.id}><td data-label={ar ? "المورد" : "Supplier"}><div className={styles.product}><strong>{ar ? supplier.legalNameAr : supplier.legalNameEn}</strong><span><bdi>{supplier.reference}</bdi> · {ar ? supplier.legalNameEn : supplier.legalNameAr}</span></div></td><td data-label={ar ? "الدولة" : "Country"}><bdi>{supplier.countryCode}</bdi></td><td data-label={ar ? "جهة الاتصال" : "Contact"}><div className={styles.product}><strong>{supplier.contactName}</strong><span><bdi>{supplier.email}</bdi><br/><bdi>{supplier.phone}</bdi></span></div></td><td data-label={ar ? "الحالة" : "Status"}><span className={styles.status} data-status={supplier.active ? "ACTIVE" : "INACTIVE"}>{ar ? (supplier.active ? "نشط" : "مؤرشف") : (supplier.active ? "Active" : "Archived")}</span></td><td data-label={ar ? "الإجراء" : "Action"}><div className={styles.rowActions}><button className={styles.lifecycleAction} type="button" data-operation-id="updateSupplier" onClick={() => startEditing(supplier)}>{ar ? "تعديل" : "Edit"}</button><button className={styles.lifecycleAction} type="button" data-operation-id="updateSupplier" onClick={() => changeStatus(supplier)}>{supplier.active ? (ar ? "أرشفة" : "Archive") : (ar ? "إعادة التفعيل" : "Reactivate")}</button></div></td></tr>)}</tbody></table></div> : <div className={styles.empty} role="status"><h3>{suppliers.length === 0 ? (ar ? "لم يُسجل أي مورد بعد" : "No suppliers registered yet") : (ar ? "لا يوجد موردون مطابقون" : "No matching suppliers")}</h3><p className={styles.muted}>{suppliers.length === 0 ? (ar ? "أضف أول مورد لبدء دليل العمل الحقيقي.":"Add the first supplier to start your real working directory.") : (ar ? "غيّر البحث أو الحالة وحاول مرة أخرى.":"Change the search or status and try again.")}</p>{suppliers.length === 0 && <button className={styles.emptyAction} type="button" onClick={() => { if (registrationRef.current) { registrationRef.current.open = true; registrationRef.current.scrollIntoView({ behavior: "smooth" }); requestAnimationFrame(() => registrationRef.current?.querySelector<HTMLInputElement>("input")?.focus()); } }}>{ar ? "إضافة أول مورد" : "Add first supplier"}</button>}</div>}
    </section>
    {!readError && <details ref={registrationRef} id="supplier-registration" className={`${styles.card} ${styles.registration}`}><summary>{editingSupplier ? (ar ? "تعديل بيانات المورد" : "Edit supplier details") : (ar ? "فتح نموذج إضافة المورد" : "Open supplier registration form")}</summary><h2>{editingSupplier ? (ar ? "تصحيح بيانات المورد" : "Correct supplier details") : (ar ? "بيانات المورد" : "Supplier details")}</h2><p className={styles.muted}>{ar ? "مرجع المورد ثابت بعد الإنشاء. أدخل بيانات اتصال عملية لتجنب السجلات غير القابلة للاستخدام.":"The supplier reference is immutable after creation. Enter usable contact details to avoid incomplete records."}</p><form key={editingSupplier?.id ?? "new"} className={styles.formGrid} onSubmit={handleCreate} aria-busy={submitting}><label>{ar ? "المرجع" : "Reference"}<input name="reference" required readOnly={Boolean(editingSupplier)} defaultValue={editingSupplier?.reference}/></label><label>{ar ? "الاسم القانوني بالإنجليزية" : "English legal name"}<input name="legalNameEn" required dir="ltr" defaultValue={editingSupplier?.legalNameEn}/></label><label>{ar ? "الاسم القانوني بالعربية" : "Arabic legal name"}<input name="legalNameAr" required dir="rtl" defaultValue={editingSupplier?.legalNameAr}/></label><label>{ar ? "رمز الدولة" : "Country code"}<input name="countryCode" required minLength={2} maxLength={2} defaultValue={editingSupplier?.countryCode}/></label><label>{ar ? "جهة الاتصال" : "Contact name"}<input name="contactName" required defaultValue={editingSupplier?.contactName}/></label><label>{ar ? "البريد الإلكتروني" : "Email"}<input name="email" type="email" required dir="ltr" defaultValue={editingSupplier?.email}/></label><label>{ar ? "الهاتف" : "Phone"}<input name="phone" type="tel" required dir="ltr" defaultValue={editingSupplier?.phone}/></label><div className={styles.formActions}><button type="submit" disabled={submitting} data-operation-id={editingSupplier ? "updateSupplier" : "createSupplier"}>{submitting ? (ar ? "جارٍ الحفظ…" : "Saving…") : editingSupplier ? (ar ? "حفظ التعديلات" : "Save changes") : (ar ? "حفظ المورد" : "Save supplier")}</button>{editingSupplier && <button className={styles.secondaryAction} type="button" disabled={submitting} onClick={() => { setEditingSupplier(null); setNotice(null); }}>{ar ? "إلغاء التعديل" : "Cancel edit"}</button>}</div></form>{notice && <div ref={feedbackRef} className={notice.kind === "error" ? styles.errorNotice : styles.successNotice} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</div>}</details>}
  </section>;
}
