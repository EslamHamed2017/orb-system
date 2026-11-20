"use client";

import { useEffect, useState } from "react";
import { problemOf, type ApiProblem } from "../../session-client";
import { DocumentFrame, PrintToolbar, Totals, date, fmt, labeler, type DocumentCompany } from "./DocumentFrame";

/**
 * Every printed trade document beyond the invoice, in the company's document design:
 * statement of account, receipt / payment voucher, sales contract / purchase order, commercial invoice, packing list.
 */
type Locale = "en" | "ar";

function useData<T>(urls: readonly string[]) {
  const [data, setData] = useState<T[] | null>(null);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const key = urls.join("|");
  useEffect(() => {
    let live = true;
    void Promise.all(urls.map(async (url) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw await problemOf(response);
      return await response.json() as T;
    })).then((values) => live && setData(values)).catch((error: ApiProblem) => live && setProblem(error?.status ? error : { status: 503, code: "DEPENDENCY_UNAVAILABLE" }));
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, problem };
}

function Status({ locale, problem, title }: { readonly locale: Locale; readonly problem: ApiProblem | null; readonly title: string }) {
  const ar = locale === "ar", t = (en: string, arabic: string) => (ar ? arabic : en);
  return <section dir={ar ? "rtl" : "ltr"} style={{ padding: 32 }}><h1>{title}</h1>
    {problem ? <p role="alert">{problem.status === 403 ? t("Your role cannot open this document.", "دورك لا يسمح بفتح هذا المستند.") : problem.status === 404 ? t("Not found. It may belong to another company or have an old link.", "غير موجود. قد يكون تابعاً لشركة أخرى أو الرابط قديم.") : t("The document could not be loaded. Try again in a moment.", "تعذر تحميل المستند. حاول مرة أخرى بعد قليل.")}</p>
      : <p role="status" aria-busy="true">{t("Loading…", "جارٍ التحميل…")}</p>}
  </section>;
}

// ---------------- statement of account ----------------

const NOWRAP = { whiteSpace: "nowrap" } as const;

interface Statement {
  type: "customer" | "supplier"; asOf: string; from: string | null; company: DocumentCompany;
  party: { reference: string; name: string; nameAr: string | null; address: string | null; taxNumber: string | null; email: string | null; paymentTermsDays: number };
  sections: { currency: string; opening: string; closing: string; unappliedPayments: string;
    lines: { date: string; type: string; reference: string; projectReference: string; dueDate: string | null; charge: string; payment: string; balance: string }[];
    aging: { current: string; days1to30: string; days31to60: string; days61to90: string; over90: string } }[];
}
const LINE_TYPES: Record<string, [string, string]> = {
  INVOICE: ["Invoice", "فاتورة"], BILL: ["Bill", "فاتورة مورد"], CUSTOMER_RECEIPT: ["Payment received", "دفعة مستلمة"], CUSTOMER_REFUND: ["Refund to customer", "رد للعميل"],
  SUPPLIER_PAYMENT: ["Payment made", "دفعة مسددة"], SUPPLIER_REFUND: ["Refund from supplier", "استرداد من المورد"],
};

