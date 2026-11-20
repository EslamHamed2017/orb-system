"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { EnterpriseStyles, ErpPageHeader } from "../admin/EnterpriseUx";
import { problemOf, sendJson, type ApiProblem } from "../../session-client";
import { ShipmentInvoicesPanel, type ShipmentInvoice } from "../invoices/ShipmentInvoicesPanel";

type Locale = "en" | "ar";
type Kind = "SUPPLIER" | "SALES";
type Action = "REVISE" | "SET_SOURCE" | "SUBMIT_CONFIRMATION" | "APPROVE_CONFIRMATION" | "REJECT_CONFIRMATION" | "START_TRANSIT" | "MARK_ARRIVED" | "CANCEL" | "REJECT";

interface Shipment {
  kind: Kind; id: string; projectId: string; projectReference: string; reference: string; version: number; executionState: string;
  contract: { id: string; reference: string; quantity: string; toleranceOverPercent: string };
  product: { name: string; nameAr: string | null };
  counterparty: { reference: string; name: string; nameAr: string | null } | null;
  quantities: { contracted: string; thisShipment: string; otherOpenShipments: string; remaining: string };
  primarySource: { id: string; reference: string; executionState: string } | null;
  dataset: {
    revisionNo: number; state: string; quantity: string; bagCount: number; bagWeight: string; netWeight: string; grossWeight: string;
    lotOrOrderReference: string | null; containerNumbers: string[]; sealNumbers: string[]; incoterm: string; namedPlace: string;
    origin: string; loadLocation: string; dischargeLocation: string | null; destination: string;
    transport: { mode: string; carrier: string; reference: string; vesselOrVehicle: string | null; voyageOrTrip: string | null; estimatedDeparture: string | null; estimatedArrival: string | null };
    plannedShipmentAt: string | null; notes: string | null;
  };
  revisions: { id: string; revisionNo: number; state: string; quantity: string; revisionReason: string; createdAt: string; createdByName: string }[];
  pendingApproval: { id: string; requesterName: string; requestedAt: string | null } | null;
  lastDecision: { decision: string; approverName: string | null; decidedAt: string | null; comment: string | null } | null;
  events: { fromState: string; toState: string; reason: string | null; occurredAt: string; actorName: string }[];
  history: { action: string; occurredAt: string; actorName: string; details: Record<string, unknown> }[];
  availableActions: Action[];
  invoices?: ShipmentInvoice[];
}

const STATES: Record<string, [string, string]> = {
  DRAFT: ["Draft", "مسودة"], CONFIRMED: ["Confirmed", "مؤكدة"], IN_TRANSIT: ["In transit", "قيد الشحن"], RECEIVED: ["Received", "مستلمة"],
  DELIVERED: ["Delivered", "مسلّمة"], CANCELLED: ["Cancelled", "ملغاة"], REJECTED: ["Rejected", "مرفوضة"],
};
const HISTORY: Record<string, [string, string]> = {
  DATASET_REVISED: ["Shipment details edited", "تعديل بيانات الشحنة"], CONFIRMATION_SUBMITTED: ["Sent for confirmation", "أُرسلت للتأكيد"],
  CONFIRMATION_APPROVED: ["Confirmed", "تأكدت"], CONFIRMATION_REJECTED: ["Returned to draft", "أُعيدت كمسودة"],
  STATE_CHANGED: ["Status changed", "تغيير الحالة"], PRIMARY_SOURCE_SET: ["Source supplier shipment set", "تحديد شحنة المورد المصدر"],
};

