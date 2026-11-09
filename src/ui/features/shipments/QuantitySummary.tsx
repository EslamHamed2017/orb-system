import s from "./operations.module.css";
export type QuantitySummaryValue = Readonly<{ contracted: string; confirmed: string; delivered: string; cancelledRejected: string; remaining: string }>;
export function QuantitySummary({ value, locale }: { readonly value: QuantitySummaryValue; readonly locale: "en" | "ar" }) {
 const ar=locale==="ar"; const rows=[[ar?"المتعاقد عليها":"Contracted",value.contracted],[ar?"المؤكدة":"Confirmed",value.confirmed],[ar?"المسلمة":"Delivered",value.delivered],[ar?"الملغاة / المرفوضة":"Cancelled / rejected",value.cancelledRejected],[ar?"المتبقية":"Remaining",value.remaining]] as const;
 return <section aria-labelledby="shipment-quantity-title"><div className={s.sectionHeader}><h3 id="shipment-quantity-title">{ar?"ملخص الكمية":"Quantity summary"}</h3><span className={s.chip}>kg</span></div><dl className={s.stats}>{rows.map(([label,amount])=><div key={label}><dt>{label}</dt><dd><bdi>{amount}</bdi></dd></div>)}</dl></section>;
}
