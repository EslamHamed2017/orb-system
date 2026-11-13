import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const overview=readFileSync("src/ui/features/projects/ProjectOverviewSummary.tsx","utf8");
const route=readFileSync("src/app/projects/[id]/overview/page.tsx","utf8");
const cards=readFileSync("src/ui/features/profit/ProfitCards.tsx","utf8");
const report=readFileSync("src/ui/features/reports/ProjectProfitabilityReportPage.tsx","utf8");

test("project overview exposes the approved action and operational KPI hierarchy",()=>{
  for(const phrase of ["Add to project","Customer Commercial Invoiced","Supplier Commercial Invoiced","Approved expenses","Customer outstanding","Supplier outstanding","Actual operational margin","Cash position"]) assert.match(overview,new RegExp(phrase));
  assert.match(overview,/\/transactions/);
  assert.match(overview,/\/documents/);
  assert.match(route,/customerCommercialInvoiced/);
  assert.match(route,/supplierCommercialInvoiced/);
  assert.match(route,/collected/);
  assert.match(route,/supplierPaid/);
});

test("profit cards name the approved commercial documents in committed and actual formulas",()=>{
  assert.match(cards,/Customer Commercial Invoices - Supplier Commercial Invoices/);
  assert.match(cards,/Customer Commercial Invoices - Supplier Commercial Invoices - approved expenses/);
  assert.doesNotMatch(cards,/customer invoices - supplier invoices/);
});

test("project profitability report links invoiced values to their source transaction registers",()=>{
  assert.match(report,/Customer Commercial Invoiced/);
  assert.match(report,/Supplier Commercial Invoiced/);
  assert.match(report,/CUSTOMER_COMMERCIAL_INVOICE/);
  assert.match(report,/SUPPLIER_COMMERCIAL_INVOICE/);
});
