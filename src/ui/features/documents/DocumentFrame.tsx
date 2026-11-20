"use client";

import type { ReactNode } from "react";

/**
 * The one professional layout every printed document uses — tax invoice, statement, receipts, contracts, purchase
 * orders, commercial invoice, packing list. The company's details come from Account and settings, like QuickBooks'
 * custom form styles. Labels print in English and Arabic side by side, or in one language if the company chose so.
 */
export interface DocumentCompany {
  readonly legalNameEn: string; readonly legalNameAr: string; readonly addressEn: string; readonly addressAr: string;
  readonly phone: string; readonly email: string; readonly website: string; readonly trn: string; readonly licenceNo: string;
  readonly bankName: string; readonly bankAccountName: string; readonly iban: string; readonly swift: string; readonly bankCurrency: string;
  readonly termsEn: string; readonly termsAr: string; readonly footerEn: string; readonly footerAr: string;
  readonly brandColor: string; readonly documentLanguage: "BILINGUAL" | "EN" | "AR"; readonly vatRegistered: boolean; readonly logoDataUrl: string | null;
}

export type Label = (en: string, ar: string) => ReactNode;

/** Builds the label helper for the company's chosen document language. */
export function labeler(language: DocumentCompany["documentLanguage"]): Label {
  if (language === "EN") return (en) => en;
  if (language === "AR") return (_en, ar) => ar;
  return (en, ar) => <>{en} <span className="doc-ar">· <bdi lang="ar" dir="rtl">{ar}</bdi></span></>;
}

