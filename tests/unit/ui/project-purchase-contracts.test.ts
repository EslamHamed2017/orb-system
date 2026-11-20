import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import {parseProject} from "../../../src/ui/features/projects/project-api.ts";
import {catalogErrorMessage,completePurchaseContractSave,contractStateLabel,contractStateTone,formatContractDate,formatContractDecimal,localizedMetricTon,purchaseContractErrorMessage,tradeRouteLabel,createLogicalSubmissionKey} from "../../../src/ui/features/projects/purchase-contract-ui.ts";
const panel=readFileSync("src/ui/features/projects/PurchaseContractsPanel.tsx","utf8");

test("successful persisted save updates project state before resetting the captured form",()=>{
  const calls:string[]=[];const saved={id:"saved-project"};
  completePurchaseContractSave(saved,value=>calls.push(`saved:${value.id}`),{reset:()=>calls.push("reset")});
  assert.deepEqual(calls,["saved:saved-project","reset"]);
});

test("purchase save errors are distinct and truthful in English and Arabic",()=>{
  const expected={401:["Sign in to save a purchase contract.","سجّل الدخول لحفظ عقد شراء."],403:["You do not have permission to add a purchase contract.","ليس لديك إذن لإضافة عقد شراء."],404:["This project was not found or is no longer available. Return to projects and choose an active project.","لم يتم العثور على هذا المشروع أو لم يعد متاحاً. ارجع إلى المشاريع واختر مشروعاً نشطاً."],400:["Check the contract fields and correct invalid values.","تحقق من حقول العقد وصحح القيم غير الصالحة."],409:["This purchase contract conflicts with current project records.","يتعارض عقد الشراء هذا مع سجلات المشروع الحالية."],412:["The project changed. Reload and try again.","تغير المشروع. أعد تحميل الصفحة وحاول مرة أخرى."],428:["The project version is required. Reload the project and try again.","إصدار المشروع مطلوب. أعد تحميل المشروع وحاول مرة أخرى."],503:["Contract service is unavailable. Try again later.","خدمة العقود غير متاحة. حاول مرة أخرى لاحقاً."]} as const;
  for(const [status,messages] of Object.entries(expected)){assert.equal(purchaseContractErrorMessage(Number(status),"en"),messages[0]);assert.equal(purchaseContractErrorMessage(Number(status),"ar"),messages[1]);}
});

test("supplier and product catalog failures identify auth, permission, and service causes",()=>{
  assert.equal(catalogErrorMessage("supplier",401,"en"),"Sign in to load the supplier catalog.");
  assert.equal(catalogErrorMessage("product",403,"ar"),"ليس لديك إذن لعرض دليل المنتجات.");
  assert.equal(catalogErrorMessage("supplier",503,"en"),"Supplier catalog service is unavailable.");
  assert.equal(catalogErrorMessage("product",500,"ar"),"خدمة دليل المنتجات غير متاحة.");
});

test("purchase readback localizes enums and formats business values without raw enum leakage",()=>{
  assert.equal(contractStateLabel("PENDING_APPROVAL","en"),"Draft");
  assert.equal(contractStateLabel("APPROVED","ar"),"مؤكد");
  assert.equal(tradeRouteLabel("FOREIGN_TO_FOREIGN","ar"),"دولي إلى دولي");
  assert.equal(tradeRouteLabel("DOMESTIC_TO_FOREIGN","en"),"Domestic to foreign");
  assert.equal(formatContractDecimal("4100.000000","en"),"4,100");
  assert.equal(formatContractDecimal("20.500000","en"),"20.5");
  assert.notEqual(formatContractDecimal("20.500000","ar"),"20.500000");
  assert.notEqual(formatContractDate("2026-11-18","ar"),"2026-11-18");
  assert.equal(localizedMetricTon("ar"),"طن متري");
  assert.equal(contractStateTone("APPROVED"),"success");
  assert.equal(contractStateTone("REJECTED"),"error");
});

