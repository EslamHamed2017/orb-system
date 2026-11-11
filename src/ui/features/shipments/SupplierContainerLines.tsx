"use client";

import { useMemo, useState, type FormEvent } from "react";
import s from "./operations.module.css";
import { calculateSupplierContainerSummary, validateSupplierContainerLines, type SupplierContainerLineDraft } from "./supplier-container-lines";

type Locale = "ar" | "en";
type ApprovedPurchaseLine = Readonly<{ id: string; reference: string; productName: string; remainingQuantity: string; unit: string; supplierId: string; supplierName: string; purchaseContractId: string }>;
type Props = Readonly<{ locale: Locale; initialLines: readonly SupplierContainerLineDraft[]; approvedLines: readonly ApprovedPurchaseLine[]; canMutate: boolean }>;

export function SupplierContainerLines({ locale, initialLines, approvedLines, canMutate }: Props) {
  const ar = locale === "ar";
  const [lines, setLines] = useState(initialLines);
  const [message, setMessage] = useState("");
  const summary = useMemo(() => calculateSupplierContainerSummary(lines), [lines]);

  function addLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    const contractLineVersionId = String(data.get("contractLineVersionId") ?? "");
    const approved = approvedLines.find((line) => line.id === contractLineVersionId);
    if (!approved) { setMessage(ar ? "اختر بند عقد شراء معتمداً." : "Choose an approved purchase-contract line."); return; }
    const line: SupplierContainerLineDraft = {
      id: `draft-${crypto.randomUUID()}`, supplierId: approved.supplierId, supplierName: approved.supplierName, purchaseContractId: approved.purchaseContractId,
      contractLineVersionId, contractLineReference: approved.reference, productName: approved.productName, remainingQuantity: approved.remainingQuantity, unit: approved.unit,
      quantity: String(data.get("quantity") ?? ""), bagCount: Number(data.get("bagCount")), bagWeight: String(data.get("bagWeight") ?? ""), netWeight: String(data.get("netWeight") ?? ""), grossWeight: String(data.get("grossWeight") ?? ""), supplierLotReference: String(data.get("supplierLotReference") ?? ""),
    };
    if (validateSupplierContainerLines([...lines, line]).length) { setMessage(ar ? "تحقق من البند المعتمد والكمية المتبقية والدفعة والأكياس والأوزان." : "Check the approved line, remaining quantity, lot, bags, and weights."); return; }
    setLines((current) => [...current, line]);
    setMessage(ar ? "تمت إضافة بند المورد إلى مسودة الحاوية." : "Supplier line added to the container draft.");
    form.reset();
  }

  function removeDraft(id: string) { setLines((current) => current.filter((line) => line.id !== id)); setMessage(ar ? "تمت إزالة بند مسودة الحاوية." : "Container draft line removed."); }

  return <section aria-labelledby="supplier-container-lines-title" className={s.stack}>
    <div className={s.sectionHeader}><div><h3 id="supplier-container-lines-title">{ar ? "بنود حاوية الموردين" : "Supplier container lines"}</h3><p>{ar ? "تجمع الحاوية المادية بنود شراء معتمدة من عدة موردين مع بقاء كل بند وفاتورة منسوبين إلى المورد." : "The physical container consolidates approved purchase lines from multiple suppliers while every line and invoice remains supplier-attributable."}</p></div><span className={s.chip}>{summary.supplierCount} {ar ? "مورد" : "suppliers"}</span></div>
    <div className={s.tableScroll}><table aria-label={ar ? "بنود حاوية الموردين" : "Supplier container lines"}><caption>{ar ? "لا يمكن إدخال منتج غير موجود في بند عقد شراء معتمد." : "Arbitrary products cannot be introduced outside an approved purchase-contract line."}</caption><thead><tr><th>#</th><th>{ar ? "المورد" : "Supplier"}</th><th>{ar ? "بند عقد الشراء المعتمد" : "Approved purchase-contract line"}</th><th>{ar ? "المنتج" : "Product"}</th><th>{ar ? "كمية الحاوية" : "Container quantity"}</th><th>{ar ? "دفعة المورد" : "Supplier lot"}</th><th>{ar ? "الأكياس" : "Bags"}</th><th>{ar ? "الوزن الصافي / الإجمالي" : "Net / gross weight"}</th>{canMutate && <th>{ar ? "الإجراءات" : "Actions"}</th>}</tr></thead>
      <tbody>{lines.map((line, index) => <tr key={line.id}><th scope="row">{index + 1}</th><td>{line.supplierName}</td><td><bdi>{line.contractLineReference}</bdi></td><td>{line.productName}</td><td><bdi>{line.quantity} {line.unit}</bdi></td><td><bdi>{line.supplierLotReference}</bdi></td><td>{line.bagCount}</td><td><bdi>{line.netWeight} / {line.grossWeight} kg</bdi></td>{canMutate && <td>{line.id.startsWith("draft-") ? <button className={s.secondary} type="button" onClick={() => removeDraft(line.id)}>{ar ? "إزالة" : "Remove"}</button> : <span className={`${s.chip} ${s.success}`}>{ar ? "محفوظ" : "Saved"}</span>}</td>}</tr>)}</tbody></table></div>
    <dl className={s.stats}><div><dt>{ar ? "عدد الموردين" : "Suppliers"}</dt><dd>{summary.supplierCount}</dd></div><div><dt>{ar ? "إجمالي الكمية" : "Total quantity"}</dt><dd><bdi>{summary.totalQuantity} {summary.unit}</bdi></dd></div><div><dt>{ar ? "إجمالي الأكياس" : "Total bags"}</dt><dd>{summary.totalBags}</dd></div><div><dt>{ar ? "الوزن الإجمالي" : "Gross weight"}</dt><dd><bdi>{summary.totalGrossWeight} kg</bdi></dd></div></dl>
    <div className={s.cardMuted}><h4>{ar ? "نسبة المورد" : "Supplier attribution"}</h4><ul className={s.routeList}>{summary.suppliers.map((supplier) => <li className={s.routeItem} key={supplier.supplierId}><span className={s.step}>{supplier.lineCount}</span><span><strong>{supplier.supplierName}</strong><small className={s.helper}>{supplier.purchaseContractCount} {ar ? "عقد شراء" : "purchase contracts"}</small></span><bdi>{supplier.quantity} {summary.unit}</bdi></li>)}</ul><p className={s.helper}>{ar ? "تُنشأ فاتورة مورد مستقلة لكل مورد ممثل؛ لا تدمج الحاوية الالتزامات بين الموردين." : "Create a separate supplier invoice for each represented supplier; the container never merges cross-supplier liabilities."}</p></div>
    {canMutate && <form className={s.formGrid} onSubmit={addLine} data-operation-id="createSupplierShipmentLine" aria-label={ar ? "إضافة بند حاوية مورد" : "Add supplier container line"}>
      <label className={s.full}>{ar ? "بند عقد الشراء المعتمد" : "Approved purchase-contract line"}<select name="contractLineVersionId" required defaultValue=""><option value="" disabled>{ar ? "اختر بنداً معتمداً ذا كمية متبقية" : "Choose an approved line with remaining quantity"}</option>{approvedLines.map((line) => <option key={line.id} value={line.id}>{line.supplierName} — {line.reference} — {line.productName} — {line.remainingQuantity} {line.unit}</option>)}</select></label>
      <label>{ar ? "الكمية" : "Quantity"}<input name="quantity" type="number" min="0.000001" step="0.000001" required /></label><label>{ar ? "مرجع دفعة المورد" : "Supplier lot reference"}<input name="supplierLotReference" required /></label><label>{ar ? "عدد الأكياس" : "Bag count"}<input name="bagCount" type="number" min="1" step="1" required /></label><label>{ar ? "وزن الكيس" : "Bag weight"}<input name="bagWeight" type="number" min="0.000001" step="0.000001" required /></label><label>{ar ? "الوزن الصافي" : "Net weight"}<input name="netWeight" type="number" min="0.000001" step="0.000001" required /></label><label>{ar ? "الوزن الإجمالي" : "Gross weight"}<input name="grossWeight" type="number" min="0.000001" step="0.000001" required /></label>
      <div className={`${s.actions} ${s.full}`}><button className={s.primary} type="submit">{ar ? "إضافة بند مورد" : "Add supplier line"}</button><span className={s.helper}>{ar ? "يحدد البند المعتمد المورد وعقد الشراء تلقائياً." : "The approved line fixes the supplier and purchase contract automatically."}</span></div>
    </form>}
    {message && <p role="status" aria-live="polite" className={s.notice}>{message}</p>}
  </section>;
}
