"use client";

import { useMemo, useState, type FormEvent } from "react";
import s from "./operations.module.css";
import { calculateSalesShipmentSummary, remainingAfterShipment, validateSalesShipmentLines, type SalesShipmentLineDraft } from "./sales-shipment-lines";

type Locale = "ar" | "en";
type ApprovedLine = Readonly<{ id: string; reference: string; productName: string; remainingQuantity: string; unit: string }>;
type Props = Readonly<{ locale: Locale; initialLines: readonly SalesShipmentLineDraft[]; approvedLines: readonly ApprovedLine[]; canMutate: boolean }>;

export function SalesShipmentLines({ locale, initialLines, approvedLines, canMutate }: Props) {
  const ar = locale === "ar";
  const [lines, setLines] = useState(initialLines);
  const [message, setMessage] = useState("");
  const summary = useMemo(() => calculateSalesShipmentSummary(lines), [lines]);

  function addLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    const contractLineVersionId = String(data.get("contractLineVersionId") ?? "");
    const approved = approvedLines.find((line) => line.id === contractLineVersionId);
    if (!approved) { setMessage(ar ? "اختر بند عقد معتمداً." : "Choose an approved contract line."); return; }
    const optional = (name: string) => String(data.get(name) ?? "").trim() || null;
    const line: SalesShipmentLineDraft = {
      id: `draft-${crypto.randomUUID()}`, contractLineVersionId, contractLineReference: approved.reference, productName: approved.productName, remainingQuantity: approved.remainingQuantity, unit: approved.unit,
      quantity: String(data.get("quantity") ?? ""), bagCount: Number(data.get("bagCount")), bagWeight: String(data.get("bagWeight") ?? ""), netWeight: String(data.get("netWeight") ?? ""), grossWeight: String(data.get("grossWeight") ?? ""),
      customerPurchaseOrderReference: optional("customerPurchaseOrderReference"), marksAndNumbers: optional("marksAndNumbers"),
    };
    if (validateSalesShipmentLines([...lines, line]).length) { setMessage(ar ? "تحقق من الكمية المتبقية والأكياس والأوزان وعدم تكرار بند العقد." : "Check remaining quantity, bags, weights, and duplicate contract lines."); return; }
    setLines((current) => [...current, line]);
    setMessage(ar ? "تمت إضافة بند الشحنة إلى المسودة." : "Shipment line added to the draft.");
    form.reset();
  }

  function removeDraft(id: string) { setLines((current) => current.filter((line) => line.id !== id)); setMessage(ar ? "تمت إزالة بند المسودة." : "Draft line removed."); }

  return <section aria-labelledby="sales-shipment-lines-title" className={s.stack}>
    <div className={s.sectionHeader}><div><h3 id="sales-shipment-lines-title">{ar ? "بنود الشحنة" : "Shipment lines"}</h3><p>{ar ? "يرتبط كل بند بإصدار بند عقد بيع معتمد؛ لا يمكن إدخال منتج عشوائي." : "Each line is bound to an approved sales-contract line version; arbitrary products are not allowed."}</p></div><span className={s.chip}>{summary.lineCount}</span></div>
    <div className={s.tableScroll}><table aria-label={ar ? "بنود شحنة البيع" : "Sales shipment lines"}><thead><tr><th>#</th><th>{ar ? "بند العقد المعتمد" : "Approved contract line"}</th><th>{ar ? "المنتج" : "Product"}</th><th>{ar ? "كمية الشحنة" : "Shipment quantity"}</th><th>{ar ? "المتبقي بعد الشحنة" : "Remaining after shipment"}</th><th>{ar ? "الأكياس" : "Bags"}</th><th>{ar ? "الوزن الصافي / الإجمالي" : "Net / gross weight"}</th>{canMutate && <th>{ar ? "الإجراءات" : "Actions"}</th>}</tr></thead>
      <tbody>{lines.map((line, index) => <tr key={line.id}><th scope="row">{index + 1}</th><td><bdi>{line.contractLineReference}</bdi></td><td>{line.productName}</td><td><bdi>{line.quantity} {line.unit}</bdi></td><td><bdi>{remainingAfterShipment(line)} {line.unit}</bdi></td><td>{line.bagCount}</td><td><bdi>{line.netWeight} / {line.grossWeight} kg</bdi></td>{canMutate && <td>{line.id.startsWith("draft-") ? <button className={s.secondary} type="button" onClick={() => removeDraft(line.id)}>{ar ? "إزالة" : "Remove"}</button> : <span className={`${s.chip} ${s.success}`}>{ar ? "محفوظ" : "Saved"}</span>}</td>}</tr>)}</tbody></table></div>
    <dl className={s.stats}><div><dt>{ar ? "إجمالي الكمية" : "Total quantity"}</dt><dd><bdi>{summary.totalQuantity} {summary.unit}</bdi></dd></div><div><dt>{ar ? "إجمالي الأكياس" : "Total bags"}</dt><dd>{summary.totalBags}</dd></div><div><dt>{ar ? "الوزن الصافي" : "Net weight"}</dt><dd><bdi>{summary.totalNetWeight} kg</bdi></dd></div><div><dt>{ar ? "الوزن الإجمالي" : "Gross weight"}</dt><dd><bdi>{summary.totalGrossWeight} kg</bdi></dd></div></dl>
    {canMutate && <form className={s.formGrid} onSubmit={addLine} data-operation-id="createSalesShipmentLine" aria-label={ar ? "إضافة بند شحنة" : "Add shipment line"}>
      <label className={s.full}>{ar ? "بند العقد المعتمد" : "Approved contract line"}<select name="contractLineVersionId" required defaultValue=""><option value="" disabled>{ar ? "اختر من البنود المعتمدة ذات الكمية المتبقية" : "Choose an approved line with remaining quantity"}</option>{approvedLines.map((line) => <option key={line.id} value={line.id}>{line.reference} — {line.productName} — {line.remainingQuantity} {line.unit}</option>)}</select></label>
      <label>{ar ? "الكمية" : "Quantity"}<input name="quantity" type="number" min="0.000001" step="0.000001" required /></label><label>{ar ? "عدد الأكياس" : "Bag count"}<input name="bagCount" type="number" min="1" step="1" required /></label><label>{ar ? "وزن الكيس" : "Bag weight"}<input name="bagWeight" type="number" min="0.000001" step="0.000001" required /></label><label>{ar ? "الوزن الصافي" : "Net weight"}<input name="netWeight" type="number" min="0.000001" step="0.000001" required /></label><label>{ar ? "الوزن الإجمالي" : "Gross weight"}<input name="grossWeight" type="number" min="0.000001" step="0.000001" required /></label><label>{ar ? "مرجع أمر شراء العميل" : "Customer PO reference"}<input name="customerPurchaseOrderReference" /></label><label className={s.full}>{ar ? "العلامات والأرقام" : "Marks and numbers"}<input name="marksAndNumbers" /></label>
      <div className={`${s.actions} ${s.full}`}><button className={s.primary} type="submit">{ar ? "إضافة بند" : "Add line"}</button><span className={s.helper}>{ar ? "تُحفظ البنود مع مراجعة مجموعة البيانات." : "Lines are persisted with the dataset revision."}</span></div>
    </form>}
    {message && <p role="status" aria-live="polite" className={s.notice}>{message}</p>}
  </section>;
}
