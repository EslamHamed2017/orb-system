import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildContractFulfillmentReport, type ContractFulfillmentReportRecord } from "../../../src/ui/features/reports/contract-fulfillment-report.ts";

const rows: readonly ContractFulfillmentReportRecord[] = [
  { id:"line-1", approvedOn:"2026-11-02", contractType:"SALES", contractId:"sales-1", contractReference:"SAL-2026-004", lineNumber:1, projectId:"project-orion", projectReference:"PRJ-2026-014", productReference:"PROD-001", productName:"Ethiopia Yirgacheffe", counterpartyName:"Northstar Roasters", contractedQuantity:"20.000000", fulfilledQuantity:"7.500000", unit:"kg", contractedValue:"200.000000", fulfilledValue:"75.000000", currency:"USD" },
  { id:"line-2", approvedOn:"2026-11-04", contractType:"PURCHASE", contractId:"purchase-1", contractReference:"PUR-2026-011", lineNumber:2, projectId:"project-orion", projectReference:"PRJ-2026-014", productReference:"PROD-002", productName:"Brazil Santos", counterpartyName:"Arbor Export", contractedQuantity:"10.000000", fulfilledQuantity:"10.000000", unit:"bag", contractedValue:"100.000000", fulfilledValue:"100.000000", currency:"AED" },
  { id:"line-3", approvedOn:"2026-10-20", contractType:"SALES", contractId:"sales-2", contractReference:"SAL-2026-009", lineNumber:1, projectId:"project-atlas", projectReference:"PRJ-2026-019", productReference:"PROD-003", productName:"Kenya AA", counterpartyName:"Atlas Retail", contractedQuantity:"5.000000", fulfilledQuantity:"0.000000", unit:"kg", contractedValue:"50.000000", fulfilledValue:"0.000000", currency:"USD" },
];

test("contract fulfillment report filters approved lines and calculates exact remaining totals", () => {
  const report = buildContractFulfillmentReport(rows, { projectId:"project-orion", contractType:"ALL", status:"ALL", from:"2026-11-01", to:"2026-11-30", query:"" });
  assert.deepEqual(report.items.map((row) => row.id), ["line-1", "line-2"]);
  assert.deepEqual(report.summary.quantityTotals, [
    { unit:"bag", contracted:"10", fulfilled:"10", remaining:"0" },
    { unit:"kg", contracted:"20", fulfilled:"7.5", remaining:"12.5" },
  ]);
  assert.deepEqual(report.summary.valueTotals, [
    { currency:"AED", contracted:"100", fulfilled:"100", remaining:"0" },
    { currency:"USD", contracted:"200", fulfilled:"75", remaining:"125" },
  ]);
  assert.equal(report.summary.completeLineCount, 1);
  assert.equal(report.summary.openLineCount, 1);
});

test("contract fulfillment report supports type, status, search, and guards impossible fulfillment", () => {
  assert.deepEqual(buildContractFulfillmentReport(rows, { contractType:"SALES", status:"OPEN", query:"northstar" }).items.map((row) => row.id), ["line-1"]);
  assert.deepEqual(buildContractFulfillmentReport(rows, { contractType:"PURCHASE", status:"COMPLETE", query:"" }).items.map((row) => row.id), ["line-2"]);
  assert.throws(() => buildContractFulfillmentReport([{ ...rows[0], fulfilledQuantity:"21" }], { contractType:"ALL", status:"ALL", query:"" }), /FULFILLMENT_EXCEEDS_CONTRACT/);
  assert.throws(() => buildContractFulfillmentReport(rows, { contractType:"ALL", status:"ALL", from:"2026-11-30", to:"2026-11-01", query:"" }), /INVERTED_FULFILLMENT_DATE_RANGE/);
});

test("dedicated contract fulfillment report is bilingual and links contract and project context", () => {
  const page = readFileSync("src/ui/features/reports/ContractFulfillmentReportPage.tsx", "utf8");
  const route = readFileSync("src/app/reports/contract-fulfillment/page.tsx", "utf8");
  assert.match(route, /ContractFulfillmentReportPage/);
  assert.match(page, /Contract fulfillment report/);
  assert.match(page, /تقرير تنفيذ العقود/);
  assert.match(page, /Remaining quantity \/ value/);
  assert.match(page, /الكمية \/ القيمة المتبقية/);
  assert.match(page, /\/projects\/\$\{row.projectId\}\/contracts/);
  assert.match(page, /\/projects\/\$\{row.projectId\}\/overview/);
});

test("reports hub routes contract fulfillment filters to the dedicated screen", () => {
  const hub = readFileSync("src/ui/features/reports/reports-hub.ts", "utf8");
  assert.match(hub, /\/reports\/contract-fulfillment/);
});
