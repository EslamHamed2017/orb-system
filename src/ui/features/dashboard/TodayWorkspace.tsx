"use client";

import { useEffect, useState } from "react";
import { EnterpriseStyles, ErpPageHeader, Kpi } from "../admin/EnterpriseUx";
import { fetchCurrentSession } from "../../session-client";

/**
 * Today: what needs someone's attention across all projects, read from the database.
 * Each block loads on its own, so one unavailable service never hides the others.
 */
interface Project { id: string; reference: string; lifecycleState: string; customer: { legalName: string } }
interface Shipment { type: "SUPPLIER" | "SALES"; id: string; reference: string; projectId: string; projectReference: string; counterpartyName: string; quantity: string; state: string; estimatedArrival: string | null; waitingForApproval: boolean; hasSource: boolean | null; invoiceState: string | null }
interface ProfitRow { project: { id: string; reference: string; customerName: string; currency: string }; actual: { amount: string; marginPercent: string | null }; cash: { amount: string }; expected: { amount: string } }
type Block<T> = { status: "loading" } | { status: "ready"; value: T } | { status: "failed" } | { status: "hidden" };
interface Step { key: string; title: string; detail: string; href: string; tone: "warning" | "info" | "error" }

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw Object.assign(new Error(String(response.status)), { status: response.status });
  return await response.json() as T;
}
const fmt = (value: string) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const daysUntil = (date: string) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86_400_000);

