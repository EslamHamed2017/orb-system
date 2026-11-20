import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildAccountsOperationalReport,
  buildProjectProfitabilityReport,
  type AccountsOperationalRecord,
  type ProjectProfitabilityRecord,
} from "../../../src/ui/features/reports/accounts-profitability-reports.ts";

const accounts: readonly AccountsOperationalRecord[] = [
  { id:"a1", occurredOn:"2026-11-03", projectId:"orion", projectReference:"PRJ-014", reference:"SINV-001", accountType:"SALES_INVOICE", partyName:"Northstar", amount:"120.250000", outstandingAmount:"20.250000", currency:"USD" },
  { id:"a2", occurredOn:"2026-11-04", projectId:"orion", projectReference:"PRJ-014", reference:"COL-001", accountType:"COLLECTION", partyName:"Northstar", amount:"100.000000", outstandingAmount:"0.000000", currency:"USD" },
  { id:"a3", occurredOn:"2026-11-05", projectId:"atlas", projectReference:"PRJ-019", reference:"EXP-001", accountType:"EXPENSE", partyName:"Port Services", amount:"500.000000", outstandingAmount:"0.000000", currency:"AED" },
];
const profitability: readonly ProjectProfitabilityRecord[] = [
  { id:"p1", occurredOn:"2026-11-05", projectId:"orion", projectReference:"PRJ-014", projectName:"Orion Coffee", salesAmount:"120.250000", supplierAmount:"70.100000", expenseAmount:"10.050000", currency:"USD" },
  { id:"p2", occurredOn:"2026-11-06", projectId:"atlas", projectReference:"PRJ-019", projectName:"Atlas Trading", salesAmount:"100.000000", supplierAmount:"120.000000", expenseAmount:"5.000000", currency:"AED" },
];

test("Accounts report filters operational movements and partitions exact totals by currency", () => {
  const report=buildAccountsOperationalReport(accounts,{projectId:"orion",accountType:"ALL",from:"2026-11-01",to:"2026-11-30",query:"north"});
  assert.deepEqual(report.items.map(x=>x.id),["a1","a2"]);
  assert.deepEqual(report.summary.currencyTotals,[{currency:"USD",amount:"220.25",outstandingAmount:"20.25"}]);
  assert.deepEqual(report.summary.typeCounts,[{accountType:"COLLECTION",count:1},{accountType:"SALES_INVOICE",count:1}]);
});

test("Project profitability report calculates exact operational margin including loss without merging currencies", () => {
  const report=buildProjectProfitabilityReport(profitability,{query:"",from:"2026-11-01",to:"2026-11-30"});
  assert.deepEqual(report.items.map(x=>[x.id,x.operationalMargin]),[["p1","40.1"],["p2","-25"]]);
  assert.deepEqual(report.summary.currencyTotals,[
    {currency:"AED",salesAmount:"100",supplierAmount:"120",expenseAmount:"5",operationalMargin:"-25"},
    {currency:"USD",salesAmount:"120.25",supplierAmount:"70.1",expenseAmount:"10.05",operationalMargin:"40.1"},
  ]);
  assert.throws(()=>buildProjectProfitabilityReport(profitability,{query:"",from:"2026-11-30",to:"2026-11-01"}),/INVERTED_REPORT_DATE_RANGE/);
});

test("Dedicated bilingual report pages preserve Reports and Project 360 navigation", () => {
  const accountsPage=readFileSync("src/ui/features/reports/AccountsOperationalReportPage.tsx","utf8");
  const profitabilityPage=readFileSync("src/ui/features/reports/ProfitabilityReportLive.tsx","utf8");
  const accountsRoute=readFileSync("src/app/reports/accounts/page.tsx","utf8");
  const profitabilityRoute=readFileSync("src/app/reports/project-profitability/page.tsx","utf8");
  assert.match(accountsRoute,/AccountsOperationalReportPage/);
  assert.match(profitabilityRoute,/ProfitabilityReportLive/);
  assert.match(accountsPage,/Accounts operational report/);
  assert.match(accountsPage,/تقرير الحسابات التشغيلي/);
  assert.match(profitabilityPage,/Project profitability report/);
  assert.match(profitabilityPage,/تقرير ربحية المشروع/);
  assert.match(accountsPage,/\/projects\/\$\{row.projectId\}\/overview/);
  assert.match(profitabilityPage,/\/projects\/\$\{r\.project\.id\}\/profit/);
  assert.match(profitabilityPage,/\/api\/reports\/project-profitability/);
  assert.doesNotMatch(accountsPage,/general ledger/i);
  assert.doesNotMatch(profitabilityPage,/inventory valuation/i);
});
