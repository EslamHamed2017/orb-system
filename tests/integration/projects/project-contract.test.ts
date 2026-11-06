import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";
import { InMemoryIdempotencyStore } from "../../../src/platform/idempotency/store.ts";

const OWNER = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000501", displayName: "Owner", roles: ["OWNER_ADMIN"] });
const OPERATIONS = Object.freeze({ userId: "019a5f9b-7c00-7000-8000-000000000502", displayName: "Operations", roles: ["OPERATIONS"] });
const CUSTOMER = "019a5f9b-7c00-7000-8000-000000000510";
const SUPPLIER = "019a5f9b-7c00-7000-8000-000000000511";
const COFFEE = "019a5f9b-7c00-7000-8000-000000000512";
const ZERO_TOLERANCES = Object.freeze({ quantityUnder: "0", quantityOver: "0", netWeightUnder: "0", netWeightOver: "0", grossWeightUnder: "0", grossWeightOver: "0" });

type Principal = Readonly<{ userId: string; displayName: string; roles: readonly string[] }>;
type ContractInput = Readonly<Record<string, unknown>>;
type Command = Readonly<{ principal: Principal; idempotencyKey: string; correlationId: string }>;
interface ProjectContractService {
  createProject(input: Command & { customerId: string; salesContract: ContractInput }): Promise<{ value: any; replayed: boolean }>;
  listProjects(input: { principal: Principal }): Promise<readonly any[]>;
  getProject(input: { projectId: string; principal: Principal }): Promise<any>;
  createPurchaseContract(input: Command & { projectId: string; expectedVersion: number; contract: ContractInput }): Promise<{ value: any; replayed: boolean }>;
  amendContract(input: Command & { contractId: string; expectedVersion: number; contract: ContractInput; reason: string; effectiveDate: string }): Promise<{ value: any; replayed: boolean }>;
  submitContract(input: Command & { contractId: string; expectedVersion: number }): Promise<{ value: any; replayed: boolean }>;
  applyContractDecision(input: { approvalId: string; approver: Principal; decision: "APPROVED" | "REJECTED"; comment: string }): Promise<any>;
  cancelProject(input: Command & { projectId: string; expectedVersion: number; reason: string }): Promise<{ value: any; replayed: boolean }>;
}
interface ProjectContractModule {
  createInMemoryProjectContractService(input: {
    idempotencyStore: InMemoryIdempotencyStore;
    now: () => string;
    referenceSequence?: () => string;
    failSalesContractInsert?: () => boolean;
    hasExecution?: (projectId: string) => boolean;
  }): ProjectContractService;
  readProjectContractState(service: ProjectContractService): Readonly<{ projects: readonly any[]; contracts: readonly any[]; versions: readonly any[]; approvals: readonly any[]; audit: readonly any[] }>;
}
async function loadModule(): Promise<ProjectContractModule> {
  return import("../../../src/modules/projects/project-service.ts") as Promise<ProjectContractModule>;
}
async function subject(options: Record<string, unknown> = {}) {
  const module = await loadModule();
  const service = module.createInMemoryProjectContractService({
    idempotencyStore: new InMemoryIdempotencyStore(), now: () => "2026-11-06T12:00:00.000Z", ...options,
  });
  return { module, service };
}
function command(key: string, principal: Principal = OPERATIONS): Command {
  return { principal, idempotencyKey: key, correlationId: key };
}
function contract(counterpartyId = CUSTOMER, overrides: Record<string, unknown> = {}): ContractInput {
  return {
    counterpartyId, coffeeSpecificationId: COFFEE, quantity: "100.000000", unitPrice: "4.250000",
    currency: "USD", route: "FOREIGN_TO_FOREIGN", incoterm: "FOB", namedPlace: "Santos", ...overrides,
  };
}
function isProblem(code: string, status?: number) {
  return (error: unknown) => error instanceof ProblemError && error.problem.code === code
    && (status === undefined || error.problem.status === status);
}

test("Project and exactly one SALES draft are created atomically with persisted zero tolerances", async () => {
  const { module, service } = await subject();
  const created = await service.createProject({ customerId: CUSTOMER, salesContract: contract(), ...command("project-create-0001") });
  assert.equal(created.replayed, false);
  assert.equal(created.value.version, 1);
  assert.equal(created.value.lifecycleState, "DRAFT");
  assert.equal(created.value.salesContract.kind, "SALES");
  assert.equal(created.value.salesContract.activeVersion.revisionNo, 1);
  assert.equal(created.value.salesContract.activeVersion.state, "DRAFT");
  assert.deepEqual(created.value.salesContract.activeVersion.tolerances, ZERO_TOLERANCES);
  const state = module.readProjectContractState(service);
  assert.deepEqual([state.projects.length, state.contracts.length, state.versions.length], [1, 1, 1]);
  assert.equal(state.contracts.filter((row) => row.kind === "SALES").length, 1);
});

test("sales-contract insertion failure rolls the whole Project back and exact replay creates no duplicate", async () => {
  let fail = true;
  const { module, service } = await subject({ failSalesContractInsert: () => fail });
  await assert.rejects(() => service.createProject({ customerId: CUSTOMER, salesContract: contract(), ...command("project-atomic-0001") }), /sales contract|atomic|insert/i);
  assert.deepEqual(module.readProjectContractState(service).projects, [], "no orphan Project may survive a sales-contract failure");
  fail = false;
  const input = { customerId: CUSTOMER, salesContract: contract(), ...command("project-atomic-0002") };
  const first = await service.createProject(input);
  const replay = await service.createProject(input);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.value, first.value);
  assert.equal(module.readProjectContractState(service).projects.length, 1);
});

