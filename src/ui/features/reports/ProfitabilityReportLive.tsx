"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EnterpriseStyles, ErpPageHeader } from "../admin/EnterpriseUx";
import { problemOf, type ApiProblem } from "../../session-client";

/** Project profitability across all active projects, from the database: the four margins side by side with totals per currency. */
interface M { amount: string; aedAmount: string | null; marginPercent: string | null }
interface Row { project: { id: string; reference: string; customerName: string; lifecycleState: string; currency: string }; warnings: number; expected: M; shipped: M; actual: M; cash: M }
type Key = "expected" | "shipped" | "actual" | "cash";
const KEYS: readonly Key[] = ["expected", "shipped", "actual", "cash"];
const fmt = (value: string | number) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ProfitabilityReportLive({ locale, initialQuery = "" }: { readonly locale: "en" | "ar"; readonly initialQuery?: string }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const load = useCallback(async () => {
    const response = await fetch("/api/reports/project-profitability", { cache: "no-store" });
    if (!response.ok) { setProblem(await problemOf(response)); return; }
    setProblem(null); setRows(((await response.json()) as { rows: Row[] }).rows);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => (rows ?? []).filter((r) => !query.trim() || `${r.project.reference} ${r.project.customerName}`.toLowerCase().includes(query.trim().toLowerCase())), [rows, query]);
  const totals = useMemo(() => {
    const by = new Map<string, Record<Key, number>>();
    for (const r of shown) {
      const x = by.get(r.project.currency) ?? { expected: 0, shipped: 0, actual: 0, cash: 0 };
      for (const k of KEYS) x[k] += Math.round(Number(r[k].amount) * 100);
      by.set(r.project.currency, x);
    }
    return [...by.entries()].sort();
  }, [shown]);
  const labels: Record<Key, string> = { expected: t("Expected", "المتوقع"), shipped: t("Shipped", "المشحون"), actual: t("Actual", "الفعلي"), cash: t("Cash", "النقد") };
  const q = `?locale=${locale}`;

  return <section className="orb-erp orb-profit-report" dir={ar ? "rtl" : "ltr"} aria-labelledby="profitability-report-title">
    <EnterpriseStyles/><style>{STYLES}</style>
    <ErpPageHeader titleId="profitability-report-title" eyebrow={<a href={`/reports${q}`}>{t("Reports", "التقارير")}</a>} title={t("Project profitability report", "تقرير ربحية المشروع")}
      description={t("Expected = contracts · Shipped = confirmed shipments · Actual = invoices − approved expenses · Cash = received − paid. Each project is in its own currency.", "المتوقع = العقود · المشحون = الشحنات المؤكدة · الفعلي = الفواتير − المصروفات المعتمدة · النقد = المحصّل − المدفوع. كل مشروع بعملته.")}/>
    <form role="form" aria-label={t("Profitability report filters", "مرشحات تقرير الربحية")} className="report-filters" onSubmit={(e) => e.preventDefault()}>
      <label>{t("Project or customer", "المشروع أو العميل")}<input type="search" value={query} onChange={(e) => setQuery(e.target.value)}/></label>
    </form>
    {problem ? <p role="alert" className="report-alert">{problem.status === 403 ? t("This report is for finance and owners.", "هذا التقرير للمالية والمالك.") : t("The report could not be loaded.", "تعذر تحميل التقرير.")} {problem.status !== 403 && <button type="button" onClick={() => void load()}>{t("Try again", "حاول مرة أخرى")}</button>}</p>
      : rows === null ? <p role="status" aria-busy="true">{t("Calculating…", "جارٍ الحساب…")}</p>
      : shown.length === 0 ? <p className="orb-muted">{rows.length === 0 ? t("No active projects yet.", "لا توجد مشاريع نشطة بعد.") : t("No projects match.", "لا توجد مشاريع مطابقة.")}</p>
      : <div className="report-scroll" data-testid="profitability-rows"><table>
        <thead><tr><th>{t("Project", "المشروع")}</th><th>{t("Currency", "العملة")}</th>{KEYS.map((k) => <th key={k}>{labels[k]}</th>)}<th>{t("Check", "مراجعة")}</th></tr></thead>
        <tbody>{shown.map((r) => <tr key={r.project.id}>
          <td><a href={`/projects/${r.project.id}/profit${q}`}><bdi>{r.project.reference}</bdi></a><br/><small>{r.project.customerName}</small></td>
          <td><bdi>{r.project.currency}</bdi></td>
          {KEYS.map((k) => <td key={k} data-tone={Number(r[k].amount) < 0 ? "negative" : undefined}><bdi>{fmt(r[k].amount)}</bdi>{r[k].marginPercent !== null && <><br/><small><bdi>{r[k].marginPercent}%</bdi></small></>}</td>)}
          <td>{r.warnings > 0 ? <a href={`/projects/${r.project.id}/profit${q}`}>{t(`${r.warnings} point(s)`, `${r.warnings} نقطة`)}</a> : "—"}</td>
        </tr>)}</tbody>
        <tfoot>{totals.map(([cur, x]) => <tr key={cur}><th>{t("Total", "الإجمالي")}</th><th><bdi>{cur}</bdi></th>{KEYS.map((k) => <th key={k}><bdi>{fmt(x[k] / 100)}</bdi></th>)}<th/></tr>)}</tfoot>
      </table></div>}
  </section>;
}

const STYLES = `
  .orb-profit-report .report-filters{display:flex;gap:12px;margin-block:12px}
  .orb-profit-report .report-filters label{display:grid;gap:4px;font-weight:600;font-size:.88rem}
  .orb-profit-report .report-alert{padding:10px 12px;border-radius:12px;background:var(--orb-color-error-container)}
  .orb-profit-report .report-scroll{overflow-x:auto}
  .orb-profit-report table{inline-size:100%;border-collapse:collapse;font-size:.88rem}
  .orb-profit-report th,.orb-profit-report td{text-align:start;padding:8px;border-block-end:1px solid var(--orb-color-outline-variant);vertical-align:top}
  .orb-profit-report [data-tone=negative]{color:var(--orb-color-error)}
`;
