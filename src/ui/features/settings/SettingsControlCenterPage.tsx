"use client";

import { FormEvent, useCallback, useEffect, useState, type ChangeEvent } from "react";
import { EnterpriseStyles, ErpPageHeader } from "../admin/EnterpriseUx";
import { mutationHeaders, problemOf, type ApiProblem } from "../../session-client";
import { DocumentFrame, Totals, fmt, labeler, type DocumentCompany } from "../documents/DocumentFrame";

/**
 * Account and settings (gear menu), like QuickBooks' company settings and custom form styles: the company's details,
 * tax registration, bank account and document design. Everything here prints on every document. Owner only.
 */
type Company = DocumentCompany & { standardVatRate: string };
interface Settings { company: Company; version: number; updatedAt: string | null }
type Field = Exclude<keyof Company, "logoDataUrl" | "vatRegistered" | "documentLanguage">;

const SECTIONS: readonly { en: string; ar: string; fields: readonly (readonly [Field, string, string, "text" | "textarea" | "color" | "email"])[] }[] = [
  { en: "Company name", ar: "اسم الشركة", fields: [["legalNameEn", "Legal name (English)", "الاسم القانوني (إنجليزي)", "text"], ["legalNameAr", "Legal name (Arabic)", "الاسم القانوني (عربي)", "text"]] },
  { en: "Contact info", ar: "بيانات التواصل", fields: [["phone", "Phone", "الهاتف", "text"], ["email", "Email", "البريد الإلكتروني", "email"], ["website", "Website", "الموقع", "text"]] },
  { en: "Address", ar: "العنوان", fields: [["addressEn", "Address (English)", "العنوان (إنجليزي)", "textarea"], ["addressAr", "Address (Arabic)", "العنوان (عربي)", "textarea"]] },
  { en: "Tax and licence", ar: "الضريبة والرخصة", fields: [["trn", "Tax registration number (TRN)", "الرقم الضريبي", "text"], ["licenceNo", "Trade licence no.", "رقم الرخصة التجارية", "text"], ["standardVatRate", "Standard VAT rate (%)", "نسبة الضريبة الأساسية (%)", "text"]] },
  { en: "Bank details", ar: "بيانات البنك", fields: [["bankName", "Bank name", "اسم البنك", "text"], ["bankAccountName", "Account name", "اسم الحساب", "text"], ["iban", "IBAN", "IBAN", "text"], ["swift", "SWIFT / BIC", "SWIFT / BIC", "text"], ["bankCurrency", "Account currency", "عملة الحساب", "text"]] },
  { en: "Document text", ar: "نصوص المستندات", fields: [["termsEn", "Terms and conditions (English)", "الشروط والأحكام (إنجليزي)", "textarea"], ["termsAr", "Terms and conditions (Arabic)", "الشروط والأحكام (عربي)", "textarea"], ["footerEn", "Footer (English)", "التذييل (إنجليزي)", "text"], ["footerAr", "Footer (Arabic)", "التذييل (عربي)", "text"]] },
];

