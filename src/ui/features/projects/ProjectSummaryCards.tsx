"use client";

import { useEffect, useState } from "react";

/** QuickBooks-style project overview cards: income, costs and profit (actual), with money still to collect and to pay. */
interface Profit { project: { currency: string }; rate: { aedPerUnit: string | null } | null; measures: Record<"expected" | "actual" | "cash", { amount: string; aedAmount: string | null; revenue: string; cost: string; marginPercent: string | null }> }
interface Money { totals: { currency: string; customerOutstanding: string; supplierOutstanding: string }[] }

const fmt = (v: string | number) => Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ProjectSummaryCards({ projectId, locale }: { readonly projectId: string; readonly locale: "en" | "ar" }) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  const [profit, setProfit] = useState<Profit | null | "hidden">(null);
  const [money, setMoney] = useState<Money | null>(null);
  useEffect(() => {
    void fetch(`/api/projects/${projectId}/profit`, { cache: "no-store" }).then(async (r) => setProfit(r.ok ? await r.json() as Profit : "hidden")).catch(() => setProfit("hidden"));
    void fetch(`/api/projects/${projectId}/money-movements`, { cache: "no-store" }).then(async (r) => r.ok && setMoney(await r.json() as Money)).catch(() => undefined);
  }, [projectId]);
  if (profit === "hidden") return null;
  const cur = profit?.project.currency ?? "";
  const a = profit?.measures.actual, e = profit?.measures.expected;
  const totals = money?.totals.find((x) => x.currency === cur) ?? money?.totals[0];
  const rate = Number(profit?.rate?.aedPerUnit ?? 0);
  const aed = (v: string | undefined) => (v && rate && cur !== "AED" ? <small className="pj-aed">AED {fmt(Number(v) * rate)}</small> : null);
  const card = (label: string, value: string | undefined, detail: React.ReactNode, testId: string, tone?: string) =>
    <div className="pj-card" data-testid={testId} data-tone={tone}><p>{label}</p><strong><bdi>{value === undefined ? "—" : `${cur} ${fmt(value)}`}</bdi></strong>{aed(value)}<span>{detail}</span></div>;
  return <section className="pj-cards" aria-label={t("Project money", "أرقام المشروع")}>
    <style>{CARD_STYLES}</style>
    {card(t("Income", "الإيرادات"), a?.revenue, totals ? t(`${cur} ${fmt(totals.customerOutstanding)} still to collect`, `${cur} ${fmt(totals.customerOutstanding)} لم يُحصّل بعد`) : t("Customer invoices", "فواتير العملاء"), "card-income")}
    {card(t("Costs", "التكاليف"), a?.cost, totals ? t(`${cur} ${fmt(totals.supplierOutstanding)} still to pay`, `${cur} ${fmt(totals.supplierOutstanding)} لم يُدفع بعد`) : t("Bills and expenses", "فواتير الموردين والمصروفات"), "card-costs")}
    {card(t("Profit", "الربح"), a?.amount, a?.marginPercent ? t(`${a.marginPercent}% margin · planned ${e ? fmt(e.amount) : "—"}`, `هامش ${a.marginPercent}% · المخطط ${e ? fmt(e.amount) : "—"}`) : t("Income − costs", "الإيرادات − التكاليف"), "card-profit", a && Number(a.amount) < 0 ? "error" : "success")}
  </section>;
}

const CARD_STYLES = `
.pj-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-block:4px 16px}
.pj-card{border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:16px;background:var(--orb-color-surface);display:grid;gap:4px}
.pj-card p{margin:0;font-size:.8rem;font-weight:700;text-transform:uppercase;color:var(--orb-color-on-surface-variant)}
.pj-card strong{font-size:1.45rem}
.pj-card[data-tone=success] strong{color:var(--orb-color-success, #146c2e)}.pj-card[data-tone=error] strong{color:var(--orb-color-error, #b3261e)}
.pj-card span,.pj-aed{color:var(--orb-color-on-surface-variant);font-size:.85rem}
@media (max-width:700px){.pj-cards{grid-template-columns:1fr}}
`;
