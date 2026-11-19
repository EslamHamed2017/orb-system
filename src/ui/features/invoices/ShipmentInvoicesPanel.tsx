"use client";

import { FormEvent, useEffect, useState } from "react";
import { fetchCurrentSession, sendForm, sendJson, type ApiProblem } from "../../session-client";

/**
 * Invoices for one shipment.
 * Supplier shipment: finance records the supplier's invoice with its PDF, submits it, the owner approves it.
 * Customer shipment: finance issues the customer invoice (numbered by the system), prints it or cancels it.
 */
export interface ShipmentInvoice {
  type: "SUPPLIER" | "SALES"; id: string; reference: string; invoiceDate: string; state: string; currency: string;
  amount: string; expectedAmount: string; quantity: string; unitPrice: string;
  document: { id: string; filename: string; mediaType: string; byteLength: number } | null;
  pendingApprovalId: string | null; requesterId: string | null;
  lastDecision: { decision: string; comment: string | null; approverName: string | null } | null;
  cancellationReason: string | null;
}

const STATES: Record<string, [string, string, string]> = {
  DRAFT: ["Draft", "مسودة", "warning"], PENDING_APPROVAL: ["Waiting for approval", "بانتظار الاعتماد", "warning"],
  CONFIRMED: ["Approved", "معتمدة", "success"], ISSUED: ["Issued", "صادرة", "success"],
  REJECTED: ["Rejected", "مرفوضة", "error"], CANCELLED: ["Cancelled", "ملغاة", "error"],
};
const money = (value: string, currency: string) => `${currency} ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

export function ShipmentInvoicesPanel({ kind, shipmentId, shipmentState, invoices, locale, onChanged }: {
  readonly kind: "SUPPLIER" | "SALES"; readonly shipmentId: string; readonly shipmentState: string;
  readonly invoices: readonly ShipmentInvoice[]; readonly locale: "en" | "ar"; readonly onChanged: () => Promise<void>;
}) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [me, setMe] = useState<{ id: string; roles: readonly string[] } | null>(null);
  const [open, setOpen] = useState<"CREATE" | `CANCEL:${string}` | `REJECT:${string}` | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  useEffect(() => { void fetchCurrentSession().then((session) => session && setMe({ id: session.userId, roles: session.roles })); }, []);

  const finance = Boolean(me?.roles.some((role) => role === "OWNER_ADMIN" || role === "FINANCE_VIEWER"));
  const owner = Boolean(me?.roles.includes("OWNER_ADMIN"));
  const active = invoices.find((invoice) => !["CANCELLED", "REJECTED"].includes(invoice.state));
  const invoiceable = kind === "SUPPLIER" ? !["DRAFT", "CANCELLED", "REJECTED"].includes(shipmentState) : ["CONFIRMED", "IN_TRANSIT", "DELIVERED"].includes(shipmentState);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setNotice(null);
    try { await action(); setOpen(null); await onChanged(); setNotice({ tone: "success", text: success }); }
    catch (error) { setNotice({ tone: "error", text: (error as ApiProblem).detail ?? t("The action could not be completed.", "تعذر تنفيذ العملية.") }); }
    finally { setBusy(false); }
  }

  const createSupplierInvoice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(() => sendForm(`/api/supplier-shipments/${shipmentId}/invoices`, form), t("Supplier invoice saved. Submit it for owner approval.", "تم حفظ فاتورة المورد. أرسلها لاعتماد المالك."));
  };
  const issueSalesInvoice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invoiceDate = String(new FormData(event.currentTarget).get("invoiceDate") ?? "");
    void run(() => sendJson(`/api/sales-shipments/${shipmentId}/sales-invoice`, "POST", { invoiceDate }), t("Customer invoice issued.", "تم إصدار فاتورة العميل."));
  };
  const reasonForm = (label: string, submit: string, onReason: (reason: string) => void) => <form className="ship-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); onReason(String(new FormData(event.currentTarget).get("reason") ?? "").trim());
  }}>
    <label>{label}<textarea name="reason" required minLength={3} maxLength={500} rows={2}/></label>
    <div className="ship-buttons"><button type="submit" className="orb-button-filled" disabled={busy}>{submit}</button><button type="button" onClick={() => setOpen(null)}>{t("Back", "رجوع")}</button></div>
  </form>;

  return <section className="ship-card" aria-labelledby="invoices-title" style={{ marginBlockEnd: 12 }} data-testid="shipment-invoices">
    <h2 id="invoices-title">{kind === "SUPPLIER" ? t("Supplier invoice", "فاتورة المورد") : t("Customer invoice", "فاتورة العميل")}</h2>
    {notice && <p className="ship-banner" data-tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}

    {invoices.length === 0 && <p className="orb-muted">{invoiceable
      ? (kind === "SUPPLIER" ? t("No supplier invoice recorded yet.", "لم تُسجّل فاتورة مورد بعد.") : t("No customer invoice issued yet.", "لم تصدر فاتورة للعميل بعد."))
      : t("Invoices can be added once the shipment is confirmed.", "يمكن إضافة الفواتير بعد تأكيد الشحنة.")}</p>}

    {invoices.length > 0 && <table><thead><tr>
      <th>{t("Invoice", "الفاتورة")}</th><th>{t("Date", "التاريخ")}</th><th>{t("Amount", "المبلغ")}</th><th>{t("Status", "الحالة")}</th><th>{t("Actions", "الإجراءات")}</th>
    </tr></thead><tbody>{invoices.map((invoice) => {
      const state = STATES[invoice.state] ?? [invoice.state, invoice.state, "warning"];
      const differs = kind === "SUPPLIER" && Number(invoice.amount) !== Number(invoice.expectedAmount);
      const selfRequested = invoice.requesterId === me?.id;
      return <tr key={invoice.id}>
        <td><bdi>{invoice.reference}</bdi>{invoice.document && <><br/><a href={`/api/evidence/${invoice.document.id}/content`} target="_blank" rel="noreferrer">{t("View document", "عرض المستند")}</a></>}</td>
        <td><bdi>{invoice.invoiceDate}</bdi></td>
        <td><bdi>{money(invoice.amount, invoice.currency)}</bdi>
          {differs && <><br/><small data-tone="warning">{t(`Expected ${money(invoice.expectedAmount, invoice.currency)} from the contract`, `المتوقع حسب العقد ${money(invoice.expectedAmount, invoice.currency)}`)}</small></>}
          <br/><small className="orb-muted"><bdi>{Number(invoice.quantity).toLocaleString("en-US", { maximumFractionDigits: 3 })} MT × {Number(invoice.unitPrice).toLocaleString("en-US", { maximumFractionDigits: 2 })}</bdi></small></td>
        <td><span className="orb-chip" data-tone={state[2]}>{state[ar ? 1 : 0]}</span>
          {invoice.state === "REJECTED" && invoice.lastDecision?.comment && <><br/><small>{invoice.lastDecision.comment}</small></>}
          {invoice.state === "CANCELLED" && invoice.cancellationReason && <><br/><small>{invoice.cancellationReason}</small></>}</td>
        <td><div className="ship-buttons">
          {finance && invoice.type === "SUPPLIER" && invoice.state === "DRAFT" && <button type="button" data-operation-id="submitSupplierInvoice" disabled={busy} onClick={() => void run(() => sendJson(`/api/supplier-invoices/${invoice.id}/submit`, "POST", {}), t("Sent to the owner for approval.", "أُرسلت للمالك للاعتماد."))}>{t("Submit for approval", "إرسال للاعتماد")}</button>}
          {owner && invoice.state === "PENDING_APPROVAL" && invoice.pendingApprovalId && !selfRequested && <>
            <button type="button" data-operation-id="decideFixedApproval" disabled={busy} onClick={() => void run(() => sendJson(`/api/approvals/${invoice.pendingApprovalId}/decision`, "POST", { decision: "APPROVED" }), t("Invoice approved.", "تم اعتماد الفاتورة."))}>{t("Approve", "اعتماد")}</button>
            <button type="button" data-operation-id="decideFixedApproval" onClick={() => setOpen(`REJECT:${invoice.id}`)}>{t("Reject", "رفض")}</button></>}
          {owner && invoice.state === "PENDING_APPROVAL" && selfRequested && <small className="orb-muted">{t("Another owner must approve.", "يجب أن يعتمدها مالك آخر.")}</small>}
          {invoice.type === "SALES" && invoice.state === "ISSUED" && <a href={`/sales-invoices/${invoice.id}/print?locale=${locale}`} target="_blank" rel="noreferrer">{t("Print", "طباعة")}</a>}
          {finance && ["DRAFT", "PENDING_APPROVAL", "CONFIRMED", "ISSUED"].includes(invoice.state) && <button type="button" data-danger data-operation-id={invoice.type === "SUPPLIER" ? "cancelUnallocatedSupplierInvoice" : "cancelUnallocatedSalesInvoice"} onClick={() => setOpen(`CANCEL:${invoice.id}`)}>{t("Cancel", "إلغاء")}</button>}
        </div></td>
      </tr>;
    })}</tbody></table>}

    {invoices.map((invoice) => <div key={invoice.id}>
      {open === `CANCEL:${invoice.id}` && reasonForm(t(`Why is invoice ${invoice.reference} cancelled?`, `سبب إلغاء الفاتورة ${invoice.reference}؟`), t("Cancel invoice", "إلغاء الفاتورة"),
        (reason) => void run(() => sendJson(`/api/${invoice.type === "SUPPLIER" ? "supplier" : "sales"}-invoices/${invoice.id}/cancel`, "POST", { reason }), t("Invoice cancelled.", "تم إلغاء الفاتورة.")))}
      {open === `REJECT:${invoice.id}` && reasonForm(t("What needs to be corrected?", "ما الذي يجب تصحيحه؟"), t("Reject invoice", "رفض الفاتورة"),
        (comment) => void run(() => sendJson(`/api/approvals/${invoice.pendingApprovalId}/decision`, "POST", { decision: "REJECTED", comment }), t("Invoice rejected.", "تم رفض الفاتورة.")))}
    </div>)}

    {finance && invoiceable && !active && open !== "CREATE" && <div className="ship-actions">
      <button type="button" data-primary data-operation-id={kind === "SUPPLIER" ? "createSupplierInvoice" : "createSalesInvoice"} onClick={() => setOpen("CREATE")}>
        {kind === "SUPPLIER" ? t("Record supplier invoice", "تسجيل فاتورة المورد") : t("Issue customer invoice", "إصدار فاتورة العميل")}</button>
    </div>}

    {open === "CREATE" && kind === "SUPPLIER" && <form className="ship-form" onSubmit={createSupplierInvoice} encType="multipart/form-data">
      <div className="grid">
        <label>{t("Supplier invoice number", "رقم فاتورة المورد")}<input name="reference" required maxLength={64} dir="ltr"/></label>
        <label>{t("Invoice date", "تاريخ الفاتورة")}<input name="invoiceDate" type="date" required max={today()} defaultValue={today()}/></label>
        <label>{t("Amount on the invoice", "المبلغ في الفاتورة")}<input name="amount" required inputMode="decimal" dir="ltr"/></label>
      </div>
      <label>{t("Invoice document (PDF, JPG or PNG, up to 10 MB)", "مستند الفاتورة (PDF أو JPG أو PNG حتى 10 ميجا)")}<input name="file" type="file" required accept="application/pdf,image/jpeg,image/png"/></label>
      <p className="orb-muted">{t("The line is the shipment quantity × the purchase contract price. If the amount differs, it will be shown to the approver.", "سطر الفاتورة = كمية الشحنة × سعر عقد الشراء. إذا اختلف المبلغ سيظهر الفرق للمعتمد.")}</p>
      <div className="ship-buttons"><button type="submit" className="orb-button-filled" disabled={busy}>{t("Save invoice", "حفظ الفاتورة")}</button><button type="button" onClick={() => setOpen(null)}>{t("Back", "رجوع")}</button></div>
    </form>}
    {open === "CREATE" && kind === "SALES" && <form className="ship-form" onSubmit={issueSalesInvoice}>
      <label>{t("Invoice date", "تاريخ الفاتورة")}<input name="invoiceDate" type="date" required max={today()} defaultValue={today()}/></label>
      <p className="orb-muted">{t("The invoice number is assigned automatically. The line is the shipment quantity × the sales contract price.", "رقم الفاتورة يُحدد تلقائياً. السطر = كمية الشحنة × سعر عقد البيع.")}</p>
      <div className="ship-buttons"><button type="submit" className="orb-button-filled" disabled={busy}>{t("Issue invoice", "إصدار الفاتورة")}</button><button type="button" onClick={() => setOpen(null)}>{t("Back", "رجوع")}</button></div>
    </form>}
  </section>;
}