test("each independent sales contract creates another Project and generated references remain unique", async () => {
  const references = ["ORB-2026-0001", "ORB-2026-0002"];
  const { service } = await subject({ referenceSequence: () => references.shift() ?? "ORB-2026-0002" });
  const first = await service.createProject({ customerId: CUSTOMER, salesContract: contract(), ...command("project-independent-0001") });
  const second = await service.createProject({ customerId: CUSTOMER, salesContract: contract(), ...command("project-independent-0002") });
  assert.notEqual(first.value.id, second.value.id);
  assert.notEqual(first.value.reference, second.value.reference);
  assert.equal((await service.listProjects({ principal: OWNER })).length, 2);
  await assert.rejects(() => service.createProject({ customerId: CUSTOMER, salesContract: contract(), ...command("project-duplicate-ref") }), isProblem("DUPLICATE_REFERENCE", 409));
});

test("purchase contract and amendments append versions without editing an approved revision", async () => {
  const { module, service } = await subject();
  const project = (await service.createProject({ customerId: CUSTOMER, salesContract: contract(), ...command("project-contract-0001") })).value;
  const purchase = (await service.createPurchaseContract({ projectId: project.id, expectedVersion: 1, contract: contract(SUPPLIER), ...command("purchase-contract-0001") })).value;
  assert.equal(purchase.kind, "PURCHASE");
  assert.equal(purchase.activeVersion.revisionNo, 1);
  const amended = (await service.amendContract({ contractId: purchase.id, expectedVersion: 1, contract: contract(SUPPLIER, { unitPrice: "4.100000" }), reason: "Price correction", effectiveDate: "2026-11-07", ...command("contract-amend-0001") })).value;
  assert.equal(amended.activeVersion.revisionNo, 2);
  assert.equal(amended.versions[0].state, "SUPERSEDED");
  assert.equal(amended.versions[0].unitPrice, "4.250000", "prior bytes remain immutable");
  const submitted = await service.submitContract({ contractId: purchase.id, expectedVersion: amended.version, ...command("contract-submit-0001") });
  const approved = await service.applyContractDecision({ approvalId: submitted.value.id, approver: OWNER, decision: "APPROVED", comment: "Approved exact revision" });
  assert.equal(approved.activeVersion.state, "APPROVED");
  const next = (await service.amendContract({ contractId: purchase.id, expectedVersion: approved.version, contract: contract(SUPPLIER, { unitPrice: "4.000000" }), reason: "New commercial terms", effectiveDate: "2026-11-08", ...command("contract-amend-approved") })).value;
  assert.equal(next.activeVersion.revisionNo, 3);
  assert.equal(next.activeVersion.state, "DRAFT");
  assert.equal(next.versions[1].state, "APPROVED", "approval is preserved on immutable revision 2");
  assert.equal(next.versions[1].unitPrice, "4.100000", "approved revision facts cannot be edited in place");
  assert.equal(module.readProjectContractState(service).versions.length, 4);
});

test("approval request is bound to the exact contract revision and hash", async () => {
  const { module, service } = await subject();
  const project = (await service.createProject({ customerId: CUSTOMER, salesContract: contract(), ...command("project-approval-0001") })).value;
  const sales = project.salesContract;
  const result = await service.submitContract({ contractId: sales.id, expectedVersion: sales.version, ...command("contract-submit-exact") });
  assert.deepEqual({
    actionCode: result.value.actionCode, subjectId: result.value.subjectId, subjectVersion: result.value.subjectVersion,
    subjectHash: result.value.subjectHash, requesterId: result.value.requesterId, decision: result.value.decision,
  }, {
    actionCode: "CONTRACT_VERSION", subjectId: sales.activeVersion.id, subjectVersion: sales.activeVersion.revisionNo,
    subjectHash: sales.activeVersion.hash, requesterId: OPERATIONS.userId, decision: "PENDING",
  });
  assert.match(result.value.subjectHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(module.readProjectContractState(service).approvals.map((row) => row.id), [result.value.id]);
});

test("only Owner cancels an unexecuted Project; execution and stale/replayed commands fail safely", async () => {
  const executed = new Set<string>();
  const { module, service } = await subject({ hasExecution: (projectId: string) => executed.has(projectId) });
  const first = (await service.createProject({ customerId: CUSTOMER, salesContract: contract(), ...command("project-cancel-first") })).value;
  await assert.rejects(() => service.cancelProject({ projectId: first.id, expectedVersion: 1, reason: "Customer withdrew", ...command("project-cancel-denied") }), isProblem("PERMISSION_DENIED", 403));
  const cancel = { projectId: first.id, expectedVersion: 1, reason: "Customer withdrew", ...command("project-cancel-owner", OWNER) };
  const cancelled = await service.cancelProject(cancel);
  const replay = await service.cancelProject(cancel);
  assert.equal(cancelled.value.lifecycleState, "CANCELLED");
  assert.equal(replay.replayed, true);
  assert.equal(module.readProjectContractState(service).projects.length, 1, "cancellation is not deletion");

  const second = (await service.createProject({ customerId: CUSTOMER, salesContract: contract(), ...command("project-cancel-executed") })).value;
  executed.add(second.id);
  await assert.rejects(() => service.cancelProject({ projectId: second.id, expectedVersion: 1, reason: "Too late", ...command("project-cancel-after-execution", OWNER) }), isProblem("INVALID_STATE_TRANSITION", 409));
  await assert.rejects(() => service.cancelProject({ projectId: second.id, expectedVersion: 2, reason: "Stale", ...command("project-cancel-stale", OWNER) }), isProblem("STALE_VERSION", 412));
});
