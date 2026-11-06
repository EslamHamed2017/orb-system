import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SCHEMA = resolve(ROOT, "prisma/schema.prisma");
const MIGRATION = resolve(ROOT, "prisma/migrations/202611050001_r1_initial/migration.sql");
const missing = [SCHEMA, MIGRATION].filter((path) => !existsSync(path));
const redReason = missing.length
  ? `ORB-R1-0202 artifacts are missing: ${missing.map((path) => path.slice(ROOT.length + 1)).join(", ")}`
  : undefined;

const canonical = (value: string) => value.replace(/[^a-z0-9]/gi, "").toLowerCase();
const source = (path: string) => readFileSync(path, "utf8");
const sqlText = () => source(MIGRATION).replace(/--.*$/gm, " ").replace(/\s+/g, " ").toLowerCase();

function tables(sql: string): Map<string, string> {
  const result = new Map<string, string>();
  const pattern = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?[\w]+"?\.)?"?([\w]+)"?\s*\(([^;]+)\)\s*;/gis;
  for (const match of sql.matchAll(pattern)) result.set(canonical(match[1]), match[2].toLowerCase());
  return result;
}

function body(all: Map<string, string>, entity: string): string {
  const key = canonical(entity);
  const found = [...all].find(([name]) => name === key || name === `${key}s`);
  assert.ok(found, `missing Release 1 table for ${entity}`);
  return found[1];
}

function has(sql: string, description: string, ...patterns: RegExp[]): void {
  assert.ok(patterns.some((pattern) => pattern.test(sql)), `initial migration must enforce ${description}`);
}

function enumDeclarations(sql: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const pattern = /create\s+type\s+(?:(?:"[^"]+"|\w+)\s*\.\s*)?(?:"([^"]+)"|(\w+))\s+as\s+enum\s*\(([^)]+)\)/gi;
  for (const match of sql.matchAll(pattern)) {
    const values = [...match[3].matchAll(/'((?:''|[^'])+)'/g)].map((item) => item[1].replace(/''/g, "'").toUpperCase());
    result.set(canonical(match[1] ?? match[2]), values);
  }
  return result;
}

function columnType(tableBody: string, column: string): string {
  const match = tableBody.match(new RegExp(`(?:^|,)\\s*"?${column}"?\\s+(?:(?:"[^"]+"|\\w+)\\s*\\.\\s*)?(?:"([^"]+)"|(\\w+))`, "i"));
  assert.ok(match, `missing column ${column}`);
  return canonical(match[1] ?? match[2]);
}

function assertColumnEnum(sql: string, entity: string, column: string, expected: string[]): void {
  const type = columnType(body(tables(sql), entity), column);
  const actual = enumDeclarations(sql).get(type);
  assert.ok(actual, `${entity}.${column} must use a declared PostgreSQL enum (resolved type: ${type})`);
  assert.deepEqual([...actual].sort(), [...expected].sort(), `${entity}.${column} enum ${type} has incorrect membership`);
}

function assertCompositeProjectFk(sql: string, table: string, subjectColumn: string, target: string): void {
  const q = (name: string) => `"?${name}"?`;
  const tablePattern = `(?:"?${table}"?)`;
  const targetPattern = `(?:"?${target}"?)`;
  const forward = `${q(subjectColumn)}\\s*,\\s*${q("project_id")}`;
  const reverse = `${q("project_id")}\\s*,\\s*${q(subjectColumn)}`;
  const referencedForward = `${q("id")}\\s*,\\s*${q("project_id")}`;
  const referencedReverse = `${q("project_id")}\\s*,\\s*${q("id")}`;
  const pattern = new RegExp(`(?:alter\\s+table\\s+${tablePattern}[^;]+)?foreign\\s+key\\s*\\((?:${forward}\\)\\s+references\\s+${targetPattern}\\s*\\(${referencedForward}|${reverse}\\)\\s+references\\s+${targetPattern}\\s*\\(${referencedReverse})\\)`, "i");
  assert.match(sql, pattern, `${table}.${subjectColumn} must be constrained to the same Project as ${target}`);
}

