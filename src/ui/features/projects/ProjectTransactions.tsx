"use client";

import { useEffect, useMemo, useState } from "react";
import { ProjectContextNavigation } from "../../navigation/ProjectContextNavigation";

/**
 * QuickBooks-style project Transactions tab: every invoice, payment, bill, expense and claim of the project in one
 * table, newest first, with the next action at the end of each row (Receive payment, Pay, Print, View).
 */
type Kind = "INVOICE" | "PAYMENT_RECEIVED" | "BILL" | "BILL_PAYMENT" | "EXPENSE" | "CLAIM";
interface Row { id: string; kind: Kind; date: string; reference: string; party: string; currency: string; amount: string; open: string | null; state: string; href: string | null; documentId: string | null }
interface AccountRecord { id: string; occurredOn: string; state: string; reference: string; currency: string; amount: string; outstandingAmount: string; partyName: string; documentId: string | null; href: string }
interface Claim { id: string; side: string; state: string; shipmentReference: string; partyName: string; amount: string | null; settledAmount: string | null; currency: string | null; openedAt: string | null; type: string }
interface MoneyExpense { id: string; occurredOn: string; state: string; category: { name: string; nameAr: string }; payee: { name: string }; currency: string; amount: string; document: { id: string } | null }

const KINDS: Record<Kind, [string, string]> = {
  INVOICE: ["Invoice", "فاتورة"], PAYMENT_RECEIVED: ["Payment received", "دفعة مستلمة"], BILL: ["Bill", "فاتورة مورد"],
  BILL_PAYMENT: ["Bill payment", "دفعة لمورد"], EXPENSE: ["Expense", "مصروف"], CLAIM: ["Claim", "مطالبة"],
};
const STATES: Record<string, [string, string, string]> = {
  ISSUED: ["Open", "مفتوحة", "warning"], CONFIRMED: ["Open", "مفتوحة", "warning"], APPROVED: ["Saved", "محفوظ", "success"], PAID: ["Paid", "مدفوعة", "success"],
  PARTIALLY_ALLOCATED: ["Partly matched", "مطابق جزئياً", "warning"], FULLY_ALLOCATED: ["Matched", "مطابق", "success"], REVERSED: ["Reversed", "معكوس", "error"],
  CANCELLED: ["Cancelled", "ملغى", "error"], REJECTED: ["Rejected", "مرفوض", "error"], DRAFT: ["Draft", "مسودة", "warning"], PENDING_APPROVAL: ["Draft", "مسودة", "warning"],
  OPEN: ["Open", "مفتوحة", "warning"], UNDER_REVIEW: ["Under review", "قيد المراجعة", "warning"], RESOLVED: ["Settled", "مسوّاة", "success"],
};
const FILTERS: [string, string, Kind[]][] = [
  ["All", "الكل", []], ["Invoices", "الفواتير", ["INVOICE", "PAYMENT_RECEIVED"]], ["Bills", "فواتير الموردين", ["BILL", "BILL_PAYMENT"]], ["Expenses", "المصروفات", ["EXPENSE"]], ["Claims", "المطالبات", ["CLAIM"]],
];
const fmt = (v: string | number) => Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ProjectTransactions({ projectId, locale }: { readonly projectId: string; readonly locale: "en" | "ar" }) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState(0);
  const root = `/projects/${encodeURIComponent(projectId)}`;

  useEffect(() => {
    const json = async <T,>(url: string): Promise<T | null> => { const r = await fetch(url, { cache: "no-store" }); return r.ok ? await r.json() as T : null; };
    const accounts = (type: string) => json<{ items: AccountRecord[] }>(`/api/accounts/${type}?projectId=${projectId}`).catch(() => null);
    void Promise.all([accounts("sales-invoices"), accounts("collections"), accounts("supplier-invoices"), accounts("supplier-payments"), accounts("expenses"),
      json<{ claims: Claim[] }>(`/api/projects/${projectId}/claims`).catch(() => null), json<{ expenses: MoneyExpense[] }>(`/api/projects/${projectId}/money-movements`).catch(() => null)])
      .then(([si, col, bi, pay, ex, claims, money]) => {
        if (!si && !claims && !money) { setFailed(true); return; }
        const fromAccounts = (items: AccountRecord[] | undefined, kind: Kind): Row[] => (items ?? []).map((r) => ({ id: r.id, kind, date: r.occurredOn, reference: r.reference, party: r.partyName, currency: r.currency, amount: r.amount,
          open: kind === "INVOICE" || kind === "BILL" ? r.outstandingAmount : null, state: (kind === "INVOICE" || kind === "BILL") && r.state !== "CANCELLED" && Number(r.outstandingAmount) === 0 ? "PAID" : r.state, href: r.href, documentId: r.documentId }));
        const expenses: Row[] = ex ? fromAccounts(ex.items, "EXPENSE") : (money?.expenses ?? []).map((x) => ({ id: x.id, kind: "EXPENSE", date: x.occurredOn, reference: ar ? x.category.nameAr : x.category.name, party: x.payee.name,
          currency: x.currency, amount: x.amount, open: null, state: x.state, href: `${root}/expenses`, documentId: x.document?.id ?? null }));
        const claimRows: Row[] = (claims?.claims ?? []).map((c) => ({ id: c.id, kind: "CLAIM", date: (c.openedAt ?? "").slice(0, 10), reference: c.shipmentReference, party: c.partyName, currency: c.currency ?? "",
          amount: c.settledAmount ?? c.amount ?? "0", open: null, state: c.state, href: `${root}/claims`, documentId: null }));
        const all = [...fromAccounts(si?.items, "INVOICE"), ...fromAccounts(col?.items, "PAYMENT_RECEIVED"), ...fromAccounts(bi?.items, "BILL"), ...fromAccounts(pay?.items, "BILL_PAYMENT"), ...expenses, ...claimRows];
        setRows(all.sort((a, b) => b.date.localeCompare(a.date) || b.reference.localeCompare(a.reference)));
      }).catch(() => setFailed(true));
  }, [ar, projectId, root]);

  const shown = useMemo(() => (rows ?? []).filter((r) => FILTERS[filter][2].length === 0 || FILTERS[filter][2].includes(r.kind)), [rows, filter]);
  const q = `locale=${locale}`;
  const action = (r: Row) => {
    if (r.kind === "INVOICE" && r.state !== "CANCELLED" && Number(r.open) > 0) return <><a className="tx-primary" href={`${root}/money?new=RECEIPT&${q}`}>{t("Receive payment", "استلام دفعة")}</a> <a href={`/sales-invoices/${r.id}/print?${q}`} target="_blank" rel="noreferrer">{t("Print", "طباعة")}</a></>;
    if (r.kind === "INVOICE" && r.state !== "CANCELLED") return <a href={`/sales-invoices/${r.id}/print?${q}`} target="_blank" rel="noreferrer">{t("Print", "طباعة")}</a>;
    if (r.kind === "BILL" && r.state !== "CANCELLED" && Number(r.open) > 0) return <a className="tx-primary" href={`${root}/money?new=PAYMENT&${q}`}>{t("Pay", "دفع")}</a>;
    if (r.kind === "PAYMENT_RECEIVED" || r.kind === "BILL_PAYMENT") return <a href={`/money-movements/${r.id}/print?projectId=${projectId}&${q}`} target="_blank" rel="noreferrer">{t("Print", "طباعة")}</a>;
    return r.href ? <a href={`${r.href}${r.href.includes("?") ? "&" : "?"}${q}`}>{t("View", "عرض")}</a> : null;
  };

  return <section className="orb-erp tx" dir={ar ? "rtl" : "ltr"} aria-labelledby="tx-title">
    <style>{TX_STYLES}</style>
    <ProjectContextNavigation locale={locale} projectId={projectId} current="transactions"/>
    <h1 id="tx-title">{t("Transactions", "المعاملات")}</h1>
    <div className="tx-filters" role="group" aria-label={t("Show", "عرض")}>{FILTERS.map(([en, arabic], i) =>
      <button key={en} type="button" aria-pressed={filter === i} onClick={() => setFilter(i)}>{ar ? arabic : en}</button>)}</div>
    {failed ? <p role="alert">{t("Transactions could not be loaded. Try again in a moment.", "تعذر تحميل المعاملات. حاول بعد قليل.")}</p>
      : rows === null ? <p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p>
      : shown.length === 0 ? <p className="orb-muted">{t("No transactions yet. Use “Add to project” to record one.", "لا توجد معاملات بعد. استخدم «إضافة للمشروع» لتسجيل معاملة.")}</p>
      : <div className="tx-scroll"><table data-testid="project-transactions">
        <thead><tr><th>{t("Date", "التاريخ")}</th><th>{t("Type", "النوع")}</th><th>{t("No.", "الرقم")}</th><th>{t("Customer / supplier", "العميل / المورد")}</th>
          <th className="num">{t("Amount", "المبلغ")}</th><th className="num">{t("Open balance", "الرصيد المفتوح")}</th><th>{t("Status", "الحالة")}</th><th>{t("Action", "الإجراء")}</th></tr></thead>
        <tbody>{shown.map((r) => { const s = STATES[r.state] ?? [r.state, r.state, "info"]; return <tr key={`${r.kind}-${r.id}`}>
          <td className="nowrap">{r.date}</td><td>{KINDS[r.kind][ar ? 1 : 0]}</td><td className="nowrap"><bdi>{r.reference}</bdi></td><td>{r.party}</td>
          <td className="num nowrap"><bdi>{r.currency} {fmt(r.amount)}</bdi></td><td className="num nowrap">{r.open === null ? "" : <bdi>{fmt(r.open)}</bdi>}</td>
          <td><span className="orb-chip" data-tone={s[2]}>{s[ar ? 1 : 0]}</span></td><td className="tx-actions">{action(r)}</td></tr>; })}</tbody>
      </table></div>}
  </section>;
}

const TX_STYLES = `
.tx h1{margin:0 0 4px}
.tx-filters{display:flex;flex-wrap:wrap;gap:8px;margin-block:8px 12px}
.tx-filters button{min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--orb-color-outline-variant);background:var(--orb-color-surface);font:inherit;cursor:pointer}
.tx-filters button[aria-pressed=true]{background:var(--orb-color-secondary-container);border-color:transparent;font-weight:650}
.tx-scroll{overflow-x:auto;border:1px solid var(--orb-color-outline-variant);border-radius:16px;background:var(--orb-color-surface)}
.tx table{width:100%;border-collapse:collapse}.tx th,.tx td{padding:10px 12px;text-align:start;border-bottom:1px solid var(--orb-color-outline-variant);vertical-align:middle}
.tx th{font-size:.75rem;text-transform:uppercase;color:var(--orb-color-on-surface-variant)}.tx .num{text-align:end}.tx .nowrap{white-space:nowrap}
.tx-actions{white-space:nowrap}.tx-actions a{margin-inline-end:8px}.tx-primary{font-weight:700}
`;
