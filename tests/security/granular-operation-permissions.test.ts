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


test("sales-shipment line APIs require exact resolved operation grants before repository access", async () => {
  const { operationPermissionCode } = await import("../../src/modules/access/permissions.ts");
  const { createSalesShipmentLineService } = await import("../../src/modules/shipments/sales-shipment-line-service.ts");
  const route = await import("../../src/app/api/sales-shipments/[shipmentId]/datasets/[datasetId]/lines/route.ts");
  const shipmentId = "019a5f9b-7c00-7000-8000-000000000101";
  const datasetId = "019a5f9b-7c00-7000-8000-000000000102";
  const principal = (operationId: string) => ({ userId: "custom", roles: ["CUSTOM"], permissionCodes: [operationPermissionCode(operationId)] });
  let datasetReads = 0;
  const service = createSalesShipmentLineService({ repository: {
    async getDataset() { datasetReads += 1; return { id: datasetId, shipmentId, salesContractId: "019a5f9b-7c00-7000-8000-000000000103", state: "DRAFT" }; },
    async getApprovedContractLineVersion() { return null; }, async nextLineNo() { return 1; },
    async findByContractLineVersion() { return null; }, async insert(input: any) { return input; },
    async list() { return []; }, async get() { return null; },
  } });
  await assert.rejects(() => service.list({ shipmentId, datasetId, correlationId: "wrong", principal: principal("getSalesShipmentLine") }), (error: any) => error?.problem?.code === "PERMISSION_DENIED");
  assert.equal(datasetReads, 0);
  await assert.doesNotReject(() => service.list({ shipmentId, datasetId, correlationId: "right", principal: principal("listSalesShipmentLines") }));
  assert.equal(datasetReads, 1);

  let calls = 0;
  const denied = route.createGetHandler({ authenticate: async () => principal("getSalesShipmentLine"), list: async () => { calls += 1; return []; } });
  const response = await denied(new Request("https://orb.example/api/sales-shipments/x/datasets/y/lines"), { params: Promise.resolve({ shipmentId, datasetId }) });
  assert.equal(response.status, 403);
  assert.equal(calls, 0);
  const allowed = route.createGetHandler({ authenticate: async () => principal("listSalesShipmentLines"), list: async () => { calls += 1; return []; } });
  assert.equal((await allowed(new Request("https://orb.example/api/sales-shipments/x/datasets/y/lines"), { params: Promise.resolve({ shipmentId, datasetId }) })).status, 200);
  assert.equal(calls, 1);
});


test("supplier-shipment line APIs require exact resolved operation grants before repository access", async () => {
  const { operationPermissionCode } = await import("../../src/modules/access/permissions.ts");
  const { createSupplierShipmentLineService } = await import("../../src/modules/shipments/supplier-shipment-line-service.ts");
  const route = await import("../../src/app/api/supplier-shipments/[shipmentId]/datasets/[datasetId]/lines/route.ts");
  const shipmentId = "019a5f9b-7c00-7000-8000-000000000201";
  const datasetId = "019a5f9b-7c00-7000-8000-000000000202";
  const principal = (operationId: string) => ({ userId: "custom", roles: ["CUSTOM"], permissionCodes: [operationPermissionCode(operationId)] });
  let datasetReads = 0;
  const service = createSupplierShipmentLineService({ repository: {
    async getDataset() { datasetReads += 1; return { id: datasetId, shipmentId, projectId: shipmentId, state: "DRAFT" }; },
    async getApprovedPurchaseContractLineVersion() { return null; }, async nextLineNo() { return 1; },
    async findByContractLineVersion() { return null; }, async insert(input: any) { return input; },
    async list() { return []; }, async get() { return null; },
  } });
  await assert.rejects(() => service.list({ shipmentId, datasetId, correlationId: "wrong", principal: principal("getSupplierShipmentLine") } as any), (error: any) => error?.problem?.code === "PERMISSION_DENIED");
  assert.equal(datasetReads, 0);
  await assert.doesNotReject(() => service.list({ shipmentId, datasetId, correlationId: "right", principal: principal("listSupplierShipmentLines") } as any));
  assert.equal(datasetReads, 1);

  let calls = 0;
  const denied = route.createGetHandler({ authenticate: async () => principal("getSupplierShipmentLine"), list: async () => { calls += 1; return []; } });
  const response = await denied(new Request("https://orb.example/api/supplier-shipments/x/datasets/y/lines"), { params: Promise.resolve({ shipmentId, datasetId }) });
  assert.equal(response.status, 403);
  assert.equal(calls, 0);
  const allowed = route.createGetHandler({ authenticate: async () => principal("listSupplierShipmentLines"), list: async () => { calls += 1; return []; } });
  assert.equal((await allowed(new Request("https://orb.example/api/supplier-shipments/x/datasets/y/lines"), { params: Promise.resolve({ shipmentId, datasetId }) })).status, 200);
  assert.equal(calls, 1);
});


