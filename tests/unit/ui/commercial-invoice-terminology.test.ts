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
    "src/platform/i18n/domain-terminology.ts",
    "src/ui/features/accounts/AccountsWorkspace.tsx",
    "src/ui/features/invoices/ShipmentInvoicesPanel.tsx",
    "src/modules/invoices/sales-invoice-service.ts",
  ].map(x=>readFileSync(x,"utf8")).join("\n");
  for(const phrase of ["Sales invoice","Supplier invoice","فاتورة مبيعات","فاتورة مورد"]) assert.match(files,new RegExp(phrase));
  assert.doesNotMatch(files,/>Sales invoices</);
  assert.doesNotMatch(files,/>Supplier invoices</);
  assert.doesNotMatch(files,/>فواتير المبيعات</);
  assert.doesNotMatch(files,/>فواتير الموردين</);
});

test("project documents route shows the project's live attachments, never sample data",()=>{
  const source=readFileSync("src/app/projects/[id]/documents/page.tsx","utf8");
  assert.match(source,/<LiveAttachments projectId=\{id\}/);
  assert.doesNotMatch(source,/ITEMS|demo/);
});
