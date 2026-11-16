"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./ProductsMasterPage.module.css";
import { ISO_COUNTRY_CODES } from "../../../modules/customers/country-codes";
import { CUSTOMER_V2_MEDIA_TYPE } from "../../../modules/customers/customer-response";
import { customerMutationHeaders } from "../../security/customer-mutation-headers";
import type { CustomerStatusFilter } from "./customer-directory";
import { isCustomerCollection, isServerCustomer, type ServerCustomer } from "./customer-response-validation";

type Locale = "en" | "ar";
type LoadState = "loading" | "ready" | "authentication" | "forbidden" | "server";
type Notice = { readonly kind: "success" | "error"; readonly text: string } | null;
export const CUSTOMERS_ENDPOINT = "/api/customers";

function responseState(status: number): Exclude<LoadState, "loading" | "ready"> {
  if (status === 401) return "authentication";
  if (status === 403) return "forbidden";
  return "server";
}

export function CustomersPage({ locale, query = "", status = "ALL", role }: { readonly locale: Locale; readonly query?: string; readonly status?: CustomerStatusFilter; readonly role?: string }) {
  const ar = locale === "ar";
  const roleSuffix = role ? `&role=${encodeURIComponent(role)}` : "";
  const [customers, setCustomers] = useState<readonly ServerCustomer[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [notice, setNotice] = useState<Notice>(null);
  const [submitting, setSubmitting] = useState(false);
  const [profileApi, setProfileApi] = useState(false);
  const [writePermitted, setWritePermitted] = useState(false);
  const registrationRef = useRef<HTMLDetailsElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  const loadCustomers = useCallback(async () => {
    setLoadState("loading"); setCustomers([]); setWritePermitted(false);
    try {
      const response = await fetch(CUSTOMERS_ENDPOINT, { cache: "no-store", headers: { Accept: CUSTOMER_V2_MEDIA_TYPE } });
      if (!response.ok) { setLoadState(responseState(response.status)); return; }
      const body: unknown = await response.json();
      if (!isCustomerCollection(body)) { setLoadState("server"); return; }
      setCustomers(body.items); setProfileApi(response.headers.get("x-orb-customer-schema-version") === "2"); setWritePermitted(response.headers.get("x-orb-customer-write-permitted") === "true"); setLoadState("ready");
    } catch { setLoadState("server"); }
  }, []);
  useEffect(() => { void loadCustomers(); }, [loadCustomers]);
  useEffect(() => { if (notice && feedbackRef.current) { feedbackRef.current.focus({ preventScroll: true }); feedbackRef.current.scrollIntoView({ behavior: "smooth", block: "center" }); } }, [notice]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleCustomers = customers.filter((customer) => (status === "ALL" || (status === "ACTIVE") === (customer.status === "ACTIVE"))
    && (!normalizedQuery || [customer.reference, customer.legalName, customer.legalNameAr ?? "", customer.contactName ?? "", customer.email ?? "", customer.phone ?? ""].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))));
  const active = customers.filter((customer) => customer.status === "ACTIVE").length;

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(null); setSubmitting(true);
    const form = event.currentTarget, data = new FormData(form);
    const address = { line1: String(data.get("billingAddressLine1") ?? "").trim(), line2: String(data.get("billingAddressLine2") ?? "").trim() || null, city: String(data.get("billingAddressCity") ?? "").trim(), region: String(data.get("billingAddressRegion") ?? "").trim() || null, postalCode: String(data.get("billingAddressPostalCode") ?? "").trim() || null };
    const hasAddress = Object.values(address).some(Boolean);
    if (profileApi && hasAddress && (!address.line1 || !address.city)) { setNotice({ kind: "error", text: ar ? "أدخل سطر عنوان الفوترة والمدينة معاً، أو اترك جميع حقول العنوان فارغة." : "Enter both billing address line 1 and city, or leave all address fields blank." }); setSubmitting(false); return; }
    const payload = {
      reference: String(data.get("reference") ?? "").trim().toUpperCase(),
      legalName: String(data.get("legalName") ?? "").trim(),
      contactName: String(data.get("contactName") ?? "").trim() || null,
      email: String(data.get("email") ?? "").trim().toLowerCase() || null,
      phone: String(data.get("phone") ?? "").trim() || null,
      ...(profileApi ? { legalNameAr: String(data.get("legalNameAr") ?? "").trim() || null, countryCode: String(data.get("countryCode") ?? "").trim().toUpperCase() || null, taxRegistrationNumber: String(data.get("taxRegistrationNumber") ?? "").trim() || null, paymentTermsDays: Number(data.get("paymentTermsDays") ?? 0), billingAddress: hasAddress ? address : null } : {}),
    };
    if (!payload.email && !payload.phone) {
      setNotice({ kind: "error", text: ar ? "أدخل بريداً إلكترونياً أو هاتفاً دولياً قبل الحفظ." : "Enter an email or international phone number before saving." });
      setSubmitting(false);
      return;
    }
    try {
      const response = await fetch(CUSTOMERS_ENDPOINT, { method: "POST", headers: { Accept: CUSTOMER_V2_MEDIA_TYPE, "Content-Type": "application/json", ...customerMutationHeaders() }, body: JSON.stringify(payload) });
      if (!response.ok) {
        const state = responseState(response.status);
        if (state === "authentication") { setCustomers([]); setLoadState(state); }
        setNotice({ kind: "error", text: state === "authentication" ? (ar ? "انتهت جلسة الدخول. لم يتم حفظ العميل." : "Your session is unavailable. The customer was not saved.") : state === "forbidden" ? (ar ? "ليست لديك صلاحية حفظ العملاء." : "You do not have permission to save customers.") : (ar ? "تعذر على الخادم حفظ العميل." : "The server could not save the customer.") });
        return;
      }
      const created: unknown = await response.json();
      if (!isServerCustomer(created)) { setNotice({ kind: "error", text: ar ? "أعاد الخادم استجابة غير صالحة. لم نعرض سجلاً محفوظاً." : "The server returned an invalid response. No saved record was shown." }); return; }
      setCustomers((current) => [...current, created]); form.reset();
      setNotice({ kind: "success", text: ar ? "حفظ الخادم العميل." : "Customer saved by the server." });
    } catch { setNotice({ kind: "error", text: ar ? "تعذر الاتصال بخدمة العملاء. لم يتم حفظ العميل." : "Could not reach the customer service. The customer was not saved." }); }
    finally { setSubmitting(false); }
  }

  const stateCopy = loadState === "authentication"
    ? { title: ar ? "تسجيل الدخول مطلوب" : "Sign-in required", detail: ar ? "سجّل الدخول لتحميل العملاء وحفظهم." : "Sign in to load and save customers." }
    : loadState === "forbidden"
      ? { title: ar ? "الوصول إلى العملاء غير مسموح" : "Customer access is not permitted", detail: ar ? "لا تمنحك جلستك الحالية صلاحية عرض العملاء أو حفظهم." : "Your current session does not permit viewing or saving customers." }
      : { title: ar ? "خدمة العملاء غير متاحة." : "Customer service is unavailable.", detail: ar ? "لم نعرض بيانات نموذجية أو بيانات متصفح بدلاً من سجلات الخادم." : "No sample or browser-stored data was substituted for server records." };
  const canCreate = loadState === "ready" && writePermitted;

  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="customers-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>{ar ? "السجلات الأساسية" : "Essential masters"}</p><h1 id="customers-title">{ar ? "العملاء" : "Customers"}</h1><p className={styles.subtitle}>{ar ? "دليل عملاء يعتمد على سجلات الخادم المصرح بها فقط.":"A customer directory backed only by authorized server records."}</p></div><button className={styles.primary} type="button" aria-controls="customer-registration" data-operation-id="createCustomer" disabled={!canCreate} onClick={() => { if (registrationRef.current) { registrationRef.current.open = true; registrationRef.current.querySelector<HTMLInputElement>("input")?.focus(); } }}><span aria-hidden="true">＋</span>{ar ? "إضافة عميل" : "Add customer"}</button></header>
    <aside className={styles.localScope}><span aria-hidden="true">●</span><div><strong>{ar ? "سجلات الخادم فقط" : "Server records only"}</strong><p>{ar ? "لا يحفظ ORB العملاء في مساحة تخزين المتصفح؛ ويصرح الخادم بكل عملية من الجلسة النشطة.":"ORB does not save customers in browser storage; the server authorizes every operation from the active session."}</p></div></aside>
    {loadState === "ready" && !writePermitted && <div className={styles.errorNotice} role="status">{ar ? "يمكنك عرض العملاء، لكن دورك الحالي لا يسمح بتغييرهم." : "You can view customers, but your current role cannot change them."}</div>}
    <div className={styles.summary} aria-label={ar ? "ملخص العملاء" : "Customer summary"}><div className={styles.kpi}><span>{ar ? "كل العملاء" : "All customers"}</span><strong>{customers.length}</strong></div><div className={styles.kpi}><span>{ar ? "نشطون" : "Active"}</span><strong>{active}</strong></div><div className={styles.kpi}><span>{ar ? "مؤرشفون" : "Archived"}</span><strong>{customers.length - active}</strong></div></div>
    <form className={`${styles.card} ${styles.toolbar}`} method="get"><input type="hidden" name="locale" value={locale}/>{role && <input type="hidden" name="role" value={role}/>}<label>{ar ? "بحث" : "Search"}<input type="search" name="q" defaultValue={query} placeholder={ar ? "المرجع أو الاسم" : "Reference or name"}/></label><label>{ar ? "الحالة" : "Status"}<select name="status" defaultValue={status}><option value="ALL">{ar ? "كل الحالات" : "All statuses"}</option><option value="ACTIVE">{ar ? "نشط" : "Active"}</option><option value="INACTIVE">{ar ? "مؤرشف" : "Archived"}</option></select></label><button type="submit">{ar ? "تطبيق" : "Apply"}</button></form>
    <section className={`${styles.card} ${styles.mobileDirectory}`} aria-labelledby="customer-directory-title"><header className={styles.tableHeader}><div><h2 id="customer-directory-title">{ar ? "دليل العملاء" : "Customer directory"}</h2><p className={styles.muted}>{ar ? `${visibleCustomers.length} عميل مطابق` : `${visibleCustomers.length} matching customers`}</p></div><a href={`/masters/customers?locale=${locale}${roleSuffix}`}>{ar ? "مسح المرشحات" : "Clear filters"}</a></header>
      {loadState === "loading" ? <div className={styles.empty} role="status">{ar ? "جارٍ تحميل العملاء من الخادم…" : "Loading customers from the server…"}</div>
        : loadState !== "ready" ? <div className={styles.errorState} role="alert"><h3>{stateCopy.title}</h3><p>{stateCopy.detail}</p><button type="button" onClick={() => void loadCustomers()}>{ar ? "إعادة المحاولة" : "Try again"}</button></div>
        : visibleCustomers.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th scope="col">{ar ? "العميل" : "Customer"}</th><th scope="col">{ar ? "التواصل" : "Contact"}</th><th scope="col">{ar ? "الحالة" : "Status"}</th></tr></thead><tbody>{visibleCustomers.map((customer) => <tr key={customer.id}><td data-label={ar ? "العميل" : "Customer"}><div className={styles.product}><strong><a href={`/customers/${encodeURIComponent(customer.id)}?locale=${locale}${roleSuffix}`}>{ar && customer.legalNameAr ? customer.legalNameAr : customer.legalName}</a></strong><span><bdi>{customer.reference}</bdi>{customer.contactName ? ` · ${customer.contactName}` : ""}</span></div></td><td data-label={ar ? "التواصل" : "Contact"}><div className={styles.product}>{customer.email && <bdi>{customer.email}</bdi>}{customer.phone && <bdi>{customer.phone}</bdi>}</div></td><td data-label={ar ? "الحالة" : "Status"}><span className={styles.status} data-status={customer.status}>{ar ? (customer.status === "ACTIVE" ? "نشط" : "مؤرشف") : (customer.status === "ACTIVE" ? "Active" : "Archived")}</span></td></tr>)}</tbody></table></div>
        : <div className={styles.empty} role="status"><h3>{customers.length === 0 ? (ar ? "لم يُسجل أي عميل بعد" : "No customers registered yet") : (ar ? "لا يوجد عملاء مطابقون" : "No matching customers")}</h3><p className={styles.muted}>{customers.length === 0 ? (ar ? "لم يرجع الخادم أي سجلات عملاء لهذه الجلسة.":"The server returned no customer records for this session.") : (ar ? "غيّر البحث أو الحالة وحاول مرة أخرى.":"Change the search or status and try again.")}</p></div>}
    </section>
    {notice && <div ref={feedbackRef} className={notice.kind === "error" ? styles.errorNotice : styles.successNotice} role={notice.kind === "error" ? "alert" : "status"} tabIndex={-1}>{notice.text}</div>}
    {canCreate && <details ref={registrationRef} id="customer-registration" className={`${styles.card} ${styles.registration}`}><summary>{ar ? "فتح نموذج إضافة العميل" : "Open customer registration form"}</summary><h2>{ar ? "بيانات العميل" : "Customer details"}</h2><p className={styles.muted}>{ar ? "يُرسل هذا النموذج إلى خدمة العملاء، ولا يُعد السجل محفوظاً إلا بعد استجابة خادم صالحة.":"This form posts to the customer service; a record is shown as saved only after a valid server response."}</p><form className={styles.formGrid} onSubmit={handleCreate} aria-busy={submitting}><label>{ar ? "المرجع" : "Reference"}<input name="reference" required maxLength={64}/></label><label>{ar ? "الاسم القانوني" : "Legal name"}<input name="legalName" required maxLength={200}/></label><label>{ar ? "اسم جهة الاتصال" : "Contact name"}<input name="contactName" maxLength={160}/></label><label>{ar ? "البريد الإلكتروني" : "Email"}<input name="email" type="email" maxLength={254}/></label><label>{ar ? "الهاتف الدولي" : "International phone"}<input name="phone" type="tel" dir="ltr" maxLength={32} placeholder="+971 50 123 4567"/></label>{profileApi && <><label>{ar ? "الاسم القانوني بالعربية" : "Arabic legal name"}<input name="legalNameAr" dir="rtl" maxLength={200}/></label><label>{ar ? "الدولة" : "Country"}<select name="countryCode" defaultValue=""><option value="">{ar ? "اختر الدولة" : "Select country"}</option>{ISO_COUNTRY_CODES.map((code) => <option key={code} value={code}>{new Intl.DisplayNames([locale], { type: "region" }).of(code)}</option>)}</select></label><label>{ar ? "الرقم الضريبي" : "Tax registration number"}<input name="taxRegistrationNumber" dir="ltr" maxLength={64}/></label><label>{ar ? "أجل السداد بالأيام" : "Payment terms (days)"}<input name="paymentTermsDays" type="number" min={0} max={3650} defaultValue={0}/></label><label>{ar ? "عنوان الفوترة" : "Billing address"}<input name="billingAddressLine1" maxLength={200}/></label><label>{ar ? "المدينة" : "City"}<input name="billingAddressCity" maxLength={120}/></label><label>{ar ? "المنطقة" : "Region"}<input name="billingAddressRegion" maxLength={120}/></label><label>{ar ? "الرمز البريدي" : "Postal code"}<input name="billingAddressPostalCode" maxLength={32}/></label><label>{ar ? "تفاصيل العنوان" : "Address line 2"}<input name="billingAddressLine2" maxLength={200}/></label></>}<p className={styles.muted}>{ar ? "أدخل البريد الإلكتروني أو الهاتف الدولي على الأقل." : "Enter at least an email or international phone number."}</p><div className={styles.formActions}><button type="submit" disabled={submitting} data-operation-id="createCustomer">{submitting ? (ar ? "جارٍ الإرسال…" : "Sending…") : (ar ? "حفظ العميل على الخادم" : "Save customer on server")}</button></div></form></details>}
  </section>;
}
