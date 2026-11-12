import { PrintAction } from "../printing/PrintAction";
import styles from "../shipments/operations.module.css";
import type { AccountsLocale } from "./accounts-hub";

export interface InvoicePrintLine {
  readonly id: string;
  readonly description: string;
  readonly sourceReference: string;
  readonly quantity: string;
  readonly unit: string;
  readonly unitPrice: string;
  readonly amount: string;
}

type Props = {
  readonly locale: AccountsLocale;
  readonly kind: "salesInvoice" | "supplierInvoice";
  readonly reference: string;
  readonly projectId: string;
  readonly partyName: string;
  readonly sourceReference: string;
  readonly occurredOn: string;
  readonly state: string;
  readonly currency: string;
  readonly amount: string;
  readonly outstandingAmount: string;
  readonly lines: readonly InvoicePrintLine[];
};

export function InvoicePrintDocument(props: Props) {
  const ar = props.locale === "ar";
  const sales = props.kind === "salesInvoice";
  const targetId = `${sales ? "sales" : "supplier"}-invoice-${props.reference}-print`;
  const title = sales ? (ar ? "فاتورة مبيعات" : "Sales invoice") : (ar ? "فاتورة مورد" : "Supplier invoice");

  return <article id={targetId} className={`${styles.card} ${styles.printDocument}`} data-print-document aria-label={`${title} ${props.reference}`}>
    <header className={styles.sectionHeader}><div><p className={styles.eyebrow}>{ar ? "مستند قابل للطباعة" : "Printable document"}</p><h2>{title} · <bdi>{props.reference}</bdi></h2></div><div className={styles.headerActions}><span className={`${styles.chip} ${styles.success}`}>{props.state}</span><PrintAction locale={props.locale} targetId={targetId} documentKind={props.kind} className={`${styles.secondary} ${styles.noPrint}`} /></div></header>
    <div className={styles.printHeading}><strong>ORB</strong><span>{title} · <bdi>{props.reference}</bdi></span><small>{ar ? "المشروع" : "Project"}: <bdi>{props.projectId}</bdi></small></div>
    <dl className={styles.metaGrid}>
      <div><dt>{sales ? (ar ? "العميل" : "Customer") : (ar ? "المورد" : "Supplier")}</dt><dd>{props.partyName}</dd></div>
      <div><dt>{sales ? (ar ? "شحنة البيع" : "Sales shipment") : (ar ? "حاوية الموردين" : "Supplier container")}</dt><dd><bdi>{props.sourceReference}</bdi></dd></div>
      <div><dt>{ar ? "تاريخ الفاتورة" : "Invoice date"}</dt><dd><bdi>{props.occurredOn}</bdi></dd></div>
      <div><dt>{ar ? "الحالة" : "Status"}</dt><dd>{props.state}</dd></div>
    </dl>
    <div className={styles.tableScroll}><table><caption>{ar ? "بنود الفاتورة وتتبع المصدر" : "Invoice lines and source traceability"}</caption><thead><tr><th>{ar ? "البند" : "Line"}</th><th>{ar ? "الوصف" : "Description"}</th><th>{ar ? "مرجع المصدر" : "Source reference"}</th><th>{ar ? "الكمية" : "Quantity"}</th><th>{ar ? "سعر الوحدة" : "Unit price"}</th><th>{ar ? "إجمالي البند" : "Line total"}</th></tr></thead><tbody>{props.lines.map((line, index) => <tr key={line.id}><td>{index + 1}</td><td>{line.description}</td><td><bdi>{line.sourceReference}</bdi></td><td><bdi>{line.quantity} {line.unit}</bdi></td><td><bdi>{props.currency} {line.unitPrice}</bdi></td><td><bdi>{props.currency} {line.amount}</bdi></td></tr>)}</tbody><tfoot><tr><th colSpan={5}>{ar ? "إجمالي الفاتورة" : "Invoice total"}</th><td><strong><bdi>{props.currency} {props.amount}</bdi></strong></td></tr><tr><th colSpan={5}>{ar ? "المبلغ المتبقي" : "Outstanding amount"}</th><td><strong><bdi>{props.currency} {props.outstandingAmount}</bdi></strong></td></tr></tfoot></table></div>
  </article>;
}
