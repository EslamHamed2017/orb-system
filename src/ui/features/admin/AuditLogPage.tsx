"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadXlsx } from "../reports/xlsx-export";

/** Gear > Tools > Audit log (QuickBooks-style): who did what and when, newest first. Owner only; read-only. */
interface Entry { id: string; occurredAt: string; userName: string; area: string; action: string; subjectType: string; subjectId: string | null; projectId: string | null; projectReference: string | null; reference: string | null; reason: string | null }
const AREAS: Record<string, [string, string]> = {
  PROJECT: ["Project", "مشروع"], SHIPMENT: ["Shipment", "شحنة"], INVOICE: ["Invoice / bill", "فاتورة"], MONEY: ["Payment / expense", "دفعة / مصروف"],
  CLAIMS: ["Claim / completion", "مطالبة / إكمال"], CUSTOMER: ["Customer", "عميل"], SUPPLIER: ["Supplier", "مورد"],
};
const words = (action: string) => action.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function AuditLogPage({ locale }: { readonly locale: "en" | "ar" }) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [area, setArea] = useState(""), [q, setQ] = useState("");
  const [items, setItems] = useState<Entry[] | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  useEffect(() => {
    const p = new URLSearchParams({ limit: "500", ...(from ? { from } : {}), ...(to ? { to } : {}) });
    setItems(null);
    void fetch(`/api/activity-log?${p}`, { cache: "no-store" }).then(async (r) => { if (!r.ok) { setStatus(r.status); return; } setStatus(null); setItems(((await r.json()) as { items: Entry[] }).items); }).catch(() => setStatus(503));
  }, [from, to]);
  const shown = useMemo(() => (items ?? []).filter((e) => (!area || e.area === area) && (!q.trim() || `${e.userName} ${e.action} ${e.reference ?? ""} ${e.projectReference ?? ""} ${e.reason ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))), [items, area, q]);
  const when = (iso: string) => iso.slice(0, 16).replace("T", " ");
  const link = (e: Entry) => e.area === "CUSTOMER" && e.subjectId ? `/customers/${e.subjectId}?locale=${locale}` : e.area === "SUPPLIER" && e.subjectId ? `/suppliers/${e.subjectId}?locale=${locale}` : e.projectId ? `/projects/${e.projectId}/transactions?locale=${locale}` : null;
  return <section className="orb-erp audit" dir={ar ? "rtl" : "ltr"} aria-labelledby="audit-title" data-operation-id="getActivityLog">
    <style>{AUDIT_STYLES}</style>
    <h1 id="audit-title">{t("Audit log", "سجل التدقيق")}</h1>
    <p className="orb-muted">{t("Every change people made, newest first. Nothing here can be edited or deleted.", "كل تغيير قام به المستخدمون، الأحدث أولاً. لا يمكن تعديل أو حذف أي شيء هنا.")}</p>
    <div className="audit-filters">
      <label>{t("From", "من")}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)}/></label>
      <label>{t("To", "إلى")}<input type="date" value={to} onChange={(e) => setTo(e.target.value)}/></label>
      <label>{t("Area", "المجال")}<select value={area} onChange={(e) => setArea(e.target.value)}><option value="">{t("All", "الكل")}</option>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v[ar ? 1 : 0]}</option>)}</select></label>
      <label>{t("Search", "بحث")}<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("User, action, number or reason", "المستخدم أو الإجراء أو الرقم أو السبب")}/></label>
      <button type="button" disabled={!items?.length} onClick={() => downloadXlsx(`audit-log-${new Date().toISOString().slice(0, 10)}`, t("Audit log", "سجل التدقيق"),
        [[t("Date and time (UTC)", "التاريخ والوقت (UTC)"), t("User", "المستخدم"), t("Area", "المجال"), t("Action", "الإجراء"), t("Number", "الرقم"), t("Project", "المشروع"), t("Reason", "السبب")],
          ...shown.map((e) => [when(e.occurredAt), e.userName, (AREAS[e.area] ?? [e.area, e.area])[ar ? 1 : 0], words(e.action), e.reference, e.projectReference, e.reason])], ar)}>{t("Export to Excel", "تصدير إلى Excel")}</button>
    </div>
    {status ? <p role="alert">{status === 403 ? t("The audit log is for the owner.", "سجل التدقيق للمالك فقط.") : t("The audit log could not be loaded.", "تعذر تحميل سجل التدقيق.")}</p>
      : items === null ? <p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p>
      : shown.length === 0 ? <p className="orb-muted">{t("Nothing recorded for these filters.", "لا شيء مسجل لهذه المرشحات.")}</p>
      : <div className="audit-scroll"><table data-testid="audit-log"><thead><tr><th>{t("Date and time (UTC)", "التاريخ والوقت (UTC)")}</th><th>{t("User", "المستخدم")}</th><th>{t("Area", "المجال")}</th><th>{t("Action", "الإجراء")}</th><th>{t("Number", "الرقم")}</th><th>{t("Project", "المشروع")}</th><th>{t("Reason", "السبب")}</th></tr></thead>
        <tbody>{shown.map((e) => { const href = link(e); return <tr key={e.id}><td className="nowrap">{when(e.occurredAt)}</td><td>{e.userName}</td><td>{(AREAS[e.area] ?? [e.area, e.area])[ar ? 1 : 0]}</td>
          <td>{words(e.action)}</td><td><bdi>{e.reference ?? ""}</bdi></td><td>{e.projectReference ? (href ? <a href={href}><bdi>{e.projectReference}</bdi></a> : <bdi>{e.projectReference}</bdi>) : href ? <a href={href}>{t("Open", "فتح")}</a> : ""}</td><td>{e.reason ?? ""}</td></tr>; })}</tbody></table></div>}
  </section>;
}

const AUDIT_STYLES = `
.audit h1{margin:0}.audit-filters{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin-block:12px}
.audit-filters label{display:grid;gap:4px;font-weight:600;font-size:.85rem}.audit-filters input,.audit-filters select{min-height:40px;border-radius:10px;border:1px solid var(--orb-color-outline-variant);padding:0 8px;font:inherit}
.audit-filters button{min-height:40px;padding:0 16px;border-radius:999px;border:1px solid var(--orb-color-outline);background:var(--orb-color-surface);font:inherit;font-weight:600}
.audit-scroll{overflow-x:auto;border:1px solid var(--orb-color-outline-variant);border-radius:16px;background:var(--orb-color-surface)}
.audit table{width:100%;border-collapse:collapse;font-size:.9rem}.audit th,.audit td{padding:8px 12px;text-align:start;border-bottom:1px solid var(--orb-color-outline-variant)}
.audit th{font-size:.75rem;text-transform:uppercase;color:var(--orb-color-on-surface-variant)}.audit .nowrap{white-space:nowrap}
`;