function assertClaimTargetCheck(sql: string): void {
  const claim = body(tables(sql), "Claim");
  const checks = [...claim.matchAll(/check\s*\(([^;]+?)\)(?:\s*(?:,|$))/gi)].map((match) => match[1].replace(/"/g, "").replace(/\s+/g, " "));
  assert.ok(checks.some((check) =>
    /num_nonnulls\s*\(\s*sales_shipment_id\s*,\s*supplier_shipment_id\s*\)\s*<=\s*1/i.test(check)
    || /sales_shipment_id\s+is\s+null\s+or\s+supplier_shipment_id\s+is\s+null/i.test(check)),
  "Claim must allow neither or exactly one shipment target, never both");
}

test("SQL helpers bind quoted enum names and reject coincidental memberships", () => {
  const fixture = `
    CREATE TYPE "AlphaState" AS ENUM ('OPEN', 'CLOSED');
    CREATE TYPE "BetaState" AS ENUM ('OPEN', 'CLOSED');
    CREATE TYPE "WrongState" AS ENUM ('OPEN', 'CLOSED', 'EXTRA');
    CREATE TABLE "Probe" ("id" uuid, "state" "BetaState");
  `;
  assertColumnEnum(fixture, "Probe", "state", ["OPEN", "CLOSED"]);
  const mutation = fixture.replace('"state" "BetaState"', '"state" "WrongState"');
  assert.throws(() => assertColumnEnum(mutation, "Probe", "state", ["OPEN", "CLOSED"]), /incorrect membership/);
  assert.equal(enumDeclarations(fixture).get(canonical("AlphaState"))?.length, 2);
});

test("scope helpers reject weak null text and cross-Project foreign keys", () => {
  const valid = `
    CREATE TABLE "Claim" ("sales_shipment_id" uuid, "supplier_shipment_id" uuid,
      CHECK ("sales_shipment_id" IS NULL OR "supplier_shipment_id" IS NULL));
    ALTER TABLE "Claim" ADD CONSTRAINT c1 FOREIGN KEY ("sales_shipment_id", "project_id") REFERENCES "SalesShipment" ("id", "project_id");
  `;
  assertClaimTargetCheck(valid);
  assertCompositeProjectFk(valid, "Claim", "sales_shipment_id", "SalesShipment");
  assert.throws(() => assertClaimTargetCheck(valid.replace(/CHECK[^;]+;/i, "CHECK (sales_shipment_id IS NULL);")), /never both/);
  assert.throws(() => assertCompositeProjectFk(valid.replace(', "project_id"', ""), "Claim", "sales_shipment_id", "SalesShipment"), /same Project/);
});

test("RED prerequisite: the ORB-R1-0202 schema and initial migration exist", () => {
  assert.deepEqual(missing, [], redReason);
});

test("every persisted R1 entity exists and every deferred/prohibited entity is absent", { skip: redReason }, () => {
  const all = tables(source(MIGRATION));
  const required = [
    "User", "UserRole", "Session", "PilotSession", "Party", "CoffeeSpecification", "Currency", "ExpenseCategory",
    "Project", "Contract", "ContractVersion", "SupplierShipment", "SupplierShipmentDataset", "SalesShipment", "SalesShipmentDataset",
    "ShipmentExecutionEvent", "RouteChecklist", "RouteChecklistItem", "EvidenceObject", "EvidenceLink", "CommercialDocument",
    "DocumentRevision", "OutboundManifest", "OutboundSendAttempt", "SupplierInvoice", "MoneyMovement", "SettlementAllocation",
    "DirectExpense", "ExpenseCorrection", "Claim", "ClaimOutcomeProposal", "Approval", "ProfitSnapshot", "ProfitLine",
    "ClosureAssessment", "ClosureBlocker", "BackupSnapshot", "RestoreTest", "AuditEvent", "IdempotencyRecord",
  ];
  for (const entity of required) body(all, entity);
  const forbidden = [
    "BankStatement", "BankTransaction", "BankImport", "BankMatch", "TaxPack", "TaxClassification", "MigrationStaging",
    "HistoricalMigration", "SupplierSourceAllocation", "ShipmentSourceAllocation", "ExpenseAllocation", "SharedExpenseAllocation",
    "ApprovalPolicy", "ApprovalRule", "RouteTemplate", "RouteTemplateDesigner", "ClaimSettlement", "ClaimCompensation",
    "ClaimNetting", "GeneralLedger", "JournalEntry", "ChartOfAccounts",
  ];
  const present = forbidden.filter((entity) => [...all.keys()].some((name) => name === canonical(entity) || name === `${canonical(entity)}s`));
  assert.deepEqual(present, [], `deferred/prohibited tables found: ${present.join(", ")}`);
});

test("all entity identifiers are PostgreSQL UUIDs generated and constrained as UUIDv7", { skip: redReason }, () => {
  const schema = source(SCHEMA);
  const sql = sqlText();
  const models = [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)];
  assert.ok(models.length >= 39, "complete Release 1 Prisma model set is required");
  for (const [, model, modelBody] of models) {
    const id = modelBody.match(/^\s*id\s+([^\n]+)/m);
    if (!id) continue;
    assert.match(id[1], /String/);
    assert.match(id[1], /@id/);
    assert.match(id[1], /@db\.Uuid/);
    assert.match(id[1], /(?:uuidv7|dbgenerated)/i, `${model}.id must be database-generated UUIDv7`);
  }
  has(sql, "UUIDv7 generation", /uuidv7\s*\(/, /uuid_generate_v7\s*\(/);
  has(sql, "UUIDv7 validation", /uuid_extract_version\s*\([^)]*\)\s*=\s*7/, /get_byte\s*\([^)]*,\s*6\s*\)[^;]+\b7\b/);
});

test("stable references, revisions, attempts, audit sequence, and idempotency have scoped uniqueness", { skip: redReason }, () => {
  const sql = sqlText();
  const scopes = [
    ["Party reference", "party", "reference"], ["Coffee specification reference", "coffeespecification", "reference"],
    ["Project reference", "project", "reference"], ["Contract reference", "contract", "project_id", "reference"],
    ["Supplier shipment reference", "suppliershipment", "project_id", "reference"],
    ["Sales shipment reference", "salesshipment", "project_id", "reference"],
    ["Commercial document reference", "commercialdocument", "project_id", "reference"],
    ["Supplier invoice reference", "supplierinvoice", "supplier_id", "reference"],
    ["Contract revision", "contractversion", "contract_id", "revision_no"],
    ["Supplier dataset revision", "suppliershipmentdataset", "shipment_id", "revision_no"],
    ["Sales dataset revision", "salesshipmentdataset", "shipment_id", "revision_no"],
    ["Document revision", "documentrevision", "document_id", "revision_no"],
    ["Outbound attempt", "outboundsendattempt", "manifest_id", "attempt_no"],
    ["Project audit sequence", "auditevent", "project_id", "sequence_no"],
    ["Idempotency key", "idempotencyrecord", "actor_id", "operation_id", "key"],
  ];
  for (const [label, table, ...columns] of scopes) {
    const list = columns.map((column) => `"?${column}"?`).join("\\s*,\\s*");
    assert.match(sql, new RegExp(`(?:unique\\s*\\(\\s*${list}\\s*\\)|create\\s+unique\\s+index[^;]+on\\s+[^;]*${table}[^;]*\\(\\s*${list}\\s*\\))`, "i"), `${label} must be database-unique in its scope`);
  }
});

test("every quantity, weight, tolerance, money, rate, and derived amount is exact numeric", { skip: redReason }, () => {
  const all = tables(source(MIGRATION));
  const expected: Record<string, string[]> = {
    CoffeeSpecification: ["standard_bag_weight"],
    ContractVersion: ["quantity", "unit_price", "quantity_tolerance_under", "quantity_tolerance_over", "net_weight_tolerance_under", "net_weight_tolerance_over", "gross_weight_tolerance_under", "gross_weight_tolerance_over"],
    SupplierShipmentDataset: ["quantity", "bag_weight", "net_weight", "gross_weight"],
    SalesShipmentDataset: ["quantity", "bag_weight", "net_weight", "gross_weight"], SupplierInvoice: ["amount"],
    MoneyMovement: ["amount", "aed_amount", "fx_rate"], SettlementAllocation: ["amount"], DirectExpense: ["amount"],
    Claim: ["quantity", "amount"], ProfitSnapshot: ["expected_margin", "committed_margin", "actual_operational_margin", "cash_position"],
    ProfitLine: ["amount"],
  };
  for (const [entity, columns] of Object.entries(expected)) for (const column of columns)
    assert.match(body(all, entity), new RegExp(`"?${column}"?\\s+(?:decimal|numeric)\\b`, "i"), `${entity}.${column} must use numeric`);
  for (const [name, tableBody] of all) assert.doesNotMatch(tableBody, /\b(?:real|float\d*|double\s+precision)\b/, `${name} contains an inexact number`);
});

test("database checks enforce XOR and conditional invariants", { skip: redReason }, () => {
  const sql = sqlText();
  const all = tables(source(MIGRATION));
  const expense = body(all, "DirectExpense");
  assert.match(expense, /"?project_id"?\s+uuid\s+not\s+null/i, "DirectExpense always belongs to one Project");
  assert.match(expense, /"?sales_shipment_id"?\s+uuid(?:\s|,)/i, "DirectExpense may narrow its scope to one sales shipment");
  assert.doesNotMatch(expense, /"?sales_shipment_id"?\s+uuid\s+not\s+null/i, "whole-Project expense scope must remain possible");
  assertClaimTargetCheck(sql);
  assertCompositeProjectFk(sql, "DirectExpense", "sales_shipment_id", "SalesShipment");
  assertCompositeProjectFk(sql, "Claim", "sales_shipment_id", "SalesShipment");
  assertCompositeProjectFk(sql, "Claim", "supplier_shipment_id", "SupplierShipment");
  assertCompositeProjectFk(sql, "SalesShipment", "primary_supplier_shipment_id", "SupplierShipment");
  const checks: Array<[string, RegExp[]]> = [
    ["evidence verification metadata", [/verification_state[^;]+pending[^;]+verified_at\s+is\s+null[^;]+verified_by\s+is\s+null/, /verification_state[^;]+verified[^;]+verified_at\s+is\s+not\s+null[^;]+verified_by\s+is\s+not\s+null/]],
    ["session revocation metadata", [/revoked_at\s+is\s+null[^;]+revoked_by\s+is\s+null[^;]+revocation_reason\s+is\s+null/, /revoked_at\s+is\s+not\s+null[^;]+revoked_by\s+is\s+not\s+null[^;]+revocation_reason\s+is\s+not\s+null/]],
    ["money FX metadata is all-null or all-present", [/aed_amount\s+is\s+null[^;]+fx_rate\s+is\s+null[^;]+fx_date\s+is\s+null[^;]+fx_source\s+is\s+null/, /aed_amount\s+is\s+not\s+null[^;]+fx_rate\s+is\s+not\s+null[^;]+fx_date\s+is\s+not\s+null[^;]+fx_source\s+is\s+not\s+null/]],
    ["self-approval denial", [/requester_id\s*(?:<>|!=)\s*approver_id/]],
    ["primary source is required to confirm and thereafter", [/execution_state[^;]+(?:confirmed|in_transit|delivered)[^;]+primary_supplier_shipment_id\s+is\s+not\s+null/]],
    ["reversed allocation linkage", [/state[^;]+reversed[^;]+reversal_of_id\s+is\s+not\s+null[^;]+reversal_reason\s+is\s+not\s+null/]],
    ["zero tolerance defaults", [/quantity_tolerance_under[^,;]+default\s+0/, /quantity_tolerance_over[^,;]+default\s+0/, /net_weight_tolerance_under[^,;]+default\s+0/, /net_weight_tolerance_over[^,;]+default\s+0/, /gross_weight_tolerance_under[^,;]+default\s+0/, /gross_weight_tolerance_over[^,;]+default\s+0/]],
  ];
  for (const [description, patterns] of checks) for (const pattern of patterns) assert.match(sql, pattern, `missing conditional check: ${description}`);
});

test("one SALES contract per Project and one singular primary source are enforced", { skip: redReason }, () => {
  const sql = sqlText();
  has(sql, "one SALES contract per Project", /create\s+unique\s+index[^;]+on\s+[^;]*contract[^;]*\(\s*"?project_id"?\s*\)[^;]+where[^;]+kind[^;]+sales/);
  const sales = body(tables(source(MIGRATION)), "SalesShipment");
  assert.match(sales, /primary_supplier_shipment_id\s+uuid\b/i);
  assert.doesNotMatch(sales, /(?:source|supplier)[^,\n]*\[\]|(?:source|supplier)[^,\n]*\bjsonb\b/i);
});

const fixedEnums: Array<[string, string, string[]]> = [
  ["UserRole", "role", ["OWNER_ADMIN", "OPERATIONS", "FINANCE_VIEWER"]],
  ["Contract", "kind", ["SALES", "PURCHASE"]],
  ["Project", "lifecycle_state", ["DRAFT", "ACTIVE", "CANCELLED"]],
  ["Project", "financial_state", ["OPEN", "FINANCIALLY_CLOSED"]],
  ["Project", "final_state", ["OPEN", "FINAL_CLOSED"]],
  ["ContractVersion", "state", ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "SUPERSEDED"]],
  ["SupplierShipment", "execution_state", ["DRAFT", "CONFIRMED", "IN_TRANSIT", "RECEIVED", "CANCELLED", "REJECTED"]],
  ["SalesShipment", "execution_state", ["DRAFT", "CONFIRMED", "IN_TRANSIT", "DELIVERED", "CANCELLED", "REJECTED"]],
  ["RouteChecklist", "template_code", ["FOREIGN_TO_FOREIGN", "UAE_FREE_ZONE_REEXPORT", "UAE_IMPORT"]],
  ["RouteChecklistItem", "category", ["EVIDENCE", "MILESTONE"]],
  ["RouteChecklistItem", "state", ["NOT_STARTED", "IN_PROGRESS", "SATISFIED", "NOT_APPLICABLE", "EXCEPTION_APPROVED"]],
  ["EvidenceObject", "verification_state", ["PENDING", "VERIFIED", "REJECTED"]],
  ["CommercialDocument", "kind", ["CINV", "PACKING_LIST"]],
  ["DocumentRevision", "language", ["AR", "EN", "BILINGUAL"]],
  ["DocumentRevision", "generation_state", ["QUEUED", "RENDERING", "READY", "FAILED"]],
  ["DocumentRevision", "lifecycle_state", ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SENT", "CANCELLED", "SUPERSEDED"]],
  ["OutboundManifest", "channel", ["EMAIL"]],
  ["OutboundSendAttempt", "result", ["ACCEPTED", "DELIVERED", "FAILED", "UNKNOWN"]],
  ["SupplierInvoice", "state", ["DRAFT", "PENDING_APPROVAL", "CONFIRMED", "REJECTED", "CANCELLED"]],
  ["MoneyMovement", "kind", ["CUSTOMER_ADVANCE", "CUSTOMER_RECEIPT", "CUSTOMER_REFUND", "SUPPLIER_ADVANCE", "SUPPLIER_PAYMENT", "SUPPLIER_REFUND", "REVERSAL"]],
  ["MoneyMovement", "state", ["DRAFT", "CONFIRMED", "PARTIALLY_ALLOCATED", "FULLY_ALLOCATED", "REVERSED"]],
  ["SettlementAllocation", "target_type", ["CINV", "SUPPLIER_INVOICE"]],
  ["SettlementAllocation", "state", ["ACTIVE", "REVERSED"]],
  ["DirectExpense", "state", ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"]],
  ["Claim", "type", ["QUANTITY", "WEIGHT", "QUALITY", "DELIVERY", "PRICE", "DOCUMENT"]],
  ["Claim", "state", ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"]],
  ["ClaimOutcomeProposal", "proposed_outcome", ["RESOLVED", "REJECTED"]],
  ["ClaimOutcomeProposal", "state", ["PENDING_APPROVAL", "APPROVED", "REJECTED", "EXPIRED", "APPLIED"]],
  ["Approval", "decision", ["PENDING", "APPROVED", "REJECTED", "EXPIRED"]],
  ["Approval", "action_code", ["CONTRACT_VERSION", "SUPPLIER_SHIPMENT_CONFIRMATION", "SALES_SHIPMENT_CONFIRMATION", "TOLERANCE_EXCEPTION", "SUPPLIER_INVOICE_CONFIRMATION", "DIRECT_EXPENSE", "EXPENSE_CORRECTION", "DOCUMENT_OUTPUT", "EXTERNAL_SEND", "CLAIM_OUTCOME", "CLOSURE_EXCEPTION", "FINAL_CLOSE", "REOPEN"]],
  ["RestoreTest", "state", ["QUEUED", "RUNNING", "PASSED", "FAILED"]],
];

test("fixed enum domains have exact accepted memberships", { skip: redReason }, () => {
  const sql = source(MIGRATION);
  for (const [entity, column, values] of fixedEnums) assertColumnEnum(sql, entity, column, values);
});

test("append-only rows and immutable approved/history content have database guards", { skip: redReason }, () => {
  const sql = sqlText();
  const appendOnly = ["ShipmentExecutionEvent", "OutboundSendAttempt", "AuditEvent"];
  for (const entity of appendOnly) {
    const name = canonical(entity);
    has(sql, `${entity} append-only update/delete denial`,
      new RegExp(`create\\s+trigger[^;]+(?:${name}|${name}s)[^;]+(?:update|delete)[^;]+execute`, "i"),
      new RegExp(`revoke\\s+(?:update\\s*,\\s*delete|delete\\s*,\\s*update|all)[^;]+(?:${name}|${name}s)`, "i"),
      new RegExp(`create\\s+rule[^;]+(?:${name}|${name}s)[^;]+(?:update|delete)[^;]+instead\\s+nothing`, "i"));
  }
  for (const entity of ["ContractVersion", "SupplierShipmentDataset", "SalesShipmentDataset", "EvidenceObject", "DocumentRevision", "OutboundManifest", "ClaimOutcomeProposal", "Approval"]) {
    const name = canonical(entity);
    has(sql, `${entity} immutable-content guard with permitted lifecycle transitions`,
      new RegExp(`create\\s+trigger[^;]+(?:${name}|${name}s)[^;]+before\\s+update[^;]+execute`, "i"),
      new RegExp(`create\\s+policy[^;]+(?:${name}|${name}s)[^;]+for\\s+update[^;]+using`, "i"));
  }
});
