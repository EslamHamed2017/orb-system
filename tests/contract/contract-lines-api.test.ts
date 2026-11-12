import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";
import { createContractLineService, type ContractLineRepository } from "../../src/modules/contracts/contract-line-service.ts";

const ids = {
  contract: "019a5f9b-7c00-7000-8000-000000000101",
  otherContract: "019a5f9b-7c00-7000-8000-000000000102",
  version1: "019a5f9b-7c00-7000-8000-000000000201",
  version2: "019a5f9b-7c00-7000-8000-000000000202",
  line: "019a5f9b-7c00-7000-8000-000000000301",
  specification: "019a5f9b-7c00-7000-8000-000000000401",
};
const OWNER = { userId: "owner", roles: ["OWNER_ADMIN"] };
const facts = { coffeeSpecificationId: ids.specification, quantity: "100.000000", unitPrice: "5.250000", currency: "USD", incoterm: "FOB", namedPlace: "Dubai", quantityToleranceUnder: "0", quantityToleranceOver: "2.500000", paymentTerms: "Net 30", documentTerms: "Original documents" };

function repository(): ContractLineRepository & { versions: any[] } {
  const versions: any[] = [];
  return {
    versions,
    async getContractVersion(contractId, versionId) { return contractId === ids.contract && [ids.version1, ids.version2].includes(versionId) ? { id: versionId, contractId, state: "DRAFT" } : null; },
    async getLine(contractId, lineId) { return contractId === ids.contract && lineId === ids.line ? { id: ids.line, contractId, lineNo: 1 } : null; },
    async nextLineNo() { return 2; },
    async insertLine(input) { const line = { id: ids.line, contractId: input.contractId, lineNo: input.lineNo }; versions.push(input.version); return { ...line, currentVersion: input.version }; },
    async insertLineVersion(input) { versions.push(input); return input; },
    async listLines() { return [{ id: ids.line, contractId: ids.contract, lineNo: 1, currentVersion: versions.at(-1) ?? null }]; },
    async listLineVersions() { return versions; },
  };
}

test("contract-line service creates a stable line and appends immutable v2 facts", async () => {
  const repo = repository();
  const service = createContractLineService({ repository: repo, newId: () => ids.line });
  const created = await service.create({ principal: OWNER, contractId: ids.contract, contractVersionId: ids.version1, facts, correlationId: "create-line" });
  assert.equal(created.lineNo, 2);
  assert.equal(repo.versions.length, 1);
  assert.equal(repo.versions[0].contractVersionId, ids.version1);
  assert.equal(repo.versions[0].hashVersion, 2);
  assert.match(repo.versions[0].lineHash, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(repo.versions[0].facts), true);
});

test("contract-line update appends to a new draft contract version and preserves history", async () => {
  const repo = repository();
  const service = createContractLineService({ repository: repo, newId: () => ids.line });
  await service.update({ principal: OWNER, contractId: ids.contract, lineId: ids.line, contractVersionId: ids.version1, facts, correlationId: "v1" });
  await service.update({ principal: OWNER, contractId: ids.contract, lineId: ids.line, contractVersionId: ids.version2, facts: { ...facts, quantity: "80.000000" }, correlationId: "v2" });
  const history = await service.versions({ principal: OWNER, contractId: ids.contract, lineId: ids.line, correlationId: "history" });
  assert.deepEqual(history.map((row) => row.contractVersionId), [ids.version1, ids.version2]);
  assert.equal(history[0].facts.quantity, "100.000000");
  assert.equal(history[1].facts.quantity, "80.000000");
});

test("contract-line service rejects invalid facts, cross-contract versions, and duplicate snapshot writes", async () => {
  const repo = repository();
  const service = createContractLineService({ repository: repo, newId: () => ids.line });
  await assert.rejects(() => service.create({ principal: OWNER, contractId: ids.contract, contractVersionId: ids.version1, facts: { ...facts, quantity: "0" }, correlationId: "bad" }), (error: any) => error.problem?.code === "VALIDATION_FAILED");
  await assert.rejects(
    () => service.create({ principal: OWNER, contractId: ids.contract, contractVersionId: ids.version1, facts: { ...facts, quantity: "100000000000000.000000" }, correlationId: "decimal-overflow" }),
    (error: any) => error.problem?.code === "VALIDATION_FAILED",
    "DECIMAL(20,6) overflow must fail before repository persistence",
  );
  await assert.rejects(() => service.create({ principal: OWNER, contractId: ids.otherContract, contractVersionId: ids.version1, facts, correlationId: "cross" }), (error: any) => error.problem?.code === "RESOURCE_NOT_FOUND");
  await service.update({ principal: OWNER, contractId: ids.contract, lineId: ids.line, contractVersionId: ids.version1, facts, correlationId: "first" });
  await assert.rejects(() => service.update({ principal: OWNER, contractId: ids.contract, lineId: ids.line, contractVersionId: ids.version1, facts, correlationId: "duplicate" }), (error: any) => error.problem?.code === "CONTRACT_LINE_VERSION_EXISTS");
});

test("contract-line approval validation returns a deterministic manifest for the exact complete draft", async () => {
  const repo = repository();
  const service = createContractLineService({ repository: repo, newId: () => ids.line });
  await service.update({ principal: OWNER, contractId: ids.contract, lineId: ids.line, contractVersionId: ids.version1, facts, correlationId: "approval-line" });

  const manifest = await service.validateApproval({ contractId: ids.contract, contractVersionId: ids.version1, correlationId: "approval" });

  assert.equal(manifest.lineCount, 1);
  assert.deepEqual(manifest.lineVersionIds, [ids.line]);
  assert.match(manifest.linesHash, /^[a-f0-9]{64}$/);
});

