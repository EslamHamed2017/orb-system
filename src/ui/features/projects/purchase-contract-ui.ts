export type ProjectLocale="en"|"ar";
export type CatalogKind="supplier"|"product";

const localized=(locale:ProjectLocale,en:string,ar:string)=>locale==="ar"?ar:en;

export function purchaseContractErrorMessage(status:number,locale:ProjectLocale){
  if(status===401)return localized(locale,"Sign in to save a purchase contract.","سجّل الدخول لحفظ عقد شراء.");
  if(status===403)return localized(locale,"You do not have permission to add a purchase contract.","ليس لديك إذن لإضافة عقد شراء.");
  if(status===404)return localized(locale,"This project was not found or is no longer available. Return to projects and choose an active project.","لم يتم العثور على هذا المشروع أو لم يعد متاحاً. ارجع إلى المشاريع واختر مشروعاً نشطاً.");
  if(status===400)return localized(locale,"Check the contract fields and correct invalid values.","تحقق من حقول العقد وصحح القيم غير الصالحة.");
  if(status===409)return localized(locale,"This purchase contract conflicts with current project records.","يتعارض عقد الشراء هذا مع سجلات المشروع الحالية.");
  if(status===412)return localized(locale,"The project changed. Reload and try again.","تغير المشروع. أعد تحميل الصفحة وحاول مرة أخرى.");
  if(status===428)return localized(locale,"The project version is required. Reload the project and try again.","إصدار المشروع مطلوب. أعد تحميل المشروع وحاول مرة أخرى.");
  return localized(locale,"Contract service is unavailable. Try again later.","خدمة العقود غير متاحة. حاول مرة أخرى لاحقاً.");
}

export function catalogErrorMessage(kind:CatalogKind,status:number,locale:ProjectLocale){
  const en=kind==="supplier"?"supplier":"product",ar=kind==="supplier"?"الموردين":"المنتجات";
  if(status===401)return localized(locale,`Sign in to load the ${en} catalog.`,`سجّل الدخول لتحميل دليل ${ar}.`);
  if(status===403)return localized(locale,`You do not have permission to view the ${en} catalog.`,`ليس لديك إذن لعرض دليل ${ar}.`);
  return localized(locale,`${kind==="supplier"?"Supplier":"Product"} catalog service is unavailable.`,`خدمة دليل ${ar} غير متاحة.`);
}

const states:Record<string,readonly [string,string]>={DRAFT:["Draft","مسودة"],PENDING_APPROVAL:["Draft","مسودة"],APPROVED:["Confirmed","مؤكد"],REJECTED:["Rejected","مرفوض"],SUPERSEDED:["Superseded","مستبدل"],CANCELLED:["Cancelled","ملغى"]};
export function contractStateTone(state:string){if(state==="APPROVED")return "success";if(state==="REJECTED"||state==="CANCELLED")return "error";if(state==="DRAFT"||state==="PENDING_APPROVAL")return "warning";return "neutral";}
export function contractStateLabel(state:string,locale:ProjectLocale){const label=states[state];return label?label[locale==="ar"?1:0]:localized(locale,"Unknown state","حالة غير معروفة");}
const routes:Record<string,readonly [string,string]>={FOREIGN_TO_FOREIGN:["Foreign to foreign","دولي إلى دولي"],DOMESTIC_TO_FOREIGN:["Domestic to foreign","محلي إلى دولي"],FOREIGN_TO_DOMESTIC:["Foreign to domestic","دولي إلى محلي"]};
export function tradeRouteLabel(route:string,locale:ProjectLocale){const label=routes[route];return label?label[locale==="ar"?1:0]:localized(locale,"Unknown route","مسار غير معروف");}
export function formatContractDate(value:string,locale:ProjectLocale){const [year,month,day]=value.split("-").map(Number);const date=new Date(Date.UTC(year,month-1,day));return Number.isNaN(date.valueOf())?value:new Intl.DateTimeFormat(locale==="ar"?"ar":"en",{year:"numeric",month:"short",day:"numeric",timeZone:"UTC"}).format(date);}
export function localizedMetricTon(locale:ProjectLocale){return localized(locale,"MT","طن متري");}
export function formatContractDecimal(value:string,locale:ProjectLocale){const number=Number(value);return Number.isFinite(number)?new Intl.NumberFormat(locale==="ar"?"ar":"en",{maximumFractionDigits:6}).format(number):localized(locale,"Invalid value","قيمة غير صالحة");}

export function completePurchaseContractSave<T>(saved:T,onSaved:(value:T)=>void,form:{reset:()=>void}){
  onSaved(saved);
  form.reset();
}

export function createLogicalSubmissionKey(generate:()=>string=()=>crypto.randomUUID()){
  let fingerprint:string|undefined,key:string|undefined;
  return {for(input:unknown){const next=JSON.stringify(input);if(next!==fingerprint){fingerprint=next;key=generate()}return key!},completed(){fingerprint=undefined;key=undefined}};
}
