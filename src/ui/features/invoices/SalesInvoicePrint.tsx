"use client";

import { useEffect, useState } from "react";
import { problemOf, type ApiProblem } from "../../session-client";

interface PrintData {
  invoice: { reference: string; invoiceDate: string; state: string; currency: string; amount: string };
  seller: { name: string; nameAr: string | null; address: string | null; taxNumber: string | null };
  buyer: { reference: string; name: string; nameAr: string | null; address: string | null; taxNumber: string | null; paymentTermsDays: number };
  project: { reference: string };
  shipment: { reference: string; customerPurchaseOrder: string | null; containers: string[]; route: string; incoterm: string };
  lines: { lineNo: number; description: string; quantity: string; unitPrice: string; lineAmount: string }[];
  paymentTerms: string; issuedAt: string | null; issuedByName: string | null;
}

const amount = (value: string, digits = 2) => Number(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** A printable commercial invoice (use the browser's Print → Save as PDF). */
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
  const { invoice, seller, buyer, shipment } = data;
  const cancelled = invoice.state === "CANCELLED";

  return <article className="orb-invoice" dir={ar ? "rtl" : "ltr"}>
    <style>{`
      .orb-invoice{max-width:820px;margin:24px auto;padding:40px;background:#fff;color:#111;font:14px/1.5 system-ui,sans-serif;position:relative}
      .orb-invoice header{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #111;padding-bottom:16px}
      .orb-invoice h1{font-size:22px;margin:0 0 4px}.orb-invoice h2{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#555;margin:0 0 6px}
      .orb-invoice .parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}
      .orb-invoice table{width:100%;border-collapse:collapse;margin:16px 0}.orb-invoice th,.orb-invoice td{padding:8px;border-bottom:1px solid #ddd;text-align:start}
      .orb-invoice td.num,.orb-invoice th.num{text-align:end;font-variant-numeric:tabular-nums}
      .orb-invoice .total td{font-weight:700;border-top:2px solid #111;border-bottom:none}
      .orb-invoice dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:0}.orb-invoice dt{color:#555}.orb-invoice dd{margin:0}
      .orb-invoice .stamp{position:absolute;top:120px;inset-inline-end:40px;border:3px solid #b00020;color:#b00020;padding:6px 14px;font-weight:800;transform:rotate(-8deg);font-size:20px}
      .orb-invoice .toolbar{margin-bottom:16px}
      @media print{body *{visibility:hidden}.orb-invoice,.orb-invoice *{visibility:visible}.orb-invoice{position:absolute;inset:0 auto auto 0;margin:0;padding:0;max-width:none;width:100%}.orb-invoice .toolbar{display:none}}
    `}</style>
    <div className="toolbar"><button type="button" onClick={() => window.print()}>{t("Print / save as PDF", "طباعة / حفظ PDF")}</button>
      {!seller.name && <p role="note">{t("Your company name and tax number are not set. Add them in Settings → Organization so they appear on invoices.", "اسم شركتك ورقمها الضريبي غير مُسجّلين. أضفهما من الإعدادات ← المؤسسة ليظهرا على الفواتير.")}</p>}</div>
    {cancelled && <div className="stamp">{t("CANCELLED", "ملغاة")}</div>}
    <header>
      <div><h2 style={{ fontSize: 22, textTransform: "none", letterSpacing: 0, color: "#111" }}>{(ar && seller.nameAr ? seller.nameAr : seller.name) || "—"}</h2>
        {seller.address && <div>{seller.address}</div>}
        {seller.taxNumber && <div>{t("Tax no.", "الرقم الضريبي")}: <bdi>{seller.taxNumber}</bdi></div>}</div>
      <div><h1>{t("Commercial invoice", "فاتورة تجارية")}</h1>
        <dl><dt>{t("Number", "الرقم")}</dt><dd><bdi>{invoice.reference}</bdi></dd>
          <dt>{t("Date", "التاريخ")}</dt><dd><bdi>{invoice.invoiceDate}</bdi></dd>
          <dt>{t("Project", "المشروع")}</dt><dd><bdi>{data.project.reference}</bdi></dd></dl></div>
    </header>
    <div className="parties">
      <section><h2>{t("Bill to", "فاتورة إلى")}</h2>
        <strong>{ar && buyer.nameAr ? buyer.nameAr : buyer.name}</strong>
        {buyer.address && <div>{buyer.address}</div>}
        {buyer.taxNumber && <div>{t("Tax no.", "الرقم الضريبي")}: <bdi>{buyer.taxNumber}</bdi></div>}
        <div>{t("Customer ref.", "مرجع العميل")}: <bdi>{buyer.reference}</bdi></div></section>
      <section><h2>{t("Shipment", "الشحنة")}</h2>
        <dl><dt>{t("Reference", "المرجع")}</dt><dd><bdi>{shipment.reference}</bdi></dd>
          {shipment.customerPurchaseOrder && <><dt>{t("Your PO", "أمر الشراء")}</dt><dd><bdi>{shipment.customerPurchaseOrder}</bdi></dd></>}
          <dt>{t("Terms", "الشروط")}</dt><dd><bdi>{shipment.incoterm}</bdi></dd>
          <dt>{t("Route", "المسار")}</dt><dd>{shipment.route}</dd>
          {shipment.containers.length > 0 && <><dt>{t("Containers", "الحاويات")}</dt><dd><bdi>{shipment.containers.join(", ")}</bdi></dd></>}</dl></section>
    </div>
    <table>
      <thead><tr><th>#</th><th>{t("Description", "الوصف")}</th><th className="num">{t("Quantity (MT)", "الكمية (طن)")}</th><th className="num">{t("Unit price", "سعر الوحدة")}</th><th className="num">{t("Amount", "المبلغ")} ({invoice.currency})</th></tr></thead>
      <tbody>
        {data.lines.map((line) => <tr key={line.lineNo}><td>{line.lineNo}</td><td>{line.description}</td><td className="num">{amount(line.quantity, 3)}</td><td className="num">{amount(line.unitPrice)}</td><td className="num">{amount(line.lineAmount)}</td></tr>)}
        <tr className="total"><td colSpan={4}>{t("Total", "الإجمالي")}</td><td className="num">{invoice.currency} {amount(invoice.amount)}</td></tr>
      </tbody>
    </table>
    <dl><dt>{t("Payment terms", "شروط الدفع")}</dt><dd>{data.paymentTerms}{buyer.paymentTermsDays ? ` (${buyer.paymentTermsDays} ${t("days", "يوم")})` : ""}</dd>
      {data.issuedByName && <><dt>{t("Issued by", "أصدرها")}</dt><dd>{data.issuedByName}</dd></>}</dl>
  </article>;
}
