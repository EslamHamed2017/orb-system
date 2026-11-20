"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import styles from "./ProductsMasterPage.module.css";
import { ISO_COUNTRY_CODES } from "../../../modules/customers/country-codes";
import { CUSTOMER_V2_MEDIA_TYPE } from "../../../modules/customers/customer-response";
import { customerMutationHeaders } from "../../security/customer-mutation-headers";
import { isServerCustomer, type ServerCustomer } from "./customer-response-validation";

type Locale = "en" | "ar";
type State = "loading" | "ready" | "authentication" | "forbidden" | "missing" | "server";
type Notice = { readonly kind: "success" | "error"; readonly text: string } | null;

function stateFor(status: number): Exclude<State, "loading" | "ready"> {
  if (status === 401) return "authentication";
  if (status === 403) return "forbidden";
  if (status === 404) return "missing";
  return "server";
}

export function CustomerDetailPage({ customerId, locale, role }: { readonly customerId: string; readonly locale: Locale; readonly role?: string }) {
  const ar = locale === "ar";
  const endpoint = `/api/customers/${encodeURIComponent(customerId)}`;
  const [customer, setCustomer] = useState<ServerCustomer | null>(null);
  const [state, setState] = useState<State>("loading");
  const [notice, setNotice] = useState<Notice>(null);
  const [submitting, setSubmitting] = useState(false);
  const [writePermitted, setWritePermitted] = useState(false);
  const profileApi = customer ? Object.prototype.hasOwnProperty.call(customer, "legalNameAr") : false;

  const load = useCallback(async () => {
    setState("loading"); setCustomer(null); setNotice(null); setWritePermitted(false);
    try {
      const response = await fetch(endpoint, { cache: "no-store", headers: { Accept: CUSTOMER_V2_MEDIA_TYPE } });
      if (!response.ok) { setState(stateFor(response.status)); return; }
      const body: unknown = await response.json();
      if (!isServerCustomer(body)) { setState("server"); return; }
      setCustomer(body); setWritePermitted(response.headers.get("x-orb-customer-write-permitted") === "true"); setState("ready");
    } catch { setState("server"); }
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);

  async function patch(body: Record<string, unknown>, success: string) {
    if (!customer) return;
    setSubmitting(true); setNotice(null);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { Accept: CUSTOMER_V2_MEDIA_TYPE, "Content-Type": "application/json", "If-Match": `"${customer.version}"`, ...customerMutationHeaders() },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const next = stateFor(response.status);
        if (next === "authentication") { setCustomer(null); setState(next); }
        setNotice({ kind: "error", text: response.status === 412 ? (ar ? "عُدّل العميل في جلسة أخرى. أعد تحميل السجل قبل المحاولة." : "This customer changed in another session. Reload the record before trying again.") : (ar ? "تعذر حفظ تغييرات العميل." : "The customer changes could not be saved.") });
        return;
      }
      const bodyValue: unknown = await response.json();
      if (!isServerCustomer(bodyValue)) { setNotice({ kind: "error", text: ar ? "أعاد الخادم استجابة غير صالحة، لذلك لم نعرض تغييراً محفوظاً." : "The server returned an invalid response, so no saved change was shown." }); return; }
      setCustomer(bodyValue); setState("ready"); setNotice({ kind: "success", text: success });
    } catch { setNotice({ kind: "error", text: ar ? "تعذر الوصول إلى خدمة العملاء." : "The customer service could not be reached." }); }
    finally { setSubmitting(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const address = { line1: String(data.get("billingAddressLine1") ?? "").trim(), line2: String(data.get("billingAddressLine2") ?? "").trim() || null, city: String(data.get("billingAddressCity") ?? "").trim(), region: String(data.get("billingAddressRegion") ?? "").trim() || null, postalCode: String(data.get("billingAddressPostalCode") ?? "").trim() || null };
    const hasAddress = Object.values(address).some(Boolean);
    if (profileApi && hasAddress && (!address.line1 || !address.city)) { setNotice({ kind: "error", text: ar ? "أدخل سطر عنوان الفوترة والمدينة معاً، أو اترك جميع حقول العنوان فارغة." : "Enter both billing address line 1 and city, or leave all address fields blank." }); return; }
    await patch({
      legalName: String(data.get("legalName") ?? "").trim(),
      contactName: String(data.get("contactName") ?? "").trim() || null,
      email: String(data.get("email") ?? "").trim().toLowerCase() || null,
      phone: String(data.get("phone") ?? "").trim() || null,
      ...(profileApi ? { legalNameAr: String(data.get("legalNameAr") ?? "").trim() || null, countryCode: String(data.get("countryCode") ?? "").trim().toUpperCase() || null, taxRegistrationNumber: String(data.get("taxRegistrationNumber") ?? "").trim() || null, paymentTermsDays: Number(data.get("paymentTermsDays") ?? 0), billingAddress: hasAddress ? address : null } : {}),
    }, ar ? "حفظ الخادم تغييرات العميل." : "Customer changes saved by the server.");
  }

  const unavailable = state === "authentication"
    ? (ar ? "سجّل الدخول لعرض هذا العميل." : "Sign in to view this customer.")
    : state === "forbidden" ? (ar ? "ليست لديك صلاحية عرض هذا العميل." : "You do not have permission to view this customer.")
      : state === "missing" ? (ar ? "لم يعثر الخادم على هذا العميل." : "The server could not find this customer.")
        : (ar ? "خدمة العملاء غير متاحة." : "Customer service is unavailable.");

  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="customer-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>{ar ? "سجل العميل" : "Customer record"}</p><h1 id="customer-title">{(ar && customer?.legalNameAr ? customer.legalNameAr : customer?.legalName) ?? (ar ? "العميل" : "Customer")}</h1><p className={styles.subtitle}>{ar ? "هوية وتواصل وحالة محفوظة على الخادم." : "Server-persisted identity, contact, and lifecycle status."}</p></div><a href={`/statements/customer/${customerId}?locale=${locale}`} target="_blank" rel="noreferrer" data-testid="customer-statement">{ar ? "كشف حساب" : "Statement"}</a><a href={`/masters/customers?locale=${locale}${role ? `&role=${encodeURIComponent(role)}` : ""}`}>{ar ? "العودة إلى العملاء" : "Back to customers"}</a></header>
    {state === "loading" ? <div className={styles.empty} role="status">{ar ? "جارٍ تحميل العميل من الخادم…" : "Loading customer from the server…"}</div>
      : state !== "ready" || !customer ? <div className={styles.errorState} role="alert"><h2>{unavailable}</h2><p>{ar ? "لم نعرض أي سجل نموذجي أو مخزن في المتصفح." : "No sample or browser-stored record was substituted."}</p><button type="button" onClick={() => void load()}>{ar ? "إعادة المحاولة" : "Try again"}</button></div>
      : <>
        <div className={styles.summary} aria-label={ar ? "ملخص العميل" : "Customer summary"}><div className={styles.kpi}><span>{ar ? "المرجع" : "Reference"}</span><strong><bdi>{customer.reference}</bdi></strong></div><div className={styles.kpi}><span>{ar ? "الحالة" : "Status"}</span><strong>{ar ? (customer.status === "ACTIVE" ? "نشط" : "مؤرشف") : (customer.status === "ACTIVE" ? "Active" : "Archived")}</strong></div><div className={styles.kpi}><span>{ar ? "الإصدار" : "Version"}</span><strong>{customer.version}</strong></div></div>
        {notice && <div className={notice.kind === "error" ? styles.errorNotice : styles.successNotice} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</div>}
        {!writePermitted && <div className={styles.errorNotice} role="status">{ar ? "يمكنك عرض هذا العميل، لكن دورك الحالي لا يسمح بتغييره." : "You can view this customer, but your current role cannot change it."}</div>}
        {writePermitted ? <form className={`${styles.card} ${styles.formGrid}`} data-operation-id="updateCustomer" onSubmit={save} aria-busy={submitting} key={customer.version}>
          <label>{ar ? "الاسم القانوني" : "Legal name"}<input name="legalName" defaultValue={customer.legalName} required maxLength={200} disabled={submitting || !writePermitted}/></label>
          <label>{ar ? "اسم جهة الاتصال" : "Contact name"}<input name="contactName" defaultValue={customer.contactName ?? ""} maxLength={160} disabled={submitting || !writePermitted}/></label>
          <label>{ar ? "البريد الإلكتروني" : "Email"}<input name="email" type="email" defaultValue={customer.email ?? ""} maxLength={254} disabled={submitting || !writePermitted}/></label>
          <label>{ar ? "الهاتف الدولي" : "International phone"}<input name="phone" type="tel" dir="ltr" defaultValue={customer.phone ?? ""} maxLength={32} disabled={submitting || !writePermitted}/></label>
          {profileApi && <><label>{ar ? "الاسم القانوني بالعربية" : "Arabic legal name"}<input name="legalNameAr" dir="rtl" defaultValue={customer.legalNameAr ?? ""} maxLength={200} disabled={submitting || !writePermitted}/></label><label>{ar ? "الدولة" : "Country"}<select name="countryCode" defaultValue={customer.countryCode ?? ""} disabled={submitting || !writePermitted}><option value="">{ar ? "اختر الدولة" : "Select country"}</option>{ISO_COUNTRY_CODES.map((code) => <option key={code} value={code}>{new Intl.DisplayNames([locale], { type: "region" }).of(code)}</option>)}</select></label><label>{ar ? "الرقم الضريبي" : "Tax registration number"}<input name="taxRegistrationNumber" dir="ltr" defaultValue={customer.taxRegistrationNumber ?? ""} maxLength={64} disabled={submitting || !writePermitted}/></label><label>{ar ? "أجل السداد بالأيام" : "Payment terms (days)"}<input name="paymentTermsDays" type="number" min={0} max={3650} defaultValue={customer.paymentTermsDays ?? 0} disabled={submitting || !writePermitted}/></label><label>{ar ? "العنوان" : "Address"}<input name="billingAddressLine1" defaultValue={customer.billingAddress?.line1 ?? ""} maxLength={200} disabled={submitting || !writePermitted}/></label><label>{ar ? "المدينة" : "City"}<input name="billingAddressCity" defaultValue={customer.billingAddress?.city ?? ""} maxLength={120} disabled={submitting || !writePermitted}/></label><label>{ar ? "المنطقة" : "Region"}<input name="billingAddressRegion" defaultValue={customer.billingAddress?.region ?? ""} maxLength={120} disabled={submitting || !writePermitted}/></label><label>{ar ? "الرمز البريدي" : "Postal code"}<input name="billingAddressPostalCode" defaultValue={customer.billingAddress?.postalCode ?? ""} maxLength={32} disabled={submitting || !writePermitted}/></label><label>{ar ? "تفاصيل العنوان" : "Address line 2"}<input name="billingAddressLine2" defaultValue={customer.billingAddress?.line2 ?? ""} maxLength={200} disabled={submitting || !writePermitted}/></label></>}{writePermitted && <div className={styles.formActions}><button type="submit" disabled={submitting}>{ar ? "حفظ التغييرات" : "Save changes"}</button></div>}
        </form> : <section className={styles.card} aria-labelledby="customer-details-title"><h2 id="customer-details-title">{ar ? "بيانات العميل" : "Customer details"}</h2><dl className={styles.summary}>
          <div className={styles.kpi}><dt>{ar ? "الاسم القانوني" : "Legal name"}</dt><dd>{customer.legalName}</dd></div>
          {customer.legalNameAr && <div className={styles.kpi}><dt>{ar ? "الاسم القانوني بالعربية" : "Arabic legal name"}</dt><dd dir="rtl">{customer.legalNameAr}</dd></div>}
          <div className={styles.kpi}><dt>{ar ? "اسم جهة الاتصال" : "Contact name"}</dt><dd>{customer.contactName ?? "—"}</dd></div>
          <div className={styles.kpi}><dt>{ar ? "البريد الإلكتروني" : "Email"}</dt><dd><bdi>{customer.email ?? "—"}</bdi></dd></div>
          <div className={styles.kpi}><dt>{ar ? "الهاتف الدولي" : "International phone"}</dt><dd><bdi>{customer.phone ?? "—"}</bdi></dd></div>
          {profileApi && <><div className={styles.kpi}><dt>{ar ? "الدولة" : "Country"}</dt><dd>{customer.countryCode ? new Intl.DisplayNames([locale], { type: "region" }).of(customer.countryCode) : "—"}</dd></div><div className={styles.kpi}><dt>{ar ? "الرقم الضريبي" : "Tax registration number"}</dt><dd><bdi>{customer.taxRegistrationNumber ?? "—"}</bdi></dd></div><div className={styles.kpi}><dt>{ar ? "أجل السداد" : "Payment terms"}</dt><dd>{ar ? `${customer.paymentTermsDays ?? 0} يوم` : `${customer.paymentTermsDays ?? 0} days`}</dd></div><div className={styles.kpi}><dt>{ar ? "عنوان الفوترة" : "Billing address"}</dt><dd>{customer.billingAddress ? [customer.billingAddress.line1, customer.billingAddress.line2, customer.billingAddress.city, customer.billingAddress.region, customer.billingAddress.postalCode].filter(Boolean).join(" · ") : "—"}</dd></div></>}
        </dl></section>}
        <section className={styles.card} aria-labelledby="customer-lifecycle-title"><h2 id="customer-lifecycle-title">{ar ? "دورة حياة العميل" : "Customer lifecycle"}</h2><p className={styles.muted}>{customer.status === "ACTIVE" ? (ar ? "أرشفة العميل تبقي سجله وتدقيقه محفوظين." : "Archiving keeps the customer record and audit history intact.") : (ar ? "يمكن إعادة تفعيل العميل المؤرشف عند استئناف التعامل." : "Reactivate the archived customer when trading resumes.")}</p>{writePermitted && <button type="button" data-operation-id="updateCustomer" disabled={submitting} onClick={() => {
          const archiving = customer.status === "ACTIVE";
          const confirmation = archiving
            ? (ar ? "أرشفة هذا العميل؟ ستُفقد أي تغييرات غير محفوظة في النموذج." : "Archive this customer? Any unsaved form changes will be lost.")
            : (ar ? "إعادة تفعيل هذا العميل؟ ستُفقد أي تغييرات غير محفوظة في النموذج." : "Reactivate this customer? Any unsaved form changes will be lost.");
          if (!window.confirm(confirmation)) return;
          void patch({ status: archiving ? "INACTIVE" : "ACTIVE" }, archiving ? (ar ? "أرشف الخادم العميل." : "Customer archived by the server.") : (ar ? "أعاد الخادم تفعيل العميل." : "Customer reactivated by the server."));
        }}>{customer.status === "ACTIVE" ? (ar ? "أرشفة العميل" : "Archive customer") : (ar ? "إعادة تفعيل العميل" : "Reactivate customer")}</button>}</section>
      </>}
  </section>;
}
