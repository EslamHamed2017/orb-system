"use client";

import { useMemo, useState, type FormEvent } from "react";
import s from "../shipments/operations.module.css";
import { calculatePurchaseContractSummary, validatePurchaseContractLines, type PurchaseContractLineDraft } from "./purchase-contract-lines";

type Locale = "ar" | "en";
type Props = { readonly locale: Locale; readonly initialLines: readonly PurchaseContractLineDraft[]; readonly canMutate: boolean; readonly readOnly?: boolean };
const productNames = { ethiopia: "Ethiopia Guji", kenya: "Kenya AA", colombia: "Colombia Supremo" } as const;

export function PurchaseContractLines({ locale, initialLines, canMutate, readOnly = false }: Props) {
  const ar = locale === "ar";
  const [lines, setLines] = useState<readonly PurchaseContractLineDraft[]>(initialLines);
  const [message, setMessage] = useState("");
  const summary = useMemo(() => calculatePurchaseContractSummary(lines), [lines]);

  function addLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const productId = String(data.get("productId") ?? "");
    const line: PurchaseContractLineDraft = {
      id: `draft-${crypto.randomUUID()}`, productId, productName: productNames[productId as keyof typeof productNames] ?? productId,
      quantity: String(data.get("quantity") ?? ""), unit: String(data.get("unit") ?? "kg"),
      unitPrice: String(data.get("unitPrice") ?? ""), currency: String(data.get("currency") ?? "USD"),
      incoterm: String(data.get("incoterm") ?? "FOB"), namedPlace: String(data.get("namedPlace") ?? ""),
      paymentTerms: String(data.get("paymentTerms") ?? ""), documentTerms: String(data.get("documentTerms") ?? ""),
    };
    if (validatePurchaseContractLines([line]).length) {
      setMessage(ar ? "تحقق من المنتج والكمية والسعر والعملة." : "Check the product, quantity, price, and currency.");
      return;
    }
    setLines((current) => [...current, line]);
    setMessage(ar ? "تمت إضافة بند الشراء إلى مسودة العقد." : "Purchase line added to the contract draft.");
    form.reset();
  }

  function removeDraft(id: string) {
    setLines((current) => current.filter((line) => line.id !== id));
    setMessage(ar ? "تمت إزالة بند الشراء من المسودة." : "Purchase draft line removed.");
  }

  return <div className={s.stack}>
    <div className={s.tableScroll}><table aria-label={ar ? "بنود عقد الشراء" : "Purchase contract lines"}>
      <caption>{ar ? "يُعتمد كل بند بإصداره ليكون مصدراً مسموحاً لحاوية الموردين." : "Each line is version-approved before it can source a supplier container."}</caption>
      <thead><tr><th scope="col">#</th><th scope="col">{ar ? "المنتج" : "Product"}</th><th scope="col">{ar ? "الكمية" : "Quantity"}</th><th scope="col">{ar ? "السعر" : "Unit price"}</th><th scope="col">{ar ? "القيمة" : "Value"}</th><th scope="col">{ar ? "الكمية المتبقية" : "Remaining quantity"}</th>{canMutate && !readOnly && <th scope="col">{ar ? "الإجراءات" : "Actions"}</th>}</tr></thead>
      <tbody>{lines.map((line, index) => <tr key={line.id} data-line-id={line.id}><th scope="row">{index + 1}</th><td>{line.productName}</td><td><bdi>{line.quantity} {line.unit}</bdi></td><td><bdi>{line.currency} {line.unitPrice}</bdi></td><td><bdi>{line.currency} {calculatePurchaseContractSummary([line]).totalsByCurrency[0]?.amount}</bdi></td><td><bdi>{line.remainingQuantity ?? line.quantity} {line.unit}</bdi></td>{canMutate && !readOnly && <td>{line.id.startsWith("draft-") ? <button className={s.secondary} type="button" onClick={() => removeDraft(line.id)}>{ar ? "إزالة" : "Remove"}</button> : <span className={`${s.chip} ${s.success}`}>{ar ? "معتمد" : "Approved"}</span>}</td>}</tr>)}</tbody>
    </table></div>
    <dl className={s.stats}><div><dt>{ar ? "عدد البنود" : "Lines"}</dt><dd>{summary.lineCount}</dd></div><div><dt>{ar ? "إجمالي الكمية" : "Total quantity"}</dt><dd><bdi>{summary.totalQuantity} {summary.unit}</bdi></dd></div>{summary.totalsByCurrency.map((total) => <div key={total.currency}><dt>{ar ? "قيمة عقد الشراء" : "Purchase contract value"}</dt><dd><bdi>{total.currency} {total.amount}</bdi></dd></div>)}</dl>
    {canMutate && !readOnly && <form className={s.formGrid} onSubmit={addLine} data-operation-id="createContractLine" aria-label={ar ? "إضافة بند شراء" : "Add purchase line"}>
      <label>{ar ? "المنتج" : "Product"}<select name="productId" required defaultValue=""><option value="" disabled>{ar ? "اختر المنتج" : "Choose product"}</option><option value="ethiopia">Ethiopia Guji</option><option value="kenya">Kenya AA</option><option value="colombia">Colombia Supremo</option></select></label>
      <label>{ar ? "الكمية" : "Quantity"}<input name="quantity" type="number" min="0.000001" step="0.000001" required /></label>
      <label>{ar ? "الوحدة" : "Unit"}<select name="unit" defaultValue="kg"><option value="kg">kg</option></select></label>
      <label>{ar ? "السعر لكل وحدة" : "Unit price"}<input name="unitPrice" type="number" min="0.000001" step="0.000001" required /></label>
      <label>{ar ? "العملة" : "Currency"}<select name="currency" defaultValue="USD"><option>USD</option><option>AED</option><option>SAR</option></select></label>
      <label>{ar ? "شرط التسليم" : "Incoterm"}<select name="incoterm" defaultValue="FOB"><option>FOB</option><option>CIF</option><option>CFR</option></select></label>
      <label>{ar ? "المكان المسمى" : "Named place"}<input name="namedPlace" required /></label>
      <label>{ar ? "شروط الدفع" : "Payment terms"}<input name="paymentTerms" defaultValue="Net 30" required /></label>
      <label className={s.full}>{ar ? "شروط المستندات" : "Document terms"}<input name="documentTerms" defaultValue="Original documents" required /></label>
      <div className={`${s.actions} ${s.full}`}><button className={s.primary} type="submit">{ar ? "إضافة بند شراء" : "Add purchase line"}</button><span className={s.helper}>{ar ? "يبقى العقد منسوباً إلى المورد المحدد أعلاه." : "The contract remains attributable to the supplier shown above."}</span></div>
    </form>}
    {message && <p role="status" aria-live="polite" className={s.notice}>{message}</p>}
    {readOnly && <p className={s.helper}>{ar ? "إصدار عقد الشراء المعتمد للقراءة فقط. أنشئ تعديلاً لتغيير البنود." : "This approved purchase contract version is read-only. Create an amendment to change its lines."}</p>}
  </div>;
}
