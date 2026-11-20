"use client";

import { useEffect, useState } from "react";
import { problemOf, type ApiProblem } from "../../session-client";
import { DocumentFrame, PrintToolbar, Totals, date, fmt, labeler, type DocumentCompany } from "../documents/DocumentFrame";

interface PrintData {
  invoice: { reference: string; invoiceDate: string; state: string; currency: string; amount: string; paid: string; outstanding: string; shipmentId: string;
    vat?: { treatment: "STANDARD" | "ZERO_RATED" | "EXEMPT" | "OUT_OF_SCOPE"; rate: string; amount: string; net: string } | null };
  company: DocumentCompany;
  buyer: { reference: string; name: string; nameAr: string | null; address: string | null; taxNumber: string | null; paymentTermsDays: number };
  project: { reference: string };
  shipment: { reference: string; customerPurchaseOrder: string | null; containers: string[]; route: string; incoterm: string };
  product: { name: string; nameAr: string | null };
  lines: { lineNo: number; description: string; quantity: string; unitPrice: string; lineAmount: string }[];
  paymentTerms: string; issuedAt: string | null; issuedByName: string | null;
}

const USD_AED = 3.6725;
const VAT_LABEL: Record<string, [string, string]> = {
  STANDARD: ["Standard rated", "خاضع للنسبة الأساسية"], ZERO_RATED: ["Zero rated", "خاضع لنسبة صفر"],
  EXEMPT: ["Exempt", "معفى"], OUT_OF_SCOPE: ["Outside the scope of VAT", "خارج نطاق الضريبة"],
};

