import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";

const ids = {
  project: "019a5f9b-7c00-7000-8000-000000007401", party: "019a5f9b-7c00-7000-8000-000000007402",
  contract: "019a5f9b-7c00-7000-8000-000000007403", targetA: "019a5f9b-7c00-7000-8000-000000007404",
  targetB: "019a5f9b-7c00-7000-8000-000000007405", actor: "019a5f9b-7c00-7000-8000-000000007406",
};
interface Service {
  recordMovement(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  allocate(input: Record<string, unknown>): Promise<{ value: any; replayed: boolean }>;
  getMovement(id: string): Promise<any>;
  getTarget(type: string, id: string): Promise<any>;
  allocations(): Promise<readonly any[]>;
}
async function subject(): Promise<Service> {
  const module = await import("../../../src/modules/money/settlement-repository.ts") as any;
  return module.createInMemorySettlementService({
    now: () => "2026-11-07T14:00:00.000Z", projects: [{ id: ids.project, version: 1, finalState: "OPEN" }],
    contracts: [{ id: ids.contract, projectId: ids.project, partyId: ids.party, partyType: "CUSTOMER", currency: "USD" }],
    targets: [ids.targetA, ids.targetB].map((id) => ({ type: "CINV", id, projectId: ids.project, partyId: ids.party,
      currency: "USD", amount: "100.000000", outstanding: "100.000000" })),
  });
}
const envelope = (key: string) => ({ principal: { userId: ids.actor, roles: ["FINANCE_VIEWER"] }, idempotencyKey: key, correlationId: key });

test("concurrent allocations serialize so one command cannot overspend shared movement availability", async () => {
  const service = await subject();
  const movement = (await service.recordMovement({ projectId: ids.project, expectedVersion: 1, partyId: ids.party,
    contractId: ids.contract, kind: "CUSTOMER_RECEIPT", amount: "100.000000", currency: "USD",
    occurredOn: "2026-11-07", reference: "CONCURRENT-001", ...envelope("concurrent-movement") })).value;
  const outcomes = await Promise.allSettled([
    service.allocate({ movementId: movement.id, expectedVersion: movement.version, targetType: "CINV", targetId: ids.targetA,
      amount: "80.000000", currency: "USD", ...envelope("concurrent-allocation-a") }),
    service.allocate({ movementId: movement.id, expectedVersion: movement.version, targetType: "CINV", targetId: ids.targetB,
      amount: "80.000000", currency: "USD", ...envelope("concurrent-allocation-b") }),
  ]);
  assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
  const failure = outcomes.find((result) => result.status === "rejected") as PromiseRejectedResult;
  assert.ok(failure.reason instanceof ProblemError);
  assert.ok(["STALE_VERSION", "ALLOCATION_EXCEEDS_AVAILABLE"].includes(failure.reason.problem.code));
  assert.equal((await service.getMovement(movement.id)).availableAmount, "20.000000");
  assert.equal((await service.allocations()).filter((row) => row.reversalOfId === null).length, 1);
});

test("concurrent identical idempotent allocation commands create one row and one replay", async () => {
  const service = await subject();
  const movement = (await service.recordMovement({ projectId: ids.project, expectedVersion: 1, partyId: ids.party,
    contractId: ids.contract, kind: "CUSTOMER_RECEIPT", amount: "100.000000", currency: "USD",
    occurredOn: "2026-11-07", reference: "CONCURRENT-002", ...envelope("replay-movement") })).value;
  const allocate = () => service.allocate({ movementId: movement.id, expectedVersion: movement.version, targetType: "CINV",
    targetId: ids.targetA, amount: "60.000000", currency: "USD", ...envelope("same-allocation-key") });
  const [first, second] = await Promise.all([allocate(), allocate()]);
  assert.equal(new Set([first.value.id, second.value.id]).size, 1);
  assert.deepEqual([first.replayed, second.replayed].sort(), [false, true]);
  assert.equal((await service.getMovement(movement.id)).availableAmount, "40.000000");
  assert.equal((await service.getTarget("CINV", ids.targetA)).outstanding, "40.000000");
  assert.equal((await service.allocations()).length, 1);
});
