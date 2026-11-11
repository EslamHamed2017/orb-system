import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseYaml } from "../contract/openapi-contract.test.ts";
import { ProblemError } from "../../src/platform/http/problem.ts";

const OPENAPI = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);
const FIXED_ROLES = ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"] as const;

interface RolesModule {
  PILOT_ROLES: readonly string[];
  requiredRolesForOperation(operationId: string): readonly string[];
  assertAuthorized(input: { actor: { userId: string; roles: readonly string[] }; operationId: string; correlationId?: string }): void;
  shapeSensitiveFields(record: Record<string, unknown>, roles: readonly string[]): Record<string, unknown>;
  assertOwnerMfa(input: { roles: readonly string[]; mfaSatisfiedAt: string | null; now: string; correlationId?: string }): void;
  assertDifferentApprover(requesterId: string, approverId: string, correlationId?: string): void;
}
interface CsrfModule {
  assertAuthenticatedMutation(input: {
    expectedToken: string; suppliedToken?: string | null; origin?: string | null; referer?: string | null;
    allowedOrigins: readonly string[]; correlationId?: string;
  }): void;
}
async function loadRoles(): Promise<RolesModule> {
  return import("../../src/modules/access/roles.ts") as Promise<RolesModule>;
}
async function loadCsrf(): Promise<CsrfModule> {
  return import("../../src/platform/http/csrf.ts") as Promise<CsrfModule>;
}
function contractRoleMap(): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const pathItem of Object.values(OPENAPI.paths as Record<string, Record<string, unknown>>)) {
    for (const [method, value] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method) || !value || typeof value !== "object") continue;
      const operation = value as Record<string, unknown>;
      result.set(operation.operationId as string, [...(operation["x-required-roles"] as string[])].sort());
    }
  }
  return result;
}

test("authorization exposes exactly the three composable roles and mirrors all 102 operation contracts", async () => {
  const roles = await loadRoles();
  assert.deepEqual(roles.PILOT_ROLES, FIXED_ROLES);
  const contract = contractRoleMap();
  assert.equal(contract.size, 102);
  for (const [operationId, expected] of contract) {
    assert.deepEqual([...roles.requiredRolesForOperation(operationId)].sort(), expected, operationId);
    for (const role of FIXED_ROLES) {
      const call = () => roles.assertAuthorized({ actor: { userId: `user-${role}`, roles: [role] }, operationId, correlationId: `rbac-${operationId}-${role}` });
      if (expected.length === 0 || expected.includes(role)) assert.doesNotThrow(call, `${role} should be allowed for ${operationId}`);
      else assert.throws(call, (error: unknown) => error instanceof ProblemError && error.problem.code === "PERMISSION_DENIED", `${role} should be denied for ${operationId}`);
    }
  }
  assert.throws(() => roles.requiredRolesForOperation("unknownOperation"), /unknown|operation/i);
});

test("composable roles permit any matching role without granting unassigned actions", async () => {
  const roles = await loadRoles();
  const actor = { userId: "multi-role-user", roles: ["OPERATIONS", "FINANCE_VIEWER"] };
  assert.doesNotThrow(() => roles.assertAuthorized({ actor, operationId: "createProjectWithSalesContract" }));
  assert.doesNotThrow(() => roles.assertAuthorized({ actor, operationId: "recordMoneyMovement" }));
  assert.throws(() => roles.assertAuthorized({ actor, operationId: "decideFixedApproval" }), (error: unknown) => error instanceof ProblemError && error.problem.status === 403);
});

test("permission shaping removes supplier cost and margin fields from Operations reads", async () => {
  const roles = await loadRoles();
  const record = { id: "project-1", reference: "ORB-1", supplierCost: "10.00", expectedMargin: "2.00", customerValue: "12.00" };
  assert.deepEqual(roles.shapeSensitiveFields(record, ["OPERATIONS"]), { id: "project-1", reference: "ORB-1", customerValue: "12.00" });
  for (const allowed of [["OWNER_ADMIN"], ["FINANCE_VIEWER"], ["OPERATIONS", "FINANCE_VIEWER"]]) {
    assert.deepEqual(roles.shapeSensitiveFields(record, allowed), record);
  }
  assert.notEqual(roles.shapeSensitiveFields(record, ["OWNER_ADMIN"]), record, "shaped reads must not expose a mutable source object");
});

test("Owner/Admin actions require satisfied MFA and controlled decisions reject self approval", async () => {
  const roles = await loadRoles();
  assert.doesNotThrow(() => roles.assertOwnerMfa({ roles: ["OWNER_ADMIN"], mfaSatisfiedAt: "2026-11-06T10:00:00.000Z", now: "2026-11-06T10:05:00.000Z" }));
  assert.throws(() => roles.assertOwnerMfa({ roles: ["OWNER_ADMIN"], mfaSatisfiedAt: null, now: "2026-11-06T10:05:00.000Z" }), /mfa|reauth/i);
  assert.throws(() => roles.assertOwnerMfa({ roles: ["OPERATIONS"], mfaSatisfiedAt: "2026-11-06T10:00:00.000Z", now: "2026-11-06T10:05:00.000Z" }), /owner|permission/i);
  assert.doesNotThrow(() => roles.assertDifferentApprover("requester-1", "approver-2"));
  assert.throws(() => roles.assertDifferentApprover("same-user", "same-user", "self-approval"), (error: unknown) => error instanceof ProblemError && error.problem.code === "SELF_APPROVAL_FORBIDDEN");
});

test("every authenticated mutation requires a session-bound token and allow-listed request source", async () => {
  const csrf = await loadCsrf();
  const valid = {
    expectedToken: "a".repeat(32), suppliedToken: "a".repeat(32), origin: "https://orb.example", referer: null,
    allowedOrigins: ["https://orb.example"], correlationId: "csrf-security-test",
  };
  assert.doesNotThrow(() => csrf.assertAuthenticatedMutation(valid));
  assert.doesNotThrow(() => csrf.assertAuthenticatedMutation({ ...valid, origin: null, referer: "https://orb.example/projects/1" }));
  for (const mutation of [
    { suppliedToken: null }, { suppliedToken: "b".repeat(32) }, { origin: "https://attacker.example" },
    { origin: null, referer: null }, { origin: null, referer: "https://orb.example.attacker.test/path" },
  ]) assert.throws(() => csrf.assertAuthenticatedMutation({ ...valid, ...mutation }), ProblemError);
});
