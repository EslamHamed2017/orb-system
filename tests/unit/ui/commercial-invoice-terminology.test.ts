import assert from "node:assert/strict";
import { existsSync,readFileSync } from "node:fs";
import test from "node:test";
import { domainTerm } from "../../../src/platform/i18n/domain-terminology.ts";

test("approved invoice terms match the frozen bilingual domain terminology",()=>{
  assert.equal(domainTerm("salesInvoice","en"),"Sales invoice");
  assert.equal(domainTerm("salesInvoice","ar"),"فاتورة مبيعات");
  assert.equal(domainTerm("supplierInvoice","en"),"Supplier invoice");
  assert.equal(domainTerm("supplierInvoice","ar"),"فاتورة مورد");
});

test("customer and supplier registers, print documents and service output use frozen invoice copy",()=>{
  const files=[
    "src/ui/features/accounts/ProjectSalesInvoicesPage.tsx",
    "src/ui/features/accounts/ProjectSupplierInvoicesPage.tsx",
    "src/ui/features/accounts/InvoicePrintDocument.tsx",
    "src/modules/invoices/sales-invoice-service.ts",
    "src/ui/features/accounts/accounts-hub.ts",
  ].map(x=>readFileSync(x,"utf8")).join("\n");
  for(const phrase of ["Sales invoice","Supplier invoice","فاتورة مبيعات","فاتورة مورد"]) assert.match(files,new RegExp(phrase));
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
