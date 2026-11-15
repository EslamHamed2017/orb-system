"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { createBrowserProduct, ProductStorageError, readBrowserProducts, setBrowserProductStatus, updateBrowserProduct } from "../../../modules/masters/browser-product-storage";
import styles from "./ProductsMasterPage.module.css";
import { filterProducts, summarizeProducts, type ProductDirectoryRecord, type ProductStatusFilter } from "./product-directory";

type Locale = "en" | "ar";
type Notice = { readonly kind: "success" | "error"; readonly text: string } | null;

export function ProductsMasterPage({ locale, query = "", status = "ALL" }: { readonly locale: Locale; readonly query?: string; readonly status?: ProductStatusFilter }) {
  const ar = locale === "ar";
  const [products, setProducts] = useState<readonly ProductDirectoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [editingProduct, setEditingProduct] = useState<ProductDirectoryRecord | null>(null);
  const registrationRef = useRef<HTMLDetailsElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setProducts(readBrowserProducts(window.localStorage)); }
    catch { setReadError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (notice && feedbackRef.current) feedbackRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [notice]);

  const summary = summarizeProducts(products);
  const visibleProducts = filterProducts(products, query, status);
  const suffix = `locale=${locale}`;

  function storageError(error: unknown) {
    if (error instanceof ProductStorageError && error.code === "DUPLICATE_REFERENCE") return ar ? "مرجع المنتج مستخدم بالفعل." : "That product reference is already in use.";
    if (error instanceof ProductStorageError && error.code === "INVALID_PRODUCT") return ar ? "راجع الحقول وأدخل وزناً موجباً ومنشأً من حرفين." : "Check every field, use a positive weight, and enter a two-letter origin.";
    return ar ? "تعذر حفظ بيانات المنتج في هذا المتصفح." : "Product data could not be saved in this browser.";
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      reference: String(data.get("reference") ?? ""), nameEn: String(data.get("nameEn") ?? ""), nameAr: String(data.get("nameAr") ?? ""),
      origin: String(data.get("origin") ?? ""), type: String(data.get("type") ?? ""), grade: String(data.get("grade") ?? ""),
      cropYear: String(data.get("cropYear") ?? ""), bagType: String(data.get("bagType") ?? ""), standardBagWeight: String(data.get("standardBagWeight") ?? ""),
    };
    try {
      if (editingProduct) await updateBrowserProduct(window.localStorage, editingProduct.id, input);
      else await createBrowserProduct(window.localStorage, input);
      setProducts(readBrowserProducts(window.localStorage));
      setNotice({ kind: "success", text: editingProduct ? (ar ? "تم حفظ التعديلات." : "Changes saved.") : (ar ? "تم حفظ المنتج." : "Product saved.") });
      setEditingProduct(null);
      form.reset();
    } catch (error) { setNotice({ kind: "error", text: storageError(error) }); }
  }

  async function changeStatus(id: string, nextStatus: "ACTIVE" | "INACTIVE") {
    try {
      await setBrowserProductStatus(window.localStorage, id, nextStatus);
      setProducts(readBrowserProducts(window.localStorage));
    } catch (error) {
      if (registrationRef.current) registrationRef.current.open = true;
      setNotice({ kind: "error", text: storageError(error) });
    }
  }

  function startEditing(product: ProductDirectoryRecord) {
    setEditingProduct(product);
    setNotice(null);
    if (registrationRef.current) registrationRef.current.open = true;
    requestAnimationFrame(() => registrationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }


  return <section className={styles.page} dir={ar ? "rtl" : "ltr"} aria-labelledby="products-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>{ar ? "السجلات الأساسية" : "Essential masters"}</p><h1 id="products-title">{ar ? "المنتجات" : "Products"}</h1><p className={styles.subtitle}>{ar ? "سجل مواصفات المنتجات المتداولة للتتبع عبر المشاريع، من دون مخزون حر أو تقييم مخزون.":"Register traded-product specifications for cross-project traceability, without free stock or inventory valuation."}</p></div><a className={styles.primary} href="#product-registration"><span aria-hidden="true">＋</span>{ar ? "تسجيل منتج" : "Register product"}</a></header>
    <aside className={styles.localScope}><span aria-hidden="true">●</span><div><strong>{ar ? "محفوظ في هذا المتصفح" : "Saved in this browser"}</strong><p>{ar ? "تظهر هذه المنتجات على هذا الجهاز فقط حالياً، ولا تتم مشاركتها مع مستخدمين آخرين أو تضمينها في نسخة المشاريع الاحتياطية. لا يتم إرسالها خارجياً.":"These products are available on this device only for now. They are not shared with other users or included in the project backup. Nothing is sent externally."}</p></div></aside>
    <div className={styles.summary} aria-label={ar ? "ملخص المنتجات" : "Product summary"}><div className={styles.kpi}><span>{ar ? "كل المنتجات" : "All products"}</span><strong>{summary.total}</strong></div><div className={styles.kpi}><span>{ar ? "نشطة" : "Active"}</span><strong>{summary.active}</strong></div><div className={styles.kpi}><span>{ar ? "غير نشطة" : "Inactive"}</span><strong>{summary.inactive}</strong></div></div>
    <form className={`${styles.card} ${styles.toolbar}`} method="get"><input type="hidden" name="locale" value={locale}/><label>{ar ? "بحث" : "Search"}<input type="search" name="q" defaultValue={query} placeholder={ar ? "المرجع أو الاسم أو المنشأ" : "Reference, name or origin"}/></label><label>{ar ? "الحالة" : "Status"}<select name="status" defaultValue={status}><option value="ALL">{ar ? "كل الحالات" : "All statuses"}</option><option value="ACTIVE">{ar ? "نشط" : "Active"}</option><option value="INACTIVE">{ar ? "غير نشط" : "Inactive"}</option></select></label><button type="submit">{ar ? "تطبيق" : "Apply"}</button></form>
    <section className={styles.card} aria-labelledby="product-directory-title"><header className={styles.tableHeader}><div><h2 id="product-directory-title">{ar ? "دليل المنتجات" : "Product directory"}</h2><p className={styles.muted}>{ar ? `${visibleProducts.length} منتج مطابق` : `${visibleProducts.length} matching products`}</p></div><a href={`/masters/coffee?${suffix}`}>{ar ? "مسح المرشحات" : "Clear filters"}</a></header>
      {loading ? <div className={styles.empty} role="status">{ar ? "جارٍ تحميل المنتجات…" : "Loading products…"}</div> : readError ? <div className={styles.errorState} role="alert"><h3>{ar ? "تعذر قراءة بيانات المنتجات المحفوظة" : "Saved product data could not be read"}</h3><p>{ar ? "لم نعرض بيانات نموذجية بدلاً منها. صدّر نسخة احتياطية قبل مسح بيانات الموقع أو تواصل مع المسؤول.":"No sample data was substituted. Export a backup before clearing site data or contact the administrator."}</p></div> : visibleProducts.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{ar ? "المنتج" : "Product"}</th><th>{ar ? "المنشأ" : "Origin"}</th><th>{ar ? "النوع / الدرجة" : "Type / grade"}</th><th>{ar ? "المحصول" : "Crop"}</th><th>{ar ? "العبوة القياسية" : "Standard pack"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "الإجراء" : "Action"}</th></tr></thead><tbody>{visibleProducts.map((product)=><tr key={product.id}><td data-label={ar ? "المنتج" : "Product"}><div className={styles.product}><strong>{ar ? product.nameAr : product.nameEn}</strong><span>{product.reference} · {ar ? product.nameEn : product.nameAr}</span></div></td><td data-label={ar ? "المنشأ" : "Origin"}><bdi>{product.origin}</bdi></td><td data-label={ar ? "النوع / الدرجة" : "Type / grade"}>{product.type} · {product.grade}</td><td data-label={ar ? "المحصول" : "Crop"}><bdi>{product.cropYear}</bdi></td><td data-label={ar ? "العبوة" : "Pack"}><bdi>{Number(product.standardBagWeight).toString()} kg · {product.bagType}</bdi></td><td data-label={ar ? "الحالة" : "Status"}><span className={styles.status} data-status={product.status}>{ar ? (product.status === "ACTIVE" ? "نشط" : "غير نشط") : (product.status === "ACTIVE" ? "Active" : "Inactive")}</span></td><td data-label={ar ? "الإجراء" : "Action"}><div className={styles.rowActions}><button className={styles.lifecycleAction} type="button" onClick={() => startEditing(product)}>{ar ? "تعديل" : "Edit"}</button><button className={styles.lifecycleAction} type="button" onClick={() => changeStatus(product.id, product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>{product.status === "ACTIVE" ? (ar ? "تعطيل" : "Deactivate") : (ar ? "إعادة التفعيل" : "Reactivate")}</button></div></td></tr>)}</tbody></table></div> : <div className={styles.empty} role="status"><h3>{products.length === 0 ? (ar ? "لم تُسجل منتجات بعد" : "No products registered yet") : (ar ? "لا توجد منتجات مطابقة" : "No matching products")}</h3><p className={styles.muted}>{products.length === 0 ? (ar ? "سجل أول منتج لبدء دليل العمل الحقيقي.":"Register the first product to start your real working directory.") : (ar ? "غيّر البحث أو الحالة وحاول مرة أخرى.":"Change the search or status and try again.")}</p>{products.length === 0 && <a className={styles.emptyAction} href="#product-registration">{ar ? "تسجيل أول منتج" : "Register first product"}</a>}</div>}
    </section>
    {!readError && <details ref={registrationRef} id="product-registration" className={`${styles.card} ${styles.registration}`}><summary>{editingProduct ? (ar ? "تعديل مواصفات المنتج" : "Edit product specification") : (ar ? "فتح نموذج تسجيل المنتج" : "Open product registration form")}</summary><h2>{editingProduct ? (ar ? "تصحيح بيانات المنتج" : "Correct product details") : (ar ? "مواصفات المنتج" : "Product specification")}</h2><p className={styles.muted}>{ar ? "المرجع ثابت بعد الإنشاء. صحح المواصفات أو استخدم التعطيل بدلاً من الحذف للحفاظ على التتبع.":"The reference is immutable after creation. Correct other details or deactivate instead of deleting to preserve traceability."}</p><form key={editingProduct?.id ?? "new"} className={styles.formGrid} onSubmit={handleCreate}><label>{ar ? "المرجع" : "Reference"}<input name="reference" required readOnly={Boolean(editingProduct)} defaultValue={editingProduct?.reference}/></label><label>{ar ? "الاسم بالإنجليزية" : "English name"}<input name="nameEn" required dir="ltr" defaultValue={editingProduct?.nameEn}/></label><label>{ar ? "الاسم بالعربية" : "Arabic name"}<input name="nameAr" required dir="rtl" defaultValue={editingProduct?.nameAr}/></label><label>{ar ? "المنشأ" : "Origin"}<input name="origin" required minLength={2} maxLength={2} defaultValue={editingProduct?.origin}/></label><label>{ar ? "النوع" : "Type"}<input name="type" required defaultValue={editingProduct?.type}/></label><label>{ar ? "الدرجة" : "Grade"}<input name="grade" required defaultValue={editingProduct?.grade}/></label><label>{ar ? "سنة المحصول" : "Crop year"}<input name="cropYear" required defaultValue={editingProduct?.cropYear}/></label><label>{ar ? "نوع الكيس" : "Bag type"}<input name="bagType" required defaultValue={editingProduct?.bagType}/></label><label>{ar ? "وزن الكيس القياسي (كجم)" : "Standard bag weight (kg)"}<input name="standardBagWeight" type="number" min="0.001" step="0.001" inputMode="decimal" required defaultValue={editingProduct?.standardBagWeight}/></label><div className={styles.formActions}><button type="submit" data-operation-id={editingProduct ? "updateMasterRecord" : "createMasterRecord"}>{editingProduct ? (ar ? "حفظ التعديلات" : "Save changes") : (ar ? "حفظ المنتج" : "Save product")}</button>{editingProduct && <button className={styles.secondaryAction} type="button" onClick={() => { setEditingProduct(null); setNotice(null); }}>{ar ? "إلغاء التعديل" : "Cancel edit"}</button>}</div></form>{notice && <div ref={feedbackRef} id="product-feedback" className={notice.kind === "error" ? styles.errorNotice : styles.successNotice} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</div>}</details>}
  </section>;
}
