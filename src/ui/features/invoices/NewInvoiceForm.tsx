"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ProjectContextNavigation } from "../../navigation/ProjectContextNavigation";
import { sendJson, type ApiProblem } from "../../session-client";

/**
 * QuickBooks-style "New invoice" for a project: Add from shipment (any confirmed customer shipment not yet invoiced),
 * the line is filled from the shipment and the contract, choose VAT, then Save and close or Save and new.
 */
interface Version { unitPrice: string; currency: string; product: { nameEn: string; nameAr: string; reference: string } }
interface ProjectRec { id: string; reference: string; customer: { legalName: string; legalNameAr: string | null }; salesContract: { activeVersion: Version }; salesShipments?: { id: string; reference?: string }[] }
interface ShipmentView { id: string; reference: string; executionState: string; dataset: { quantity: string; bagCount: number; netWeight: string }; invoices?: { state: string }[] }
const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

export function NewInvoiceForm({ projectId, locale }: { readonly projectId: string; readonly locale: "en" | "ar" }) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  const [project, setProject] = useState<ProjectRec | null>(null);
  const [shipments, setShipments] = useState<ShipmentView[] | null>(null);
  const [chosen, setChosen] = useState<string>("");
  const [vat, setVat] = useState("");
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const p = await (await fetch(`/api/projects/${projectId}`, { cache: "no-store" })).json() as ProjectRec;
    setProject(p);
    const views = await Promise.all((p.salesShipments ?? []).map(async (s) => { const r = await fetch(`/api/sales-shipments/${s.id}`, { cache: "no-store" }); return r.ok ? await r.json() as ShipmentView : null; }));
    setShipments(views.filter((v): v is ShipmentView => v !== null));
  }, [projectId]);
  useEffect(() => { void load().catch(() => setMessage({ tone: "error", text: t("The project could not be loaded.", "تعذر تحميل المشروع.") })); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const available = useMemo(() => (shipments ?? []).filter((s) => !["DRAFT", "CANCELLED", "REJECTED"].includes(s.executionState) && !(s.invoices ?? []).some((i) => i.state !== "CANCELLED")), [shipments]);
  const shipment = available.find((s) => s.id === chosen);
  const v = project?.salesContract.activeVersion;
  const qty = shipment ? Number(shipment.dataset.quantity) : 0, price = v ? Number(v.unitPrice) : 0, net = Math.round(qty * price * 100) / 100;
  const vatAmount = vat === "STANDARD" ? Math.round(net * 5) / 100 : 0;

  async function save(again: boolean) {
    if (!shipment) return;
    setBusy(true); setMessage(null);
    try {
      const invoice = await sendJson<{ id: string; reference: string }>(`/api/sales-shipments/${shipment.id}/sales-invoice`, "POST", { invoiceDate: date, ...(vat ? { vatTreatment: vat } : {}) });
      if (again) { setChosen(""); setVat(""); await load(); setMessage({ tone: "success", text: t(`Invoice ${invoice?.reference ?? ""} saved. Start the next one.`, `تم حفظ الفاتورة ${invoice?.reference ?? ""}. ابدأ التالية.`) }); }
      else window.location.href = `/projects/${projectId}/transactions?locale=${locale}`;
    } catch (error) { setMessage({ tone: "error", text: (error as ApiProblem)?.detail ?? t("The invoice could not be saved.", "تعذر حفظ الفاتورة.") }); }
    finally { setBusy(false); }
  }

  return <section className="orb-erp inv-new" dir={ar ? "rtl" : "ltr"} aria-labelledby="inv-title">
    <style>{INV_STYLES}</style>
    <ProjectContextNavigation locale={locale} projectId={projectId} current="transactions"/>
    <h1 id="inv-title">{t("New invoice", "فاتورة جديدة")}</h1>
    {project && <p className="orb-muted">{t("Customer", "العميل")}: <strong>{ar ? project.customer.legalNameAr || project.customer.legalName : project.customer.legalName}</strong></p>}
    {message && <p role={message.tone === "error" ? "alert" : "status"} className="inv-msg" data-tone={message.tone}>{message.text}</p>}
    <section className="inv-card" aria-labelledby="inv-add"><h2 id="inv-add">{t("Add from shipment", "إضافة من شحنة")}</h2>
      {shipments === null ? <p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p>
        : available.length === 0 ? <p className="orb-muted" data-testid="no-shipments">{t("Every confirmed customer shipment is already invoiced. Confirm a shipment first, then invoice it here.", "كل شحنات العميل المؤكدة لها فواتير. أكّد شحنة أولاً ثم أصدر فاتورتها هنا.")}</p>
        : <div className="inv-ships">{available.map((s) => <button key={s.id} type="button" aria-pressed={chosen === s.id} onClick={() => setChosen(s.id)}>
          <bdi>{s.reference}</bdi><small>{fmt(Number(s.dataset.quantity))} MT · {s.dataset.bagCount} {t("bags", "كيس")}</small></button>)}</div>}
    </section>
    {shipment && v && <form className="inv-card" onSubmit={(e) => e.preventDefault()} data-testid="invoice-lines">
      <div className="inv-grid">
        <label>{t("Invoice date", "تاريخ الفاتورة")}<input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} required/></label>
        <label>{t("VAT", "ضريبة القيمة المضافة")}<select value={vat} onChange={(e) => setVat(e.target.value)}>
          <option value="">{t("Automatic (from company and customer)", "تلقائي (حسب الشركة والعميل)")}</option><option value="STANDARD">{t("Standard 5%", "قياسي 5%")}</option>
          <option value="ZERO_RATED">{t("Zero-rated (export)", "خاضع بنسبة صفر (تصدير)")}</option><option value="EXEMPT">{t("Exempt", "معفى")}</option><option value="OUT_OF_SCOPE">{t("Out of scope", "خارج النطاق")}</option></select></label>
      </div>
      <table><thead><tr><th>#</th><th>{t("Product / service", "المنتج / الخدمة")}</th><th>{t("Description", "الوصف")}</th><th className="num">{t("Qty (MT)", "الكمية (طن)")}</th><th className="num">{t("Rate", "السعر")}</th><th className="num">{t("Amount", "المبلغ")}</th></tr></thead>
        <tbody><tr><td>1</td><td>{ar ? v.product.nameAr : v.product.nameEn}</td><td>{t("Shipment", "الشحنة")} <bdi>{shipment.reference}</bdi></td><td className="num">{fmt(qty)}</td><td className="num">{fmt(price)}</td><td className="num">{fmt(net)}</td></tr></tbody></table>
      <dl className="inv-totals"><dt>{t("Subtotal", "المجموع الفرعي")}</dt><dd><bdi>{v.currency} {fmt(net)}</bdi></dd>
        <dt>{t("VAT", "الضريبة")}</dt><dd>{vat === "" ? t("Calculated on save", "تُحسب عند الحفظ") : <bdi>{v.currency} {fmt(vatAmount)}</bdi>}</dd>
        <dt><strong>{t("Total", "الإجمالي")}</strong></dt><dd><strong><bdi>{v.currency} {fmt(net + vatAmount)}</bdi></strong></dd></dl>
      <div className="inv-buttons"><button type="button" className="orb-button-filled" disabled={busy} onClick={() => void save(false)} data-operation-id="issueSalesInvoice">{t("Save and close", "حفظ وإغلاق")}</button>
        <button type="button" disabled={busy} onClick={() => void save(true)}>{t("Save and new", "حفظ وجديد")}</button>
        <a href={`/projects/${projectId}/transactions?locale=${locale}`}>{t("Cancel", "إلغاء")}</a></div>
    </form>}
  </section>;
}

