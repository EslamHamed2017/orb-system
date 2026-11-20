"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EnterpriseStyles, ErpPageHeader } from "../admin/EnterpriseUx";

/** All supplier and customer shipments from the database, with filters and the next step for each. */
interface Shipment { type: "SUPPLIER" | "SALES"; id: string; reference: string; projectId: string; projectReference: string; counterpartyName: string; quantity: string; state: string; estimatedDeparture: string | null; estimatedArrival: string | null; waitingForApproval: boolean; hasSource: boolean | null; invoiceState: string | null }
type Filter = "ALL" | "SUPPLIER" | "SALES" | "OPEN";

const STATES: Record<string, [string, string, string]> = {
  DRAFT: ["Draft", "مسودة", "warning"], CONFIRMED: ["Confirmed", "مؤكدة", "success"], IN_TRANSIT: ["In transit", "في الطريق", "warning"],
  DELIVERED: ["Delivered", "تم التسليم", "success"], RECEIVED: ["Received", "تم الاستلام", "success"], CANCELLED: ["Cancelled", "ملغاة", "error"], REJECTED: ["Rejected", "مرفوضة", "error"],
};

export function ShipmentsQueue({ locale }: { readonly locale: "en" | "ar" }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [items, setItems] = useState<Shipment[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("OPEN");
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    setFailed(false);
    const response = await fetch("/api/shipments", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) { setFailed(true); return; }
    setItems(((await response.json()) as { items: Shipment[] }).items);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const next = (s: Shipment) => s.waitingForApproval ? t("Waiting for owner approval", "بانتظار اعتماد المالك")
    : s.state === "DRAFT" ? t("Send for confirmation", "إرسال للتأكيد")
    : s.type === "SALES" && s.hasSource === false ? t("Choose source supplier shipment", "اختيار شحنة المورد المصدر")
    : ["CONFIRMED", "IN_TRANSIT", "DELIVERED", "RECEIVED"].includes(s.state) && !s.invoiceState ? (s.type === "SALES" ? t("Issue customer invoice", "إصدار فاتورة العميل") : t("Record supplier invoice", "تسجيل فاتورة المورد"))
    : s.state === "CONFIRMED" ? t("Mark in transit when it leaves", "تحديد في الطريق عند المغادرة")
    : s.state === "IN_TRANSIT" ? (s.type === "SALES" ? t("Mark delivered on arrival", "تحديد التسليم عند الوصول") : t("Mark received on arrival", "تحديد الاستلام عند الوصول"))
    : "—";
  const shown = useMemo(() => (items ?? []).filter((s) => (filter === "ALL" || (filter === "OPEN" ? !["DELIVERED", "RECEIVED", "CANCELLED", "REJECTED"].includes(s.state) || !s.invoiceState : s.type === filter))
    && (!query.trim() || `${s.reference} ${s.projectReference} ${s.counterpartyName}`.toLowerCase().includes(query.trim().toLowerCase()))), [items, filter, query]);

  return <section className="orb-erp orb-queue" dir={ar ? "rtl" : "ltr"} aria-labelledby="queue-title">
    <EnterpriseStyles/><style>{STYLES}</style>
    <ErpPageHeader titleId="queue-title" eyebrow={t("Work", "العمل")} title={t("Shipments", "الشحنات")} description={t("Supplier and customer shipments across all projects, with the next step for each.", "شحنات الموردين والعملاء في كل المشاريع، مع الخطوة التالية لكل شحنة.")}/>
    <div className="queue-tools">
      <div role="group" aria-label={t("Show", "عرض")} className="queue-filters">
        {(["OPEN", "ALL", "SUPPLIER", "SALES"] as const).map((f) => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
          {f === "OPEN" ? t("Needs work", "تحتاج عمل") : f === "ALL" ? t("All", "الكل") : f === "SUPPLIER" ? t("From suppliers", "من الموردين") : t("To customers", "إلى العملاء")}</button>)}
      </div>
      <label>{t("Search", "بحث")}<input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Reference, project or party", "مرجع أو مشروع أو طرف")}/></label>
    </div>
    {failed ? <p role="alert" className="queue-alert">{t("Shipments could not be loaded.", "تعذر تحميل الشحنات.")} <button type="button" onClick={() => void load()}>{t("Try again", "حاول مرة أخرى")}</button></p>
      : items === null ? <p role="status" aria-busy="true">{t("Loading shipments…", "جارٍ تحميل الشحنات…")}</p>
      : shown.length === 0 ? <p className="orb-muted">{items.length === 0 ? t("No shipments yet. Shipments are created from a project.", "لا توجد شحنات بعد. تُنشأ الشحنات من المشروع.") : t("No shipments match.", "لا توجد شحنات مطابقة.")} <a href={`/projects?locale=${locale}`}>{t("Projects", "المشاريع")}</a></p>
      : <div className="queue-scroll" data-testid="shipments-queue"><table>
        <thead><tr><th>{t("Shipment", "الشحنة")}</th><th>{t("Project", "المشروع")}</th><th>{t("Party", "الطرف")}</th><th>{t("Quantity", "الكمية")}</th><th>{t("Status", "الحالة")}</th><th>{t("Arrival", "الوصول")}</th><th>{t("Next step", "الخطوة التالية")}</th></tr></thead>
        <tbody>{shown.map((s) => { const st = STATES[s.state] ?? [s.state, s.state, "warning"]; return <tr key={`${s.type}:${s.id}`}>
          <td><a href={`/${s.type === "SUPPLIER" ? "supplier" : "sales"}-shipments/${s.id}?locale=${locale}`}><bdi>{s.reference}</bdi></a><br/><small>{s.type === "SUPPLIER" ? t("From supplier", "من المورد") : t("To customer", "إلى العميل")}</small></td>
          <td><a href={`/projects/${s.projectId}/overview?locale=${locale}`}><bdi>{s.projectReference}</bdi></a></td>
          <td>{s.counterpartyName}</td>
          <td><bdi>{Number(s.quantity).toLocaleString("en-US", { maximumFractionDigits: 3 })} MT</bdi></td>
          <td><span className="orb-chip" data-tone={st[2]}>{st[ar ? 1 : 0]}</span></td>
          <td><bdi>{s.estimatedArrival ?? "—"}</bdi></td>
          <td>{next(s)}</td>
        </tr>; })}</tbody></table></div>}
  </section>;
}

const STYLES = `
  .orb-queue .queue-tools{display:flex;flex-wrap:wrap;gap:12px;align-items:end;justify-content:space-between;margin-block:12px}
  .orb-queue .queue-filters{display:flex;flex-wrap:wrap;gap:6px}
  .orb-erp.orb-queue .queue-filters button{padding:6px 12px;border-radius:999px;border:1px solid var(--orb-color-outline-variant)!important;background:var(--orb-color-surface-bright)!important;color:var(--orb-color-on-surface)!important;font:inherit;font-weight:600;min-height:0;box-shadow:none}
  .orb-erp.orb-queue .queue-filters button[aria-pressed=true]{background:var(--orb-color-primary)!important;color:var(--orb-color-on-primary)!important;border-color:transparent!important}
  .orb-queue .queue-tools label{display:grid;gap:4px;font-weight:600;font-size:.88rem}
  .orb-queue .queue-alert{padding:10px 12px;border-radius:12px;background:var(--orb-color-error-container)}
  .orb-queue .queue-scroll{overflow-x:auto}
  .orb-queue table{inline-size:100%;border-collapse:collapse;font-size:.88rem}
  .orb-queue th,.orb-queue td{text-align:start;padding:8px;border-block-end:1px solid var(--orb-color-outline-variant);vertical-align:top;overflow-wrap:anywhere}
`;
