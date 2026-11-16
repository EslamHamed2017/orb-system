import { fileURLToPath } from "node:url";
import { R1_CURRENCIES, R1_PARTIES, R1_COFFEE_SPECIFICATIONS, R1_EXPENSE_CATEGORIES } from "../tests/fixtures/r1-masters.ts";
import { R1_USERS, R1_USER_ROLES, R1_PILOT_SESSIONS } from "../tests/fixtures/r1-security-users.ts";
import {
 R1_APPROVALS,R1_PROJECTS,R1_CONTRACTS,R1_CONTRACT_VERSIONS,R1_CONTRACT_LINES,R1_CONTRACT_LINE_VERSIONS,R1_SUPPLIER_SHIPMENTS,R1_SALES_SHIPMENTS,R1_SUPPLIER_DATASETS,R1_SALES_DATASETS,R1_SALES_DATASET_LINES,R1_EVIDENCE,
 R1_ROUTE_CHECKLISTS,R1_ROUTE_ITEMS,R1_SALES_INVOICES,R1_SALES_INVOICE_LINES,R1_SUPPLIER_INVOICES,R1_MONEY_MOVEMENTS,R1_DIRECT_EXPENSES,R1_CLAIMS,R1_CLOSURE_ASSESSMENTS,R1_CLOSURE_BLOCKERS,R1_INVALIDATOR_FIXTURE,stableHash,R1_CYCLE_IDS,
} from "../tests/fixtures/r1-project-cycle.ts";
import { R1_DOCUMENTS,R1_DOCUMENT_REVISIONS,R1_OUTBOUND_MANIFESTS,R1_OUTBOUND_IDS } from "../tests/fixtures/r1-outbound.ts";