test("contract-line amendment validation requires an approved source and a complete distinct draft", async () => {
  const repo = repository();
  const service = createContractLineService({ repository: repo, newId: () => ids.line });
  await service.update({ principal: OWNER, contractId: ids.contract, lineId: ids.line, contractVersionId: ids.version1, facts, correlationId: "source-line" });
  repo.getContractVersion = async (contractId, versionId) => contractId !== ids.contract ? null
    : versionId === ids.version1 ? { id: versionId, contractId, state: "APPROVED" }
    : versionId === ids.version2 ? { id: versionId, contractId, state: "DRAFT" }
    : null;

  await assert.rejects(
    () => service.validateAmendment({ contractId: ids.contract, sourceVersionId: ids.version1, draftVersionId: ids.version2, correlationId: "amendment" }),
    (error: any) => error.problem?.code === "CONTRACT_LINE_SNAPSHOT_INCOMPLETE",
  );
});

test("contract-line amendment validation accepts carried-forward snapshots and approved lines stay immutable", async () => {
  const repo = repository();
  const service = createContractLineService({ repository: repo, newId: () => ids.line });
  await service.update({ principal: OWNER, contractId: ids.contract, lineId: ids.line, contractVersionId: ids.version1, facts, correlationId: "source-line" });
  await service.update({ principal: OWNER, contractId: ids.contract, lineId: ids.line, contractVersionId: ids.version2, facts: { ...facts, quantity: "90.000000" }, correlationId: "draft-line" });
  repo.getContractVersion = async (contractId, versionId) => contractId !== ids.contract ? null
    : versionId === ids.version1 ? { id: versionId, contractId, state: "APPROVED" }
    : versionId === ids.version2 ? { id: versionId, contractId, state: "DRAFT" }
    : null;

  await service.validateAmendment({ contractId: ids.contract, sourceVersionId: ids.version1, draftVersionId: ids.version2, correlationId: "amendment-complete" });
  await assert.rejects(
    () => service.update({ principal: OWNER, contractId: ids.contract, lineId: ids.line, contractVersionId: ids.version1, facts: { ...facts, quantity: "1" }, correlationId: "approved-edit" }),
    (error: any) => error.problem?.code === "IMMUTABLE_VERSION",
  );
});

test("contract-line approval validation rejects contracts without a complete line snapshot", async () => {
  const empty = repository();
  empty.listLines = async () => [];
  await assert.rejects(
    () => createContractLineService({ repository: empty }).validateApproval({ contractId: ids.contract, contractVersionId: ids.version1, correlationId: "no-lines" }),
    (error: any) => error.problem?.code === "CONTRACT_LINES_REQUIRED",
  );

  const incomplete = repository();
  await assert.rejects(
    () => createContractLineService({ repository: incomplete }).validateApproval({ contractId: ids.contract, contractVersionId: ids.version1, correlationId: "missing-snapshot" }),
    (error: any) => error.problem?.code === "CONTRACT_LINE_SNAPSHOT_INCOMPLETE",
  );
});

test("contract-line OpenAPI exposes create/read/update/version operations with guarded writes", () => {
  const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
  const expected = [
    ["/contracts/{contractId}/lines", "get", "listContractLines"],
    ["/contracts/{contractId}/lines", "post", "createContractLine"],
    ["/contracts/{contractId}/lines/{lineId}", "get", "getContractLine"],
    ["/contracts/{contractId}/lines/{lineId}", "patch", "updateContractLine"],
    ["/contracts/{contractId}/lines/{lineId}/versions", "get", "listContractLineVersions"],
  ] as const;
  for (const [path, method, operationId] of expected) assert.equal(api.paths[path]?.[method]?.operationId, operationId);
  for (const [path, method] of [[expected[0][0], "post"], [expected[2][0], "patch"]] as const) {
    const refs = api.paths[path][method].parameters.map((p: any) => p.$ref);
    assert.deepEqual(refs.slice(-3), ["#/components/parameters/IfMatch", "#/components/parameters/IdempotencyKey", "#/components/parameters/CsrfToken"]);
  }
  assert.deepEqual(api.components.schemas.ContractLineInput.required, ["contractVersionId", "coffeeSpecificationId", "quantity", "unitPrice", "currency", "incoterm", "namedPlace", "quantityToleranceUnder", "quantityToleranceOver", "paymentTerms", "documentTerms"]);
});

test("contract-line route factories deny unauthenticated and finance mutations before dependencies", async () => {
  const route = await import("../../src/app/api/contracts/[contractId]/lines/route.ts");
  let called = false;
  const post = route.createContractLinesPostHandler({ authenticate: async () => ({ userId: ids.line, roles: ["FINANCE_VIEWER"] }), create: async () => { called = true; return {}; } });
  const response = await post(new Request("https://orb.example/api/contracts/x/lines", { method: "POST", body: "{}" }), { params: Promise.resolve({ contractId: ids.contract }) });
  assert.equal(response.status, 403);
  assert.equal(called, false);
  assert.equal((await response.json()).code, "PERMISSION_DENIED");
});