export function StatementPrint({ type, id, locale, asOf, from }: { readonly type: string; readonly id: string; readonly locale: Locale; readonly asOf?: string; readonly from?: string }) {
  const q = new URLSearchParams({ ...(asOf ? { asOf } : {}), ...(from ? { from } : {}) }).toString();
  const { data, problem } = useData<Statement>([`/api/statements/${type}/${id}${q ? `?${q}` : ""}`]);
  if (!data) return <Status locale={locale} problem={problem} title={locale === "ar" ? "كشف حساب" : "Statement"}/>;
  const s = data[0], c = s.company, L = labeler(c.documentLanguage);
  return <DocumentFrame company={c} titleEn="Statement of account" titleAr="كشف حساب" signature={false}
    toolbar={<PrintToolbar locale={locale}/>}
    party={{ headingEn: s.type === "customer" ? "Customer" : "Supplier", headingAr: s.type === "customer" ? "العميل" : "المورد", name: s.party.name, lines: [
      c.documentLanguage !== "EN" && s.party.nameAr ? <span dir="rtl" lang="ar">{s.party.nameAr}</span> : null, s.party.address,
      s.party.taxNumber ? <>{L("TRN", "الرقم الضريبي")}: <bdi>{s.party.taxNumber}</bdi></> : null, s.party.email] }}
    meta={[["Statement date", "تاريخ الكشف", date(s.asOf)], ["Period from", "من تاريخ", s.from ? date(s.from) : null], ["Account no.", "رقم الحساب", s.party.reference], ["Payment terms", "شروط الدفع", s.party.paymentTermsDays ? `${s.party.paymentTermsDays} ${locale === "ar" ? "يوم" : "days"}` : null]]}>
    {s.sections.length === 0 && <p>{L("No transactions.", "لا توجد معاملات.")}</p>}
    {s.sections.map((section) => <section key={section.currency} style={{ display: "grid", gap: 10 }}>
      <table>
        <thead><tr><th>{L("Date", "التاريخ")}</th><th>{L("Transaction", "المعاملة")}</th><th>{L("Project", "المشروع")}</th><th>{L("Due", "الاستحقاق")}</th>
          <th className="num">{L("Amount", "المبلغ")}</th><th className="num">{L("Payment", "الدفعة")}</th><th className="num">{L("Balance", "الرصيد")} ({section.currency})</th></tr></thead>
        <tbody>
          {s.from && <tr><td style={NOWRAP}>{date(s.from)}</td><td colSpan={5}>{L("Opening balance", "الرصيد الافتتاحي")}</td><td className="num">{fmt(section.opening)}</td></tr>}
          {section.lines.map((line, index) => <tr key={index}><td style={NOWRAP}>{date(line.date)}</td><td>{L(...(LINE_TYPES[line.type] ?? [line.type, line.type]))}<div style={NOWRAP}><bdi>{line.reference}</bdi></div></td><td style={NOWRAP}><bdi>{line.projectReference}</bdi></td>
            <td style={NOWRAP}>{line.dueDate ? date(line.dueDate) : ""}</td><td className="num">{line.charge ? fmt(line.charge) : ""}</td><td className="num">{line.payment ? fmt(line.payment) : ""}</td><td className="num">{fmt(line.balance)}</td></tr>)}
        </tbody>
      </table>
      <table>
        <thead><tr><th className="num">{L("Current", "غير مستحق")}</th><th className="num">1–30</th><th className="num">31–60</th><th className="num">61–90</th><th className="num">90+</th><th className="num">{L("Amount due", "المبلغ المستحق")} ({section.currency})</th></tr></thead>
        <tbody><tr>{[section.aging.current, section.aging.days1to30, section.aging.days31to60, section.aging.days61to90, section.aging.over90].map((v, i) => <td key={i} className="num">{fmt(v)}</td>)}<td className="num"><strong>{fmt(section.closing)}</strong></td></tr></tbody>
      </table>
      {Number(section.unappliedPayments) > 0 && <div className="doc-muted">{L("Payments not yet matched to invoices", "دفعات لم تطابق مع فواتير بعد")}: {section.currency} {fmt(section.unappliedPayments)}</div>}
    </section>)}
  </DocumentFrame>;
}

// ---------------- receipt / payment voucher ----------------

interface Money {
  project: { reference: string; currency: string }; customer: { name: string };
  movements: { id: string; kind: string; counterparty: { type: string; name: string }; amount: string; currency: string; fxRate: string; aedAmount: string; occurredOn: string; reference: string; notes: string | null; state: string; recordedByName: string;
    allocations: { invoiceReference: string; amount: string; state: string }[]; unallocated: string; reversalReason: string | null }[];
}
const RECEIPT_TITLES: Record<string, [string, string]> = {
  CUSTOMER_RECEIPT: ["Receipt", "إيصال استلام"], SUPPLIER_PAYMENT: ["Payment voucher", "سند صرف"],
  CUSTOMER_REFUND: ["Refund voucher", "سند رد مبلغ"], SUPPLIER_REFUND: ["Refund receipt", "إيصال استرداد"],
};

