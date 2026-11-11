import s from "./operations.module.css";
import { buildPartialFulfillmentRows, type PartialFulfillmentInput } from "./partial-fulfillment";

export function PartialFulfillmentVisualization({ locale, lines }: Readonly<{ locale: "en" | "ar"; lines: readonly PartialFulfillmentInput[] }>) {
  const ar = locale === "ar", rows = buildPartialFulfillmentRows(lines);
  return <section aria-labelledby="partial-fulfillment-title" className={s.stack}>
    <div className={s.sectionHeader}><div><h3 id="partial-fulfillment-title">{ar ? "التنفيذ الجزئي" : "Partial fulfillment"}</h3><p>{ar ? "تقدم كل بند عقد عبر الشحنات السابقة وهذه الشحنة والكمية المتبقية." : "Contract-line progress across prior shipments, this shipment, and the remaining quantity."}</p></div></div>
    <div className={s.fulfillmentGrid}>{rows.map((row) => <article className={s.fulfillmentCard} key={row.contractLineVersionId}>
      <div className={s.fulfillmentHeading}><div><strong>{row.productName}</strong><small><bdi>{row.contractLineReference}</bdi></small></div><span className={[s.chip, row.completionPercent === 100 ? s.success : s.warning].join(" ")}>{row.completionPercent}%</span></div>
      <progress max={100} value={row.completionPercent} aria-label={row.productName + " " + (ar ? "نسبة التنفيذ" : "fulfillment percentage")}>{row.completionPercent}%</progress>
      <dl className={s.fulfillmentStats}>
        <div><dt>{ar ? "تم قبل هذه الشحنة" : "Before this shipment"}</dt><dd><bdi>{row.fulfilledBeforeShipment} {row.unit}</bdi></dd></div>
        <div><dt>{ar ? "هذه الشحنة" : "This shipment"}</dt><dd><bdi>{row.currentShipmentQuantity} {row.unit}</bdi></dd></div>
        <div><dt>{ar ? "الكمية المتبقية" : "Remaining quantity"}</dt><dd><bdi>{row.remainingQuantity} {row.unit}</bdi></dd></div>
      </dl>
      <p className={s.helper}>{ar ? "الإجمالي المنفذ" : "Total fulfilled"}: <bdi>{row.fulfilledQuantity} / {row.contractedQuantity} {row.unit}</bdi></p>
    </article>)}</div>
  </section>;
}
