"use client";

import { useState, type FormEvent } from "react";
import {
  prepareOrganizationPrintUpdate,
  supportedTimeZones,
  type OrganizationPrintValues,
  type SettingsLocale,
} from "./organization-print-settings";

export function OrganizationPrintSettingsPanel({
  locale,
  initialValues,
  initialVersion,
  canManage,
}: Readonly<{
  locale: SettingsLocale;
  initialValues: OrganizationPrintValues;
  initialVersion: number;
  canManage: boolean;
}>) {
  const ar = locale === "ar";
  const [values, setValues] = useState<OrganizationPrintValues>(initialValues);
  const [version, setVersion] = useState(initialVersion);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const disabled = !canManage || busy;

  function setOrganization(key: keyof OrganizationPrintValues["organization"], value: string) {
    setValues((current) => ({ ...current, organization: { ...current.organization, [key]: value } }));
  }

  function setPrint(key: "footerEn" | "footerAr", value: string) {
    setValues((current) => ({ ...current, print: { ...current.print, [key]: value } }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    let update: ReturnType<typeof prepareOrganizationPrintUpdate>;
    try {
      update = prepareOrganizationPrintUpdate({ expectedVersion: version, reason, values });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : (ar ? "تعذر التحقق من الإعدادات." : "Settings validation failed."));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json", "If-Match": `"${update.expectedVersion}"` },
        body: JSON.stringify({ reason: update.reason, patch: update.patch }),
      });
      if (!response.ok) {
        if (response.status === 409 || response.status === 412) throw new Error(ar ? "تغيرت الإعدادات. حدّث الصفحة وحاول مرة أخرى." : "Settings changed. Refresh and try again.");
        throw new Error(ar ? "تعذر حفظ إعدادات المؤسسة والطباعة." : "Organization and print settings could not be saved.");
      }
      const snapshot = await response.json() as { version?: unknown; organization?: unknown; print?: unknown };
      if (!Number.isSafeInteger(snapshot.version) || !snapshot.organization || !snapshot.print) {
        throw new Error(ar ? "استجابة الإعدادات غير صالحة." : "The settings response was invalid.");
      }
      setValues(update.patch);
      setVersion(snapshot.version as number);
      setReason("");
      setStatus(ar ? "تم حفظ الهوية والطباعة وتسجيل سبب التغيير." : "Organization and print settings saved with an audited reason.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : (ar ? "تعذر حفظ إعدادات المؤسسة والطباعة." : "Organization and print settings could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  return <section id="organization-print-settings" className="organization-print-panel" role="region" aria-labelledby="organization-print-title">
    <header><div><p className="orb-eyebrow">{ar ? "هوية ثنائية اللغة وضوابط الطباعة" : "Bilingual identity and print controls"}</p><h2 id="organization-print-title">{ar ? "المؤسسة والطباعة" : "Organization and print"}</h2></div><span className="orb-chip">{ar ? `الإصدار ${version}` : `Version ${version}`}</span></header>
    <p>{ar ? "اضبط الهوية القانونية واللغة والمنطقة الزمنية وتذييلات المستندات غير الحساسة. لا تُخزن أسرار أو ملفات شعار في هذه الصفحة." : "Set legal identity, language, time zone, and non-sensitive document footers. Secrets and logo files are not stored on this page."}</p>
    <form onSubmit={save} data-operation-id="updateSettings">
      <fieldset id="organization"><legend>{ar ? "المؤسسة واللغة" : "Organization and language"}</legend><div className="organization-print-grid">
        <label><span>{ar ? "الاسم القانوني بالإنجليزية" : "English legal name"}</span><input value={values.organization.legalNameEn} onChange={(event) => setOrganization("legalNameEn", event.target.value)} maxLength={160} required disabled={disabled} dir="ltr"/></label>
        <label><span>{ar ? "الاسم القانوني بالعربية" : "Arabic legal name"}</span><input value={values.organization.legalNameAr} onChange={(event) => setOrganization("legalNameAr", event.target.value)} maxLength={160} required disabled={disabled} dir="rtl"/></label>
        <label><span>{ar ? "اللغة الافتراضية" : "Default language"}</span><select value={values.organization.defaultLocale} onChange={(event) => setOrganization("defaultLocale", event.target.value)} disabled={disabled}><option value="en">English</option><option value="ar">العربية</option></select></label>
        <label><span>{ar ? "المنطقة الزمنية" : "Time zone"}</span><select value={values.organization.timeZone} onChange={(event) => setOrganization("timeZone", event.target.value)} disabled={disabled}>{supportedTimeZones().map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></label>
      </div></fieldset>
      <fieldset id="print"><legend>{ar ? "الطباعة والقوالب" : "Print and templates"}</legend><div className="organization-print-grid">
        <label><span>{ar ? "تذييل الطباعة بالإنجليزية" : "English print footer"}</span><textarea value={values.print.footerEn} onChange={(event) => setPrint("footerEn", event.target.value)} maxLength={500} required disabled={disabled} dir="ltr"/></label>
        <label><span>{ar ? "تذييل الطباعة بالعربية" : "Arabic print footer"}</span><textarea value={values.print.footerAr} onChange={(event) => setPrint("footerAr", event.target.value)} maxLength={500} required disabled={disabled} dir="rtl"/></label>
      </div><label className="logo-toggle"><input type="checkbox" checked={values.print.showLogo} onChange={(event) => setValues((current) => ({ ...current, print: { ...current.print, showLogo: event.target.checked } }))} disabled={disabled}/><span>{ar ? "إظهار شعار ORB في المستندات المطبوعة" : "Show ORB logo on printed documents"}</span></label></fieldset>
      <label className="organization-print-reason"><span>{ar ? "سبب التغيير" : "Change reason"}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} maxLength={500} required disabled={disabled}/><small>{ar ? "مطلوب لسجل التدقيق (8 أحرف على الأقل)." : "Required for the audit trail (minimum 8 characters)."}</small></label>
      <div className="organization-print-actions"><button type="submit" disabled={disabled}>{busy ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "حفظ المؤسسة والطباعة" : "Save organization and print")}</button><span role="status" aria-live="polite">{status}</span></div>
    </form>
    {!canManage && <p role="alert">{ar ? "ليس لديك صلاحية تحديث إعدادات المؤسسة والطباعة." : "You do not have permission to update organization and print settings."}</p>}
  </section>;
}
