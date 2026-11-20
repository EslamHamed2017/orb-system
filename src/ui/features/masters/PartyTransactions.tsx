"use client";

import { useEffect, useState } from "react";

/**
 * QuickBooks-style customer / supplier page money: open balance and overdue in AED, then every invoice or bill and
 * payment with this party across all projects, with Receive payment / Pay at the end of each row.
 */
interface Rec { id: string; projectId: string; type: string; occurredOn: string; state: string; partyId?: string; reference: string; currency: string; amount: string; outstandingAmount: string;
  projectReference: string; dueDate?: string; overdue?: boolean; aedAmount: string | null; aedOutstanding: string | null }
const fmt = (v: string | number) => Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PartyTransactions({ kind, partyId, locale }: { readonly kind: "customer" | "supplier"; readonly partyId: string; readonly locale: "en" | "ar" }) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  const [rows, setRows] = useState<Rec[] | null | "hidden">(null);
  useEffect(() => {
    const types = kind === "customer" ? ["sales-invoices", "collections"] : ["supplier-invoices", "supplier-payments"];
    void Promise.all(types.map(async (type) => { const r = await fetch(`/api/accounts/${type}`, { cache: "no-store" }); if (!r.ok) throw r.status; return ((await r.json()) as { items: Rec[] }).items; }))
      .then((lists) => setRows(lists.flat().filter((x) => x.partyId === partyId).sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))))
      .catch(() => setRows("hidden"));
  }, [kind, partyId]);
  if (rows === "hidden") return null;
  const invoiceType = kind === "customer" ? "SALES_INVOICE" : "SUPPLIER_INVOICE";
  const live = (rows ?? []).filter((r) => !["CANCELLED", "REJECTED", "REVERSED"].includes(r.state));
  const open = live.filter((r) => r.type === invoiceType).reduce((x, r) => x + Number(r.aedOutstanding ?? 0), 0);
  const overdue = live.filter((r) => r.type === invoiceType && r.overdue).reduce((x, r) => x + Number(r.aedOutstanding ?? 0), 0);
  const label = (r: Rec) => r.type === "SALES_INVOICE" ? t("Invoice", "فاتورة") : r.type === "SUPPLIER_INVOICE" ? t("Bill", "فاتورة مورد") : r.type === "COLLECTION" ? t("Payment received", "دفعة مستلمة") : t("Payment made", "دفعة مسددة");
  const action = (r: Rec) => {
    if (r.type === "SALES_INVOICE" && Number(r.outstandingAmount) > 0) return <a href={`/projects/${r.projectId}/money?new=RECEIPT&locale=${locale}`}><strong>{t("Receive payment", "استلام دفعة")}</strong></a>;
    if (r.type === "SUPPLIER_INVOICE" && Number(r.outstandingAmount) > 0) return <a href={`/projects/${r.projectId}/money?new=PAYMENT&locale=${locale}`}><strong>{t("Pay", "دفع")}</strong></a>;
    if (r.type === "SALES_INVOICE") return <a href={`/sales-invoices/${r.id}/print?locale=${locale}`} target="_blank" rel="noreferrer">{t("Print", "طباعة")}</a>;
    if (r.type === "COLLECTION" || r.type === "SUPPLIER_PAYMENT") return <a href={`/money-movements/${r.id}/print?projectId=${r.projectId}&locale=${locale}`} target="_blank" rel="noreferrer">{t("Print", "طباعة")}</a>;
    return null;
  };
  return <section className="party-tx" aria-labelledby="party-tx-title" data-testid="party-transactions">
    <style>{PARTY_STYLES}</style>
    <h2 id="party-tx-title">{t("Transactions", "المعاملات")}</h2>
    <div className="party-cards">
      <div><span>{kind === "customer" ? t("Open balance", "الرصيد المفتوح") : t("We owe", "المستحق علينا")}</span><strong><bdi>AED {fmt(open)}</bdi></strong></div>
      <div data-tone={overdue > 0 ? "error" : undefined}><span>{t("Overdue", "متأخر")}</span><strong><bdi>AED {fmt(overdue)}</bdi></strong></div>
      <a href={`/statements/${kind}/${partyId}?locale=${locale}`} target="_blank" rel="noreferrer">{t("Statement", "كشف حساب")}</a>
    </div>
    {rows === null ? <p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p> : rows.length === 0 ? <p className="orb-muted">{t("No transactions yet.", "لا توجد معاملات بعد.")}</p>
      : <div className="party-scroll"><table>
        <thead><tr><th>{t("Date", "التاريخ")}</th><th>{t("Type", "النوع")}</th><th>{t("No.", "الرقم")}</th><th>{t("Project", "المشروع")}</th><th>{t("Due", "الاستحقاق")}</th><th className="num">{t("Amount", "المبلغ")}</th><th className="num">{t("Open balance", "الرصيد المفتوح")}</th><th>{t("Action", "الإجراء")}</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={`${r.type}-${r.id}`} data-state={r.state}>
          <td className="nowrap">{r.occurredOn}</td><td>{label(r)}</td><td className="nowrap"><bdi>{r.reference}</bdi></td>
          <td><a href={`/projects/${r.projectId}/transactions?locale=${locale}`}><bdi>{r.projectReference}</bdi></a></td>
          <td className="nowrap">{r.dueDate ?? ""}{r.overdue && <> <span className="orb-chip" data-tone="error">{t("Overdue", "متأخرة")}</span></>}</td>
          <td className="num nowrap"><bdi>{r.currency} {fmt(r.amount)}</bdi></td><td className="num nowrap">{r.type === invoiceType ? <bdi>{fmt(r.outstandingAmount)}</bdi> : ""}</td><td className="nowrap">{action(r)}</td></tr>)}</tbody>
      </table></div>}
  </section>;
}

const PARTY_STYLES = `
.party-tx{display:grid;gap:12px;margin-top:16px}.party-tx h2{margin:0}
.party-cards{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.party-cards div{border:1px solid var(--orb-color-outline-variant);border-radius:14px;padding:12px 16px;display:grid;min-width:180px;background:var(--orb-color-surface)}
.party-cards span{font-size:.8rem;font-weight:700;text-transform:uppercase;color:var(--orb-color-on-surface-variant)}.party-cards strong{font-size:1.25rem}
.party-cards div[data-tone=error] strong{color:var(--orb-color-error,#b3261e)}
.party-scroll{overflow-x:auto;border:1px solid var(--orb-color-outline-variant);border-radius:16px;background:var(--orb-color-surface)}
.party-tx table{width:100%;border-collapse:collapse}.party-tx th,.party-tx td{padding:9px 12px;text-align:start;border-bottom:1px solid var(--orb-color-outline-variant)}
.party-tx th{font-size:.75rem;text-transform:uppercase;color:var(--orb-color-on-surface-variant)}.party-tx .num{text-align:end}.party-tx .nowrap{white-space:nowrap}
.party-tx tr[data-state=CANCELLED],.party-tx tr[data-state=REVERSED]{opacity:.55}
`;
