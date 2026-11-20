"use client";

import { useEffect, useMemo, useState } from "react";
import { ProjectContextNavigation } from "../../navigation/ProjectContextNavigation";

/**
 * QuickBooks-style attachments: the files attached to transactions, read live from the database. With a project it
 * is that project's Attachments tab; without one it lists every project's attachments (Gear → Lists → Attachments).
 */
interface Item { id: string; projectId: string; projectReference: string; subjectType: string; subjectId: string; subjectReference: string; purpose: string;
  originalFilename: string; mediaType: string; byteLength: number; uploadedAt: string; uploadedByName: string; contentHref: string }

const TYPES: Record<string, [string, string, string]> = {
  CONTRACT: ["Contract", "عقد", "contracts"], SALES_SHIPMENT: ["Customer shipment", "شحنة عميل", "shipments"], SUPPLIER_CONTAINER: ["Supplier shipment", "شحنة مورد", "shipments"],
  SALES_INVOICE: ["Invoice", "فاتورة", "transactions"], SUPPLIER_INVOICE: ["Bill", "فاتورة مورد", "transactions"], MONEY_MOVEMENT: ["Payment", "دفعة", "money"],
  EXPENSE: ["Expense", "مصروف", "expenses"], CLAIM: ["Claim", "مطالبة", "claims"], PROJECT: ["Project", "مشروع", "overview"],
};
const size = (n: number) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export function LiveAttachments({ locale, projectId, search = "" }: { readonly locale: "en" | "ar"; readonly projectId?: string; readonly search?: string }) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  const [items, setItems] = useState<Item[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [type, setType] = useState("");
  const [q, setQ] = useState(search);
  useEffect(() => {
    const load = async () => {
      const ids = projectId ? [projectId] : (((await (await fetch("/api/projects", { cache: "no-store" })).json()) as { items: { id: string }[] }).items ?? []).map((p) => p.id);
      const lists = await Promise.all(ids.map(async (id) => { const r = await fetch(`/api/evidence?projectId=${id}`, { cache: "no-store" }); return r.ok ? ((await r.json()) as { items: Item[] }).items : []; }));
      setItems(lists.flat().sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)));
    };
    void load().catch(() => setFailed(true));
  }, [projectId]);
  const shown = useMemo(() => (items ?? []).filter((i) => (!type || i.subjectType === type) &&
    (!q.trim() || `${i.originalFilename} ${i.subjectReference} ${i.projectReference}`.toLowerCase().includes(q.trim().toLowerCase()))), [items, type, q]);
  const source = (i: Item) => `/projects/${i.projectId}/${(TYPES[i.subjectType] ?? ["", "", "overview"])[2]}?locale=${locale}`;

  return <section className="orb-erp att" dir={ar ? "rtl" : "ltr"} aria-labelledby="att-title" data-operation-id="listEvidence">
    <style>{ATT_STYLES}</style>
    {projectId && <ProjectContextNavigation locale={locale} projectId={projectId} current="documents"/>}
    <h1 id="att-title">{t("Attachments", "المرفقات")}</h1>
    <p className="orb-muted">{t("Files attached to invoices, bills, payments, expenses, shipments and claims. Attach a file from the transaction itself.", "الملفات المرفقة بالفواتير والمدفوعات والمصروفات والشحنات والمطالبات. أرفق الملف من المعاملة نفسها.")}</p>
    <div className="att-filters">
      <label>{t("Search", "بحث")}<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("File name or number", "اسم الملف أو الرقم")}/></label>
      <label>{t("Attached to", "مرفق بـ")}<select value={type} onChange={(e) => setType(e.target.value)}><option value="">{t("All", "الكل")}</option>
        {Object.entries(TYPES).filter(([k]) => k !== "PROJECT").map(([k, v]) => <option key={k} value={k}>{v[ar ? 1 : 0]}</option>)}</select></label>
    </div>
    {failed ? <p role="alert">{t("Attachments could not be loaded. Try again in a moment.", "تعذر تحميل المرفقات. حاول بعد قليل.")}</p>
      : items === null ? <p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p>
      : shown.length === 0 ? <p className="orb-muted" data-testid="attachments-empty">{t("No attachments yet.", "لا توجد مرفقات بعد.")}</p>
      : <div className="att-scroll"><table data-testid="attachments-table">
        <thead><tr><th>{t("File", "الملف")}</th><th>{t("Attached to", "مرفق بـ")}</th>{!projectId && <th>{t("Project", "المشروع")}</th>}<th>{t("Uploaded", "تاريخ الرفع")}</th><th>{t("By", "بواسطة")}</th><th className="num">{t("Size", "الحجم")}</th></tr></thead>
        <tbody>{shown.map((i) => <tr key={`${i.id}-${i.subjectId}`}>
          <td><a href={i.contentHref} target="_blank" rel="noreferrer">{i.originalFilename}</a></td>
          <td>{(TYPES[i.subjectType] ?? [i.subjectType, i.subjectType])[ar ? 1 : 0]} · <a href={source(i)}><bdi>{i.subjectReference || "—"}</bdi></a></td>
          {!projectId && <td><a href={`/projects/${i.projectId}/documents?locale=${locale}`}><bdi>{i.projectReference}</bdi></a></td>}
          <td className="nowrap">{i.uploadedAt.slice(0, 10)}</td><td>{i.uploadedByName}</td><td className="num nowrap">{size(i.byteLength)}</td></tr>)}</tbody>
      </table></div>}
  </section>;
}

const ATT_STYLES = `
.att h1{margin:0}.att-filters{display:flex;flex-wrap:wrap;gap:12px;margin-block:12px}
.att-filters label{display:grid;gap:4px;font-size:.85rem;font-weight:600}.att-filters input,.att-filters select{min-height:40px;padding:0 10px;border-radius:10px;border:1px solid var(--orb-color-outline-variant);font:inherit}
.att-scroll{overflow-x:auto;border:1px solid var(--orb-color-outline-variant);border-radius:16px;background:var(--orb-color-surface)}
.att table{width:100%;border-collapse:collapse}.att th,.att td{padding:10px 12px;text-align:start;border-bottom:1px solid var(--orb-color-outline-variant)}
.att th{font-size:.75rem;text-transform:uppercase;color:var(--orb-color-on-surface-variant)}.att .num{text-align:end}.att .nowrap{white-space:nowrap}
`;