const num = (value: string, digits = 3) => Number(value).toLocaleString("en-US", { maximumFractionDigits: digits });
const when = (value: string | null, ar: boolean) => (value ? new Date(value).toLocaleString(ar ? "ar-AE" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");
const day = (value: string | null) => (value ? value.slice(0, 10) : "");

export function ShipmentExecutionWorkspace({ kind, shipmentId, locale }: { readonly kind: Kind; readonly shipmentId: string; readonly locale: Locale }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const base = kind === "SUPPLIER" ? "/api/supplier-shipments" : "/api/sales-shipments";
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loadError, setLoadError] = useState<ApiProblem | null>(null);
  const [open, setOpen] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [sources, setSources] = useState<{ id: string; reference: string; executionState: string; quantity: string }[]>([]);

  const load = useCallback(async () => {
    const response = await fetch(`${base}/${shipmentId}`, { cache: "no-store" });
    if (!response.ok) { setLoadError(await problemOf(response)); return; }
    setLoadError(null);
    setShipment(await response.json() as Shipment);
  }, [base, shipmentId]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (open !== "SET_SOURCE" || !shipment) return;
    void fetch(`/api/projects/${shipment.projectId}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const project = await response.json() as { supplierShipments?: { id: string; reference: string; executionState: string; activeDataset: { quantity: string } }[] };
      setSources((project.supplierShipments ?? []).filter((item) => !["CANCELLED", "REJECTED"].includes(item.executionState)).map((item) => ({ id: item.id, reference: item.reference, executionState: item.executionState, quantity: item.activeDataset.quantity })));
    });
  }, [open, shipment]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice(null);
    try {
      const result = await action() as Shipment | { shipment: Shipment } | null;
      const next = result && "shipment" in result ? result.shipment : result as Shipment | null;
      if (next && next.id) setShipment((current) => ({ ...next, invoices: next.invoices ?? current?.invoices })); else await load();
      setOpen(null);
      setNotice({ tone: "success", text: success });
    } catch (error) {
      const problem = error as ApiProblem;
      if (problem.status === 412) await load();
      setNotice({ tone: "error", text: problem.detail ?? t("The action could not be completed.", "تعذر تنفيذ العملية.") });
    } finally { setBusy(false); }
  }

  if (loadError) {
    return <section className="orb-erp" dir={ar ? "rtl" : "ltr"} aria-labelledby="shipment-title"><EnterpriseStyles/>
      <ErpPageHeader titleId="shipment-title" eyebrow={kind === "SUPPLIER" ? t("Supplier shipment", "شحنة مورد") : t("Customer shipment", "شحنة عميل")}
        title={loadError.status === 404 ? t("Shipment not found", "الشحنة غير موجودة") : t("Shipment unavailable", "الشحنة غير متاحة")}
        description={loadError.status === 404 ? t("It may belong to another company or have an old link.", "قد تكون تابعة لشركة أخرى أو الرابط قديم.") : t("Try again in a moment.", "حاول مرة أخرى بعد قليل.")}/>
      <p><button type="button" onClick={() => void load()}>{t("Try again", "حاول مرة أخرى")}</button></p>
    </section>;
  }
  if (!shipment) return <section className="orb-erp" dir={ar ? "rtl" : "ltr"}><EnterpriseStyles/><h1 className="orb-sr-only">{t("Shipment", "الشحنة")}</h1><p role="status" aria-busy="true">{t("Loading shipment…", "جارٍ تحميل الشحنة…")}</p></section>;

  const s = shipment, d = s.dataset, can = (action: Action) => s.availableActions.includes(action);
  const arrived = kind === "SUPPLIER" ? "RECEIVED" : "DELIVERED";
  const state = STATES[s.executionState] ?? [s.executionState, s.executionState];
  const counterparty = s.counterparty ? (ar && s.counterparty.nameAr ? s.counterparty.nameAr : s.counterparty.name) : "—";
  const timeline = [
    ...s.history.map((h) => ({ at: h.occurredAt, who: h.actorName, title: (HISTORY[h.action] ?? [h.action, h.action])[ar ? 1 : 0], note: String(h.details.reason ?? h.details.comment ?? (h.action === "STATE_CHANGED" ? `${(STATES[String(h.details.from)] ?? ["", ""])[ar ? 1 : 0]} → ${(STATES[String(h.details.to)] ?? ["", ""])[ar ? 1 : 0]}` : "")) })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const post = (path: string, body: Record<string, unknown>, method: "POST" | "PUT" = "POST") => sendJson(`${base}/${s.id}${path}`, method, { expectedVersion: s.version, ...body });
  const reasonForm = (action: Action, toState: string, label: string, required: boolean) => <form className="ship-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    void run(() => post("/execution-transitions", { toState, ...(reason ? { reason } : {}) }), t("Status updated.", "تم تحديث الحالة."));
  }}>
    <label>{label}<textarea name="reason" required={required} minLength={required ? 3 : 0} maxLength={500} rows={2}/></label>
    <div className="ship-buttons"><button type="submit" className="orb-button-filled" disabled={busy}>{t("Confirm", "تأكيد")}</button><button type="button" onClick={() => setOpen(null)}>{t("Back", "رجوع")}</button></div>
  </form>;

  return <section className="orb-erp orb-shipment" dir={ar ? "rtl" : "ltr"} aria-labelledby="shipment-title">
    <EnterpriseStyles/>
    <style>{`
      .orb-shipment .ship-banner{padding:12px 16px;border-radius:14px;margin-block:12px;background:var(--orb-color-surface-container)}
      .orb-erp.orb-shipment .ship-banner[data-tone=warning]{background:#fff4e0!important;border-inline-start-color:#b26a00!important;color:#5c3a00}
      .orb-erp.orb-shipment .ship-banner[data-tone=error]{background:var(--orb-color-error-container)!important;border-inline-start-color:var(--orb-color-error)!important}
      .orb-erp.orb-shipment .ship-banner[data-tone=success]{background:#e6f4ea!important;border-inline-start-color:#1e7d32!important;color:#0d3d17}
      .orb-shipment .ship-actions{display:flex;flex-wrap:wrap;gap:8px;margin-block:12px}
      .orb-shipment .ship-actions button{padding:9px 16px;border-radius:999px;border:1px solid var(--orb-color-outline-variant);background:transparent;font:inherit;font-weight:700;cursor:pointer}
      .orb-shipment .ship-actions button[data-primary]{background:var(--orb-color-primary);color:var(--orb-color-on-primary);border-color:transparent}
      .orb-shipment .ship-actions button[data-danger]{color:var(--orb-color-error)}
      .orb-shipment .ship-form{display:grid;gap:10px;padding:16px;border:1px solid var(--orb-color-outline-variant);border-radius:16px;margin-block:12px}
      .orb-shipment .ship-form label{display:grid;gap:4px;font-weight:600;font-size:.88rem}.orb-shipment .ship-form .grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
      .orb-shipment .ship-buttons{display:flex;gap:8px;flex-wrap:wrap}
      .orb-shipment .ship-cards{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-block:16px}
      .orb-shipment .ship-card{border:1px solid var(--orb-color-outline-variant);border-radius:16px;padding:16px}.orb-shipment .ship-card h2{font-size:.95rem;margin:0 0 10px}
      .orb-shipment dl{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;margin:0;font-size:.88rem}.orb-shipment dt{color:var(--orb-color-on-surface-variant)}.orb-shipment dd{margin:0;overflow-wrap:anywhere}
      .orb-shipment .bar{height:8px;border-radius:99px;background:var(--orb-color-surface-container);overflow:hidden;margin-top:8px}.orb-shipment .bar span{display:block;height:100%;background:var(--orb-color-primary)}
      .orb-shipment ol.timeline{list-style:none;padding:0;margin:0;display:grid;gap:10px}.orb-shipment ol.timeline li{border-inline-start:3px solid var(--orb-color-primary-container);padding-inline-start:12px}
      .orb-shipment ol.timeline small{color:var(--orb-color-on-surface-variant)}
      .orb-shipment table{inline-size:100%;border-collapse:collapse;font-size:.88rem}.orb-shipment th,.orb-shipment td{text-align:start;padding:8px;border-block-end:1px solid var(--orb-color-outline-variant)}
    `}</style>
    <ErpPageHeader titleId="shipment-title"
      eyebrow={<><a href={`/projects/${s.projectId}/overview?locale=${locale}`}><bdi>{s.projectReference}</bdi></a><span>•</span>{kind === "SUPPLIER" ? t("Supplier shipment (inbound)", "شحنة مورد (وارد)") : t("Customer shipment (outbound)", "شحنة عميل (صادر)")}</>}
      title={<bdi>{s.reference}</bdi>}
      description={`${counterparty} · ${ar && s.product.nameAr ? s.product.nameAr : s.product.name} · ${num(d.quantity)} MT`}
      meta={<span className="orb-chip" data-tone={s.executionState === "CANCELLED" || s.executionState === "REJECTED" ? "error" : s.executionState === "DRAFT" ? "warning" : "success"} data-testid="shipment-state">{state[ar ? 1 : 0]}</span>}/>

    {s.pendingApproval && <p className="ship-banner" data-tone="warning" role="status">{t(`Waiting for owner approval — requested by ${s.pendingApproval.requesterName} on ${when(s.pendingApproval.requestedAt, ar)}.`, `بانتظار اعتماد المالك — طلبها ${s.pendingApproval.requesterName} في ${when(s.pendingApproval.requestedAt, ar)}.`)}</p>}
    {!s.pendingApproval && s.lastDecision?.decision === "REJECTED" && s.executionState === "DRAFT" && <p className="ship-banner" data-tone="error" role="status">{t(`Approval was rejected by ${s.lastDecision.approverName ?? "the owner"}: ${s.lastDecision.comment ?? ""}. Correct the shipment and submit again.`, `رفض ${s.lastDecision.approverName ?? "المالك"} الاعتماد: ${s.lastDecision.comment ?? ""}. صحّح الشحنة وأعد الإرسال.`)}</p>}
    {kind === "SALES" && s.executionState === "DRAFT" && !s.primarySource && <p className="ship-banner" role="note">{t("Before confirming, choose the supplier shipment this customer shipment is sourced from.", "قبل التأكيد، اختر شحنة المورد التي تُغذّي شحنة العميل هذه.")}</p>}
    {notice && <p className="ship-banner" data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}

    {s.availableActions.length > 0 && <div className="ship-actions" role="group" aria-label={t("Shipment actions", "إجراءات الشحنة")}>
      {can("SUBMIT_CONFIRMATION") && <button type="button" data-primary data-operation-id={kind === "SUPPLIER" ? "submitSupplierShipmentConfirmation" : "submitSalesShipmentConfirmation"} disabled={busy} onClick={() => void run(() => post("/submit", {}), t("Shipment confirmed.", "تم تأكيد الشحنة."))}>{t("Confirm shipment", "تأكيد الشحنة")}</button>}
      {can("APPROVE_CONFIRMATION") && <button type="button" data-primary data-operation-id="decideFixedApproval" disabled={busy} onClick={() => void run(() => sendJson(`/api/approvals/${s.pendingApproval!.id}/decision`, "POST", { decision: "APPROVED" }), t("Approved — the shipment is confirmed.", "تم الاعتماد — الشحنة مؤكدة."))}>{t("Approve and confirm", "اعتماد وتأكيد")}</button>}
      {can("REJECT_CONFIRMATION") && <button type="button" data-danger onClick={() => setOpen("REJECT_CONFIRMATION")} data-operation-id="decideFixedApproval">{t("Reject request", "رفض الطلب")}</button>}
      {can("START_TRANSIT") && <button type="button" data-primary onClick={() => setOpen("START_TRANSIT")} data-operation-id={kind === "SUPPLIER" ? "transitionSupplierShipmentExecution" : "transitionSalesShipmentExecution"}>{t("Mark in transit", "تسجيل قيد الشحن")}</button>}
      {can("MARK_ARRIVED") && <button type="button" data-primary onClick={() => setOpen("MARK_ARRIVED")} data-operation-id={kind === "SUPPLIER" ? "transitionSupplierShipmentExecution" : "transitionSalesShipmentExecution"}>{kind === "SUPPLIER" ? t("Mark received", "تسجيل الاستلام") : t("Mark delivered", "تسجيل التسليم")}</button>}
      {can("REVISE") && <button type="button" data-operation-id={kind === "SUPPLIER" ? "reviseSupplierShipmentDataset" : "reviseSalesShipmentDataset"} onClick={() => setOpen("REVISE")}>{t("Edit details", "تعديل البيانات")}</button>}
      {can("SET_SOURCE") && <button type="button" data-operation-id="setPrimarySupplierSource" onClick={() => setOpen("SET_SOURCE")}>{s.primarySource ? t("Change source", "تغيير المصدر") : t("Choose source", "اختيار المصدر")}</button>}
      {can("CANCEL") && <button type="button" data-danger onClick={() => setOpen("CANCEL")}>{t("Cancel shipment", "إلغاء الشحنة")}</button>}
      {can("REJECT") && <button type="button" data-danger onClick={() => setOpen("REJECT")}>{t("Reject shipment", "رفض الشحنة")}</button>}
    </div>}

    {open === "REJECT_CONFIRMATION" && <form className="ship-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const comment = String(new FormData(event.currentTarget).get("comment") ?? "");
      void run(() => sendJson(`/api/approvals/${s.pendingApproval!.id}/decision`, "POST", { decision: "REJECTED", comment }), t("Request rejected and returned to draft.", "رُفض الطلب وأُعيد كمسودة."));
    }}>
      <label>{t("What needs to be corrected?", "ما الذي يجب تصحيحه؟")}<textarea name="comment" required minLength={3} maxLength={500} rows={2}/></label>
      <div className="ship-buttons"><button type="submit" className="orb-button-filled" disabled={busy}>{t("Reject request", "رفض الطلب")}</button><button type="button" onClick={() => setOpen(null)}>{t("Back", "رجوع")}</button></div>
    </form>}
    {open === "START_TRANSIT" && reasonForm("START_TRANSIT", "IN_TRANSIT", t("Note (optional), e.g. B/L number or departure date", "ملاحظة (اختيارية) مثل رقم البوليصة أو تاريخ المغادرة"), false)}
    {open === "MARK_ARRIVED" && reasonForm("MARK_ARRIVED", arrived, t("Note (optional), e.g. arrival date or condition", "ملاحظة (اختيارية) مثل تاريخ الوصول أو الحالة"), false)}
    {open === "CANCEL" && reasonForm("CANCEL", "CANCELLED", t("Why is this shipment cancelled?", "سبب إلغاء الشحنة؟"), true)}
    {open === "REJECT" && reasonForm("REJECT", "REJECTED", t("Why is this shipment rejected?", "سبب رفض الشحنة؟"), true)}
    {open === "SET_SOURCE" && <form className="ship-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const supplierShipmentId = String(new FormData(event.currentTarget).get("supplierShipmentId") ?? "");
      void run(() => post("/primary-source", { supplierShipmentId }, "PUT"), t("Source saved.", "تم حفظ المصدر."));
    }}>
      <label>{t("Supplier shipment", "شحنة المورد")}<select name="supplierShipmentId" required defaultValue={s.primarySource?.id ?? ""}>
        <option value="" disabled>{sources.length ? t("Choose…", "اختر…") : t("No supplier shipments in this project yet", "لا توجد شحنات موردين في هذا المشروع بعد")}</option>
        {sources.map((source) => <option key={source.id} value={source.id}>{source.reference} · {num(source.quantity)} MT · {(STATES[source.executionState] ?? [source.executionState, source.executionState])[ar ? 1 : 0]}</option>)}
      </select></label>
      <div className="ship-buttons"><button type="submit" className="orb-button-filled" disabled={busy || !sources.length}>{t("Save source", "حفظ المصدر")}</button><button type="button" onClick={() => setOpen(null)}>{t("Back", "رجوع")}</button></div>
    </form>}
    {open === "REVISE" && <form className="ship-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const field = (name: string) => String(data.get(name) ?? "").trim();
      const listOf = (name: string) => field(name).split(/[\s,]+/).filter(Boolean);
      const changes: Record<string, unknown> = {};
      const compare = (key: string, next: unknown, current: unknown) => { if (JSON.stringify(next) !== JSON.stringify(current)) changes[key] = next; };
      compare("quantity", field("quantity"), num(d.quantity, 6).replaceAll(",", ""));
      compare("bagCount", Number(field("bagCount")), d.bagCount);
      compare("netWeight", field("netWeight"), num(d.netWeight, 6).replaceAll(",", ""));
      compare("grossWeight", field("grossWeight"), num(d.grossWeight, 6).replaceAll(",", ""));
      compare("lotOrOrderReference", field("lotOrOrderReference") || null, d.lotOrOrderReference);
      compare("containerNumbers", listOf("containerNumbers"), d.containerNumbers);
      compare("sealNumbers", listOf("sealNumbers"), d.sealNumbers);
      compare("transportCarrier", field("carrier"), d.transport.carrier);
      compare("transportReference", field("transportReference"), d.transport.reference);
      compare("vesselOrVehicle", field("vesselOrVehicle") || null, d.transport.vesselOrVehicle);
      compare("estimatedDeparture", field("estimatedDeparture") || null, day(d.transport.estimatedDeparture) || null);
      compare("estimatedArrival", field("estimatedArrival") || null, day(d.transport.estimatedArrival) || null);
      compare("notes", field("notes") || null, d.notes);
      if (Object.keys(changes).length === 0) { setNotice({ tone: "error", text: t("Nothing was changed.", "لم يتم تغيير أي شيء.") }); return; }
      void run(() => post("/datasets", { reason: field("reason"), changes }), t("Saved as a new revision.", "حُفظت كمراجعة جديدة."));
    }}>
      <div className="grid">
        <label>{t("Quantity (MT)", "الكمية (طن)")}<input name="quantity" inputMode="decimal" defaultValue={num(d.quantity, 6).replaceAll(",", "")} required/></label>
        <label>{t("Bags", "عدد الأكياس")}<input name="bagCount" type="number" min={1} defaultValue={d.bagCount} required/></label>
        <label>{t("Net weight (kg)", "الوزن الصافي (كجم)")}<input name="netWeight" inputMode="decimal" defaultValue={num(d.netWeight, 6).replaceAll(",", "")} required/></label>
        <label>{t("Gross weight (kg)", "الوزن القائم (كجم)")}<input name="grossWeight" inputMode="decimal" defaultValue={num(d.grossWeight, 6).replaceAll(",", "")} required/></label>
        <label>{kind === "SUPPLIER" ? t("Supplier lot", "لوت المورد") : t("Customer PO", "أمر شراء العميل")}<input name="lotOrOrderReference" defaultValue={d.lotOrOrderReference ?? ""}/></label>
        <label>{t("Containers (comma separated)", "الحاويات (مفصولة بفواصل)")}<input name="containerNumbers" dir="ltr" defaultValue={d.containerNumbers.join(", ")}/></label>
        <label>{t("Seals (comma separated)", "الأختام (مفصولة بفواصل)")}<input name="sealNumbers" dir="ltr" defaultValue={d.sealNumbers.join(", ")}/></label>
        <label>{t("Carrier", "الناقل")}<input name="carrier" defaultValue={d.transport.carrier} required/></label>
        <label>{t("Booking / transport ref.", "مرجع الحجز / النقل")}<input name="transportReference" dir="ltr" defaultValue={d.transport.reference} required/></label>
        <label>{t("Vessel or vehicle", "السفينة أو المركبة")}<input name="vesselOrVehicle" defaultValue={d.transport.vesselOrVehicle ?? ""}/></label>
        <label>{t("Departure (ETD)", "المغادرة المتوقعة")}<input name="estimatedDeparture" type="date" defaultValue={day(d.transport.estimatedDeparture)}/></label>
        <label>{t("Arrival (ETA)", "الوصول المتوقع")}<input name="estimatedArrival" type="date" defaultValue={day(d.transport.estimatedArrival)}/></label>
      </div>
      <label>{t("Notes", "ملاحظات")}<textarea name="notes" rows={2} defaultValue={d.notes ?? ""}/></label>
      <label>{t("Reason for the change (kept in the history)", "سبب التعديل (يُحفظ في السجل)")}<input name="reason" required minLength={3} maxLength={500}/></label>
      <div className="ship-buttons"><button type="submit" className="orb-button-filled" disabled={busy}>{t("Save new revision", "حفظ مراجعة جديدة")}</button><button type="button" onClick={() => setOpen(null)}>{t("Back", "رجوع")}</button></div>
    </form>}

    <div className="ship-cards">
      <article className="ship-card"><h2>{t("Quantity", "الكمية")}</h2>
        <dl><dt>{t("This shipment", "هذه الشحنة")}</dt><dd><bdi>{num(s.quantities.thisShipment)} MT</bdi></dd>
          <dt>{t("Contract", "العقد")}</dt><dd><bdi>{num(s.quantities.contracted)} MT (+{num(s.contract.toleranceOverPercent, 2)}%)</bdi></dd>
          <dt>{t("Other open shipments", "شحنات أخرى مفتوحة")}</dt><dd><bdi>{num(s.quantities.otherOpenShipments)} MT</bdi></dd>
          <dt>{t("Still to ship", "المتبقي للشحن")}</dt><dd><bdi>{num(s.quantities.remaining)} MT</bdi></dd></dl>
        <div className="bar" role="progressbar" aria-label={t("Contract quantity used", "نسبة استخدام كمية العقد")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(((Number(s.quantities.thisShipment) + Number(s.quantities.otherOpenShipments)) / Math.max(1, Number(s.quantities.contracted))) * 100))}>
          <span style={{ inlineSize: `${Math.min(100, ((Number(s.quantities.thisShipment) + Number(s.quantities.otherOpenShipments)) / Math.max(1, Number(s.quantities.contracted))) * 100)}%` }}/>
        </div>
      </article>
      <article className="ship-card"><h2>{t("Goods", "البضاعة")}</h2>
        <dl><dt>{t("Product", "المنتج")}</dt><dd>{ar && s.product.nameAr ? s.product.nameAr : s.product.name}</dd>
          <dt>{t("Bags", "الأكياس")}</dt><dd><bdi>{d.bagCount} × {num(d.bagWeight)} kg</bdi></dd>
          <dt>{t("Net / gross", "صافي / قائم")}</dt><dd><bdi>{num(d.netWeight)} / {num(d.grossWeight)} kg</bdi></dd>
          <dt>{kind === "SUPPLIER" ? t("Supplier lot", "لوت المورد") : t("Customer PO", "أمر الشراء")}</dt><dd><bdi>{d.lotOrOrderReference ?? "—"}</bdi></dd>
          <dt>{t("Containers", "الحاويات")}</dt><dd><bdi>{d.containerNumbers.join(", ") || "—"}</bdi></dd>
          <dt>{t("Seals", "الأختام")}</dt><dd><bdi>{d.sealNumbers.join(", ") || "—"}</bdi></dd></dl>
      </article>
      <article className="ship-card"><h2>{t("Route and transport", "المسار والنقل")}</h2>
        <dl><dt>{t("From", "من")}</dt><dd>{d.loadLocation}</dd>
          {d.dischargeLocation && <><dt>{t("Discharge", "التفريغ")}</dt><dd>{d.dischargeLocation}</dd></>}
          <dt>{t("To", "إلى")}</dt><dd>{d.destination}</dd>
          <dt>{t("Terms", "الشروط")}</dt><dd><bdi>{d.incoterm} {d.namedPlace}</bdi></dd>
          <dt>{t("Carrier", "الناقل")}</dt><dd><bdi>{d.transport.carrier} · {d.transport.reference}</bdi></dd>
          {d.transport.vesselOrVehicle && <><dt>{t("Vessel", "السفينة")}</dt><dd><bdi>{d.transport.vesselOrVehicle} {d.transport.voyageOrTrip ?? ""}</bdi></dd></>}
          <dt>{t("ETD / ETA", "المغادرة / الوصول")}</dt><dd><bdi>{day(d.transport.estimatedDeparture) || "—"} → {day(d.transport.estimatedArrival) || "—"}</bdi></dd></dl>
      </article>
      <article className="ship-card"><h2>{t("Links", "الروابط")}</h2>
        <dl><dt>{kind === "SUPPLIER" ? t("Supplier", "المورد") : t("Customer", "العميل")}</dt><dd>{counterparty}</dd>
          <dt>{t("Contract", "العقد")}</dt><dd><bdi>{s.contract.reference}</bdi></dd>
          {kind === "SALES" && <><dt>{t("Sourced from", "المصدر")}</dt><dd>{s.primarySource ? <a href={`/supplier-shipments/${s.primarySource.id}?locale=${locale}`}><bdi>{s.primarySource.reference}</bdi></a> : "—"}</dd></>}
          <dt>{t("Revision", "المراجعة")}</dt><dd>#{d.revisionNo}</dd></dl>
      </article>
    </div>

    {kind === "SALES" && <p className="shipment-documents" data-testid="shipment-documents">
      <a href={`/sales-shipments/${s.id}/commercial-invoice?locale=${locale}`} target="_blank" rel="noreferrer">{locale === "ar" ? "الفاتورة التجارية" : "Commercial invoice"}</a> · <a href={`/sales-shipments/${s.id}/packing-list?locale=${locale}`} target="_blank" rel="noreferrer">{locale === "ar" ? "قائمة التعبئة" : "Packing list"}</a>
    </p>}
    <ShipmentInvoicesPanel kind={kind} shipmentId={s.id} shipmentState={s.executionState} invoices={s.invoices ?? []} locale={locale} onChanged={load}/>

    <section className="ship-card" aria-labelledby="timeline-title"><h2 id="timeline-title">{t("History", "السجل")}</h2>
      {timeline.length === 0 ? <p className="orb-muted">{t("No activity yet.", "لا يوجد نشاط بعد.")}</p> :
        <ol className="timeline">{timeline.map((item, index) => <li key={index}><strong>{item.title}</strong>{item.note && <> — {item.note}</>}<br/><small>{item.who} · {when(item.at, ar)}</small></li>)}</ol>}
    </section>

    {s.revisions.length > 1 && <section className="ship-card" aria-labelledby="revisions-title" style={{ marginBlockStart: 12 }}><h2 id="revisions-title">{t("Revisions", "المراجعات")}</h2>
      <table><thead><tr><th>#</th><th>{t("Quantity", "الكمية")}</th><th>{t("Reason", "السبب")}</th><th>{t("By", "بواسطة")}</th><th>{t("Date", "التاريخ")}</th></tr></thead>
        <tbody>{s.revisions.map((revision) => <tr key={revision.id}><td>{revision.revisionNo}</td><td><bdi>{num(revision.quantity)} MT</bdi></td><td>{revision.revisionReason}</td><td>{revision.createdByName}</td><td>{when(revision.createdAt, ar)}</td></tr>)}</tbody></table>
    </section>}
  </section>;
}
