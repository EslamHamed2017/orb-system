export type ContractFulfillmentType = "SALES" | "PURCHASE";
export type ContractFulfillmentTypeFilter = ContractFulfillmentType | "ALL";
export type ContractFulfillmentStatusFilter = "OPEN" | "COMPLETE" | "ALL";

export interface ContractFulfillmentReportRecord {
  readonly id:string; readonly approvedOn:string; readonly contractType:ContractFulfillmentType; readonly contractId:string; readonly contractReference:string; readonly lineNumber:number;
  readonly projectId:string; readonly projectReference:string; readonly productReference:string; readonly productName:string; readonly counterpartyName:string;
  readonly contractedQuantity:string; readonly fulfilledQuantity:string; readonly unit:string; readonly contractedValue:string; readonly fulfilledValue:string; readonly currency:string;
}
export interface ContractFulfillmentReportFilters { readonly projectId?:string; readonly contractType:ContractFulfillmentTypeFilter; readonly status:ContractFulfillmentStatusFilter; readonly from?:string; readonly to?:string; readonly query:string }

const SCALE=1_000_000n, DATE=/^\d{4}-\d{2}-\d{2}$/;
function date(value:string|undefined):void { if(value!==undefined && (!DATE.test(value)||Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)))) throw new TypeError("INVALID_FULFILLMENT_DATE"); }
function decimal(value:string):bigint { const [whole,fraction=""]=value.split("."); if(!/^(?:0|[1-9][0-9]*)$/.test(whole)||!/^[0-9]{0,6}$/.test(fraction)) throw new TypeError("INVALID_FULFILLMENT_DECIMAL"); return BigInt(whole)*SCALE+BigInt(fraction.padEnd(6,"0")); }
function format(value:bigint):string { const whole=value/SCALE, fraction=(value%SCALE).toString().padStart(6,"0").replace(/0+$/,""); return fraction?`${whole}.${fraction}`:whole.toString(); }
function state(row:ContractFulfillmentReportRecord) { const contractedQuantity=decimal(row.contractedQuantity), fulfilledQuantity=decimal(row.fulfilledQuantity), contractedValue=decimal(row.contractedValue), fulfilledValue=decimal(row.fulfilledValue); // Shipments may deliver above the contract within tolerance: remaining stops at zero and the line counts as complete.
const remainingQuantity=fulfilledQuantity>contractedQuantity?0n:contractedQuantity-fulfilledQuantity, remainingValue=fulfilledValue>contractedValue?0n:contractedValue-fulfilledValue; return { contractedQuantity,fulfilledQuantity,remainingQuantity,contractedValue,fulfilledValue,remainingValue,complete:remainingQuantity===0n }; }
export function buildContractFulfillmentReport(rows:readonly ContractFulfillmentReportRecord[], filters:ContractFulfillmentReportFilters) {
  date(filters.from); date(filters.to); if(filters.from&&filters.to&&filters.from>filters.to) throw new TypeError("INVERTED_FULFILLMENT_DATE_RANGE");
  const query=filters.query.trim().toLocaleLowerCase();
  const selected=rows.map((row)=>({row,calculated:state(row)})).filter(({row,calculated})=>{
    if(filters.projectId&&row.projectId!==filters.projectId)return false; if(filters.contractType!=="ALL"&&row.contractType!==filters.contractType)return false;
    if(filters.status==="OPEN"&&calculated.complete)return false; if(filters.status==="COMPLETE"&&!calculated.complete)return false;
    if(filters.from&&row.approvedOn<filters.from)return false; if(filters.to&&row.approvedOn>filters.to)return false;
    return !query||[row.contractReference,row.projectReference,row.productReference,row.productName,row.counterpartyName].some((value)=>value.toLocaleLowerCase().includes(query));
  }).sort((a,b)=>a.row.approvedOn.localeCompare(b.row.approvedOn)||a.row.id.localeCompare(b.row.id));
  const quantities=new Map<string,{contracted:bigint;fulfilled:bigint}>(), values=new Map<string,{contracted:bigint;fulfilled:bigint}>();
  for(const {row,calculated} of selected){ const q=quantities.get(row.unit)??{contracted:0n,fulfilled:0n}; q.contracted+=calculated.contractedQuantity;q.fulfilled+=calculated.fulfilledQuantity;quantities.set(row.unit,q); const v=values.get(row.currency)??{contracted:0n,fulfilled:0n};v.contracted+=calculated.contractedValue;v.fulfilled+=calculated.fulfilledValue;values.set(row.currency,v); }
  const items=selected.map(({row,calculated})=>Object.freeze({...row,remainingQuantity:format(calculated.remainingQuantity),remainingValue:format(calculated.remainingValue),status:calculated.complete?"COMPLETE" as const:"OPEN" as const}));
  return Object.freeze({items:Object.freeze(items),summary:Object.freeze({lineCount:items.length,openLineCount:items.filter(x=>x.status==="OPEN").length,completeLineCount:items.filter(x=>x.status==="COMPLETE").length,quantityTotals:Object.freeze([...quantities].sort(([a],[b])=>a.localeCompare(b)).map(([unit,x])=>Object.freeze({unit,contracted:format(x.contracted),fulfilled:format(x.fulfilled),remaining:format(x.contracted>x.fulfilled?x.contracted-x.fulfilled:0n)}))),valueTotals:Object.freeze([...values].sort(([a],[b])=>a.localeCompare(b)).map(([currency,x])=>Object.freeze({currency,contracted:format(x.contracted),fulfilled:format(x.fulfilled),remaining:format(x.contracted>x.fulfilled?x.contracted-x.fulfilled:0n)})))}),});
}
