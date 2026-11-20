"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EnterpriseStyles, ErpPageHeader } from "../admin/EnterpriseUx";
import { problemOf, type ApiProblem } from "../../session-client";
import { domainTerm } from "../../../platform/i18n/domain-terminology";

/** Accounts operational report from the database: every invoice, collection, payment and expense in a date range, with exact totals. */
interface Item { id: string; projectId: string; type: "SALES_INVOICE" | "SUPPLIER_INVOICE" | "COLLECTION" | "SUPPLIER_PAYMENT" | "EXPENSE"; occurredOn: string; state: string; reference: string; currency: string; amount: string; outstandingAmount: string; projectReference: string; partyName: string; href: string }
interface Report { from: string | null; to: string | null; items: Item[]; summary: Record<string, string> }
const TYPE_TERMS = { SALES_INVOICE: "salesInvoice", SUPPLIER_INVOICE: "supplierInvoice", COLLECTION: "collection", SUPPLIER_PAYMENT: "supplierPayment", EXPENSE: "expense" } as const;
const ORDER = ["SALES_INVOICE", "SUPPLIER_INVOICE", "COLLECTION", "SUPPLIER_PAYMENT", "EXPENSE"] as const;
const fmt = (value: string | number) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function AccountsReportLive({ locale, from: initialFrom, to: initialTo }: { readonly locale: "en" | "ar"; readonly from?: string; readonly to?: string }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [range, setRange] = useState({ from: initialFrom ?? "", to: initialTo ?? "" });
  const [report, setReport] = useState<Report | null>(null);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const load = useCallback(async () => {
    setReport(null); setProblem(null);
    const params = new URLSearchParams(Object.entries(range).filter(([, v]) => v));
    const response = await fetch(`/api/reports/accounts${params.size ? `?${params}` : ""}`, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) { setProblem(response ? await problemOf(response) : { status: 503 } as ApiProblem); return; }
    setReport(await response.json() as Report);
  }, [range]);
  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    const by = new Map<string, Record<string, [string, string]>>();
    for (const [key, value] of Object.entries(report?.summary ?? {})) {
      const [currency, type, kind] = key.split(".");
      const row = by.get(currency) ?? {};
      const pair = row[type] ?? ["0", "0"];
      if (kind === "amount") pair[0] = value; else pair[1] = value;
      row[type] = pair; by.set(currency, row);
    }
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [report]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setRange({ from: String(form.get("from") ?? ""), to: String(form.get("to") ?? "") });
  };

  return <section className="orb-erp orb-accounts-report" dir={ar ? "rtl" : "ltr"} aria-labelledby="accounts-report-title">
    <EnterpriseStyles/><style>{STYLES}</style>
    <ErpPageHeader titleId="accounts-report-title" eyebrow={<a href={`/reports?locale=${locale}`}>{t("Reports", "التقارير")}</a>} title={t("Accounts operational report", "تقرير الحسابات التشغيلي")}
      description={t("Invoices, collections, supplier payments and expenses of all projects, with operational totals per currency.", "الفواتير والتحصيلات ومدفوعات الموردين والمصروفات لكل المشاريع، مع إجماليات تشغيلية لكل عملة.")}/>
    <form role="form" aria-label={t("Accounts report filters", "مرشحات تقرير الحسابات")} className="report-filters" onSubmit={submit}>
      <label>{t("From", "من")}<input type="date" name="from" defaultValue={range.from}/></label>
      <label>{t("To", "إلى")}<input type="date" name="to" defaultValue={range.to}/></label>
      <button type="submit">{t("Apply", "تطبيق")}</button>
    </form>
    {problem ? <p role="alert" className="report-alert">{problem.status === 403 ? t("This report is for finance and owners.", "هذا التقرير للمالية والمالك.") : problem.status === 422 ? t("Check the dates.", "تحقق من التواريخ.") : t("The report could not be loaded.", "تعذر تحميل التقرير.")}</p>
      : report === null ? <p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p>
      : report.items.length === 0 ? <p className="orb-muted">{t("Nothing recorded in this period.", "لا توجد سجلات في هذه الفترة.")}</p>
      : <>
        {totals.map(([currency, row]) => <section key={currency} className="report-totals" aria-label={currency} data-testid={`accounts-report-${currency}`}>
          <h2><bdi>{currency}</bdi></h2>
          <dl>{ORDER.filter((type) => row[type]).map((type) => <div key={type}><dt>{domainTerm(TYPE_TERMS[type], locale)}</dt><dd><bdi>{fmt(row[type][0])}</bdi>{Number(row[type][1]) > 0 && <small> · {t("open", "مفتوح")} <bdi>{fmt(row[type][1])}</bdi></small>}</dd></div>)}</dl>
        </section>)}
        <div className="report-scroll" data-testid="accounts-report-rows"><table>
          <thead><tr><th>{t("Date", "التاريخ")}</th><th>{t("Type", "النوع")}</th><th>{t("Reference", "المرجع")}</th><th>{t("Project", "المشروع")}</th><th>{t("Party", "الطرف")}</th><th>{t("Amount", "المبلغ")}</th><th>{t("Open", "مفتوح")}</th></tr></thead>
          <tbody>{report.items.map((r) => <tr key={`${r.type}:${r.id}`}>
            <td><bdi>{r.occurredOn}</bdi></td><td>{domainTerm(TYPE_TERMS[r.type], locale)}</td>
            <td><a href={`${r.href}?locale=${locale}`}><bdi>{r.reference}</bdi></a></td>
            <td><a href={`/projects/${r.projectId}/overview?locale=${locale}`}><bdi>{r.projectReference}</bdi></a></td>
            <td>{r.partyName}</td><td><bdi>{r.currency} {fmt(r.amount)}</bdi></td><td>{Number(r.outstandingAmount) > 0 ? <bdi>{fmt(r.outstandingAmount)}</bdi> : "—"}</td>
          </tr>)}</tbody>
        </table></div>
      </>}
  </section>;
}

const STYLES = `
  .orb-accounts-report .report-filters{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin-block:12px}
  .orb-accounts-report .report-filters label{display:grid;gap:4px;font-weight:600;font-size:.88rem}
  .orb-accounts-report .report-alert{padding:10px 12px;border-radius:12px;background:var(--orb-color-error-container)}
  .orb-accounts-report .report-totals{border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:12px 16px;margin-block:12px}
  .orb-accounts-report .report-totals h2{font-size:1rem;margin:0 0 6px}
  .orb-accounts-report .report-totals dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:0}
  .orb-accounts-report .report-totals dt{font-size:.82rem;color:var(--orb-color-on-surface-variant)}
  .orb-accounts-report .report-totals dd{margin:0;font-weight:700}
  .orb-accounts-report .report-scroll{overflow-x:auto}
  .orb-accounts-report table{inline-size:100%;border-collapse:collapse;font-size:.88rem}
  .orb-accounts-report th,.orb-accounts-report td{text-align:start;padding:8px;border-block-end:1px solid var(--orb-color-outline-variant);vertical-align:top;overflow-wrap:anywhere}
`;
