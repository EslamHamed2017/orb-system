// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";

export interface SupplierShipmentFacts extends Readonly<Record<string, unknown>> {
  readonly reference: string; readonly purchaseContractId: string; readonly supplierId: string;
  readonly coffeeSpecificationId: string; readonly supplierLotReference: string; readonly quantity: string;
  readonly bagCount: number; readonly bagWeight: string; readonly netWeight: string; readonly grossWeight: string;
  readonly origin: TradeLocation; readonly loadLocation: TradeLocation; readonly destination: TradeLocation;
  readonly incoterm: string; readonly namedPlace: string; readonly containerNumbers: readonly string[];
  readonly sealNumbers: readonly string[]; readonly transport: TransportDetails;
}
export interface TradeLocation { readonly countryCode: string; readonly location: string }
export interface TransportDetails extends Readonly<Record<string, unknown>> { readonly mode: string; readonly carrier?: string; readonly reference?: string }
const REQUIRED = ["reference","purchaseContractId","supplierId","coffeeSpecificationId","supplierLotReference","quantity","bagCount","bagWeight","netWeight","grossWeight","origin","loadLocation","destination","incoterm","namedPlace","containerNumbers","sealNumbers","transport"] as const;
const OPTIONAL = ["dischargeLocation","plannedShipmentAt","notes"] as const;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECIMAL=/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
const fail=(correlationId:string):never=>{throw problemError({code:"VALIDATION_FAILED",status:400,correlationId});};
function text(value:unknown,min=1,max=2000){return typeof value==="string"&&value.trim().length>=min&&value.length<=max;}
function location(value:unknown){if(!value||typeof value!=="object"||Array.isArray(value))return false;const row=value as Record<string,unknown>;return Object.keys(row).every(k=>["countryCode","location"].includes(k))&&typeof row.countryCode==="string"&&/^[A-Z]{2}$/.test(row.countryCode)&&text(row.location);}
function transport(value:unknown){if(!value||typeof value!=="object"||Array.isArray(value))return false;const row=value as Record<string,unknown>;return Object.keys(row).every(k=>["mode","carrier","reference"].includes(k))&&text(row.mode)&&(!("carrier" in row)||text(row.carrier))&&(!("reference" in row)||text(row.reference));}
export function validateSupplierShipmentFacts(value:unknown,correlationId="shipment-validation"):SupplierShipmentFacts{
 if(!value||typeof value!=="object"||Array.isArray(value))fail(correlationId);const row=value as Record<string,unknown>;const allowed=new Set<string>([...REQUIRED,...OPTIONAL]);
 if(Object.keys(row).some(k=>!allowed.has(k))||REQUIRED.some(k=>!(k in row)))fail(correlationId);
 for(const k of ["purchaseContractId","supplierId","coffeeSpecificationId"] as const)if(typeof row[k]!=="string"||!UUID.test(row[k]))fail(correlationId);
 for(const k of ["reference","supplierLotReference","namedPlace"] as const)if(!text(row[k]))fail(correlationId);
 if(!text(row.incoterm,3,20)||!Number.isSafeInteger(row.bagCount)||Number(row.bagCount)<1)fail(correlationId);
 for(const k of ["quantity","bagWeight","netWeight","grossWeight"] as const)if(typeof row[k]!=="string"||!DECIMAL.test(row[k])||Number(row[k])<=0)fail(correlationId);
 if(!location(row.origin)||!location(row.loadLocation)||!location(row.destination)||("dischargeLocation" in row&&!location(row.dischargeLocation))||!transport(row.transport))fail(correlationId);
 for(const k of ["containerNumbers","sealNumbers"] as const){const list=row[k];if(!Array.isArray(list)||list.some(x=>!text(x))||new Set(list).size!==list.length)fail(correlationId);}
 if("plannedShipmentAt" in row&&(typeof row.plannedShipmentAt!=="string"||Number.isNaN(Date.parse(row.plannedShipmentAt))))fail(correlationId);
 if("notes" in row&&row.notes!==null&&!text(row.notes,1,2000))fail(correlationId);
 return Object.freeze(structuredClone(row)) as SupplierShipmentFacts;
}
