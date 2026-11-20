import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const overview=readFileSync("src/ui/features/projects/ProjectOverviewSummary.tsx","utf8");
const route=readFileSync("src/app/projects/[id]/overview/page.tsx","utf8");
const cards=readFileSync("src/ui/features/profit/ProfitCards.tsx","utf8");
const report=readFileSync("src/ui/features/reports/ProfitabilityReportLive.tsx","utf8");

test("project overview exposes the approved action and operational KPI hierarchy",()=>{
  for(const phrase of ["Add to project","Sales invoiced","Supplier invoiced","Approved expenses","Customer outstanding","Supplier outstanding","Actual operational margin","Cash position"]) assert.match(overview,new RegExp(phrase));
  assert.match(overview,/\/transactions/);
  assert.match(overview,/\/documents/);
  assert.match(route,/customerCommercialInvoiced/);
  assert.match(route,/supplierCommercialInvoiced/);
  assert.match(route,/collected/);
  assert.match(route,/supplierPaid/);
});

test("profit cards name the approved commercial documents in committed and actual formulas",()=>{
  assert.match(cards,/Sales invoices - Supplier invoices/);
  assert.match(cards,/Sales invoices - Supplier invoices - approved expenses/);
  assert.doesNotMatch(cards,/customer invoices - supplier invoices/);
});

test("project profitability report reads live margins and links each project to its profit sources",()=>{
  assert.match(report,/\/api\/reports\/project-profitability/);
  assert.match(report,/\/projects\/\$\{r\.project\.id\}\/profit/);
  assert.doesNotMatch(report,/ROWS\s*:|project-orion/);
});