type Delegate={upsert(input:{where:{id:string};create:Record<string,unknown>;update:Record<string,unknown>}):Promise<unknown>;update?(input:{where:{id:string};data:Record<string,unknown>}):Promise<unknown>};
type SeedClient=Record<string,unknown>&{$transaction<T>(work:(client:SeedClient)=>Promise<T>):Promise<T>};
const tables = Object.freeze([
 ["user",R1_USERS],["userRole",R1_USER_ROLES],["pilotSession",R1_PILOT_SESSIONS],["currency",R1_CURRENCIES],["party",R1_PARTIES],["coffeeSpecification",R1_COFFEE_SPECIFICATIONS],["expenseCategory",R1_EXPENSE_CATEGORIES],
 ["approval",R1_APPROVALS],["project",R1_PROJECTS],["contract",R1_CONTRACTS],["contractVersion",R1_CONTRACT_VERSIONS],["contractLine",R1_CONTRACT_LINES],["contractLineVersion",R1_CONTRACT_LINE_VERSIONS],["supplierShipment",R1_SUPPLIER_SHIPMENTS],["salesShipment",R1_SALES_SHIPMENTS],
 ["supplierShipmentDataset",R1_SUPPLIER_DATASETS],["salesShipmentDataset",R1_SALES_DATASETS],["salesShipmentDatasetLine",R1_SALES_DATASET_LINES],["evidenceObject",R1_EVIDENCE],["routeChecklist",R1_ROUTE_CHECKLISTS],["routeChecklistItem",R1_ROUTE_ITEMS],
 ["salesInvoice",R1_SALES_INVOICES],["salesInvoiceLine",R1_SALES_INVOICE_LINES],["commercialDocument",R1_DOCUMENTS],["documentRevision",R1_DOCUMENT_REVISIONS],["outboundManifest",R1_OUTBOUND_MANIFESTS],["supplierInvoice",R1_SUPPLIER_INVOICES],["moneyMovement",R1_MONEY_MOVEMENTS],
 ["directExpense",R1_DIRECT_EXPENSES],["claim",R1_CLAIMS],["closureAssessment",R1_CLOSURE_ASSESSMENTS],["closureBlocker",R1_CLOSURE_BLOCKERS],
] as const);
const DATE_KEYS=/(?:_at|_date|_on|_until|_departure|_arrival)$/;
function materialize(value:unknown,key=""):unknown { if(Array.isArray(value))return value.map((item)=>materialize(item)); if(value&&typeof value==="object"){const result:Record<string,unknown>={};for(const [name,item] of Object.entries(value))result[name]=materialize(item,name);return result;} if(typeof value==="string"&&DATE_KEYS.test(key)&&/^\d{4}-\d{2}-\d{2}T/.test(value))return new Date(value); return value; }
function canonical(value:unknown):unknown { if(typeof value==="bigint")return value.toString(); if(Array.isArray(value))return value.map(canonical); if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)])); return value; }
export const R1_SEED_MANIFEST=Object.freeze({version:1,tables:Object.fromEntries(tables),invalidator:R1_INVALIDATOR_FIXTURE});
export const R1_SEED_DIGEST=stableHash(canonical(R1_SEED_MANIFEST));
export function verifyR1SeedManifest():void {
 const rows=tables.flatMap(([,items])=>items as readonly Record<string,unknown>[]),ids=rows.map((row)=>row.id);
 if(ids.some((id)=>typeof id!=="string")||new Set(ids).size!==ids.length)throw new Error("R1 fixture IDs must be present and globally unique");
 const currencies=new Set(rows.flatMap((row)=>typeof row.currency==="string"?[row.currency]:[])); if([...currencies].some((code)=>!new Set(["USD","AED"]).has(code)))throw new Error("unexpected fixture currency");
 const text=JSON.stringify(canonical(R1_SEED_MANIFEST)); if(/bank(?:ingestion|integration)|tax(?:engine|pack)|legacyMigration|sharedExpense|secondarySource|multipleShipmentSources|routeDesigner|complexClaim/i.test(text))throw new Error("deferred surface in R1 fixtures");
 if(!/^[a-f0-9]{64}$/.test(R1_SEED_DIGEST))throw new Error("unstable R1 seed digest");
}
async function upsert(delegate:Delegate,row:Record<string,unknown>){const create=materialize(row) as Record<string,unknown>,{id,...update}=create;await delegate.upsert({where:{id:String(id)},create,update});}
export async function seedR1(client:SeedClient):Promise<{digest:string;rows:number}> { verifyR1SeedManifest(); return client.$transaction(async(tx)=>{
  for(const [name,items] of tables){const delegate=tx[name] as Delegate|undefined;if(!delegate?.upsert)throw new Error(`Prisma delegate unavailable: ${name}`);for(const row of items)await upsert(delegate,row as Record<string,unknown>);}
  await (tx.contract as Delegate).update?.({where:{id:R1_CYCLE_IDS.salesContract},data:{active_version_id:R1_CYCLE_IDS.salesVersion}});
  await (tx.contract as Delegate).update?.({where:{id:R1_CYCLE_IDS.purchaseContract},data:{active_version_id:R1_CYCLE_IDS.purchaseVersion}});
  await (tx.project as Delegate).update?.({where:{id:R1_CYCLE_IDS.projectA},data:{primary_sales_contract_id:R1_CYCLE_IDS.salesContract}});
  await (tx.supplierShipment as Delegate).update?.({where:{id:R1_CYCLE_IDS.supplierShipment},data:{active_dataset_id:R1_CYCLE_IDS.supplierDataset}});
  await (tx.salesShipment as Delegate).update?.({where:{id:R1_CYCLE_IDS.salesShipment},data:{active_dataset_id:R1_CYCLE_IDS.salesDataset}});
  await (tx.commercialDocument as Delegate).update?.({where:{id:R1_OUTBOUND_IDS.document},data:{active_revision_id:R1_OUTBOUND_IDS.revision}});
  return {digest:R1_SEED_DIGEST,rows:tables.reduce((sum,[,items])=>sum+items.length,0)};
 }); }
