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


test("customer and supplier master operations require their resolved domain grants", async () => {
  const { operationPermissionCode } = await import("../../src/modules/access/permissions.ts");
  const { createInMemoryMasterService } = await import("../../src/modules/masters/master-service.ts");
  const { InMemoryIdempotencyStore } = await import("../../src/platform/idempotency/store.ts");
  const service = createInMemoryMasterService({ idempotencyStore: new InMemoryIdempotencyStore(), now: () => "2026-11-11T00:00:00.000Z" });
  const principal = (operationId: string) => ({ userId: "custom", roles: ["CUSTOM"], permissionCodes: [operationPermissionCode(operationId)] });
  const command = { masterType: "customers" as const, payload: { reference: "CUST-GRANT", legalNameAr: "عميل", legalNameEn: "Customer", countryCode: "AE" }, idempotencyKey: "granular-customer-create", correlationId: "granular-customer-create" };

  await assert.doesNotReject(() => service.create({ ...command, principal: principal("createCustomer") }));
  await assert.rejects(() => service.list({ masterType: "customers", principal: principal("listSuppliers") }), (error: any) => error?.problem?.code === "PERMISSION_DENIED");
  await assert.doesNotReject(() => service.list({ masterType: "customers", principal: principal("listCustomers") }));
  await assert.rejects(() => service.create({ ...command, idempotencyKey: "wrong-domain-grant", correlationId: "wrong-domain-grant", principal: principal("createSupplier") }), (error: any) => error?.problem?.code === "PERMISSION_DENIED");
});


test("contract-line APIs enforce operation-specific resolved grants in the domain service", async () => {
  const { operationPermissionCode } = await import("../../src/modules/access/permissions.ts");
  const { createContractLineService } = await import("../../src/modules/contracts/contract-line-service.ts");
  const contractId = "019a5f9b-7c00-7000-8000-000000000101";
  const versionId = "019a5f9b-7c00-7000-8000-000000000201";
  const specificationId = "019a5f9b-7c00-7000-8000-000000000401";
  let inserted = false;
  const repository = {
    async getContractVersion() { return { id: versionId, contractId, state: "DRAFT" }; },
    async getLine() { return null; },
    async nextLineNo() { return 1; },
    async insertLine(input: any) { inserted = true; return { id: input.id, contractId, lineNo: input.lineNo, currentVersion: input.version }; },
    async insertLineVersion(input: any) { return input; },
    async listLines() { return []; },
    async listLineVersions() { return []; },
  };
  const service = createContractLineService({ repository });
  const principal = (operationId: string) => ({ userId: "custom", roles: ["CUSTOM"], permissionCodes: [operationPermissionCode(operationId)] });
  const facts = { coffeeSpecificationId: specificationId, quantity: "10", unitPrice: "5", currency: "USD", incoterm: "FOB", namedPlace: "Dubai", quantityToleranceUnder: "0", quantityToleranceOver: "0", paymentTerms: "Net 30", documentTerms: "Originals" };

  await assert.rejects(() => service.create({ contractId, contractVersionId: versionId, facts, correlationId: "wrong-grant", principal: principal("listContractLines") } as any), (error: any) => error?.problem?.code === "PERMISSION_DENIED");
  assert.equal(inserted, false);
  await assert.doesNotReject(() => service.create({ contractId, contractVersionId: versionId, facts, correlationId: "correct-grant", principal: principal("createContractLine") } as any));
  await assert.rejects(() => service.list({ contractId, correlationId: "wrong-read-grant", principal: principal("getContractLine") } as any), (error: any) => error?.problem?.code === "PERMISSION_DENIED");
  await assert.doesNotReject(() => service.list({ contractId, correlationId: "correct-read-grant", principal: principal("listContractLines") } as any));
});


test("contract-line HTTP routes accept the exact resolved grant and reject a different grant", async () => {
  const { operationPermissionCode } = await import("../../src/modules/access/permissions.ts");
  const { createContractLinesPostHandler } = await import("../../src/app/api/contracts/[contractId]/lines/route.ts");
  const contractId = "019a5f9b-7c00-7000-8000-000000000101";
  const custom = (operationId: string) => ({ userId: "custom", roles: ["CUSTOM"], permissionCodes: [operationPermissionCode(operationId)] });
  let calls = 0;
  const request = () => new Request(`https://orb.example/api/contracts/${contractId}/lines`, { method: "POST", body: "{}" });
  const allowed = createContractLinesPostHandler({ authenticate: async () => custom("createContractLine"), create: async () => { calls += 1; return { id: "line" }; } });
  assert.equal((await allowed(request(), { params: Promise.resolve({ contractId }) })).status, 201);
  const denied = createContractLinesPostHandler({ authenticate: async () => custom("listContractLines"), create: async () => { calls += 1; return {}; } });
  assert.equal((await denied(request(), { params: Promise.resolve({ contractId }) })).status, 403);
  assert.equal(calls, 1);
});
