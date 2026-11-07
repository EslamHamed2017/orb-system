import assert from "node:assert/strict";
import test from "node:test";

const PROJECT_ID = "019a6100-2000-7000-8000-000000000001";
const OWNER = Object.freeze({ userId: "owner-1", roles: ["OWNER_ADMIN"] });
const FINANCE = Object.freeze({ userId: "finance-1", roles: ["FINANCE_VIEWER"] });
const requiredAdapters = ["project", "shipments", "routes", "documents", "settlement", "expenses", "claims", "closure", "audit", "marginAndCash"] as const;
type OverviewModule = {
  REQUIRED_PROJECT_OVERVIEW_ADAPTERS: readonly string[];
  createInMemoryProjectOverviewQuery(options: { adapters: Record<string, (projectId: string) => Promise<unknown>> }): {
    getProjectOverview(input: { projectId: string; principal: { userId: string; roles: readonly string[] } }): Promise<any>;
  };
};
async function moduleUnderTest(): Promise<OverviewModule> {
  const modulePath = "../../../src/modules/projects/project-overview-query.ts";
  return import(modulePath) as Promise<OverviewModule>;
}
function fixture() {
  const state = {
    project: { id: PROJECT_ID, code: "ORB-P-0001", state: "ACTIVE", version: 7, customerName: "Pilot Customer" },
    shipments: { supplier: { count: 2, quantity: "40.000000", unit: "MT", states: { RECEIVED: 1, IN_TRANSIT: 1 } }, sales: { count: 1, quantity: "20.000000", unit: "MT", states: { IN_TRANSIT: 1 } } },
    routes: { blockers: [{ id: "route-blocker", code: "ROUTE_ITEM_INCOMPLETE", href: "/sales-shipments/sales-1?tab=route" }] },
    documents: { blockers: [{ id: "document-blocker", code: "CINV_MISSING", href: "/sales-shipments/sales-1?tab=documents" }] },
    settlement: { currencySections: [{ currency: "USD", receivable: "1000.000000", payable: "700.000000", unallocated: "50.000000" }], blockers: [{ id: "settlement-blocker", code: "UNALLOCATED_MONEY", href: `/projects/${PROJECT_ID}/money` }] },
    expenses: { currencySections: [{ currency: "USD", approved: "25.000000", pending: "5.000000" }], blockers: [{ id: "expense-blocker", code: "EXPENSE_PENDING", href: `/projects/${PROJECT_ID}/expenses` }] },
    claims: { open: 1, blockers: [{ id: "claim-blocker", code: "CLAIM_INCOMPLETE", href: `/projects/${PROJECT_ID}/claims` }] },
    closure: { assessmentId: "assessment-1", state: "CURRENT", blockers: [{ id: "closure-blocker", code: "SALES_SHIPMENT_NOT_DELIVERED", href: `/projects/${PROJECT_ID}/closure` }] },
    audit: { eventCount: 9, lastSequenceNo: 9, lastEventHash: "a".repeat(64), continuityVerified: true, href: `/projects/${PROJECT_ID}/audit` },
    marginAndCash: { currencySections: [{ currency: "USD", measures: { expectedMargin: { amount: "300.000000" }, committedMargin: { amount: "275.000000" }, actualOperationalMargin: { amount: "250.000000" }, cashPosition: { amount: "100.000000" } } }] },
  };
  const adapters = Object.fromEntries(requiredAdapters.map((name) => [name, async (projectId: string) => {
    assert.equal(projectId, PROJECT_ID);
    return structuredClone(state[name]);
  }]));
  return { state, adapters };
}

test("Project overview declares each authoritative source adapter exactly once and fails closed on every omission", async () => {
  const module = await moduleUnderTest();
  assert.deepEqual(module.REQUIRED_PROJECT_OVERVIEW_ADAPTERS, requiredAdapters);
  for (const omitted of requiredAdapters) {
    const { adapters } = fixture();
    delete adapters[omitted];
    assert.throws(() => module.createInMemoryProjectOverviewQuery({ adapters }), new RegExp(`missing Project overview source adapter: ${omitted}`));
  }
});

test("Project overview reports authoritative state, quantities, money, all blockers and audit summary with source links", async () => {
  const module = await moduleUnderTest();
  const { adapters } = fixture();
  const result = await module.createInMemoryProjectOverviewQuery({ adapters }).getProjectOverview({ projectId: PROJECT_ID, principal: OWNER });
  assert.deepEqual(result.project, { id: PROJECT_ID, code: "ORB-P-0001", state: "ACTIVE", version: 7, customerName: "Pilot Customer" });
  assert.deepEqual(result.quantities.supplier, { count: 2, quantity: "40.000000", unit: "MT", states: { RECEIVED: 1, IN_TRANSIT: 1 } });
  assert.deepEqual(result.quantities.sales, { count: 1, quantity: "20.000000", unit: "MT", states: { IN_TRANSIT: 1 } });
  assert.equal(result.money[0].currency, "USD");
  assert.deepEqual(result.money[0].marginAndCash, { expectedMargin: "300.000000", committedMargin: "275.000000", actualOperationalMargin: "250.000000", cashPosition: "100.000000" });
  assert.deepEqual(result.blockers.map((item: any) => item.family), ["routes", "documents", "settlement", "expenses", "claims", "closure"]);
  for (const blocker of result.blockers) assert.match(blocker.href, /^\//);
  assert.deepEqual(result.auditSummary, { eventCount: 9, lastSequenceNo: 9, lastEventHash: "a".repeat(64), continuityVerified: true, href: `/projects/${PROJECT_ID}/audit` });
  assert.ok(!JSON.stringify(result).includes("estimated"), "overview must not fabricate an estimated aggregate");
});

test("overview role shaping preserves financial read access without exposing Owner-only action metadata", async () => {
  const module = await moduleUnderTest();
  const { state, adapters } = fixture();
  Object.assign(state.closure, { ownerAction: { operationId: "finalCloseProject", csrfToken: "must-never-leak" } });
  const result = await module.createInMemoryProjectOverviewQuery({ adapters }).getProjectOverview({ projectId: PROJECT_ID, principal: FINANCE });
  assert.equal(result.money[0].marginAndCash.cashPosition, "100.000000");
  assert.equal(JSON.stringify(result).includes("csrfToken"), false);
  assert.equal(JSON.stringify(result).includes("finalCloseProject"), false);
});

test("resolved blockers disappear only after the corresponding authoritative source changes", async () => {
  const module = await moduleUnderTest();
  const subject = fixture();
  const query = module.createInMemoryProjectOverviewQuery({ adapters: subject.adapters });
  const before = await query.getProjectOverview({ projectId: PROJECT_ID, principal: OWNER });
  assert.equal(before.blockers.some((item: any) => item.id === "route-blocker"), true);
  const unchanged = await query.getProjectOverview({ projectId: PROJECT_ID, principal: OWNER });
  assert.equal(unchanged.blockers.some((item: any) => item.id === "route-blocker"), true);
  subject.state.routes.blockers = [];
  const after = await query.getProjectOverview({ projectId: PROJECT_ID, principal: OWNER });
  assert.equal(after.blockers.some((item: any) => item.id === "route-blocker"), false);
  assert.equal(after.blockers.some((item: any) => item.id === "document-blocker"), true);
});
