"use client";

import { useCallback, useEffect, useState } from "react";
import { EnterpriseStyles, ErpPageHeader } from "../admin/EnterpriseUx";
import { ProjectContextNavigation } from "../../navigation/ProjectContextNavigation";
import { problemOf, type ApiProblem } from "../../session-client";

/** A saved project's profit: four margins with their formulas and the documents behind each figure. */
type Key = "expected" | "shipped" | "actual" | "cash";
interface Measure { key: Key; amount: string; aedAmount: string | null; revenue: string; cost: string; marginPercent: string | null; formula: string; notIncluded: number }
interface Source { measure: Key; kind: string; id: string; reference: string; description: string; sign: 1 | -1; amount: string; currency: string; projectAmount: string | null; aedAmount: string | null; href: string | null }
interface Profit {
  project: { id: string; reference: string; customerName: string; lifecycleState: string; currency: string };
  rate: { aedPerUnit: string | null; source: "AED" | "RECORDED_AVERAGE" | "USD_PEG" | "UNAVAILABLE" };
  measures: Record<Key, Measure>; sources: Source[]; warnings: string[]; formulaVersion: string;
}

const ORDER: readonly Key[] = ["expected", "shipped", "actual", "cash"];
const TITLES: Record<Key, [string, string, string, string]> = {
  expected: ["Expected margin", "الهامش المتوقع", "From the contracts", "من العقود"],
  shipped: ["Shipped margin", "هامش المشحون", "From confirmed shipments", "من الشحنات المؤكدة"],
  actual: ["Actual margin", "الهامش الفعلي", "From invoices and approved expenses", "من الفواتير والمصروفات المعتمدة"],
  cash: ["Cash position", "صافي النقد", "Money received minus money paid", "المحصّل ناقص المدفوع"],
};
const FORMULAS_AR: Record<Key, string> = {
  expected: "قيمة عقد البيع − قيم عقود الشراء (الكمية × سعر الوحدة للنسخ السارية)",
  shipped: "شحنات العميل المؤكدة × سعر البيع − نفس الكميات × سعر شراء شحنات المورد المصدر",
  actual: "فواتير العملاء الصادرة − فواتير الموردين المعتمدة − المصروفات المعتمدة",
  cash: "المحصّل من العميل − المردود للعميل − المدفوع للموردين + المسترد من الموردين",
};
const KINDS: Record<string, [string, string]> = {
  SALES_CONTRACT: ["Sales contract", "عقد البيع"], PURCHASE_CONTRACT: ["Purchase contract", "عقد شراء"], SALES_SHIPMENT: ["Customer shipment", "شحنة عميل"],
  SALES_SHIPMENT_COST: ["Cost from supplier shipment", "تكلفة من شحنة المورد"], CUSTOMER_INVOICE: ["Customer invoice", "فاتورة عميل"], SUPPLIER_INVOICE: ["Supplier invoice", "فاتورة مورد"],
  EXPENSE: ["Expense", "مصروف"], CUSTOMER_CLAIM: ["Customer claim", "مطالبة عميل"], SUPPLIER_CLAIM: ["Supplier claim", "مطالبة على مورد"], CUSTOMER_RECEIPT: ["Receipt", "تحصيل"], CUSTOMER_REFUND: ["Refund to customer", "رد للعميل"], SUPPLIER_PAYMENT: ["Supplier payment", "دفعة مورد"], SUPPLIER_REFUND: ["Refund from supplier", "استرداد من مورد"],
};
const fmt = (value: string | number) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ProjectProfitWorkspace({ projectId, locale }: { readonly projectId: string; readonly locale: "en" | "ar" }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [data, setData] = useState<Profit | null>(null);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [open, setOpen] = useState<Key | null>("actual");
  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/profit`, { cache: "no-store" });
    if (!response.ok) { setProblem(await problemOf(response)); return; }
    setProblem(null); setData(await response.json() as Profit);
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const shell = (body: React.ReactNode) => <section className="orb-erp orb-profit" dir={ar ? "rtl" : "ltr"} aria-labelledby="profit-title">
    <EnterpriseStyles/><style>{STYLES}</style>
    <ProjectContextNavigation locale={locale} projectId={projectId} projectLabel={data?.project.reference} current="reports"/>
    {body}
  </section>;
  if (problem) return shell(<>
    <ErpPageHeader titleId="profit-title" eyebrow={t("Project", "المشروع")} title={problem.status === 403 ? t("Profit is for finance and owners", "الربحية للمالية والمالك") : problem.status === 404 ? t("Project not found", "المشروع غير موجود") : t("Profit unavailable", "الربحية غير متاحة")}
      description={problem.status === 403 ? t("Ask an owner or finance user for the project's margins.", "اطلب الهوامش من المالك أو المالية.") : t("Try again in a moment.", "حاول مرة أخرى بعد قليل.")}/>
    <p><button type="button" onClick={() => void load()}>{t("Try again", "حاول مرة أخرى")}</button></p>
  </>);
  if (!data) return shell(<><h1 id="profit-title" className="orb-sr-only">{t("Profit", "الربحية")}</h1><p role="status" aria-busy="true">{t("Calculating…", "جارٍ الحساب…")}</p></>);

  const cur = data.project.currency;
  const rateText = data.rate.source === "AED" ? t("Project is in AED.", "المشروع بالدرهم.")
    : data.rate.source === "RECORDED_AVERAGE" ? t(`AED figures use ${data.rate.aedPerUnit} AED per ${cur}, the average bank rate recorded on this project.`, `أرقام الدرهم بسعر ${data.rate.aedPerUnit} لكل ${cur}، وهو متوسط سعر البنك المسجل على المشروع.`)
    : data.rate.source === "USD_PEG" ? t("AED figures use the USD peg 3.6725 until a bank rate is recorded on this project.", "أرقام الدرهم بسعر الربط 3.6725 حتى يُسجل سعر بنك على المشروع.")
    : t(`No AED rate is available for ${cur} yet.`, `لا يوجد سعر درهم لعملة ${cur} بعد.`);

  return shell(<>
    <ErpPageHeader titleId="profit-title" eyebrow={<><bdi>{data.project.reference}</bdi><span>•</span>{data.project.customerName}</>} title={t("Profit", "الربحية")}
      description={t(`All figures in ${cur}. Each number shows how it is calculated and the documents behind it.`, `كل الأرقام بعملة ${cur}. كل رقم يوضح طريقة حسابه والمستندات وراءه.`)}/>
    <div className="profit-grid" data-testid="profit-measures">
      {ORDER.map((key) => {
        const m = data.measures[key];
        const negative = Number(m.amount) < 0;
        return <button key={key} type="button" className="profit-card" aria-pressed={open === key} aria-controls="profit-sources" onClick={() => setOpen(key)} data-measure={key}>
          <span className="label">{t(TITLES[key][0], TITLES[key][1])}</span>
          <strong data-tone={negative ? "negative" : undefined}><bdi>{cur} {fmt(m.amount)}</bdi></strong>
          <span className="meta">{m.marginPercent !== null ? <>{t("Margin", "الهامش")} <bdi>{m.marginPercent}%</bdi> · </> : null}{m.aedAmount !== null ? <bdi>AED {fmt(m.aedAmount)}</bdi> : t("AED not available", "الدرهم غير متاح")}</span>
          <span className="meta">{t(TITLES[key][2], TITLES[key][3])}</span>
        </button>;
      })}
    </div>
    <p className="orb-muted profit-rate">{rateText}</p>
    {data.warnings.length > 0 && <ul className="profit-warnings" aria-label={t("Points to check", "نقاط للمراجعة")}>{data.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}

    {open && <section id="profit-sources" className="profit-card-detail" aria-labelledby="sources-title">
      <h2 id="sources-title">{t(TITLES[open][0], TITLES[open][1])}</h2>
      <p className="formula"><strong>{t("Formula:", "المعادلة:")}</strong> {ar ? FORMULAS_AR[open] : data.measures[open].formula}</p>
      {data.sources.filter((s) => s.measure === open).length === 0 ? <p className="orb-muted">{t("Nothing counts here yet.", "لا يوجد ما يُحتسب هنا بعد.")}</p> : <div className="profit-scroll"><table>
        <thead><tr><th>{t("Document", "المستند")}</th><th>{t("Details", "التفاصيل")}</th><th>{t("Amount", "المبلغ")}</th><th>{cur}</th><th>AED</th></tr></thead>
        <tbody>{data.sources.filter((s) => s.measure === open).map((s) => <tr key={`${s.kind}:${s.id}`}>
          <td>{KINDS[s.kind]?.[ar ? 1 : 0] ?? s.kind}<br/>{s.href ? <a href={`${s.href}?locale=${locale}`}><bdi>{s.reference}</bdi></a> : <bdi>{s.reference}</bdi>}</td>
          <td>{s.description}</td>
          <td><bdi>{s.currency} {fmt(s.amount)}</bdi></td>
          <td>{s.projectAmount === null ? <em>{t("not included", "غير محتسب")}</em> : <bdi data-tone={s.sign < 0 ? "negative" : undefined}>{s.sign < 0 ? "−" : "+"}{fmt(s.projectAmount)}</bdi>}</td>
          <td>{s.aedAmount === null ? "—" : <bdi>{s.sign < 0 ? "−" : "+"}{fmt(s.aedAmount)}</bdi>}</td>
        </tr>)}</tbody>
        <tfoot><tr><th colSpan={3}>{t("Total", "الإجمالي")}</th><th><bdi>{fmt(data.measures[open].amount)}</bdi></th><th>{data.measures[open].aedAmount === null ? "—" : <bdi>{fmt(data.measures[open].aedAmount!)}</bdi>}</th></tr></tfoot>
      </table></div>}
    </section>}
    <p className="orb-muted"><small>{t("Calculation version", "إصدار الحساب")} <bdi>{data.formulaVersion}</bdi></small></p>
  </>);
}

const STYLES = `
  .orb-profit .profit-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-block:16px}
  .orb-erp.orb-profit .profit-card{display:grid;gap:6px;text-align:start;padding:16px;border-radius:16px;border:1px solid var(--orb-color-outline-variant)!important;background:var(--orb-color-surface-bright)!important;color:var(--orb-color-on-surface)!important;cursor:pointer;font:inherit;box-shadow:none;min-height:0}
  .orb-erp.orb-profit .profit-card[aria-pressed=true]{border-color:var(--orb-color-primary)!important;box-shadow:inset 0 0 0 1px var(--orb-color-primary)}
  .orb-profit .profit-card .label{font-weight:700;font-size:.9rem}
  .orb-profit .profit-card strong{font-size:1.35rem}
  .orb-profit [data-tone=negative]{color:var(--orb-color-error)}
  .orb-profit .profit-card .meta{font-size:.82rem;color:var(--orb-color-on-surface-variant)}
  .orb-profit .profit-warnings{padding:12px 28px;border-radius:14px;background:var(--orb-color-surface-container);margin-block:12px}
  .orb-profit .profit-card-detail{border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:16px;margin-block:12px}
  .orb-profit .profit-card-detail h2{font-size:1rem;margin:0 0 6px}
  .orb-profit .formula{font-size:.88rem;margin:0 0 10px}
  .orb-profit .profit-scroll{overflow-x:auto}
  .orb-profit table{inline-size:100%;border-collapse:collapse;font-size:.88rem}
  .orb-profit th,.orb-profit td{text-align:start;padding:8px;border-block-end:1px solid var(--orb-color-outline-variant);vertical-align:top}
  .orb-profit tfoot th{border-block-end:0}
  @media (max-width:900px){.orb-profit .profit-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media (max-width:520px){.orb-profit .profit-grid{grid-template-columns:1fr}}
`;