export function ReceiptPrint({ movementId, projectId, locale }: { readonly movementId: string; readonly projectId: string; readonly locale: Locale }) {
  const { data, problem } = useData<unknown>([`/api/projects/${projectId}/money-movements`, "/api/company/document-profile"]);
  if (!data) return <Status locale={locale} problem={problem} title={locale === "ar" ? "إيصال" : "Receipt"}/>;
  const money = data[0] as Money, c = data[1] as DocumentCompany, L = labeler(c.documentLanguage);
  const mv = money.movements.find((x) => x.id === movementId);
  if (!mv) return <Status locale={locale} problem={{ status: 404, code: "RESOURCE_NOT_FOUND" }} title={locale === "ar" ? "إيصال" : "Receipt"}/>;
  const title = RECEIPT_TITLES[mv.kind] ?? ["Receipt", "إيصال"];
  const incoming = mv.kind === "CUSTOMER_RECEIPT" || mv.kind === "SUPPLIER_REFUND";
  const active = mv.allocations.filter((a) => a.state === "ACTIVE");
  return <DocumentFrame company={c} titleEn={title[0]} titleAr={title[1]} toolbar={<PrintToolbar locale={locale} onBack={`/projects/${projectId}/money?locale=${locale}`}/>}
    stamp={mv.state === "REVERSED" ? (locale === "ar" ? "معكوس" : "REVERSED") : null}
    party={{ headingEn: incoming ? "Received from" : "Paid to", headingAr: incoming ? "استلمنا من" : "صُرف إلى", name: mv.counterparty.name, lines: [] }}
    meta={[["Number", "الرقم", mv.reference], ["Date", "التاريخ", date(mv.occurredOn)], ["Project", "المشروع", money.project.reference], ["Exchange rate to AED", "سعر الصرف للدرهم", mv.currency === "AED" ? null : mv.fxRate]]}
    totals={<Totals label={L} rows={[["Amount", "المبلغ", `${mv.currency} ${fmt(mv.amount)}`, true], ["In AED", "بالدرهم", `AED ${fmt(mv.aedAmount)}`], ...(Number(mv.unallocated) > 0 ? [["Not matched to an invoice", "غير مطابق مع فاتورة", `${mv.currency} ${fmt(mv.unallocated)}`] as const] : [])]}/>}
    notes={<>{mv.notes && <div><strong>{L("Notes", "ملاحظات")}:</strong> {mv.notes}</div>}<div className="doc-muted">{L("Recorded by", "سجّلها")} {mv.recordedByName}</div></>}>
    <table>
      <thead><tr><th>{L("Invoice", "الفاتورة")}</th><th className="num">{L("Amount applied", "المبلغ المطبق")} ({mv.currency})</th></tr></thead>
      <tbody>{active.length ? active.map((a, i) => <tr key={i}><td><bdi>{a.invoiceReference}</bdi></td><td className="num">{fmt(a.amount)}</td></tr>)
        : <tr><td colSpan={2}>{L("Advance payment — not yet matched to an invoice", "دفعة مقدمة — لم تطابق مع فاتورة بعد")}</td></tr>}</tbody>
    </table>
  </DocumentFrame>;
}

// ---------------- sales contract / purchase order ----------------

interface ContractVersion { revisionNo: number; effectiveDate: string; product: { reference: string; nameEn: string; nameAr: string }; quantity: string; unitPrice: string; currency: string; incoterm: string; namedPlace: string; paymentTerms: string; documentTerms: string;
  tolerances: { quantityUnder: string; quantityOver: string } }
interface ProjectRecord { reference: string; customer: { reference: string; legalName: string; legalNameAr: string | null };
  salesContract: { id: string; reference: string; state: string; activeVersion: ContractVersion };
  purchaseContracts: { id: string; reference: string; state: string; supplier: { reference: string; registeredName: string; displayNameAr: string | null }; activeVersion: ContractVersion }[] }

