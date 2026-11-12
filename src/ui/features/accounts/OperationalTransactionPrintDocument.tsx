import { PrintAction } from "../printing/PrintAction";
import styles from "../shipments/operations.module.css";
import type { AccountsLocale } from "./accounts-hub";

export type OperationalPrintKind = "collection" | "supplierPayment" | "expense";

type Props = {
  readonly locale: AccountsLocale;
  readonly kind: OperationalPrintKind;
  readonly reference: string;
  readonly projectId: string;
  readonly occurredOn: string;
  readonly state: string;
  readonly currency: string;
  readonly amount: string;
  readonly partyId?: string;
  readonly category?: string;
  readonly scopeReference?: string;
};

const titles = {
  collection: { en: "Collection receipt", ar: "إيصال تحصيل" },
  supplierPayment: { en: "Supplier payment", ar: "دفعة مورد" },
  expense: { en: "Expense voucher", ar: "سند مصروف" },
} as const;

export function OperationalTransactionPrintDocument(props: Props) {
  const ar = props.locale === "ar";
  const title = titles[props.kind][props.locale];
  const targetId = `${props.kind}-${props.reference}-print`;
  const partyLabel = props.kind === "collection" ? (ar ? "العميل" : "Customer") : (ar ? "المورد" : "Supplier");

  return <article id={targetId} className={`${styles.card} ${styles.printDocument}`} data-print-document aria-label={`${title} ${props.reference}`}>
    <header className={styles.sectionHeader}><div><p className={styles.eyebrow}>{ar ? "مستند قابل للطباعة" : "Printable document"}</p><h2>{title} · <bdi>{props.reference}</bdi></h2></div><div className={styles.headerActions}><span className={`${styles.chip} ${styles.success}`}>{props.state}</span><PrintAction locale={props.locale} targetId={targetId} documentKind={props.kind} className={`${styles.secondary} ${styles.noPrint}`} /></div></header>
    <div className={styles.printHeading}><strong>ORB</strong><span>{title} · <bdi>{props.reference}</bdi></span><small>{ar ? "المشروع" : "Project"}: <bdi>{props.projectId}</bdi></small></div>
    <dl className={styles.metaGrid}>
      <div><dt>{ar ? "المشروع" : "Project"}</dt><dd><bdi>{props.projectId}</bdi></dd></div>
      {props.partyId ? <div><dt>{partyLabel}</dt><dd><bdi>{props.partyId}</bdi></dd></div> : null}
      {props.category ? <div><dt>{ar ? "فئة المصروف" : "Expense category"}</dt><dd><bdi>{props.category}</bdi></dd></div> : null}
      {props.scopeReference ? <div><dt>{ar ? "نطاق المعاملة" : "Transaction scope"}</dt><dd><bdi>{props.scopeReference}</bdi></dd></div> : null}
      <div><dt>{ar ? "تاريخ المعاملة" : "Transaction date"}</dt><dd><bdi>{props.occurredOn}</bdi></dd></div>
      <div><dt>{ar ? "الحالة" : "Status"}</dt><dd>{props.state}</dd></div>
      <div><dt>{ar ? "المبلغ بعملة المصدر" : "Source-currency amount"}</dt><dd><strong><bdi>{props.currency} {props.amount}</bdi></strong></dd></div>
    </dl>
  </article>;
}