test("panel captures the form before await, resets only after persisted save, and has complete responsive bilingual readback",()=>{
  assert.match(panel,/const form=event\.currentTarget/);
  assert.doesNotMatch(panel,/event\.currentTarget\.reset\(\)/);
  assert.match(panel,/completePurchaseContractSave\(saved,onSaved,form\)/);
  for(const seam of ["purchaseContractErrorMessage","formatContractDate","localizedMetricTon","contractStateTone","toleranceFields","retryAfterResponseLoss","refreshAfterResponseLoss","catalogErrorMessage","contractStateLabel","tradeRouteLabel","formatContractDecimal","revisionNo","quantityUnder","netWeightUnder","grossWeightUnder","supplier.reference","product.reference"])assert.ok(panel.includes(seam),`missing ${seam}`);
  for(const label of ["Revision","الإصدار","Trade route","مسار التجارة","Quantity tolerance","تحمل الكمية","Supplier reference","مرجع المورد","Product reference","مرجع المنتج"])assert.ok(panel.includes(label),`missing ${label}`);
  assert.match(panel,/dir=\{ar\?"rtl":"ltr"\}/);
  assert.match(readFileSync("src/ui/features/projects/Projects.module.css","utf8"),/@media\s*\(max-width:/);
  assert.doesNotMatch(panel,/>\{ar\?"مسودة":"Draft"\}</);
  assert.doesNotMatch(panel,/localStorage|demoState|PC-0007|Arbor Export/);
});


test("logical purchase submission retains its key across failures, rotates on input change, and clears after success",()=>{
  const generated=["key-a","key-b","key-c"];
  const keys=createLogicalSubmissionKey(()=>generated.shift()!);
  const original={supplier:"s1",quantity:"20"};
  assert.equal(keys.for(original),"key-a");
  assert.equal(keys.for({...original}),"key-a");
  assert.equal(keys.for({...original,quantity:"21"}),"key-b");
  keys.completed();
  assert.equal(keys.for({...original,quantity:"21"}),"key-c");
});

test("panel validates a 201 response before replacing state or resetting the form",()=>{
  assert.match(panel,/parseProject\(await response\.json\(\)\)/);
  assert.match(panel,/completePurchaseContractSave\(saved,onSaved,form\)/);
  assert.ok(panel.indexOf("parseProject(await response.json())")<panel.indexOf("completePurchaseContractSave(saved,onSaved,form)"));
  assert.match(panel,/submissionKey\.current\.completed\(\)/);
  assert.match(panel,/"if-match":`\"\$\{project\.version\}\"`/);
});


test("project parser deeply rejects malformed purchase-contract records",()=>{
  const valid={id:"project",reference:"PRJ-1",lifecycleState:"DRAFT",managementCurrency:"USD",version:2,customer:{id:"customer",reference:"CUS-1",legalName:"Customer",legalNameAr:null},salesContract:{id:"sales",reference:"SC-1",state:"DRAFT",version:1,activeVersion:{revisionNo:1,effectiveDate:"2026-11-17",product:{id:"product",reference:"P-1",nameEn:"Coffee",nameAr:"قهوة"},quantity:"10.000000",unitPrice:"1.000000",currency:"USD",route:"FOREIGN_TO_FOREIGN",incoterm:"FOB",namedPlace:"Aden",paymentTerms:"Due",documentTerms:"BL",tolerances:{quantityUnder:"0.000000",quantityOver:"0.000000",netWeightUnder:"0.000000",netWeightOver:"0.000000",grossWeightUnder:"0.000000",grossWeightOver:"0.000000"}}},purchaseContracts:[{id:"purchase",reference:"PC-1",state:"DRAFT",version:1,supplier:{id:"supplier",reference:"SUP-1",registeredName:"Supplier",displayNameAr:null},activeVersion:{revisionNo:1,effectiveDate:"2026-11-18",product:{id:"product",reference:"P-1",nameEn:"Coffee",nameAr:"قهوة"},quantity:"8.000000",unitPrice:"1.000000",currency:"USD",route:"FOREIGN_TO_FOREIGN",incoterm:"FOB",namedPlace:"Aden",paymentTerms:"Due",documentTerms:"BL",tolerances:{quantityUnder:"0.000000",quantityOver:"0.000000",netWeightUnder:"0.000000",netWeightOver:"0.000000",grossWeightUnder:"0.000000",grossWeightOver:"0.000000"}}}]};
  assert.equal(parseProject(valid).purchaseContracts[0].reference,"PC-1");
  const malformed=[{...valid,purchaseContracts:[null]},{...valid,purchaseContracts:[{...valid.purchaseContracts[0],supplier:{...valid.purchaseContracts[0].supplier,registeredName:7}}]},{...valid,purchaseContracts:[{...valid.purchaseContracts[0],activeVersion:{...valid.purchaseContracts[0].activeVersion,revisionNo:"1"}}]},{...valid,purchaseContracts:[{...valid.purchaseContracts[0],activeVersion:{...valid.purchaseContracts[0].activeVersion,tolerances:{...valid.purchaseContracts[0].activeVersion.tolerances,grossWeightOver:null}}}]}];
  for(const response of malformed)assert.throws(()=>parseProject(response),/invalid/);
});


test("response-loss UI is truthful and offers safe same-key retry and refresh without clearing entered data",()=>{
  assert.match(panel,/The request may have been saved, but its response could not be verified/);
  assert.match(panel,/قد يكون الطلب قد حُفظ/);
  assert.match(panel,/type="submit"/);
  assert.ok(panel.includes("Retry with the same key"));
  assert.match(panel,/refreshAfterResponseLoss/);
  assert.doesNotMatch(panel,/response could not be verified[^]*form\.reset/);
  assert.match(panel,/className=\{styles\.toleranceFields\}/);
  assert.match(panel,/Under tolerance/);
  assert.match(panel,/Over tolerance/);
});
