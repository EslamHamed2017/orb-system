import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";
import { createSupplierShipmentLineService, type SupplierShipmentLineRepository } from "../../src/modules/shipments/supplier-shipment-line-service.ts";

const id = {
  shipment: "019a5f9b-7c00-7000-8000-000000000301", dataset: "019a5f9b-7c00-7000-8000-000000000302",
  project: "019a5f9b-7c00-7000-8000-000000000303", contractA: "019a5f9b-7c00-7000-8000-000000000304",
  contractB: "019a5f9b-7c00-7000-8000-000000000305", supplierA: "019a5f9b-7c00-7000-8000-000000000306",
  supplierB: "019a5f9b-7c00-7000-8000-000000000307", versionA: "019a5f9b-7c00-7000-8000-000000000308",
  versionB: "019a5f9b-7c00-7000-8000-000000000309", lineA: "019a5f9b-7c00-7000-8000-000000000310",
  lineB: "019a5f9b-7c00-7000-8000-000000000311",
};
function facts(contract:string,supplier:string,version:string,quantity:string) { return { purchaseContractId:contract, supplierId:supplier, contractLineVersionId:version, supplierLotReference:`LOT-${supplier.at(-1)}`, quantity, bagCount:10, bagWeight:"60.000000", netWeight:quantity, grossWeight:quantity }; }
function repository(): SupplierShipmentLineRepository & { rows:any[] } {
  const rows:any[]=[];
  const sources = new Map([
    [id.versionA,{ id:id.versionA, contractId:id.contractA, counterpartyId:id.supplierA, projectId:id.project, contractKind:"PURCHASE", quantity:"100", unitPrice:"5", approvalState:"APPROVED" }],
    [id.versionB,{ id:id.versionB, contractId:id.contractB, counterpartyId:id.supplierB, projectId:id.project, contractKind:"PURCHASE", quantity:"100", unitPrice:"6", approvalState:"APPROVED" }],
  ]);
  return {
    rows,
    async getDataset(shipmentId,datasetId){ return shipmentId===id.shipment&&datasetId===id.dataset ? {id:id.dataset,shipmentId:id.shipment,projectId:id.project,state:"DRAFT"}:null; },
    async getApprovedPurchaseContractLineVersion(versionId){ return sources.get(versionId)??null; },
    async nextLineNo(){return rows.length+1;}, async findByContractLineVersion(datasetId,versionId){return rows.find(r=>r.supplierShipmentDatasetId===datasetId&&r.contractLineVersionId===versionId)??null;},
    async insert(input){rows.push(input);return input;}, async list(datasetId){return rows.filter(r=>r.supplierShipmentDatasetId===datasetId);},
    async get(datasetId,lineId){return rows.find(r=>r.supplierShipmentDatasetId===datasetId&&r.id===lineId)??null;},
  };
}

test("one physical supplier container accepts approved purchase lines from multiple suppliers in its project", async()=>{
  const repo=repository(); let next=0; const service=createSupplierShipmentLineService({repository:repo,newId:()=>[id.lineA,id.lineB][next++]});
  await service.create({shipmentId:id.shipment,datasetId:id.dataset,facts:facts(id.contractA,id.supplierA,id.versionA,"25.500000"),correlationId:"supplier-a"});
  await service.create({shipmentId:id.shipment,datasetId:id.dataset,facts:facts(id.contractB,id.supplierB,id.versionB,"14.500000"),correlationId:"supplier-b"});
  const consolidation=await service.getConsolidation({shipmentId:id.shipment,datasetId:id.dataset,correlationId:"summary"});
  assert.equal(consolidation.containerId,id.shipment); assert.equal(consolidation.datasetId,id.dataset);
  assert.equal(consolidation.supplierCount,2); assert.equal(consolidation.lineCount,2); assert.equal(consolidation.totalQuantity,"40.000000");
  assert.deepEqual(consolidation.suppliers.map(row=>[row.supplierId,row.purchaseContractIds,row.lineCount,row.quantity]),[
    [id.supplierA,[id.contractA],1,"25.500000"],[id.supplierB,[id.contractB],1,"14.500000"],
  ]);
});

test("container line ownership fails closed for cross-project or mismatched supplier purchase lines",async()=>{
  const repo=repository(); const service=createSupplierShipmentLineService({repository:repo});
  repo.getApprovedPurchaseContractLineVersion=async()=>({id:id.versionA,contractId:id.contractA,counterpartyId:id.supplierA,projectId:"019a5f9b-7c00-7000-8000-000000000999",contractKind:"PURCHASE",quantity:"100",unitPrice:"5",approvalState:"APPROVED"});
  await assert.rejects(()=>service.create({shipmentId:id.shipment,datasetId:id.dataset,facts:facts(id.contractA,id.supplierA,id.versionA,"1.000000"),correlationId:"cross-project"}),(e:any)=>e.problem?.code==="APPROVED_PURCHASE_CONTRACT_LINE_REQUIRED");
  repo.getApprovedPurchaseContractLineVersion=async()=>({id:id.versionA,contractId:id.contractA,counterpartyId:id.supplierA,projectId:id.project,contractKind:"PURCHASE",quantity:"100",unitPrice:"5",approvalState:"APPROVED"});
  await assert.rejects(()=>service.create({shipmentId:id.shipment,datasetId:id.dataset,facts:facts(id.contractA,id.supplierB,id.versionA,"1.000000"),correlationId:"wrong-supplier"}),(e:any)=>e.problem?.code==="APPROVED_PURCHASE_CONTRACT_LINE_REQUIRED");
});

test("multi-supplier consolidation API is read-authorized and specified",async()=>{
  const route=await import("../../src/app/api/supplier-shipments/[shipmentId]/datasets/[datasetId]/consolidation/route.ts");
  let called=false; const get=route.createGetHandler({authenticate:async()=>({userId:id.supplierA,roles:["FINANCE_VIEWER"]}),getConsolidation:async(input)=>{called=true;return {datasetId:input.datasetId};}});
  const response=await get(new Request("https://orb.example/api/supplier-shipments/x/datasets/y/consolidation"),{params:Promise.resolve({shipmentId:id.shipment,datasetId:id.dataset})});
  assert.equal(response.status,200); assert.equal(called,true);
  const api=parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml","utf8"));
  const operation=api.paths["/supplier-shipments/{shipmentId}/datasets/{datasetId}/consolidation"].get;
  assert.equal(operation.operationId,"getSupplierContainerConsolidation");
  assert.deepEqual(operation["x-required-roles"],["OWNER_ADMIN","OPERATIONS","FINANCE_VIEWER"]);
  assert.deepEqual(api.components.schemas.SupplierShipmentLineInput.required,["purchaseContractId","supplierId","contractLineVersionId","supplierLotReference","quantity","bagCount","bagWeight","netWeight","grossWeight"]);
});