test("supplier-container mutation, exact-read and consolidation routes require their own grants", async () => {
  const { operationPermissionCode } = await import("../../src/modules/access/permissions.ts");
  const collection = await import("../../src/app/api/supplier-shipments/[shipmentId]/datasets/[datasetId]/lines/route.ts");
  const item = await import("../../src/app/api/supplier-shipments/[shipmentId]/datasets/[datasetId]/lines/[lineId]/route.ts");
  const consolidation = await import("../../src/app/api/supplier-shipments/[shipmentId]/datasets/[datasetId]/consolidation/route.ts");
  const principal = (operationId: string) => ({ userId: "custom", roles: ["CUSTOM"], permissionCodes: [operationPermissionCode(operationId)] });
  const ids = { shipmentId: "shipment", datasetId: "dataset" };
  let calls = 0;

  const deniedCreate = collection.createPostHandler({ authenticate: async () => principal("listSupplierShipmentLines"), create: async () => { calls += 1; return {}; } });
  assert.equal((await deniedCreate(new Request("https://orb.example/api/supplier-shipments/x/datasets/y/lines", { method: "POST", body: "{}" }), { params: Promise.resolve(ids) })).status, 403);
  const allowedCreate = collection.createPostHandler({ authenticate: async () => principal("createSupplierShipmentLine"), create: async () => { calls += 1; return {}; } });
  assert.equal((await allowedCreate(new Request("https://orb.example/api/supplier-shipments/x/datasets/y/lines", { method: "POST", body: "{}" }), { params: Promise.resolve(ids) })).status, 201);

  const deniedItem = item.createGetHandler({ authenticate: async () => principal("listSupplierShipmentLines"), get: async () => { calls += 1; return {}; } });
  assert.equal((await deniedItem(new Request("https://orb.example/api/supplier-shipments/x/datasets/y/lines/z"), { params: Promise.resolve({ ...ids, lineId: "line" }) })).status, 403);
  const allowedItem = item.createGetHandler({ authenticate: async () => principal("getSupplierShipmentLine"), get: async () => { calls += 1; return {}; } });
  assert.equal((await allowedItem(new Request("https://orb.example/api/supplier-shipments/x/datasets/y/lines/z"), { params: Promise.resolve({ ...ids, lineId: "line" }) })).status, 200);

  const deniedSummary = consolidation.createGetHandler({ authenticate: async () => principal("listSupplierShipmentLines"), getConsolidation: async () => { calls += 1; return {}; } });
  assert.equal((await deniedSummary(new Request("https://orb.example/api/supplier-shipments/x/datasets/y/consolidation"), { params: Promise.resolve(ids) })).status, 403);
  const allowedSummary = consolidation.createGetHandler({ authenticate: async () => principal("getSupplierContainerConsolidation"), getConsolidation: async () => { calls += 1; return {}; } });
  assert.equal((await allowedSummary(new Request("https://orb.example/api/supplier-shipments/x/datasets/y/consolidation"), { params: Promise.resolve(ids) })).status, 200);
  assert.equal(calls, 3);
});



test("invoice services require exact resolved operation grants before business access", async () => {
  const { operationPermissionCode } = await import("../../src/modules/access/permissions.ts");
  const { createInMemorySalesInvoiceService } = await import("../../src/modules/invoices/sales-invoice-service.ts");
  const { createInMemorySupplierInvoiceService } = await import("../../src/modules/invoices/supplier-invoice-service.ts");
  const principal = (operationId: string) => ({ userId: "custom", roles: ["CUSTOM"], permissionCodes: [operationPermissionCode(operationId)] });

  const sales = createInMemorySalesInvoiceService({ now: () => "2026-11-11T00:00:00.000Z", shipments: [], datasets: [] });
  await assert.rejects(() => sales.create({ principal: principal("getSalesInvoice"), correlationId: "wrong-sales-create" }), (error: any) => error?.problem?.code === "PERMISSION_DENIED");
  await assert.rejects(() => sales.get({ invoiceId: "missing", principal: principal("createSalesInvoice") }), (error: any) => error?.problem?.code === "PERMISSION_DENIED");
  await assert.rejects(() => sales.getPrintData({ invoiceId: "missing", principal: principal("getSalesInvoice") }), (error: any) => error?.problem?.code === "PERMISSION_DENIED");
  await assert.rejects(() => sales.create({ principal: principal("createSalesInvoice"), correlationId: "right-sales-create" }), (error: any) => error?.problem?.code === "VALIDATION_FAILED");
  await assert.rejects(() => sales.get({ invoiceId: "missing", principal: principal("getSalesInvoice") }), (error: any) => error?.problem?.code === "RESOURCE_NOT_FOUND");
  await assert.rejects(() => sales.getPrintData({ invoiceId: "missing", principal: principal("getSalesInvoicePrintData") }), (error: any) => error?.problem?.code === "RESOURCE_NOT_FOUND");

  const supplier = createInMemorySupplierInvoiceService({ now: () => "2026-11-11T00:00:00.000Z", shipments: [], evidence: [] });
  await assert.rejects(() => supplier.create({ principal: principal("submitSupplierInvoice"), correlationId: "wrong-supplier-create" }), (error: any) => error?.problem?.code === "PERMISSION_DENIED");
  await assert.rejects(() => supplier.create({ principal: principal("createSupplierInvoice"), correlationId: "right-supplier-create" }), (error: any) => error?.problem?.code === "VALIDATION_FAILED");
});



