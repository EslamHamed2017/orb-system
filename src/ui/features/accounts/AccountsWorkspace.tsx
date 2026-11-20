"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EnterpriseStyles, ErpPageHeader, Kpi } from "../admin/EnterpriseUx";
import { problemOf, type ApiProblem } from "../../session-client";
import { domainTerm } from "../../../platform/i18n/domain-terminology";

/**
 * Accounts across all projects, read live from the database for the signed-in company (Owner and Finance).
 * `view="hub"` shows totals per currency and what is still open; the other views list one record type.
 */
export type AccountsView = "hub" | "sales-invoices" | "supplier-invoices" | "collections" | "supplier-payments" | "expenses";
interface Record_ { id: string; projectId: string; type: string; occurredOn: string; state: string; reference: string; currency: string; amount: string; outstandingAmount: string; projectReference: string; partyName: string; documentId: string | null; href: string }
interface Section { currency: string; salesInvoiced: string; salesOutstanding: string; supplierInvoiced: string; supplierOutstanding: string; collections: string; supplierPayments: string; expenses: string; netOperationalCash: string }

/** Tab labels use the frozen bilingual domain terms (Sales invoice / فاتورة مبيعات, …). */
const TABS: readonly [AccountsView, string, string][] = [
  ["hub", "Overview", "نظرة عامة"],
  ["sales-invoices", domainTerm("salesInvoice", "en"), domainTerm("salesInvoice", "ar")],
  ["supplier-invoices", domainTerm("supplierInvoice", "en"), domainTerm("supplierInvoice", "ar")],
  ["collections", domainTerm("collection", "en"), domainTerm("collection", "ar")],
  ["supplier-payments", domainTerm("supplierPayment", "en"), domainTerm("supplierPayment", "ar")],
  ["expenses", domainTerm("expense", "en"), domainTerm("expense", "ar")],
];
const STATES: Record<string, [string, string, string]> = {
  DRAFT: ["Draft", "مسودة", "warning"], PENDING_APPROVAL: ["Waiting for approval", "بانتظار الاعتماد", "warning"], ISSUED: ["Issued", "صادرة", "success"],
  CONFIRMED: ["Approved", "معتمدة", "success"], APPROVED: ["Approved", "معتمد", "success"], REJECTED: ["Rejected", "مرفوض", "error"], CANCELLED: ["Cancelled", "ملغى", "error"],
  PARTIALLY_ALLOCATED: ["Partly matched", "مطابق جزئياً", "warning"], FULLY_ALLOCATED: ["Matched", "مطابق", "success"], REVERSED: ["Reversed", "معكوس", "error"],
};
const fmt = (value: string | number) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function AccountsWorkspace({ locale, view, projectId }: { readonly locale: "en" | "ar"; readonly view: AccountsView; readonly projectId?: string }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [records, setRecords] = useState<Record_[] | null>(null);
  const [sections, setSections] = useState<Section[] | null>(null);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [query, setQuery] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const scope = projectId ? `projectId=${encodeURIComponent(projectId)}` : "";
  const load = useCallback(async () => {
    setProblem(null);
    const urls = view === "hub" ? [`/api/accounts/summary${scope ? `?${scope}` : ""}`] : [`/api/accounts/${view}${scope ? `?${scope}` : ""}`];
    const response = await fetch(urls[0], { cache: "no-store" }).catch(() => null);
    if (!response?.ok) { setProblem(response ? await problemOf(response) : { status: 503, code: "DEPENDENCY_UNAVAILABLE" } as ApiProblem); return; }
    const body = await response.json();
    if (view === "hub") setSections((body as { currencySections: Section[] }).currencySections); else setRecords((body as { items: Record_[] }).items);
  }, [view, scope]);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => (records ?? []).filter((r) => (!openOnly || Number(r.outstandingAmount) > 0)
    && (!query.trim() || `${r.reference} ${r.projectReference} ${r.partyName}`.toLowerCase().includes(query.trim().toLowerCase()))), [records, query, openOnly]);
  const totals = useMemo(() => {
    const by = new Map<string, [number, number]>();
    for (const r of shown.filter((x) => !["CANCELLED", "REJECTED", "REVERSED"].includes(x.state))) { const v = by.get(r.currency) ?? [0, 0]; by.set(r.currency, [v[0] + Math.round(Number(r.amount) * 100), v[1] + Math.round(Number(r.outstandingAmount) * 100)]); }
    return [...by.entries()].sort();
  }, [shown]);
  const q = (path: string) => `${path}?locale=${locale}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""}`;
  const title = TABS.find(([v]) => v === view)!;
  const openLabel = view === "sales-invoices" || view === "supplier-invoices" ? t("Due", "المتبقي") : view === "expenses" ? null : t("Unmatched", "غير مطابق");

  return <section className="orb-erp orb-accounts" dir={ar ? "rtl" : "ltr"} aria-labelledby="accounts-title">
    <EnterpriseStyles/><style>{STYLES}</style>
    <ErpPageHeader titleId="accounts-title" eyebrow={view === "hub" ? t("Accounts", "الحسابات") : ["sales-invoices", "collections"].includes(view) ? t("Sales", "المبيعات") : t("Expenses", "المصروفات")} title={view === "hub" ? t("Accounts", "الحسابات") : t(title[1], title[2])}
      description={t("Live records of all projects for your company. Operational totals, not a general ledger.", "سجلات فعلية لكل مشاريع شركتك. أرقام تشغيلية وليست دفتر أستاذ عام.")}/>
    {/* Sales and Expenses pages get their tabs from the app menu; the overview keeps the full list. */}
    {view === "hub" && <nav className="accounts-tabs" aria-label={t("Accounts sections", "أقسام الحسابات")}>
      {TABS.map(([v, en, a]) => <a key={v} href={q(v === "hub" ? "/accounts" : `/accounts/${v}`)} aria-current={v === view ? "page" : undefined}>{t(en, a)}</a>)}
      <a href={`/reports/accounts?locale=${locale}`}>{t("Accounts report", "تقرير الحسابات")}</a>
    </nav>}
    {projectId && <p className="orb-muted">{t("Showing one project.", "عرض مشروع واحد.")} <a href={`${view === "hub" ? "/accounts" : `/accounts/${view}`}?locale=${locale}`}>{t("Show all projects", "عرض كل المشاريع")}</a></p>}

    {problem ? <p role="alert" className="accounts-alert">{problem.status === 403 ? t("Accounts are for finance and owners.", "الحسابات للمالية والمالك.") : t("Accounts could not be loaded.", "تعذر تحميل الحسابات.")} {problem.status !== 403 && <button type="button" onClick={() => void load()}>{t("Try again", "حاول مرة أخرى")}</button>}</p>
      : view === "hub" ? (sections === null ? <p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p>
        : sections.length === 0 ? <p className="orb-muted">{t("No invoices, payments or expenses yet. They are recorded on the shipment and project pages.", "لا توجد فواتير أو مدفوعات أو مصروفات بعد. تُسجّل من صفحات الشحنات والمشاريع.")}</p>
        : sections.map((s) => <section key={s.currency} className="accounts-currency" aria-label={s.currency} data-testid={`accounts-${s.currency}`}>
          <h2><bdi>{s.currency}</bdi></h2>
          <div className="orb-summary-grid">
            <Kpi label={t("Customers owe", "مستحق على العملاء")} value={<bdi>{fmt(s.salesOutstanding)}</bdi>} detail={t(`Invoiced ${fmt(s.salesInvoiced)}`, `المفوتر ${fmt(s.salesInvoiced)}`)}/>
            <Kpi label={t("We owe suppliers", "مستحق للموردين")} value={<bdi>{fmt(s.supplierOutstanding)}</bdi>} detail={t(`Invoiced ${fmt(s.supplierInvoiced)}`, `المفوتر ${fmt(s.supplierInvoiced)}`)}/>
            <Kpi label={t("Received", "المحصّل")} value={<bdi>{fmt(s.collections)}</bdi>} detail={t(`Paid to suppliers ${fmt(s.supplierPayments)}`, `المدفوع للموردين ${fmt(s.supplierPayments)}`)}/>
            <Kpi label={t("Net operational cash", "صافي النقد التشغيلي")} value={<bdi>{fmt(s.netOperationalCash)}</bdi>} detail={t(`Approved expenses ${fmt(s.expenses)}`, `المصروفات المعتمدة ${fmt(s.expenses)}`)}/>
          </div>
        </section>))
      : <>
        <div className="accounts-tools">
          <label>{t("Search", "بحث")}<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Reference, project or party", "مرجع أو مشروع أو طرف")}/></label>
          {openLabel && <label className="accounts-check"><input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)}/>{view === "sales-invoices" || view === "supplier-invoices" ? t("Only unpaid", "غير المدفوعة فقط") : t("Only unmatched", "غير المطابقة فقط")}</label>}
        </div>
        {records === null ? <p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p>
          : shown.length === 0 ? <p className="orb-muted">{records.length === 0 ? t("Nothing recorded yet.", "لم يُسجّل شيء بعد.") : t("No records match.", "لا توجد سجلات مطابقة.")}</p>
          : <div className="accounts-scroll" data-testid="accounts-records"><table>
            <thead><tr><th>{t("Date", "التاريخ")}</th><th>{view === "expenses" ? t("Category", "الفئة") : t("Reference", "المرجع")}</th><th>{t("Project", "المشروع")}</th><th>{view === "sales-invoices" || view === "collections" ? t("Customer", "العميل") : view === "expenses" ? t("Paid to", "المدفوع له") : t("Supplier", "المورد")}</th><th>{t("Status", "الحالة")}</th><th>{t("Amount", "المبلغ")}</th>{openLabel && <th>{openLabel}</th>}</tr></thead>
            <tbody>{shown.map((r) => { const st = STATES[r.state] ?? [r.state, r.state, "warning"]; return <tr key={r.id}>
              <td><bdi>{r.occurredOn}</bdi></td>
              <td><a href={`${r.href}?locale=${locale}`}><bdi>{r.reference}</bdi></a>{r.documentId && <><br/><small><a href={`/api/evidence/${r.documentId}/content`} target="_blank" rel="noreferrer">{t("Document", "المستند")}</a></small></>}</td>
              <td><a href={`/projects/${r.projectId}/overview?locale=${locale}`}><bdi>{r.projectReference}</bdi></a></td>
              <td>{r.partyName}</td>
              <td><span className="orb-chip" data-tone={st[2]}>{st[ar ? 1 : 0]}</span></td>
              <td><bdi>{r.currency} {fmt(r.amount)}</bdi></td>
              {openLabel && <td>{Number(r.outstandingAmount) > 0 ? <strong><bdi>{fmt(r.outstandingAmount)}</bdi></strong> : "—"}</td>}
            </tr>; })}</tbody>
            <tfoot>{totals.map(([cur, [amount, open]]) => <tr key={cur}><th colSpan={5}>{t("Total", "الإجمالي")} <bdi>{cur}</bdi></th><th><bdi>{fmt(amount / 100)}</bdi></th>{openLabel && <th><bdi>{fmt(open / 100)}</bdi></th>}</tr>)}</tfoot>
          </table></div>}
      </>}
  </section>;
}

