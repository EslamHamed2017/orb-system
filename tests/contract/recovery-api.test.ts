import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";

const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const recoveryOperations = [
  ["/recovery/backup-status", "get", "getBackupRecoveryStatus"],
  ["/recovery/restore-tests", "post", "startIsolatedRestoreTest"],
  ["/recovery/restore-tests/{restoreTestId}", "get", "getIsolatedRestoreTest"],
] as const;

function operation(path: string, method: string): Record<string, any> {
  const value = api.paths[path]?.[method];
  assert.ok(value, `missing ${method.toUpperCase()} ${path}`);
  return value;
}

test("recovery exposes only Owner/Admin backup status and isolated restore lifecycle operations", () => {
  for (const [path, method, operationId] of recoveryOperations) {
    const value = operation(path, method);
    assert.equal(value.operationId, operationId);
    assert.deepEqual(value["x-required-roles"], ["OWNER_ADMIN"]);
    assert.equal(value.responses.default.$ref, "#/components/responses/Problem");
  }
  const tagged = Object.values(api.paths).flatMap((pathItem: any) => Object.values(pathItem))
    .filter((value: any) => value?.tags?.includes("Recovery"))
    .map((value: any) => value.operationId)
    .sort();
  assert.deepEqual(tagged, recoveryOperations.map(([, , id]) => id).sort());
});

test("starting a restore is an idempotent CSRF-protected command with no production-target override", () => {
  const start = operation("/recovery/restore-tests", "post");
  assert.deepEqual(start.parameters.map((item: any) => item.$ref), [
    "#/components/parameters/IdempotencyKey",
    "#/components/parameters/CsrfToken",
  ]);
  assert.equal(start.requestBody.$ref, "#/components/requestBodies/RestoreTestInput");
  assert.equal(start.responses["202"].content["application/json"].schema.$ref, "#/components/schemas/RestoreTest");
  const input = api.components.schemas.RestoreTestInput;
  assert.equal(input.additionalProperties, false);
  assert.deepEqual(input.required, ["backupId", "objectSnapshotId", "isolatedEnvironment"]);
  assert.deepEqual(Object.keys(input.properties).sort(), ["backupId", "isolatedEnvironment", "objectSnapshotId"]);
  for (const property of Object.values(input.properties) as any[]) assert.equal(property.minLength, 1);
});

test("backup status discloses freshness and protection without credentials", () => {
  const get = operation("/recovery/backup-status", "get");
  assert.equal(get.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/BackupStatus");
  const status = api.components.schemas.BackupStatus;
  assert.deepEqual(status.required, ["lastSuccessfulBackupAt", "rpoMinutes", "encrypted", "separateCopy", "lastRestoreTest"]);
  assert.equal(status.properties.rpoMinutes.minimum, 0);
  assert.equal(status.properties.encrypted.type, "boolean");
  assert.equal(status.properties.separateCopy.type, "boolean");
  assert.equal(status.properties.lastRestoreTest.$ref, "#/components/schemas/RestoreTest");
  for (const secret of ["credential", "password", "secret", "accessKey", "connectionString"])
    assert.equal(Object.hasOwn(status.properties, secret), false, `backup status leaked ${secret}`);
});

test("restore status has the fixed lifecycle and nullable completion evidence measurements", () => {
  const get = operation("/recovery/restore-tests/{restoreTestId}", "get");
  assert.deepEqual(get.parameters.map((item: any) => item.$ref), ["#/components/parameters/RestoreTestId"]);
  assert.equal(get.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/RestoreTest");
  const overlay = api.components.schemas.RestoreTest.allOf[1];
  assert.deepEqual(overlay.required, ["state", "requestedAt"]);
  assert.deepEqual(overlay.properties.state.enum, ["QUEUED", "RUNNING", "PASSED", "FAILED"]);
  for (const property of ["completedAt", "rpoMinutes", "rtoMinutes"])
    assert.ok(overlay.properties[property].type.includes("null"), `${property} must be nullable before completion`);
  assert.equal(overlay.properties.evidenceId.$ref, "#/components/schemas/Uuid");
});