test("invoice HTTP routes require exact resolved operation grants before dependencies", async () => {
  const { operationPermissionCode } = await import("../../src/modules/access/permissions.ts");
  const salesCreate = await import("../../src/app/api/sales-shipments/[shipmentId]/sales-invoice/route.ts");
  const salesGet = await import("../../src/app/api/sales-invoices/[invoiceId]/route.ts");
  const salesPrint = await import("../../src/app/api/sales-invoices/[invoiceId]/print-data/route.ts");
  const supplierCreate = await import("../../src/app/api/supplier-shipments/[shipmentId]/invoices/route.ts");
  const principal = (operationId: string) => ({ userId: "custom", roles: ["CUSTOM"], permissionCodes: [operationPermissionCode(operationId)] });
  let calls = 0;

  const deniedSalesCreate = salesCreate.createPostHandler({ authenticate: async () => principal("getSalesInvoice"), create: async () => { calls += 1; return {}; } });
  assert.equal((await deniedSalesCreate(new Request("https://orb.example/api/sales-shipments/s/sales-invoice", { method: "POST", body: "{}" }), { params: Promise.resolve({ shipmentId: "s" }) })).status, 403);
  const allowedSalesCreate = salesCreate.createPostHandler({ authenticate: async () => principal("createSalesInvoice"), create: async () => { calls += 1; return {}; } });
  assert.equal((await allowedSalesCreate(new Request("https://orb.example/api/sales-shipments/s/sales-invoice", { method: "POST", body: "{}" }), { params: Promise.resolve({ shipmentId: "s" }) })).status, 201);

  const deniedSalesGet = salesGet.createGetHandler({ authenticate: async () => principal("getSalesInvoicePrintData"), get: async () => { calls += 1; return {}; } });
  assert.equal((await deniedSalesGet(new Request("https://orb.example/api/sales-invoices/i"), { params: Promise.resolve({ invoiceId: "i" }) })).status, 403);
  const allowedSalesGet = salesGet.createGetHandler({ authenticate: async () => principal("getSalesInvoice"), get: async () => { calls += 1; return {}; } });
  assert.equal((await allowedSalesGet(new Request("https://orb.example/api/sales-invoices/i"), { params: Promise.resolve({ invoiceId: "i" }) })).status, 200);

  const deniedPrint = salesPrint.createGetHandler({ authenticate: async () => principal("getSalesInvoice"), getPrintData: async () => { calls += 1; return {}; } });
  assert.equal((await deniedPrint(new Request("https://orb.example/api/sales-invoices/i/print-data"), { params: Promise.resolve({ invoiceId: "i" }) })).status, 403);
  const allowedPrint = salesPrint.createGetHandler({ authenticate: async () => principal("getSalesInvoicePrintData"), getPrintData: async () => { calls += 1; return {}; } });
  assert.equal((await allowedPrint(new Request("https://orb.example/api/sales-invoices/i/print-data"), { params: Promise.resolve({ invoiceId: "i" }) })).status, 200);

  const deniedSupplierCreate = supplierCreate.createCreateSupplierInvoicePostHandler({ authenticate: async () => principal("submitSupplierInvoice"), create: async () => { calls += 1; return {}; } });
  assert.equal((await deniedSupplierCreate(new Request("https://orb.example/api/supplier-shipments/s/invoices", { method: "POST", body: "{}" }), { params: Promise.resolve({ shipmentId: "s" }) })).status, 403);
  const allowedSupplierCreate = supplierCreate.createCreateSupplierInvoicePostHandler({ authenticate: async () => principal("createSupplierInvoice"), create: async () => { calls += 1; return {}; } });
  assert.equal((await allowedSupplierCreate(new Request("https://orb.example/api/supplier-shipments/s/invoices", { method: "POST", body: "{}" }), { params: Promise.resolve({ shipmentId: "s" }) })).status, 201);
  assert.equal(calls, 4);
});