const SQL_TABLES:Readonly<Record<string,string>>=Object.freeze({user:"User",userRole:"UserRole",pilotSession:"PilotSession",currency:"Currency",party:"Party",coffeeSpecification:"CoffeeSpecification",expenseCategory:"ExpenseCategory",approval:"Approval",project:"Project",contract:"Contract",contractVersion:"ContractVersion",contractLine:"ContractLine",contractLineVersion:"ContractLineVersion",supplierShipment:"SupplierShipment",salesShipment:"SalesShipment",supplierShipmentDataset:"SupplierShipmentDataset",salesShipmentDataset:"SalesShipmentDataset",salesShipmentDatasetLine:"SalesShipmentDatasetLine",evidenceObject:"EvidenceObject",routeChecklist:"RouteChecklist",routeChecklistItem:"RouteChecklistItem",salesInvoice:"SalesInvoice",salesInvoiceLine:"SalesInvoiceLine",commercialDocument:"CommercialDocument",documentRevision:"DocumentRevision",outboundManifest:"OutboundManifest",supplierInvoice:"SupplierInvoice",moneyMovement:"MoneyMovement",directExpense:"DirectExpense",claim:"Claim",closureAssessment:"ClosureAssessment",closureBlocker:"ClosureBlocker"});
const JSON_COLUMNS=new Set(["attributes","ordered_to_recipients","ordered_cc_recipients","attachment_manifest"]);
const quote=(value:string)=>`"${value.replaceAll('"','""')}"`;
export async function seedR1Postgres(connectionString:string):Promise<{digest:string;rows:number}>{
 verifyR1SeedManifest();
 // @ts-expect-error pg is an accepted runtime dependency; its optional declaration package is intentionally not added to the frozen baseline.
 const {Client}=await import("pg"); const client=new Client({connectionString}); await client.connect();
 try { await client.query("BEGIN");
  for(const [delegateName,items] of tables){const table=SQL_TABLES[delegateName];if(!table)throw new Error(`SQL table unavailable: ${delegateName}`);for(const raw of items){
   const row=materialize(raw) as Record<string,unknown>,columns=Object.keys(row),values=columns.map((name)=>JSON_COLUMNS.has(name)?JSON.stringify(row[name]):row[name]);
   const updates=columns.filter((name)=>name!=="id").map((name)=>`${quote(name)}=EXCLUDED.${quote(name)}`).join(",");
   await client.query(`INSERT INTO ${quote(table)} (${columns.map(quote).join(",")}) VALUES (${columns.map((_,index)=>`$${index+1}`).join(",")}) ON CONFLICT (${quote("id")}) DO UPDATE SET ${updates}`,values);
  }}
  for(const [table,id,data] of [["Contract",R1_CYCLE_IDS.salesContract,{active_version_id:R1_CYCLE_IDS.salesVersion}],["Contract",R1_CYCLE_IDS.purchaseContract,{active_version_id:R1_CYCLE_IDS.purchaseVersion}],["Project",R1_CYCLE_IDS.projectA,{primary_sales_contract_id:R1_CYCLE_IDS.salesContract}],["SupplierShipment",R1_CYCLE_IDS.supplierShipment,{active_dataset_id:R1_CYCLE_IDS.supplierDataset}],["SalesShipment",R1_CYCLE_IDS.salesShipment,{active_dataset_id:R1_CYCLE_IDS.salesDataset}],["CommercialDocument",R1_OUTBOUND_IDS.document,{active_revision_id:R1_OUTBOUND_IDS.revision}]] as const){const [column,value]=Object.entries(data)[0];await client.query(`UPDATE ${quote(table)} SET ${quote(column)}=$1 WHERE ${quote("id")}=$2`,[value,id]);}
  await client.query("COMMIT"); return {digest:R1_SEED_DIGEST,rows:tables.reduce((sum,[,items])=>sum+items.length,0)};
 } catch(error){await client.query("ROLLBACK");throw error;} finally{await client.end();}
}
verifyR1SeedManifest();
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required to seed R1 fixtures");
 console.log(JSON.stringify(await seedR1Postgres(process.env.DATABASE_URL)));
}