export function SettingsControlCenterPage({ locale }: Readonly<{ locale: "en" | "ar"; canManage?: boolean }>) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Company | null>(null);
  const [logoChanged, setLogoChanged] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/settings", { cache: "no-store" });
    if (!response.ok) { setProblem(await problemOf(response)); return; }
    const data = await response.json() as Settings;
    setSettings(data); setForm(data.company); setLogoChanged(false); setProblem(null);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const set = (field: keyof Company, value: unknown) => setForm((current) => (current ? { ...current, [field]: value } as Company : current));
  function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 512 * 1024) { setNotice({ tone: "error", text: t("Choose a PNG, JPEG or WebP image of 512 KB or less.", "اختر صورة PNG أو JPEG أو WebP حجمها 512 كيلوبايت أو أقل.") }); return; }
    const reader = new FileReader();
    reader.onload = () => { set("logoDataUrl", String(reader.result)); setLogoChanged(true); };
    reader.readAsDataURL(file);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !settings) return;
    setBusy(true); setNotice(null);
    const { logoDataUrl, ...rest } = form;
    const company: Record<string, unknown> = { ...rest };
    if (logoChanged) company.logoDataUrl = logoDataUrl;
    try {
      const response = await fetch("/api/settings", { method: "PATCH", headers: mutationHeaders({ "if-match": `"${settings.version}"` }), body: JSON.stringify({ reason: "Company details updated from Account and settings", patch: { company } }), cache: "no-store" });
      if (!response.ok) throw await problemOf(response);
      const data = await response.json() as Settings;
      setSettings(data); setForm(data.company); setLogoChanged(false);
      setNotice({ tone: "success", text: t("Saved. Every document now prints these details.", "تم الحفظ. كل المستندات تطبع هذه البيانات الآن.") });
    } catch (error) {
      setNotice({ tone: "error", text: (error as ApiProblem).detail ?? t("Couldn't save. Try again.", "تعذر الحفظ. حاول مرة أخرى.") });
    } finally { setBusy(false); }
  }

  const shell = (body: React.ReactNode) => <section className="orb-erp orb-company" dir={ar ? "rtl" : "ltr"} aria-labelledby="settings-title"><EnterpriseStyles/><style>{STYLES}</style>{body}</section>;
  if (problem) return shell(<><ErpPageHeader titleId="settings-title" eyebrow={t("Your company", "شركتك")} title={t("Account and settings", "الحساب والإعدادات")}
    description={problem.status === 403 ? t("Only an owner can change company settings.", "تغيير إعدادات الشركة متاح للمالك فقط.") : t("Settings couldn't be loaded. Try again in a moment.", "تعذر تحميل الإعدادات. حاول مرة أخرى بعد قليل.")}/></>);
  if (!form || !settings) return shell(<><h1 id="settings-title" className="orb-sr-only">{t("Account and settings", "الحساب والإعدادات")}</h1><p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p></>);

  return shell(<>
    <ErpPageHeader titleId="settings-title" eyebrow={t("Your company", "شركتك")} title={t("Account and settings", "الحساب والإعدادات")}
      description={t("Your company's details, tax registration, bank account and document design. They print on every invoice, statement, receipt and contract.", "بيانات شركتك وتسجيلها الضريبي وحسابها البنكي وتصميم المستندات. تُطبع على كل فاتورة وكشف حساب وإيصال وعقد.")}/>
    {notice && <p className="company-banner" data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
    <form className="company-form" onSubmit={(event) => void save(event)} data-operation-id="updateSettings">
      {SECTIONS.map((section) => <fieldset key={section.en}>
        <legend>{t(section.en, section.ar)}</legend>
        <div className="company-grid">
          {section.fields.map(([field, en, arabic, kind]) => <label key={field} className={kind === "textarea" ? "wide" : undefined}>{t(en, arabic)}
            {kind === "textarea"
              ? <textarea rows={3} value={String(form[field] ?? "")} onChange={(event) => set(field, event.currentTarget.value)} dir={field.endsWith("Ar") ? "rtl" : undefined}/>
              : <input type={kind} value={String(form[field] ?? "")} onChange={(event) => set(field, event.currentTarget.value)} dir={field.endsWith("Ar") ? "rtl" : field === "email" || field === "iban" || field === "trn" ? "ltr" : undefined}/>}
          </label>)}
          {section.en === "Tax and licence" && <label className="check"><input type="checkbox" checked={form.vatRegistered} onChange={(event) => set("vatRegistered", event.currentTarget.checked)}/>{t("We are VAT registered — print tax invoices", "مسجلون في ضريبة القيمة المضافة — اطبع فواتير ضريبية")}</label>}
        </div>
      </fieldset>)}
      <fieldset>
        <legend>{t("Document design", "تصميم المستندات")}</legend>
        <div className="company-grid">
          <div className="logo-box">
            <span>{t("Logo", "الشعار")}</span>
            {form.logoDataUrl ? <img src={form.logoDataUrl} alt={t("Company logo", "شعار الشركة")}/> : <span className="orb-muted">{t("No logo yet", "لا يوجد شعار بعد")}</span>}
            <div className="row"><label className="file">{t("Upload logo", "رفع الشعار")}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseLogo}/></label>
              {form.logoDataUrl && <button type="button" onClick={() => { set("logoDataUrl", null); setLogoChanged(true); }}>{t("Remove", "إزالة")}</button>}</div>
          </div>
          <label>{t("Brand colour", "لون الهوية")}<input type="color" value={form.brandColor} onChange={(event) => set("brandColor", event.currentTarget.value)}/></label>
          <label>{t("Document language", "لغة المستندات")}<select value={form.documentLanguage} onChange={(event) => set("documentLanguage", event.currentTarget.value)}>
            <option value="BILINGUAL">{t("English and Arabic side by side", "إنجليزي وعربي جنباً إلى جنب")}</option>
            <option value="EN">{t("English", "الإنجليزية")}</option>
            <option value="AR">{t("Arabic", "العربية")}</option>
          </select></label>
        </div>
      </fieldset>
      <div className="company-actions">
        <button type="submit" className="orb-button-filled" disabled={busy}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Save", "حفظ")}</button>
        <button type="button" onClick={() => setPreview((value) => !value)}>{preview ? t("Hide preview", "إخفاء المعاينة") : t("Preview an invoice", "معاينة فاتورة")}</button>
        {settings.updatedAt && <span className="orb-muted">{t("Last saved", "آخر حفظ")} {new Date(settings.updatedAt).toLocaleString(ar ? "ar-AE" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>}
      </div>
    </form>
    {preview && <div className="company-preview" aria-label={t("Invoice preview", "معاينة الفاتورة")}><SamplePreview company={form}/></div>}
  </>);
}

function SamplePreview({ company }: { readonly company: Company }) {
  const L = labeler(company.documentLanguage);
  const tax = company.vatRegistered;
  return <DocumentFrame company={company} titleEn={tax ? "Tax Invoice" : "Invoice"} titleAr={tax ? "فاتورة ضريبية" : "فاتورة"}
    party={{ headingEn: "Bill to", headingAr: "فاتورة إلى", name: "Sample Customer LLC", lines: ["Dubai, UAE"] }}
    meta={[["Invoice no.", "رقم الفاتورة", "INV-2026-000001"], ["Invoice date", "تاريخ الفاتورة", "20 Nov 2026"], ["Due date", "تاريخ الاستحقاق", "20 Dec 2026"]]}
    totals={<Totals label={L} rows={[["Subtotal (excl. VAT)", "الإجمالي قبل الضريبة", "AED 10,000.00"], [`VAT ${tax ? Number(company.standardVatRate) : 0}%`, "الضريبة", `AED ${fmt(tax ? 10000 * Number(company.standardVatRate) / 100 : 0)}`], ["Total", "الإجمالي", `AED ${fmt(10000 * (1 + (tax ? Number(company.standardVatRate) / 100 : 0)))}`, true]]}/>}>
    <table><thead><tr><th>#</th><th>{L("Description", "الوصف")}</th><th className="num">{L("Qty", "الكمية")}</th><th className="num">{L("Rate", "السعر")}</th><th className="num">{L("Amount", "المبلغ")}</th></tr></thead>
      <tbody><tr><td>1</td><td>Sample item</td><td className="num">2</td><td className="num">5,000.00</td><td className="num">10,000.00</td></tr></tbody></table>
  </DocumentFrame>;
}


const STYLES = `
  .orb-company .company-banner{padding:12px 16px;border-radius:14px;margin-block:12px;background:var(--orb-color-surface-container)}
  .orb-erp.orb-company .company-banner[data-tone=error]{background:var(--orb-color-error-container)!important}
  .orb-erp.orb-company .company-banner[data-tone=success]{background:#e6f4ea!important;color:#0d3d17}
  .orb-company .company-form{display:grid;gap:16px;max-inline-size:960px}
  .orb-company fieldset{border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:16px 18px;margin:0}
  .orb-company legend{font-weight:700;padding:0 6px}
  .orb-company .company-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
  .orb-company label{display:grid;gap:4px;font-weight:600;font-size:.88rem}
  .orb-company label.wide{grid-column:1/-1}
  .orb-company label.check{display:flex;gap:8px;align-items:center;grid-column:1/-1;font-weight:500}
  .orb-company .logo-box{display:grid;gap:8px;font-weight:600;font-size:.88rem}
  .orb-company .logo-box img{max-inline-size:180px;max-block-size:90px;object-fit:contain;border:1px solid var(--orb-color-outline-variant);border-radius:10px;padding:6px;background:#fff}
  .orb-company .logo-box .row{display:flex;gap:8px;align-items:center}
  .orb-company label.file{display:inline-flex;align-items:center;padding:8px 14px;border-radius:999px;border:1px solid var(--orb-color-outline-variant);cursor:pointer}
  .orb-company label.file input{position:absolute;inline-size:1px;block-size:1px;opacity:0}
  .orb-company input[type=color]{inline-size:64px;block-size:40px;padding:2px}
  .orb-company .company-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .orb-erp.orb-company button{padding:8px 16px;font:inherit;font-weight:700}
  .orb-company .company-preview{margin-block:16px;border-radius:16px;overflow:hidden}
`;
