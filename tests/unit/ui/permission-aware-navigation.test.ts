import assert from "node:assert/strict";
import test from "node:test";
import { actionStateForOperation, navigationAccessForRole, permissionAwareQuery } from "../../../src/ui/navigation/permission-aware-access.ts";

test("navigation access is least-privilege for configured roles and fail-closed for unknown roles", () => {
  assert.equal(navigationAccessForRole("owner-admin", "accounts"), true);
  assert.equal(navigationAccessForRole("operations", "accounts"), false);
  assert.equal(navigationAccessForRole("operations", "shipments"), true);
  assert.equal(navigationAccessForRole("finance", "reports"), true);
  assert.equal(navigationAccessForRole("contract-reviewer", "approvals"), true);
  assert.equal(navigationAccessForRole("unknown", "projects"), false);
});

test("action state distinguishes allowed, read-only disabled and hidden administration actions", () => {
  assert.deepEqual(actionStateForOperation("operations", "createContractLine"), { allowed: true, visibility: "visible" });
  assert.deepEqual(actionStateForOperation("finance", "createContractLine"), { allowed: false, visibility: "disabled" });
  assert.deepEqual(actionStateForOperation("operations", "submitContractForApproval"), { allowed: true, visibility: "visible" });
  assert.deepEqual(actionStateForOperation("operations", "confirmSalesShipment"), { allowed: true, visibility: "visible" });
  assert.deepEqual(actionStateForOperation("operations", "finalCloseProject"), { allowed: false, visibility: "disabled" });
  assert.deepEqual(actionStateForOperation("operations", "createUser"), { allowed: false, visibility: "hidden" });
  assert.deepEqual(actionStateForOperation("unknown", "signOutCurrentSession"), { allowed: true, visibility: "visible" });
});

test("permission-aware links preserve locale and role context", () => {
  assert.equal(permissionAwareQuery("ar", "finance"), "?locale=ar&role=finance");
  assert.equal(permissionAwareQuery("en", null), "?locale=en");
});
