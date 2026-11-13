import assert from "node:assert/strict";
import { existsSync,readFileSync } from "node:fs";
import test from "node:test";
import { domainTerm } from "../../../src/platform/i18n/domain-terminology.ts";

test("approved commercial invoice terms are canonical in English and Arabic",()=>{
  assert.equal(domainTerm("salesInvoice","en"),"Customer Commercial Invoice");
  assert.equal(domainTerm("salesInvoice","ar"),"الفاتورة التجارية للعميل");
  assert.equal(domainTerm("supplierInvoice","en"),"Supplier Commercial Invoice");
  assert.equal(domainTerm("supplierInvoice","ar"),"الفاتورة التجارية للمورد");
});

test("customer and supplier registers, print documents and service output use commercial invoice copy",()=>{
  const files=[
    "src/ui/features/accounts/ProjectSalesInvoicesPage.tsx",
    "src/ui/features/accounts/ProjectSupplierInvoicesPage.tsx",
    "src/ui/features/accounts/InvoicePrintDocument.tsx",
    "src/modules/invoices/sales-invoice-service.ts",
    "src/ui/features/accounts/accounts-hub.ts",
  ].map(x=>readFileSync(x,"utf8")).join("\n");
  for(const phrase of ["Customer Commercial Invoice","Supplier Commercial Invoice","الفاتورة التجارية للعميل","الفاتورة التجارية للمورد"]) assert.match(files,new RegExp(phrase));
  assert.doesNotMatch(files,/>Sales invoices</);
  assert.doesNotMatch(files,/>Supplier invoices</);
  assert.doesNotMatch(files,/>فواتير المبيعات</);
  assert.doesNotMatch(files,/>فواتير الموردين</);
});

test("project documents route preserves project context and enforces the project filter",()=>{
  const route="src/app/projects/[id]/documents/page.tsx";
  assert.equal(existsSync(route),true);
  const source=readFileSync(route,"utf8");
  assert.match(source,/ProjectContextNavigation/);
  assert.match(source,/current="documents"/);
  assert.match(source,/projectId:\s*id/);
  assert.match(source,/AttachmentsIndexPage/);
});