export const fmt = (value: string | number, digits = 2) => Number(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const date = (value: string | null | undefined) => value ? new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "";

export function DocumentFrame({ company, titleEn, titleAr, meta, party, children, totals, notes, stamp, signature = true, toolbar }: {
  readonly company: DocumentCompany; readonly titleEn: string; readonly titleAr: string;
  /** Right-hand box: document number, dates, references. */
  readonly meta: readonly (readonly [string, string, ReactNode])[];
  /** Left-hand box: who the document is for. */
  readonly party: { readonly headingEn: string; readonly headingAr: string; readonly name: ReactNode; readonly lines: readonly ReactNode[] };
  readonly children: ReactNode; readonly totals?: ReactNode; readonly notes?: ReactNode; readonly stamp?: string | null; readonly signature?: boolean; readonly toolbar?: ReactNode;
}) {
  const L = labeler(company.documentLanguage);
  const rtl = company.documentLanguage === "AR";
  const color = company.brandColor;
  const bank = company.iban || company.bankName;
  const terms = company.documentLanguage === "AR" ? company.termsAr : company.documentLanguage === "EN" ? company.termsEn : [company.termsEn, company.termsAr].filter(Boolean).join("\n");
  const footer = company.documentLanguage === "AR" ? company.footerAr : company.documentLanguage === "EN" ? company.footerEn : [company.footerEn, company.footerAr].filter(Boolean).join(" · ");
  return <div className="doc-shell">
    <style>{documentStyles(color)}</style>
    {toolbar && <div className="doc-toolbar">{toolbar}</div>}
    <article className="doc" dir={rtl ? "rtl" : "ltr"} lang={rtl ? "ar" : "en"}>
      {stamp && <div className="doc-stamp">{stamp}</div>}
      <header className="doc-head">
        <div className="doc-company">
          {company.logoDataUrl ? <img className="doc-logo" src={company.logoDataUrl} alt=""/> : null}
          <div>
            {company.documentLanguage !== "AR" && <>
              <div className="doc-company-name">{company.legalNameEn || "—"}</div>
              {company.addressEn && <div className="doc-muted doc-pre">{company.addressEn}</div>}
            </>}
            {company.documentLanguage === "AR" && <>
              <div className="doc-company-name">{company.legalNameAr || company.legalNameEn || "—"}</div>
              {company.addressAr && <div className="doc-muted doc-pre">{company.addressAr}</div>}
            </>}
            <div className="doc-muted">{[company.phone, company.email, company.website].filter(Boolean).join(" · ")}</div>
            <div className="doc-muted">{company.trn && <>{L("TRN", "الرقم الضريبي")} <bdi>{company.trn}</bdi></>}{company.trn && company.licenceNo && " · "}{company.licenceNo && <>{L("Licence", "الرخصة")} <bdi>{company.licenceNo}</bdi></>}</div>
          </div>
        </div>
        {company.documentLanguage === "BILINGUAL" && (company.legalNameAr || company.addressAr) && <div className="doc-company-ar" dir="rtl" lang="ar">
          {company.legalNameAr && <div className="doc-company-name">{company.legalNameAr}</div>}
          {company.addressAr && <div className="doc-muted doc-pre">{company.addressAr}</div>}
        </div>}
      </header>

      <div className="doc-title">
        {company.documentLanguage !== "AR" && <h1>{titleEn}</h1>}
        {company.documentLanguage !== "EN" && <h1 dir="rtl" lang="ar">{titleAr}</h1>}
      </div>

      <section className="doc-boxes">
        <div className="doc-box">
          <div className="doc-label">{L(party.headingEn, party.headingAr)}</div>
          <div className="doc-strong">{party.name}</div>
          {party.lines.filter(Boolean).map((line, index) => <div key={index}>{line}</div>)}
        </div>
        <dl className="doc-box doc-meta">
          {meta.filter(([, , value]) => value !== null && value !== undefined && value !== "").map(([en, arabic, value]) => <div key={en} className="doc-meta-row"><dt>{L(en, arabic)}</dt><dd><bdi>{value}</bdi></dd></div>)}
        </dl>
      </section>

      {children}

      {(totals || bank) && <section className="doc-bottom">
        <div className="doc-box doc-bank">
          {bank ? <>
            <div className="doc-label">{L("Bank details", "بيانات البنك")}</div>
            {company.bankName && <div>{company.bankName}{company.bankCurrency ? ` (${company.bankCurrency})` : ""}</div>}
            {company.bankAccountName && <div>{L("Account name", "اسم الحساب")}: {company.bankAccountName}</div>}
            {company.iban && <div>IBAN <bdi>{company.iban}</bdi></div>}
            {company.swift && <div>SWIFT <bdi>{company.swift}</bdi></div>}
          </> : null}
        </div>
        {totals && <div className="doc-totals">{totals}</div>}
      </section>}

      {notes && <section className="doc-notes">{notes}</section>}
      {terms && <section className="doc-notes"><div className="doc-label">{L("Terms and conditions", "الشروط والأحكام")}</div><div className="doc-pre">{terms}</div></section>}

      <footer className="doc-foot">
        {signature ? <div className="doc-sign"><div>{L("Authorised signature and stamp", "التوقيع والختم المعتمد")}</div><div className="doc-sign-line"/></div> : <div/>}
        <div className="doc-muted doc-foot-text">{footer}</div>
      </footer>
    </article>
  </div>;
}

/** Totals block rows: [label en, label ar, value, emphasise]. */
export function Totals({ rows, label }: { readonly rows: readonly (readonly [string, string, ReactNode, boolean?])[]; readonly label: Label }) {
  return <dl className="doc-total-list">{rows.map(([en, arabic, value, strong]) => <div key={en} className={strong ? "doc-total-strong" : undefined}><dt>{label(en, arabic)}</dt><dd><bdi>{value}</bdi></dd></div>)}</dl>;
}

export function PrintToolbar({ locale, onBack }: { readonly locale: "en" | "ar"; readonly onBack?: string }) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  return <>
    <button type="button" className="doc-primary" onClick={() => window.print()}>{t("Print or save as PDF", "طباعة أو حفظ PDF")}</button>
    {onBack && <a href={onBack}>{t("Back", "رجوع")}</a>}
    <span className="doc-hint">{t("To save a PDF, choose “Save as PDF” as the printer.", "لحفظ PDF اختر «حفظ كـ PDF» كطابعة.")}</span>
  </>;
}