export function TodayWorkspace({ locale }: { readonly locale: "en" | "ar" }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [roles, setRoles] = useState<readonly string[] | null>(null);
  const [projects, setProjects] = useState<Block<Project[]>>({ status: "loading" });
  const [shipments, setShipments] = useState<Block<Shipment[]>>({ status: "loading" });
  const [profit, setProfit] = useState<Block<ProfitRow[]>>({ status: "loading" });

  useEffect(() => {
    void fetchCurrentSession().then((session) => {
      const r = session?.roles ?? [];
      setRoles(r);
      const owner = r.includes("OWNER_ADMIN"), finance = owner || r.includes("FINANCE_VIEWER");
      void getJson<{ items: Project[] }>("/api/projects").then((v) => setProjects({ status: "ready", value: v.items })).catch(() => setProjects({ status: "failed" }));
      void getJson<{ items: Shipment[] }>("/api/shipments").then((v) => setShipments({ status: "ready", value: v.items })).catch(() => setShipments({ status: "failed" }));
      if (finance) void getJson<{ rows: ProfitRow[] }>("/api/reports/project-profitability").then((v) => setProfit({ status: "ready", value: v.rows })).catch(() => setProfit({ status: "failed" }));
      else setProfit({ status: "hidden" });
    });
  }, []);

  const finance = Boolean(roles?.some((r) => r === "OWNER_ADMIN" || r === "FINANCE_VIEWER"));
  const q = `?locale=${locale}`;
  const steps: Step[] = [];
  if (projects.status === "ready") for (const p of projects.value.filter((x) => x.lifecycleState === "DRAFT")) {
    steps.push({ key: `p-${p.id}`, title: t(`Activate project ${p.reference}`, `تفعيل المشروع ${p.reference}`), detail: t(`${p.customer.legalName} · add the purchase contract and activate`, `${p.customer.legalName} · أضف عقد الشراء وفعّل المشروع`), href: `/projects/${p.id}/overview${q}`, tone: "info" });
  }
  if (shipments.status === "ready") for (const s of shipments.value) {
    const href = `/${s.type === "SUPPLIER" ? "supplier" : "sales"}-shipments/${s.id}${q}`;
    const label = `${s.reference} · ${s.projectReference}`;
    if (s.state === "DRAFT" && !s.waitingForApproval) steps.push({ key: `s-${s.id}`, title: t(`Confirm ${s.reference}`, `أكّد ${s.reference}`), detail: `${label} · ${s.counterpartyName}`, href, tone: "info" });
    if (s.type === "SALES" && s.hasSource === false && !["CANCELLED", "REJECTED"].includes(s.state)) steps.push({ key: `src-${s.id}`, title: t(`Choose the source supplier shipment for ${s.reference}`, `اختر شحنة المورد المصدر لـ ${s.reference}`), detail: label, href, tone: "warning" });
    if (finance && ["CONFIRMED", "IN_TRANSIT", "DELIVERED", "RECEIVED"].includes(s.state) && !s.invoiceState) steps.push({ key: `i-${s.id}`, title: s.type === "SALES" ? t(`Issue the customer invoice for ${s.reference}`, `أصدر فاتورة العميل لـ ${s.reference}`) : t(`Record the supplier invoice for ${s.reference}`, `سجّل فاتورة المورد لـ ${s.reference}`), detail: `${label} · ${s.counterpartyName}`, href, tone: "info" });
    if (s.state === "IN_TRANSIT" && s.estimatedArrival) {
      const days = daysUntil(s.estimatedArrival);
      if (days < 0) steps.push({ key: `eta-${s.id}`, title: t(`${s.reference} is past its arrival date`, `${s.reference} تجاوزت تاريخ الوصول`), detail: t(`Expected ${s.estimatedArrival} · update the status`, `متوقع ${s.estimatedArrival} · حدّث الحالة`), href, tone: "error" });
      else if (days <= 7) steps.push({ key: `eta-${s.id}`, title: t(`${s.reference} arrives in ${days} day(s)`, `${s.reference} تصل خلال ${days} يوم`), detail: `${label} · ${s.estimatedArrival}`, href, tone: "warning" });
    }
  }
  const order = { error: 0, warning: 1, info: 2 } as const;
  steps.sort((a, b) => order[a.tone] - order[b.tone]);

  const active = projects.status === "ready" ? projects.value.filter((p) => p.lifecycleState === "ACTIVE").length : null;
  const moving = shipments.status === "ready" ? shipments.value.filter((s) => s.state === "IN_TRANSIT").length : null;
  const loading = projects.status === "loading" || shipments.status === "loading";

  return <section className="orb-erp orb-today" dir={ar ? "rtl" : "ltr"} aria-labelledby="today-title">
    <EnterpriseStyles/><style>{STYLES}</style>
    <ErpPageHeader titleId="today-title" eyebrow={t("Work", "العمل")} title={t("Today", "اليوم")} description={t("What needs attention across your projects, from the live records.", "ما يحتاج متابعة في مشاريعك، من السجلات الفعلية.")}/>
    <div className="orb-summary-grid" data-testid="today-kpis">
      <Kpi label={t("Active projects", "المشاريع النشطة")} value={active === null ? "—" : String(active)} detail={<a href={`/projects${q}`}>{t("See all", "عرض الكل")}</a>}/>
      <Kpi label={t("Shipments in transit", "الشحنات في الطريق")} value={moving === null ? "—" : String(moving)} detail={<a href={`/shipments${q}`}>{t("See all", "عرض الكل")}</a>}/>
      <Kpi label={t("Next steps", "الخطوات التالية")} value={loading ? "—" : String(steps.length)}/>
    </div>

    <section className="today-card" aria-labelledby="steps-title" data-testid="today-steps">
      <h2 id="steps-title">{t("Next steps", "الخطوات التالية")}</h2>
      {(projects.status === "failed" || shipments.status === "failed") && <p role="alert" className="today-alert">{t("Some records could not be loaded. The list below may be incomplete.", "تعذر تحميل بعض السجلات. القائمة قد تكون ناقصة.")} <button type="button" onClick={() => window.location.reload()}>{t("Reload", "إعادة التحميل")}</button></p>}
      {loading ? <p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p>
        : steps.length === 0 ? <p className="orb-muted">{t("Nothing is waiting. New work appears here when projects and shipments move.", "لا يوجد ما ينتظر. ستظهر المهام هنا عند تحرك المشاريع والشحنات.")} <a href={`/projects/new${q}`}>{t("New project", "مشروع جديد")}</a></p>
        : <ol className="today-steps">{steps.slice(0, 25).map((s) => <li key={s.key} data-tone={s.tone}><a href={s.href}><strong>{s.title}</strong></a><span><bdi>{s.detail}</bdi></span></li>)}</ol>}
      {steps.length > 25 && <p className="orb-muted">{t(`${steps.length - 25} more in Shipments and Projects.`, `${steps.length - 25} أخرى في الشحنات والمشاريع.`)}</p>}
    </section>

    {profit.status !== "hidden" && <section className="today-card" aria-labelledby="money-title" data-testid="today-profit">
      <h2 id="money-title">{t("Project money", "أموال المشاريع")}</h2>
      {profit.status === "loading" ? <p role="status">{t("Loading…", "جارٍ التحميل…")}</p>
        : profit.status === "failed" ? <p role="alert">{t("Profit could not be loaded.", "تعذر تحميل الربحية.")}</p>
        : profit.value.length === 0 ? <p className="orb-muted">{t("No active projects yet.", "لا توجد مشاريع نشطة بعد.")}</p>
        : <div className="today-scroll"><table>
          <thead><tr><th>{t("Project", "المشروع")}</th><th>{t("Expected margin", "الهامش المتوقع")}</th><th>{t("Actual margin", "الهامش الفعلي")}</th><th>{t("Cash position", "صافي النقد")}</th></tr></thead>
          <tbody>{profit.value.map((r) => <tr key={r.project.id}>
            <td><a href={`/projects/${r.project.id}/profit${q}`}><bdi>{r.project.reference}</bdi></a><br/><small>{r.project.customerName}</small></td>
            <td><bdi>{r.project.currency} {fmt(r.expected.amount)}</bdi></td>
            <td><bdi>{fmt(r.actual.amount)}</bdi>{r.actual.marginPercent !== null && <small> · <bdi>{r.actual.marginPercent}%</bdi></small>}</td>
            <td data-tone={Number(r.cash.amount) < 0 ? "negative" : undefined}><bdi>{fmt(r.cash.amount)}</bdi></td>
          </tr>)}</tbody></table></div>}
      <p><a href={`/reports/project-profitability${q}`}>{t("Profitability report", "تقرير الربحية")}</a></p>
    </section>}
  </section>;
}

const STYLES = `
  .orb-today .today-card{border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:16px;margin-block:12px}
  .orb-today .today-card h2{font-size:1rem;margin:0 0 10px}
  .orb-today .today-steps{list-style:none;margin:0;padding:0;display:grid;gap:8px}
  .orb-today .today-steps li{display:grid;gap:2px;padding:10px 12px;border-radius:12px;background:var(--orb-color-surface-container);border-inline-start:4px solid var(--orb-color-primary)}
  .orb-today .today-steps li[data-tone=warning]{border-inline-start-color:#b26a00}
  .orb-today .today-steps li[data-tone=error]{border-inline-start-color:var(--orb-color-error)}
  .orb-today .today-steps span{font-size:.85rem;color:var(--orb-color-on-surface-variant);overflow-wrap:anywhere}
  .orb-today .today-alert{padding:10px 12px;border-radius:12px;background:var(--orb-color-error-container)}
  .orb-today .today-scroll{overflow-x:auto}
  .orb-today table{inline-size:100%;border-collapse:collapse;font-size:.88rem}
  .orb-today th,.orb-today td{text-align:start;padding:8px;border-block-end:1px solid var(--orb-color-outline-variant);vertical-align:top}
  .orb-today [data-tone=negative]{color:var(--orb-color-error)}
`;
