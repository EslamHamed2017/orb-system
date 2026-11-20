import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const report=readFileSync("src/ui/features/reports/ProfitabilityReportLive.tsx","utf8");

test("project profitability report reads live margins and links each project to its profit sources",()=>{
  assert.match(report,/\/api\/reports\/project-profitability/);
  assert.match(report,/\/projects\/\$\{r\.project\.id\}\/profit/);
  assert.doesNotMatch(report,/ROWS\s*:|project-orion/);
});
