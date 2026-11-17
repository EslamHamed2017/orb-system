"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {projectMutationHeaders} from "../../security/project-mutation-headers";
import {parseProject,type ProjectApiRecord} from "./project-api";
import {catalogErrorMessage,completePurchaseContractSave,contractStateLabel,contractStateTone,createLogicalSubmissionKey,formatContractDate,formatContractDecimal,localizedMetricTon,purchaseContractErrorMessage,tradeRouteLabel} from "./purchase-contract-ui";
import styles from "./Projects.module.css";

type Supplier={id:string;reference:string;registeredName:string;displayNameAr:string|null;status:string};
type Product={id:string;reference:string;nameEn:string;nameAr:string;status:string};
type LoadState="loading"|"ready"|"saving"|"error";

export function PurchaseContractsPanel({project,locale,canWrite,onSaved}:{project:ProjectApiRecord;locale:"en"|"ar";canWrite:boolean;onSaved:(project:ProjectApiRecord)=>void}){
  const ar=locale==="ar";
  const [suppliers,setSuppliers]=useState<Supplier[]>([]);
  const [products,setProducts]=useState<Product[]>([]);
  const [state,setState]=useState<LoadState>("loading");
  const [message,setMessage]=useState("");
  const [success,setSuccess]=useState(false);
  const [responseLoss,setResponseLoss]=useState(false);
  const submissionKey=useRef(createLogicalSubmissionKey());

  useEffect(()=>{let active=true;(async()=>{try{
    const [supplierResponse,productResponse]=await Promise.all([fetch("/api/suppliers",{cache:"no-store"}),fetch("/api/products",{cache:"no-store"})]);
    if(!supplierResponse.ok)throw {kind:"supplier",status:supplierResponse.status};
    if(!productResponse.ok)throw {kind:"product",status:productResponse.status};
    const [supplierJson,productJson]=await Promise.all([supplierResponse.json(),productResponse.json()]);
    if(active){setSuppliers(supplierJson.items.filter((x:Supplier)=>x.status==="ACTIVE"));setProducts(productJson.items.filter((x:Product)=>x.status==="ACTIVE"));setState("ready");}
  }catch(error){if(active){const failure=error as {kind?:"supplier"|"product";status?:number};setMessage(failure.kind?catalogErrorMessage(failure.kind,failure.status??503,locale):(ar?"خدمات أدلة الموردين والمنتجات غير متاحة.":"Supplier and product catalog services are unavailable."));setState("error");}}})();return()=>{active=false};},[ar,locale]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=event.currentTarget;
    setState("saving");setMessage("");setSuccess(false);setResponseLoss(false);
    const data=new FormData(form),value=(name:string)=>String(data.get(name)??"");
    const body={counterpartyId:value("supplier"),coffeeSpecificationId:value("product"),effectiveDate:value("effectiveDate"),quantity:value("quantity"),unitPrice:value("unitPrice"),currency:value("currency"),route:value("route"),incoterm:value("incoterm"),namedPlace:value("namedPlace"),paymentTerms:value("paymentTerms"),documentTerms:value("documentTerms"),tolerances:{quantityUnder:value("quantityUnder")||"0",quantityOver:value("quantityOver")||"0",netWeightUnder:value("netWeightUnder")||"0",netWeightOver:value("netWeightOver")||"0",grossWeightUnder:value("grossWeightUnder")||"0",grossWeightOver:value("grossWeightOver")||"0"}};
    let response:Response;
    try{response=await fetch(`/api/projects/${encodeURIComponent(project.id)}/purchase-contracts`,{method:"POST",headers:{...projectMutationHeaders(submissionKey.current.for(body)),"content-type":"application/json","if-match":`"${project.version}"`},body:JSON.stringify(body)});}catch{setMessage(ar?"قد يكون الطلب قد حُفظ، لكن تعذر التحقق من استجابته. تحقق من العقود المحفوظة أو أعد المحاولة بالمفتاح نفسه.":"The request may have been saved, but its response could not be verified. Check saved contracts or retry with the same key.");setResponseLoss(true);setState("ready");return;}
    if(!response.ok){setMessage(purchaseContractErrorMessage(response.status,locale));setState("ready");return;}
    let saved:ProjectApiRecord;
    try{saved=parseProject(await response.json());}catch{setMessage(ar?"قد يكون الطلب قد حُفظ، لكن تعذر التحقق من استجابته. تحقق من العقود المحفوظة أو أعد المحاولة بالمفتاح نفسه.":"The request may have been saved, but its response could not be verified. Check saved contracts or retry with the same key.");setResponseLoss(true);setState("ready");return;}
    completePurchaseContractSave(saved,onSaved,form);
    submissionKey.current.completed();
    setMessage(ar?"تم حفظ عقد الشراء.":"Purchase contract saved.");setSuccess(true);setState("ready");
  }

  function retryAfterResponseLoss(form:HTMLFormElement){form.requestSubmit();}
  async function refreshAfterResponseLoss(){try{const response=await fetch(`/api/projects/${encodeURIComponent(project.id)}`,{cache:"no-store"});if(!response.ok)throw Error();onSaved(parseProject(await response.json()));setMessage(ar?"تم تحديث العقود المحفوظة دون مسح الحقول المدخلة.":"Saved contracts were refreshed without clearing your entries.");setResponseLoss(false);}catch{setMessage(ar?"تعذر تحديث العقود المحفوظة. ما زالت الحقول المدخلة محفوظة في النموذج.":"Saved contracts could not be refreshed. Your entered fields remain in the form.");}}

  return <section className={styles.overviewStack} dir={ar?"rtl":"ltr"} aria-labelledby="purchase-contracts-title">
    <div className={styles.sectionCard}><h2 id="purchase-contracts-title">{ar?"عقود الشراء":"Purchase contracts"}</h2>
      {project.purchaseContracts.length===0?<p className={styles.muted}>{ar?"لا توجد عقود شراء محفوظة لهذا المشروع بعد.":"No purchase contracts have been saved for this project yet."}</p>:<div className={styles.projectCards}>{project.purchaseContracts.map(contract=>{const version=contract.activeVersion;return <article className={styles.projectCard} key={contract.id}><div className={styles.cardTop}><div><p className={styles.reference}><bdi>{contract.reference}</bdi></p><h3>{ar?(contract.supplier.displayNameAr||contract.supplier.registeredName):contract.supplier.registeredName}</h3></div><span className={styles.status} data-tone={contractStateTone(contract.state)}>{contractStateLabel(contract.state,locale)}</span></div>
        <dl className={styles.projectFacts}>
          <div><dt>{ar?"مرجع المورد":"Supplier reference"}</dt><dd><bdi>{contract.supplier.reference}</bdi></dd></div><div><dt>{ar?"المنتج":"Product"}</dt><dd>{ar?(version.product.nameAr||version.product.nameEn):version.product.nameEn}</dd></div><div><dt>{ar?"مرجع المنتج":"Product reference"}</dt><dd><bdi>{version.product.reference}</bdi></dd></div><div><dt>{ar?"الإصدار":"Revision"}</dt><dd>{version.revisionNo}</dd></div>
          <div><dt>{ar?"تاريخ السريان":"Effective date"}</dt><dd><time dateTime={version.effectiveDate}>{formatContractDate(version.effectiveDate,locale)}</time></dd></div><div><dt>{ar?"الكمية":"Quantity"}</dt><dd><bdi>{formatContractDecimal(version.quantity,locale)} {localizedMetricTon(locale)}</bdi></dd></div><div><dt>{ar?"سعر الوحدة":"Unit price"}</dt><dd><bdi>{formatContractDecimal(version.unitPrice,locale)} {version.currency} / {localizedMetricTon(locale)}</bdi></dd></div><div><dt>{ar?"مسار التجارة":"Trade route"}</dt><dd>{tradeRouteLabel(version.route,locale)}</dd></div>
          <div><dt>{ar?"شرط التسليم":"Incoterm"}</dt><dd><bdi>{version.incoterm}</bdi></dd></div><div><dt>{ar?"المكان المسمى":"Named place"}</dt><dd>{version.namedPlace}</dd></div><div><dt>{ar?"تحمل الكمية (- / +)":"Quantity tolerance (- / +)"}</dt><dd><bdi>{formatContractDecimal(version.tolerances.quantityUnder,locale)} / {formatContractDecimal(version.tolerances.quantityOver,locale)}</bdi></dd></div><div><dt>{ar?"تحمل الوزن الصافي (- / +)":"Net weight tolerance (- / +)"}</dt><dd><bdi>{formatContractDecimal(version.tolerances.netWeightUnder,locale)} / {formatContractDecimal(version.tolerances.netWeightOver,locale)}</bdi></dd></div><div><dt>{ar?"تحمل الوزن الإجمالي (- / +)":"Gross weight tolerance (- / +)"}</dt><dd><bdi>{formatContractDecimal(version.tolerances.grossWeightUnder,locale)} / {formatContractDecimal(version.tolerances.grossWeightOver,locale)}</bdi></dd></div>
          <div><dt>{ar?"شروط السداد":"Payment terms"}</dt><dd>{version.paymentTerms}</dd></div><div><dt>{ar?"شروط المستندات":"Document terms"}</dt><dd>{version.documentTerms}</dd></div>
        </dl></article>})}</div>}
    </div>
    {canWrite?<form className={styles.sectionCard} onSubmit={submit}><fieldset disabled={state==="loading"||state==="saving"}><legend>{ar?"إضافة عقد شراء":"Add purchase contract"}</legend>{state==="error"?<p role="alert" className={styles.error}>{message}</p>:<div className={styles.formGrid}>
      <label>{ar?"المورد":"Supplier"}<select name="supplier" required defaultValue=""><option value="" disabled>{ar?"اختر مورداً نشطاً":"Select an active supplier"}</option>{suppliers.map(x=><option key={x.id} value={x.id}>{ar?(x.displayNameAr||x.registeredName):x.registeredName} · {x.reference}</option>)}</select></label>
      <label>{ar?"المنتج":"Product"}<select name="product" required defaultValue=""><option value="" disabled>{ar?"اختر منتجاً نشطاً":"Select an active product"}</option>{products.map(x=><option key={x.id} value={x.id}>{ar?(x.nameAr||x.nameEn):x.nameEn} · {x.reference}</option>)}</select></label>
      <label>{ar?"تاريخ السريان":"Effective date"}<input name="effectiveDate" type="date" required/></label><label>{ar?"الكمية":"Quantity"}<input name="quantity" inputMode="decimal" required/></label><label>{ar?"سعر الوحدة":"Unit price"}<input name="unitPrice" inputMode="decimal" required/></label><label>{ar?"العملة":"Currency"}<input name="currency" maxLength={3} required/></label>
      <label>{ar?"مسار التجارة":"Trade route"}<select name="route" required><option value="FOREIGN_TO_FOREIGN">{tradeRouteLabel("FOREIGN_TO_FOREIGN",locale)}</option><option value="DOMESTIC_TO_FOREIGN">{tradeRouteLabel("DOMESTIC_TO_FOREIGN",locale)}</option><option value="FOREIGN_TO_DOMESTIC">{tradeRouteLabel("FOREIGN_TO_DOMESTIC",locale)}</option></select></label><label>{ar?"شرط التسليم":"Incoterm"}<input name="incoterm" required/></label><label className={styles.full}>{ar?"المكان المسمى":"Named place"}<input name="namedPlace" required/></label>
      <label>{ar?"شروط السداد":"Payment terms"}<textarea name="paymentTerms" required/></label><label>{ar?"شروط المستندات":"Document terms"}<textarea name="documentTerms" required/></label><fieldset className={styles.toleranceGroup}><legend>{ar?"تحمل الكمية":"Quantity tolerance"}</legend><span className={styles.toleranceFields}><label><span>{ar?"النقص":"Under tolerance"}</span><input name="quantityUnder" inputMode="decimal"/></label><label><span>{ar?"الزيادة":"Over tolerance"}</span><input name="quantityOver" inputMode="decimal"/></label></span></fieldset>
      <fieldset className={styles.toleranceGroup}><legend>{ar?"تحمل الوزن الصافي":"Net weight tolerance"}</legend><span className={styles.toleranceFields}><label><span>{ar?"النقص":"Under tolerance"}</span><input name="netWeightUnder" inputMode="decimal"/></label><label><span>{ar?"الزيادة":"Over tolerance"}</span><input name="netWeightOver" inputMode="decimal"/></label></span></fieldset><fieldset className={styles.toleranceGroup}><legend>{ar?"تحمل الوزن الإجمالي":"Gross weight tolerance"}</legend><span className={styles.toleranceFields}><label><span>{ar?"النقص":"Under tolerance"}</span><input name="grossWeightUnder" inputMode="decimal"/></label><label><span>{ar?"الزيادة":"Over tolerance"}</span><input name="grossWeightOver" inputMode="decimal"/></label></span></fieldset>
      <div className={`${styles.actions} ${styles.full}`}><button className={styles.filledButton} type="submit">{state==="saving"?(ar?"جارٍ الحفظ…":"Saving…"):(ar?"حفظ عقد الشراء":"Save purchase contract")}</button></div>
    </div>}</fieldset>{message&&state!=="error"&&<div className={responseLoss?styles.responseLoss:undefined}><p role="status" className={success?styles.recordOnly:styles.error}>{message}</p>{responseLoss&&<div className={styles.responseLossActions}><button type="submit" onClick={event=>{event.preventDefault();retryAfterResponseLoss(event.currentTarget.form!)}}>{ar?"إعادة المحاولة بالمفتاح نفسه":"Retry with the same key"}</button><button type="button" onClick={refreshAfterResponseLoss}>{ar?"التحقق من العقود المحفوظة":"Check saved contracts"}</button></div>}</div>}</form>:<div className={styles.stateCard}><p>{ar?"يمكنك عرض العقود، لكن دورك لا يسمح بإضافة عقد شراء.":"You can view contracts, but your role cannot add a purchase contract."}</p></div>}
  </section>;
}