/** The customer invoice — a tax invoice when the company is VAT registered — in the company's document design. */
export function SalesInvoicePrint({ invoiceId, locale }: { readonly invoiceId: string; readonly locale: "en" | "ar" }) {
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [data, setData] = useState<PrintData | null>(null);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  useEffect(() => {
    void fetch(`/api/sales-invoices/${invoiceId}/print-data`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) { setProblem(await problemOf(response)); return; }
      setData(await response.json() as PrintData);
    });
  }, [invoiceId]);

  if (problem) return <section dir={ar ? "rtl" : "ltr"} style={{ padding: 32 }}><h1>{problem.status === 404 ? t("Invoice not found", "الفاتورة غير موجودة") : t("Invoice unavailable", "الفاتورة غير متاحة")}</h1>
    <p>{problem.status === 404 ? t("It may belong to another company or have an old link.", "قد تكون تابعة لشركة أخرى أو الرابط قديم.") : t("Sign in with a finance or owner account, or try again in a moment.", "سجّل الدخول بحساب مالية أو مالك، أو حاول بعد قليل.")}</p></section>;
  if (!data) return <section style={{ padding: 32 }}><h1 className="orb-sr-only">{t("Customer invoice", "فاتورة العميل")}</h1><p role="status">{t("Loading invoice…", "جارٍ تحميل الفاتورة…")}</p></section>;

  const { invoice, buyer, shipment, company } = data;
  const L = labeler(company.documentLanguage);
  const vat = invoice.vat ?? { treatment: "OUT_OF_SCOPE" as const, rate: "0.00", amount: "0.00", net: invoice.amount };
  const taxInvoice = company.vatRegistered && vat.treatment !== "OUT_OF_SCOPE";
  const aedRate = invoice.currency === "AED" ? 1 : invoice.currency === "USD" ? USD_AED : null;
  const due = buyer.paymentTermsDays ? new Date(Date.parse(`${invoice.invoiceDate}T00:00:00Z`) + buyer.paymentTermsDays * 86400000).toISOString().slice(0, 10) : null;
  const rateText = `${Number(vat.rate)}%`;
  const missing = !company.trn || !company.addressEn;

  return <DocumentFrame company={company}
    titleEn={taxInvoice ? "Tax Invoice" : "Invoice"} titleAr={taxInvoice ? "فاتورة ضريبية" : "فاتورة"}
    stamp={invoice.state === "CANCELLED" ? t("CANCELLED", "ملغاة") : null}
    toolbar={<>
      <PrintToolbar locale={locale} onBack={`/sales-shipments/${invoice.shipmentId}?locale=${locale}`}/>
      {missing && <span className="doc-hint" role="note">{t("Add your company address and tax number under the gear → Account and settings so they print here.", "أضف عنوان الشركة والرقم الضريبي من الترس ← الحساب والإعدادات ليظهرا هنا.")}</span>}
    </>}
    party={{ headingEn: "Bill to", headingAr: "فاتورة إلى", name: company.documentLanguage === "AR" && buyer.nameAr ? buyer.nameAr : buyer.name, lines: [
      company.documentLanguage === "BILINGUAL" && buyer.nameAr ? <span dir="rtl" lang="ar">{buyer.nameAr}</span> : null,
      buyer.address,
      buyer.taxNumber ? <>{L("Customer TRN", "الرقم الضريبي للعميل")}: <bdi>{buyer.taxNumber}</bdi></> : null,
      <>{L("Customer no.", "رقم العميل")}: <bdi>{buyer.reference}</bdi></>,
    ] }}
    meta={[
      ["Invoice no.", "رقم الفاتورة", invoice.reference],
      ["Invoice date", "تاريخ الفاتورة", date(invoice.invoiceDate)],
      ["Due date", "تاريخ الاستحقاق", due ? `${date(due)} (${buyer.paymentTermsDays} ${ar ? "يوم" : "days"})` : null],
      ["Project", "المشروع", data.project.reference],
      ["Customer PO", "أمر شراء العميل", shipment.customerPurchaseOrder],
      ["Shipment", "الشحنة", shipment.reference],
      ["Containers", "الحاويات", shipment.containers.length ? shipment.containers.join(", ") : null],
      ["Incoterm", "شرط التسليم", shipment.incoterm],
    ]}
    totals={<Totals label={L} rows={[
      ["Subtotal (excl. VAT)", "الإجمالي قبل الضريبة", `${invoice.currency} ${fmt(vat.net)}`],
      [`VAT ${rateText}`, `الضريبة ${rateText}`, `${invoice.currency} ${fmt(vat.amount)}`],
      ["Total", "الإجمالي", `${invoice.currency} ${fmt(invoice.amount)}`, true],
      ...(Number(invoice.paid) > 0 ? [["Paid", "المدفوع", `${invoice.currency} ${fmt(invoice.paid)}`] as const, ["Balance due", "المتبقي", `${invoice.currency} ${fmt(invoice.outstanding)}`, true] as const] : []),
      ...(taxInvoice && aedRate && invoice.currency !== "AED" ? [
        [`Total in AED @ ${aedRate}`, "الإجمالي بالدرهم", `AED ${fmt(Number(invoice.amount) * aedRate)}`] as const,
        ["VAT in AED", "الضريبة بالدرهم", `AED ${fmt(Number(vat.amount) * aedRate)}`] as const,
      ] : []),
    ]}/>}
    notes={<>
      {taxInvoice && <div><strong>{L("VAT treatment", "المعاملة الضريبية")}:</strong> {L(VAT_LABEL[vat.treatment][0], VAT_LABEL[vat.treatment][1])}</div>}
      {data.paymentTerms && <div><strong>{L("Payment terms", "شروط الدفع")}:</strong> {data.paymentTerms}</div>}
      {shipment.route && <div><strong>{L("Route", "المسار")}:</strong> {shipment.route}</div>}
      {data.issuedByName && <div className="doc-muted">{L("Issued by", "أصدرها")} {data.issuedByName}</div>}
    </>}>
    <table>
      <thead><tr>
        <th style={{ width: 28 }}>#</th>
        <th>{L("Description", "الوصف")}</th>
        <th className="num">{L("Qty (MT)", "الكمية (طن)")}</th>
        <th className="num">{L("Rate", "السعر")}</th>
        {taxInvoice && <th className="num">{L("VAT", "الضريبة")}</th>}
        <th className="num">{L("Amount", "المبلغ")} ({invoice.currency})</th>
      </tr></thead>
      <tbody>
        {data.lines.map((line) => <tr key={line.lineNo}>
          <td>{line.lineNo}</td>
          <td>{line.description}{company.documentLanguage !== "EN" && data.product.nameAr ? <div className="doc-muted" dir="rtl" lang="ar">{data.product.nameAr}</div> : null}</td>
          <td className="num">{fmt(line.quantity, 3)}</td>
          <td className="num">{fmt(line.unitPrice)}</td>
          {taxInvoice && <td className="num">{rateText}</td>}
          <td className="num">{fmt(line.lineAmount)}</td>
        </tr>)}
      </tbody>
    </table>
  </DocumentFrame>;
}
