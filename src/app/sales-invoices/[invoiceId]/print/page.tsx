import { SalesInvoicePrint } from "../../../../ui/features/invoices/SalesInvoicePrint";

export default async function SalesInvoicePrintPage({ params, searchParams }: Readonly<{ params: Promise<{ invoiceId: string }>; searchParams: Promise<{ locale?: string }> }>) {
  const [{ invoiceId }, query] = await Promise.all([params, searchParams]);
  return <SalesInvoicePrint invoiceId={invoiceId} locale={query.locale === "ar" ? "ar" : "en"} />;
}