const INV_STYLES = `
.inv-new h1{margin:0}.inv-card{border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:16px;margin-block:12px;background:var(--orb-color-surface);display:grid;gap:12px}
.inv-card h2{margin:0;font-size:1.05rem}.inv-ships{display:flex;flex-wrap:wrap;gap:8px}
.inv-ships button{display:grid;text-align:start;gap:2px;padding:10px 14px;border-radius:12px;border:1px solid var(--orb-color-outline-variant);background:var(--orb-color-surface);font:inherit;cursor:pointer}
.inv-ships button[aria-pressed=true]{border-color:var(--orb-color-primary);background:var(--orb-color-secondary-container)}.inv-ships small{color:var(--orb-color-on-surface-variant)}
.inv-grid{display:flex;flex-wrap:wrap;gap:12px}.inv-grid label{display:grid;gap:4px;font-weight:600;font-size:.88rem}
.inv-new table{width:100%;border-collapse:collapse}.inv-new th,.inv-new td{padding:8px;border-bottom:1px solid var(--orb-color-outline-variant);text-align:start}.inv-new .num{text-align:end}
.inv-totals{display:grid;grid-template-columns:auto auto;justify-content:end;gap:6px 24px;margin:0}.inv-totals dd{margin:0;text-align:end}
.inv-buttons{display:flex;gap:8px;align-items:center}.inv-msg{padding:10px 12px;border-radius:12px;background:var(--orb-color-secondary-container)}.inv-msg[data-tone=error]{background:var(--orb-color-error-container)}
`;
