import type { SupplierView } from "./supplier-response-validation";
export type SupplierStatusFilter="ACTIVE"|"INACTIVE"|"ALL";
export type SupplierDirectoryRecord=SupplierView;
export function summarizeSuppliers(rows:readonly SupplierView[]){return Object.freeze({total:rows.length,active:rows.filter(x=>x.status==="ACTIVE").length,inactive:rows.filter(x=>x.status==="INACTIVE").length})}
export function filterSuppliers(rows:readonly SupplierView[],query:string,status:SupplierStatusFilter){const q=query.trim().toLocaleLowerCase();return rows.filter(x=>(status==="ALL"||x.status===status)&&(!q||[x.reference,x.registeredName,x.displayNameAr,x.countryCode,x.contactName,x.email,x.phone,x.paymentCurrency].some(v=>v?.toLocaleLowerCase().includes(q))))}