export function ContractPrint({ contractId, projectId, locale }: { readonly contractId: string; readonly projectId: string; readonly locale: Locale }) {
  const { data, problem } = useData<unknown>([`/api/projects/${projectId}`, "/api/company/document-profile"]);
  if (!data) return <Status locale={locale} problem={problem} title={locale === "ar" ? "عقد" : "Contract"}/>;
  const p = data[0] as ProjectRecord, c = data[1] as DocumentCompany, L = labeler(c.documentLanguage);
  const sales = p.salesContract.id === contractId;
  const purchase = p.purchaseContracts.find((k) => k.id === contractId);
  if (!sales && !purchase) return <Status locale={locale} problem={{ status: 404, code: "RESOURCE_NOT_FOUND" }} title={locale === "ar" ? "عقد" : "Contract"}/>;
  const k = sales ? p.salesContract : purchase!;
  const v = k.activeVersion;
  const total = Number(v.quantity) * Number(v.unitPrice);
  return <DocumentFrame company={c} signature={false} titleEn={sales ? "Sales contract" : "Purchase order"} titleAr={sales ? "عقد بيع" : "أمر شراء"}
    toolbar={<PrintToolbar locale={locale} onBack={`/projects/${projectId}/contracts?locale=${locale}`}/>}
    stamp={k.state === "DRAFT" ? (locale === "ar" ? "مسودة" : "DRAFT") : null}
    party={sales ? { headingEn: "Buyer", headingAr: "المشتري", name: p.customer.legalName, lines: [c.documentLanguage !== "EN" && p.customer.legalNameAr ? <span dir="rtl" lang="ar">{p.customer.legalNameAr}</span> : null, <>{L("Customer no.", "رقم العميل")}: <bdi>{p.customer.reference}</bdi></>] }
      : { headingEn: "Supplier", headingAr: "المورد", name: purchase!.supplier.registeredName, lines: [c.documentLanguage !== "EN" && purchase!.supplier.displayNameAr ? <span dir="rtl" lang="ar">{purchase!.supplier.displayNameAr}</span> : null, <>{L("Supplier no.", "رقم المورد")}: <bdi>{purchase!.supplier.reference}</bdi></>] }}
    meta={[[sales ? "Contract no." : "PO no.", sales ? "رقم العقد" : "رقم أمر الشراء", k.reference], ["Revision", "الإصدار", String(v.revisionNo)], ["Effective date", "تاريخ السريان", date(v.effectiveDate)], ["Project", "المشروع", p.reference],
      ["Incoterm", "شرط التسليم", `${v.incoterm} ${v.namedPlace}`]]}
    totals={<Totals label={L} rows={[["Contract value", "قيمة العقد", `${v.currency} ${fmt(total)}`, true]]}/>}
    notes={<>
      <div><strong>{L("Quantity tolerance", "سماحية الكمية")}:</strong> −{Number(v.tolerances.quantityUnder)}% / +{Number(v.tolerances.quantityOver)}%</div>
      {v.paymentTerms && <div><strong>{L("Payment terms", "شروط الدفع")}:</strong> {v.paymentTerms}</div>}
      {v.documentTerms && <div><strong>{L("Documents required", "المستندات المطلوبة")}:</strong> {v.documentTerms}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
      <div><div className="doc-label">{L(sales ? "For the seller" : "For the buyer", sales ? "عن البائع" : "عن المشتري")}</div><div className="doc-sign-line"/></div>
      <div><div className="doc-label">{L(sales ? "For the buyer" : "For the supplier", sales ? "عن المشتري" : "عن المورد")}</div><div className="doc-sign-line"/></div>
    </div>
    </>}>
    <table>
      <thead><tr><th>{L("Product", "المنتج")}</th><th className="num">{L("Quantity (MT)", "الكمية (طن)")}</th><th className="num">{L("Unit price", "سعر الوحدة")}</th><th className="num">{L("Amount", "المبلغ")} ({v.currency})</th></tr></thead>
      <tbody><tr><td>{v.product.nameEn}{c.documentLanguage !== "EN" && v.product.nameAr ? <div className="doc-muted" dir="rtl" lang="ar">{v.product.nameAr}</div> : null}<div className="doc-muted"><bdi>{v.product.reference}</bdi></div></td>
        <td className="num">{fmt(v.quantity, 3)}</td><td className="num">{fmt(v.unitPrice)}</td><td className="num">{fmt(total)}</td></tr></tbody>
    </table>
  </DocumentFrame>;
}

// ---------------- commercial invoice / packing list ----------------

interface Shipment {
  kind: "SALES" | "SUPPLIER"; reference: string; projectReference: string; executionState: string;
  contract: { reference: string };
  product: { name: string; nameAr: string | null }; counterparty: { reference: string; name: string; nameAr: string | null } | null;
  dataset: { quantity: string; bagCount: number; bagWeight: string; netWeight: string; grossWeight: string; lotOrOrderReference: string | null; containerNumbers: string[]; sealNumbers: string[];
    incoterm: string; namedPlace: string; origin: string; loadLocation: string; dischargeLocation: string | null; destination: string;
    transport: { mode: string; carrier: string; reference: string; vesselOrVehicle: string | null; voyageOrTrip: string | null; estimatedDeparture: string | null; estimatedArrival: string | null } };
}

export function ShipmentDocumentPrint({ shipmentId, document, locale }: { readonly shipmentId: string; readonly document: "commercial-invoice" | "packing-list"; readonly locale: Locale }) {
  const { data, problem } = useData<unknown>([`/api/sales-shipments/${shipmentId}`, "/api/company/document-profile"]);
  if (!data) return <Status locale={locale} problem={problem} title={document === "packing-list" ? (locale === "ar" ? "قائمة التعبئة" : "Packing list") : (locale === "ar" ? "فاتورة تجارية" : "Commercial invoice")}/>;
  const s = data[0] as Shipment, c = data[1] as DocumentCompany, L = labeler(c.documentLanguage);
  const invoices = ((s as unknown as { invoices?: { reference: string; state: string; amount: string; currency: string; unitPrice: string; vat?: { net: string } }[] }).invoices ?? []).filter((i) => i.state !== "CANCELLED");
  const invoice = invoices[0];
  const d = s.dataset;
  const packing = document === "packing-list";
  const price = invoice ? Number(invoice.unitPrice) : 0;
  const currency = invoice?.currency ?? "";
  const value = invoice?.vat?.net ? Number(invoice.vat.net) : Number(d.quantity) * price;
  return <DocumentFrame company={c} titleEn={packing ? "Packing list" : "Commercial invoice"} titleAr={packing ? "قائمة التعبئة" : "فاتورة تجارية"}
    toolbar={<PrintToolbar locale={locale} onBack={`/sales-shipments/${shipmentId}?locale=${locale}`}/>}
    party={{ headingEn: "Consignee", headingAr: "المرسل إليه", name: s.counterparty?.name ?? "—", lines: [c.documentLanguage !== "EN" && s.counterparty?.nameAr ? <span dir="rtl" lang="ar">{s.counterparty.nameAr}</span> : null] }}
    meta={[["Shipment", "الشحنة", s.reference], ["Invoice no.", "رقم الفاتورة", invoice?.reference ?? null], ["Contract", "العقد", s.contract.reference], ["Project", "المشروع", s.projectReference],
      ["Customer PO", "أمر شراء العميل", d.lotOrOrderReference], ["Incoterm", "شرط التسليم", `${d.incoterm} ${d.namedPlace}`],
      ["Vessel / voyage", "السفينة / الرحلة", [d.transport.vesselOrVehicle, d.transport.voyageOrTrip].filter(Boolean).join(" / ") || null], ["Carrier / B/L", "الناقل / بوليصة الشحن", [d.transport.carrier, d.transport.reference].filter(Boolean).join(" / ")],
      ["Port of loading", "ميناء الشحن", d.loadLocation], ["Port of discharge", "ميناء التفريغ", d.dischargeLocation], ["Final destination", "الوجهة النهائية", d.destination], ["Country of origin", "بلد المنشأ", d.origin],
      ["ETD / ETA", "المغادرة / الوصول", [d.transport.estimatedDeparture, d.transport.estimatedArrival].filter(Boolean).map((x) => date(x)).join(" → ") || null]]}
    totals={packing ? <Totals label={L} rows={[["Total bags", "إجمالي الأكياس", String(d.bagCount)], ["Total net weight", "إجمالي الوزن الصافي", `${fmt(d.netWeight, 3)} kg`], ["Total gross weight", "إجمالي الوزن القائم", `${fmt(d.grossWeight, 3)} kg`, true]]}/>
      : <Totals label={L} rows={[["Total value", "القيمة الإجمالية", `${currency} ${fmt(value)}`, true]]}/>}
    notes={<div><strong>{L("Containers / seals", "الحاويات / الأختام")}:</strong> <bdi>{d.containerNumbers.join(", ") || "—"}</bdi>{d.sealNumbers.length ? <> · <bdi>{d.sealNumbers.join(", ")}</bdi></> : null}</div>}>
    <table>
      <thead><tr><th>{L("Description of goods", "وصف البضاعة")}</th>
        {packing ? <><th className="num">{L("Bags", "الأكياس")}</th><th className="num">{L("Bag weight (kg)", "وزن الكيس (كجم)")}</th><th className="num">{L("Net (kg)", "الصافي (كجم)")}</th><th className="num">{L("Gross (kg)", "القائم (كجم)")}</th></>
          : <><th className="num">{L("Qty (MT)", "الكمية (طن)")}</th><th className="num">{L("Unit price", "سعر الوحدة")}</th><th className="num">{L("Amount", "المبلغ")} ({currency})</th></>}</tr></thead>
      <tbody><tr><td>{s.product.name}{c.documentLanguage !== "EN" && s.product.nameAr ? <div className="doc-muted" dir="rtl" lang="ar">{s.product.nameAr}</div> : null}<div className="doc-muted">{L("Origin", "المنشأ")}: {d.origin}</div></td>
        {packing ? <><td className="num">{d.bagCount}</td><td className="num">{fmt(d.bagWeight, 3)}</td><td className="num">{fmt(d.netWeight, 3)}</td><td className="num">{fmt(d.grossWeight, 3)}</td></>
          : <><td className="num">{fmt(d.quantity, 3)}</td><td className="num">{fmt(price)}</td><td className="num">{fmt(value)}</td></>}</tr></tbody>
    </table>
  </DocumentFrame>;
}