const STYLES = `
  .orb-accounts .accounts-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-block:12px}
  .orb-accounts .accounts-tabs a{padding:6px 12px;border-radius:999px;border:1px solid var(--orb-color-outline-variant);text-decoration:none;font-weight:600;font-size:.88rem}
  .orb-accounts .accounts-tabs a[aria-current=page]{background:var(--orb-color-primary);color:var(--orb-color-on-primary);border-color:transparent}
  .orb-accounts .accounts-currency{border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:16px;margin-block:12px}
  .orb-accounts .accounts-currency h2{font-size:1rem;margin:0 0 8px}
  .orb-accounts .accounts-tools{display:flex;flex-wrap:wrap;gap:16px;align-items:end;margin-block:12px}
  .orb-accounts .accounts-tools label{display:grid;gap:4px;font-weight:600;font-size:.88rem}
  .orb-accounts .accounts-tools .accounts-check{display:flex;gap:8px;align-items:center;white-space:nowrap;min-height:44px}
  .orb-erp.orb-accounts .accounts-check input{inline-size:18px!important;block-size:18px!important;min-height:0!important;padding:0!important;margin:0}
  .orb-accounts .accounts-alert{padding:10px 12px;border-radius:12px;background:var(--orb-color-error-container)}
  .orb-accounts .accounts-scroll{overflow-x:auto}
  .orb-accounts table{inline-size:100%;border-collapse:collapse;font-size:.88rem}
  .orb-accounts th,.orb-accounts td{text-align:start;padding:8px;border-block-end:1px solid var(--orb-color-outline-variant);vertical-align:top;overflow-wrap:anywhere}
`;