function documentStyles(color: string) {
  return `
  .doc-shell{background:#eef1f5;padding:24px 12px;min-height:100%}
  .doc-toolbar{max-width:794px;margin:0 auto 12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  .doc-toolbar .doc-primary{background:${color};color:#fff;border:0;border-radius:999px;padding:10px 20px;font:inherit;font-weight:700;cursor:pointer}
  .doc-hint{color:#5b6470;font-size:.85rem}
  .doc{max-width:794px;min-height:1050px;margin:0 auto;background:#fff;color:#1b1f24;font:12.5px/1.55 "Segoe UI",Tahoma,Arial,sans-serif;padding:44px 48px;box-shadow:0 2px 14px rgba(0,0,0,.08);position:relative;display:flex;flex-direction:column;gap:18px}
  .doc .doc-ar{color:#5b6470;font-weight:400}
  .doc-head{display:flex;justify-content:space-between;gap:24px;padding-bottom:16px;border-bottom:3px solid ${color}}
  .doc-company{display:flex;gap:14px;align-items:flex-start}
  .doc-logo{max-width:120px;max-height:72px;object-fit:contain}
  .doc-company-name{font-size:17px;font-weight:700;color:${color}}
  .doc-company-ar{text-align:right}
  .doc-muted{color:#5b6470}
  .doc-pre{white-space:pre-line}
  .doc-title{display:flex;justify-content:space-between;align-items:baseline}
  .doc-title h1{margin:0;font-size:24px;letter-spacing:.02em;color:${color}}
  .doc-boxes{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .doc-box{background:#f5f7fa;border-radius:8px;padding:12px 14px;margin:0}
  .doc-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#5b6470;margin-bottom:4px;font-weight:700}
  .doc-strong{font-weight:700;font-size:14px}
  .doc-meta{display:grid;gap:3px}
  .doc-meta-row{display:grid;grid-template-columns:minmax(120px,auto) 1fr;gap:10px}
  .doc-meta dt{color:#5b6470}.doc-meta dd{margin:0;font-weight:600}
  .doc table{width:100%;border-collapse:collapse}
  .doc thead th{background:${color};color:#fff;font-weight:600;padding:8px 10px;text-align:start;font-size:11.5px}
  .doc thead th .doc-ar{color:rgba(255,255,255,.82)}
  .doc tbody td{padding:8px 10px;border-bottom:1px solid #e3e7ec;vertical-align:top}
  .doc .num{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}
  .doc-bottom{display:grid;grid-template-columns:1fr 360px;gap:16px;align-items:start}
  .doc-total-list{margin:0;display:grid;gap:4px}
  .doc-total-list>div{display:flex;justify-content:space-between;gap:12px}
  .doc-total-list dt{color:#5b6470}.doc-total-list dd{margin:0;font-variant-numeric:tabular-nums;white-space:nowrap}
  .doc-total-strong{border-top:2px solid ${color};padding-top:6px;margin-top:2px;font-weight:700;font-size:14px}
  .doc-total-strong dt{color:#1b1f24}
  .doc-notes{font-size:11.5px}
  .doc-foot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;gap:24px;padding-top:24px}
  .doc-sign-line{width:200px;border-bottom:1px solid #9aa3ad;height:34px}
  .doc-foot-text{text-align:end;max-width:50%}
  .doc-stamp{position:absolute;top:140px;inset-inline-end:48px;border:3px solid #b00020;color:#b00020;padding:6px 16px;font-weight:800;font-size:20px;transform:rotate(-8deg);opacity:.85}
  @media (max-width:700px){.doc{padding:22px}.doc-boxes,.doc-bottom{grid-template-columns:1fr}.doc-head{flex-direction:column}}
  @page{size:A4;margin:12mm}
  @media print{
    body *{visibility:hidden}
    .doc-shell,.doc-shell *{visibility:visible}
    .doc-shell{position:absolute;inset:0 auto auto 0;width:100%;background:#fff;padding:0}
    .doc-toolbar{display:none}
    .doc{box-shadow:none;max-width:none;min-height:auto;padding:0}
    .doc thead th,.doc-box,.doc-head{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }`;
}
