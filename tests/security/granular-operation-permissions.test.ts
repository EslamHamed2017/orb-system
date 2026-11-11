import assert from "node:assert/strict";
import test from "node:test";

const OWNER = { userId: "owner", roles: ["OWNER_ADMIN"] };

test("resolved granular permissions take precedence over legacy pilot roles", async () => {
  const { assertServerPermission, operationPermissionCode } = await import("../../src/modules/access/permissions.ts");
  const permission = operationPermissionCode("getAccountsSummary");
  assert.equal(permission, "operation.get-accounts-summary");
  assert.doesNotThrow(() => assertServerPermission({ userId: "custom", roles: ["ACCOUNT_READER"], permissionCodes: [permission] }, "getAccountsSummary"));
  assert.throws(() => assertServerPermission({ ...OWNER, permissionCodes: [] }, "getAccountsSummary"), /permission/i);
  assert.doesNotThrow(() => assertServerPermission(OWNER, "getAccountsSummary"), "legacy sessions remain usable during cutover");
});

test("granular authorization fails closed on unknown operations and malformed resolved grants", async () => {
  const { assertServerPermission } = await import("../../src/modules/access/permissions.ts");
  assert.throws(() => assertServerPermission({ userId: "custom", roles: [], permissionCodes: ["operation.get-accounts-summary"] }, "notAnOperation"), /unknown operation/i);
  assert.throws(() => assertServerPermission({ userId: "custom", roles: [], permissionCodes: ["operation.get-accounts-summary", "bad grant"] }, "getAccountsSummary"), /permission/i);
  assert.throws(() => assertServerPermission({ userId: "", roles: [], permissionCodes: ["operation.get-accounts-summary"] }, "getAccountsSummary"), /permission/i);
});

test("Accounts, Reports, Settings and access administration enforce resolved operation grants server-side", async () => {
  const { operationPermissionCode } = await import("../../src/modules/access/permissions.ts");
  const { createInMemoryAccountsQuery } = await import("../../src/modules/accounts/accounts-query.ts");
  const { createInMemoryOperationalReportQuery } = await import("../../src/modules/reports/operational-report-query.ts");
  const { createInMemorySettingsService } = await import("../../src/modules/settings/settings-service.ts");
  const { createInMemoryAccessAdministrationService } = await import("../../src/modules/access/administration-service.ts");
  const principal = (operationId: string) => ({ userId: "custom", roles: ["CUSTOM"], permissionCodes: [operationPermissionCode(operationId)] });

  await assert.doesNotReject(() => createInMemoryAccountsQuery({}).summary({ principal: principal("getAccountsSummary") }));
  await assert.rejects(() => createInMemoryAccountsQuery({}).summary({ principal: principal("listAccountRecords") }), /access denied/i);
  await assert.doesNotReject(() => createInMemoryOperationalReportQuery({}).run({ principal: principal("runOperationalReport"), reportType: "ACCOUNTS" }));

  const settings = createInMemorySettingsService({ initial: { organization: { legalNameEn: "ORB Trading", legalNameAr: "أورب للتجارة", defaultLocale: "en", timeZone: "Asia/Dubai" }, numbering: { salesContractPrefix: "SC", purchaseContractPrefix: "PC", salesShipmentPrefix: "SS", supplierContainerPrefix: "CN" }, print: { footerEn: "ORB Trading", footerAr: "أورب للتجارة", showLogo: true } }, now: () => "2026-11-11T00:00:00.000Z" });
  await assert.doesNotReject(() => settings.read({ principal: principal("getSettings") }));
  await assert.rejects(() => settings.read({ principal: principal("updateSettings") }), /access denied/i);

  const access = createInMemoryAccessAdministrationService({ permissions: [] });
  await assert.doesNotReject(() => access.listPermissions({ principal: principal("listPermissions") }));
  await assert.rejects(() => access.listPermissions({ principal: principal("listRoles") }), /access administration denied/i);
});
