// @ts-expect-error Native Node TypeScript tests require source extensions.
import { parseProjectRecords, PROJECT_STORAGE_KEY, type ProjectRecord } from "./daily-projects.ts";

const FORMAT = "orb-browser-project-backup";
const VERSION = 1;
const KEYS = ["format", "version", "storageKey", "exportedAt", "projects"] as const;
const PROJECT_KEYS = ["id", "code", "customer", "supplier", "reference", "contractReference", "purchaseContractReference", "startDate", "commodity", "quantity", "unit", "currency", "unitPrice", "value", "origin", "destination", "status", "supplierShipment", "customerShipment", "customerShipmentReviewedAt", "supplierInvoice", "supplierPayment", "customerInvoice", "customerCollections", "expenses", "claims", "closure", "createdAt", "updatedAt"] as const;
const SHIPMENT_KEYS = ["reference", "expectedArrival", "quantity"] as const;
const CUSTOMER_SHIPMENT_KEYS = ["reference", "plannedDispatchDate", "quantity"] as const;
const INVOICE_KEYS = ["reference", "invoiceDate", "amount"] as const;
const PAYMENT_KEYS = ["reference", "paymentDate", "amount"] as const;
const COLLECTION_KEYS = ["reference", "collectionDate", "amount"] as const;
const EXPENSE_KEYS = ["reference", "occurredOn", "category", "vendor", "amount"] as const;
const CLAIM_KEYS = ["reference", "type", "claimDate", "claimant", "respondent", "description", "amount", "status", "createdAt", "resolutionNote", "resolutionDate", "resolvedAt"] as const;
const CLOSURE_KEYS = ["closedOn", "note", "closedAt", "reopenedOn", "reopenReason", "reopenedAt", "reopenReviewedAt"] as const;

export type BrowserProjectBackup = Readonly<{ format: typeof FORMAT; version: typeof VERSION; storageKey: typeof PROJECT_STORAGE_KEY; exportedAt: string; projects: readonly ProjectRecord[] }>;

function validTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() !== value || value === "") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}
function invalid(): never { throw new Error("INVALID_BROWSER_PROJECT_BACKUP"); }
function exactObject(value: unknown, allowed: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  if (Object.keys(value).some((key) => !allowed.includes(key))) invalid();
}
function optionalObject(project: Record<string, unknown>, key: string, allowed: readonly string[]): void {
  if (project[key] !== undefined) exactObject(project[key], allowed);
}
function optionalArray(project: Record<string, unknown>, key: string, allowed: readonly string[]): void {
  const value = project[key];
  if (value === undefined) return;
  if (!Array.isArray(value)) invalid();
  for (const row of value) exactObject(row, allowed);
}
function exactProjects(value: unknown): asserts value is readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) invalid();
  for (const item of value) {
    exactObject(item, PROJECT_KEYS);
    optionalObject(item, "supplierShipment", SHIPMENT_KEYS);
    optionalObject(item, "customerShipment", CUSTOMER_SHIPMENT_KEYS);
    optionalObject(item, "supplierInvoice", INVOICE_KEYS);
    optionalObject(item, "supplierPayment", PAYMENT_KEYS);
    optionalObject(item, "customerInvoice", INVOICE_KEYS);
    optionalObject(item, "closure", CLOSURE_KEYS);
    optionalArray(item, "customerCollections", COLLECTION_KEYS);
    optionalArray(item, "expenses", EXPENSE_KEYS);
    optionalArray(item, "claims", CLAIM_KEYS);
  }
}

export function createBrowserProjectBackup(rawProjects: string | null, exportedAt: string): BrowserProjectBackup {
  try {
    if (!validTimestamp(exportedAt)) invalid();
    const source: unknown = rawProjects === null ? [] : JSON.parse(rawProjects);
    exactProjects(source);
    const projects = parseProjectRecords(rawProjects);
    return Object.freeze({ format: FORMAT, version: VERSION, storageKey: PROJECT_STORAGE_KEY, exportedAt, projects: Object.freeze(projects) });
  } catch { return invalid(); }
}

export function parseBrowserProjectBackup(raw: string): BrowserProjectBackup {
  try {
    const value: unknown = JSON.parse(raw);
    exactObject(value, KEYS);
    if (Object.keys(value).length !== KEYS.length || !KEYS.every((key) => Object.hasOwn(value, key))) invalid();
    if (value.format !== FORMAT || value.version !== VERSION || value.storageKey !== PROJECT_STORAGE_KEY || !validTimestamp(value.exportedAt)) invalid();
    exactProjects(value.projects);
    const projects = parseProjectRecords(JSON.stringify(value.projects));
    return Object.freeze({ format: FORMAT, version: VERSION, storageKey: PROJECT_STORAGE_KEY, exportedAt: value.exportedAt, projects: Object.freeze(projects) });
  } catch { return invalid(); }
}
