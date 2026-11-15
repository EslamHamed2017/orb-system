export const PROJECT_STORAGE_KEY = "orb.user-projects.owner-1.v1";

export type ProjectStatus = "SETUP" | "ACTIVE" | "CLOSED";
export type ProjectClosure = Readonly<{ closedOn: string; note: string; closedAt: string; reopenedOn?: string; reopenReason?: string; reopenedAt?: string; reopenReviewedAt?: string }>;
export type SupplierShipment = Readonly<{ reference: string; expectedArrival: string; quantity: string }>;
export type CustomerShipment = Readonly<{ reference: string; plannedDispatchDate: string; quantity: string }>;
export type SupplierInvoice = Readonly<{ reference: string; invoiceDate: string; amount: string }>;
export type SupplierPayment = Readonly<{ reference: string; paymentDate: string; amount: string }>;
export type CustomerInvoice = Readonly<{ reference: string; invoiceDate: string; amount: string }>;
export type CustomerCollection = Readonly<{ reference: string; collectionDate: string; amount: string }>;
export type ProjectExpense = Readonly<{ reference: string; occurredOn: string; category: string; vendor: string; amount: string }>;
export const PROJECT_CLAIM_TYPES = ["QUANTITY", "WEIGHT", "QUALITY", "DELIVERY", "PRICE", "DOCUMENT"] as const;
export type ProjectClaimType = typeof PROJECT_CLAIM_TYPES[number];
export type ProjectClaimStatus = "OPEN" | "RESOLVED";
export type ProjectClaim = Readonly<{ reference: string; type: ProjectClaimType; claimDate: string; claimant: string; respondent: string; description: string; amount?: string; status: ProjectClaimStatus; createdAt: string; resolutionNote?: string; resolutionDate?: string; resolvedAt?: string }>;
export type ProjectRecord = Readonly<{
  id: string; code: string; customer: string; supplier?: string; reference: string; contractReference: string; purchaseContractReference?: string;
  startDate: string; commodity: string; quantity: string; unit: string; currency: string;
  unitPrice: string; value: number; origin: string; destination: string;
  status: ProjectStatus; supplierShipment?: SupplierShipment; customerShipment?: CustomerShipment; customerShipmentReviewedAt?: string; supplierInvoice?: SupplierInvoice; supplierPayment?: SupplierPayment; customerInvoice?: CustomerInvoice; customerCollections?: readonly CustomerCollection[]; expenses?: readonly ProjectExpense[]; claims?: readonly ProjectClaim[]; closure?: ProjectClosure; createdAt: string; updatedAt: string;
}>;
export type ProjectInput = Readonly<Omit<ProjectRecord, "id" | "code" | "value" | "status" | "createdAt" | "updatedAt">>;

const textFields = ["id", "code", "customer", "reference", "contractReference", "startDate", "commodity", "quantity", "unit", "currency", "unitPrice", "origin", "destination", "createdAt", "updatedAt"] as const;

function isStrictDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isStrictTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() !== value || value === "") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

const MONEY_SCALE = 1_000_000n;

function parseMoneyUnits(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * MONEY_SCALE + BigInt(fraction.padEnd(6, "0"));
}

function formatMoneyUnits(units: bigint): string {
  const whole = units / MONEY_SCALE;
  const fraction = String(units % MONEY_SCALE).padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function isValidShipment(value: unknown, status: unknown, projectQuantity: unknown, startDate: unknown): value is SupplierShipment {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || status === "SETUP") return false;
  const shipment = value as Record<string, unknown>;
  const quantity = Number(shipment.quantity);
  const maximum = Number(projectQuantity);
  return typeof shipment.reference === "string" && shipment.reference.trim() !== "" &&
    typeof shipment.expectedArrival === "string" && isStrictDate(shipment.expectedArrival) && typeof startDate === "string" && shipment.expectedArrival >= startDate &&
    typeof shipment.quantity === "string" && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(maximum) && maximum > 0 && quantity <= maximum;
}

function isValidCustomerShipment(value: unknown, status: unknown, projectQuantity: unknown, supplierShipment: unknown): value is CustomerShipment {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || !["ACTIVE", "CLOSED"].includes(String(status)) || !supplierShipment || typeof supplierShipment !== "object") return false;
  const shipment = value as Record<string, unknown>;
  const supplied = supplierShipment as Record<string, unknown>;
  const quantity = Number(shipment.quantity);
  const projectMaximum = Number(projectQuantity);
  const supplierMaximum = Number(supplied.quantity);
  return typeof shipment.reference === "string" && shipment.reference.trim() !== "" &&
    typeof shipment.plannedDispatchDate === "string" && isStrictDate(shipment.plannedDispatchDate) && typeof supplied.expectedArrival === "string" && shipment.plannedDispatchDate >= supplied.expectedArrival &&
    typeof shipment.quantity === "string" && Number.isFinite(quantity) && quantity > 0 &&
    Number.isFinite(projectMaximum) && quantity <= projectMaximum && Number.isFinite(supplierMaximum) && quantity <= supplierMaximum;
}


function isValidSupplierInvoice(value: unknown, status: unknown, projectValue: unknown, customerShipment: unknown, reviewedAt: unknown): value is SupplierInvoice {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || !["ACTIVE", "CLOSED"].includes(String(status)) || !customerShipment || typeof customerShipment !== "object" || !isStrictTimestamp(reviewedAt)) return false;
  const invoice = value as Record<string, unknown>;
  const shipment = customerShipment as Record<string, unknown>;
  const amount = Number(invoice.amount);
  return typeof invoice.reference === "string" && invoice.reference.trim() === invoice.reference && invoice.reference !== "" &&
    typeof invoice.invoiceDate === "string" && isStrictDate(invoice.invoiceDate) && typeof shipment.plannedDispatchDate === "string" && invoice.invoiceDate >= shipment.plannedDispatchDate &&
    typeof invoice.amount === "string" && Number.isFinite(amount) && amount > 0 && typeof projectValue === "number" && amount <= projectValue;
}

function isValidSupplierPayment(value: unknown, status: unknown, supplierInvoice: unknown, reviewedAt: unknown): value is SupplierPayment {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || !["ACTIVE", "CLOSED"].includes(String(status)) || !supplierInvoice || typeof supplierInvoice !== "object" || !isStrictTimestamp(reviewedAt)) return false;
  const payment = value as Record<string, unknown>;
  const invoice = supplierInvoice as Record<string, unknown>;
  return typeof payment.reference === "string" && payment.reference.trim() === payment.reference && payment.reference !== "" &&
    typeof payment.paymentDate === "string" && isStrictDate(payment.paymentDate) && typeof invoice.invoiceDate === "string" && payment.paymentDate >= invoice.invoiceDate &&
    typeof payment.amount === "string" && Number(payment.amount) === Number(invoice.amount) && Number(payment.amount) > 0;
}

function isValidCustomerInvoice(value: unknown, status: unknown, projectValue: unknown, customerShipment: unknown, supplierPayment: unknown): value is CustomerInvoice {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || !["ACTIVE", "CLOSED"].includes(String(status)) || !customerShipment || typeof customerShipment !== "object" || !supplierPayment || typeof supplierPayment !== "object") return false;
  const invoice = value as Record<string, unknown>;
  const shipment = customerShipment as Record<string, unknown>;
  const amount = parseMoneyUnits(invoice.amount);
  return typeof invoice.reference === "string" && invoice.reference.trim() === invoice.reference && invoice.reference !== "" &&
    typeof invoice.invoiceDate === "string" && isStrictDate(invoice.invoiceDate) && typeof shipment.plannedDispatchDate === "string" && invoice.invoiceDate >= shipment.plannedDispatchDate &&
    amount !== null && amount > 0n && typeof projectValue === "number" && Number(invoice.amount) <= projectValue;
}

function isValidCustomerCollections(value: unknown, status: unknown, customerInvoice: unknown): value is readonly CustomerCollection[] {
  if (value === undefined) return true;
  if (!Array.isArray(value) || !["ACTIVE", "CLOSED"].includes(String(status)) || !customerInvoice || typeof customerInvoice !== "object") return false;
  const invoice = customerInvoice as Record<string, unknown>;
  const invoiceAmount = parseMoneyUnits(invoice.amount);
  if (invoiceAmount === null || invoiceAmount <= 0n) return false;
  const references = new Set<string>();
  let total = 0n;
  for (const item of value) {
    if (!item || typeof item !== "object") return false;
    const collection = item as Record<string, unknown>;
    const amount = parseMoneyUnits(collection.amount);
    if (typeof collection.reference !== "string" || collection.reference.trim() !== collection.reference || collection.reference === "" || references.has(collection.reference) ||
        typeof collection.collectionDate !== "string" || !isStrictDate(collection.collectionDate) || typeof invoice.invoiceDate !== "string" || collection.collectionDate < invoice.invoiceDate ||
        amount === null || amount <= 0n) return false;
    references.add(collection.reference);
    total += amount;
  }
  return total <= invoiceAmount;
}


function compareClaims(left: ProjectClaim, right: ProjectClaim): number {
  return left.claimDate.localeCompare(right.claimDate) || left.createdAt.localeCompare(right.createdAt) || left.reference.localeCompare(right.reference);
}

function isValidProjectClaims(value: unknown, status: unknown, customer: unknown, supplier: unknown, startDate: unknown, createdAt: unknown, updatedAt: unknown): value is readonly ProjectClaim[] {
  if (value === undefined) return true;
  if (!Array.isArray(value) || !["ACTIVE", "CLOSED"].includes(String(status)) || typeof customer !== "string" || typeof supplier !== "string" || typeof startDate !== "string") return false;
  const references = new Set<string>();
  let previous: ProjectClaim | undefined;
  for (const item of value) {
    if (!item || typeof item !== "object") return false;
    const claim = item as Record<string, unknown>;
    const amount = claim.amount === undefined ? null : parseMoneyUnits(claim.amount);
    const partiesValid = (claim.claimant === customer && claim.respondent === supplier) || (claim.claimant === supplier && claim.respondent === customer);
    const openShape = claim.status === "OPEN" && claim.resolutionNote === undefined && claim.resolutionDate === undefined && claim.resolvedAt === undefined;
    const resolvedShape = claim.status === "RESOLVED" && typeof claim.resolutionNote === "string" && claim.resolutionNote.trim() === claim.resolutionNote && claim.resolutionNote !== "" &&
      typeof claim.resolutionDate === "string" && isStrictDate(claim.resolutionDate) && typeof claim.claimDate === "string" && claim.resolutionDate >= claim.claimDate &&
      isStrictTimestamp(claim.resolvedAt) && typeof claim.createdAt === "string" && claim.resolvedAt >= claim.createdAt && typeof updatedAt === "string" && claim.resolvedAt <= updatedAt;
    if (typeof claim.reference !== "string" || claim.reference.trim() !== claim.reference || claim.reference === "" || references.has(claim.reference) ||
        typeof claim.type !== "string" || !PROJECT_CLAIM_TYPES.includes(claim.type as ProjectClaimType) ||
        typeof claim.claimDate !== "string" || !isStrictDate(claim.claimDate) || claim.claimDate < startDate || !partiesValid ||
        typeof claim.description !== "string" || claim.description.trim() !== claim.description || claim.description.length < 3 ||
        !isStrictTimestamp(claim.createdAt) || typeof createdAt !== "string" || typeof updatedAt !== "string" || claim.createdAt < createdAt || claim.createdAt > updatedAt ||
        (claim.amount !== undefined && (amount === null || amount <= 0n)) || (!openShape && !resolvedShape)) return false;
    const typed = claim as unknown as ProjectClaim;
    if (previous && compareClaims(previous, typed) > 0) return false;
    previous = typed;
    references.add(claim.reference);
  }
  return true;
}

function latestProjectBusinessDate(project: Pick<ProjectRecord, "startDate" | "supplierShipment" | "customerShipment" | "supplierInvoice" | "supplierPayment" | "customerInvoice" | "customerCollections" | "expenses" | "claims">): string {
  const dates = [project.startDate, project.supplierShipment?.expectedArrival, project.customerShipment?.plannedDispatchDate, project.supplierInvoice?.invoiceDate,
    project.supplierPayment?.paymentDate, project.customerInvoice?.invoiceDate, ...(project.customerCollections ?? []).map((item) => item.collectionDate),
    ...(project.expenses ?? []).map((item) => item.occurredOn), ...(project.claims ?? []).flatMap((item) => [item.claimDate, item.resolutionDate].filter((date): date is string => Boolean(date)))];
  return dates.filter((date): date is string => typeof date === "string" && isStrictDate(date)).sort().at(-1) ?? project.startDate;
}

function isValidProjectClosure(value: unknown, status: unknown, startDate: unknown, createdAt: unknown, updatedAt: unknown): value is ProjectClosure | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || !["ACTIVE", "CLOSED"].includes(String(status)) || typeof startDate !== "string" || typeof createdAt !== "string" || typeof updatedAt !== "string") return false;
  const closure = value as Record<string, unknown>;
  const baseValid = typeof closure.closedOn === "string" && isStrictDate(closure.closedOn) && closure.closedOn >= startDate &&
    typeof closure.note === "string" && closure.note.trim() === closure.note && closure.note.length >= 3 &&
    isStrictTimestamp(closure.closedAt) && closure.closedAt >= createdAt && closure.closedAt <= updatedAt;
  const reopenFields = [closure.reopenedOn, closure.reopenReason, closure.reopenedAt, closure.reopenReviewedAt];
  if (!baseValid || (closure.closedOn as string) > (closure.closedAt as string).slice(0, 10)) return false;
  if (status === "CLOSED") return reopenFields.every((field) => field === undefined);
  return typeof closure.reopenedOn === "string" && isStrictDate(closure.reopenedOn) && closure.reopenedOn >= (closure.closedOn as string) &&
    typeof closure.reopenReason === "string" && closure.reopenReason.trim() === closure.reopenReason && closure.reopenReason.length >= 3 &&
    isStrictTimestamp(closure.reopenedAt) && closure.reopenedAt >= (closure.closedAt as string) && closure.reopenedAt <= updatedAt && closure.reopenedOn <= closure.reopenedAt.slice(0, 10) &&
    (closure.reopenReviewedAt === undefined || (isStrictTimestamp(closure.reopenReviewedAt) && closure.reopenReviewedAt >= closure.reopenedAt && closure.reopenReviewedAt <= updatedAt));
}

function isValidProjectExpenses(value: unknown, status: unknown, startDate: unknown): value is readonly ProjectExpense[] {
  if (value === undefined) return true;
  if (!Array.isArray(value) || !["ACTIVE", "CLOSED"].includes(String(status))) return false;
  const references = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") return false;
    const expense = item as Record<string, unknown>;
    const amount = parseMoneyUnits(expense.amount);
    if (typeof expense.reference !== "string" || expense.reference.trim() !== expense.reference || expense.reference === "" || references.has(expense.reference) ||
        typeof expense.occurredOn !== "string" || !isStrictDate(expense.occurredOn) || typeof startDate !== "string" || expense.occurredOn < startDate ||
        typeof expense.category !== "string" || expense.category.trim() !== expense.category || expense.category === "" ||
        typeof expense.vendor !== "string" || expense.vendor.trim() !== expense.vendor || expense.vendor === "" || amount === null || amount <= 0n) return false;
    references.add(expense.reference);
  }
  return true;
}

export function createProjectRecord(input: ProjectInput, options: Readonly<{ id: string; now: string; sequence: number }>): ProjectRecord {
  const clean = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value).trim()])) as unknown as ProjectInput;
  const quantity = Number(clean.quantity), unitPrice = Number(clean.unitPrice);
  if (textFields.slice(2, 13).some((key) => !clean[key as keyof ProjectInput]) || !isStrictDate(clean.startDate) || !isStrictTimestamp(options.now) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error("INVALID_PROJECT_INPUT");
  const value = quantity * unitPrice;
  if (!Number.isFinite(value) || value <= 0) throw new Error("INVALID_PROJECT_INPUT");
  return { ...clean, id: options.id, code: `ORB-P-${String(options.sequence).padStart(4, "0")}`, value, status: "SETUP", createdAt: options.now, updatedAt: options.now };
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (!textFields.every((key) => typeof item[key] === "string" && (item[key] as string).trim() !== "")) return false;
  if (typeof item.status !== "string" || !["SETUP", "ACTIVE", "CLOSED"].includes(item.status)) return false;
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.unitPrice);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0 || !isStrictDate(item.startDate as string)) return false;
  if (!isStrictTimestamp(item.createdAt) || !isStrictTimestamp(item.updatedAt) || item.createdAt > item.updatedAt) return false;
  if (typeof item.value !== "number" || !Number.isFinite(item.value) || item.value <= 0 || item.value !== quantity * unitPrice) return false;
  const validOptionalText = ["supplier", "purchaseContractReference"].every((key) => item[key] === undefined || (typeof item[key] === "string" && (item[key] as string).trim() !== ""));
  if (!validOptionalText) return false;
  if (item.status !== "SETUP" && (typeof item.supplier !== "string" || typeof item.purchaseContractReference !== "string")) return false;
  if (item.customerShipmentReviewedAt !== undefined &&
      (!isStrictTimestamp(item.customerShipmentReviewedAt) || item.customerShipmentReviewedAt < item.createdAt || item.customerShipmentReviewedAt > item.updatedAt || !item.customerShipment || !["ACTIVE", "CLOSED"].includes(item.status))) return false;
  return isValidShipment(item.supplierShipment, item.status, item.quantity, item.startDate) &&
    isValidCustomerShipment(item.customerShipment, item.status, item.quantity, item.supplierShipment) &&
    isValidSupplierInvoice(item.supplierInvoice, item.status, item.value, item.customerShipment, item.customerShipmentReviewedAt) &&
    isValidSupplierPayment(item.supplierPayment, item.status, item.supplierInvoice, item.customerShipmentReviewedAt) &&
    isValidCustomerInvoice(item.customerInvoice, item.status, item.value, item.customerShipment, item.supplierPayment) &&
    isValidCustomerCollections(item.customerCollections, item.status, item.customerInvoice) &&
    isValidProjectExpenses(item.expenses, item.status, item.startDate) &&
    isValidProjectClaims(item.claims, item.status, item.customer, item.supplier, item.startDate, item.createdAt, item.updatedAt) &&
    isValidProjectClosure(item.closure, item.status, item.startDate, item.createdAt, item.updatedAt) &&
    (item.closure === undefined || item.status !== "CLOSED" || (item.closure as ProjectClosure).closedOn >= latestProjectBusinessDate(item as unknown as ProjectRecord));
}

export function parseProjectRecords(raw: string | null): ProjectRecord[] {
  if (!raw) return [];
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("CORRUPT_PROJECT_STORAGE"); }
  if (!Array.isArray(value) || !value.every(isProjectRecord)) throw new Error("CORRUPT_PROJECT_STORAGE");
  return value;
}

export type ProjectSetupInput = Readonly<{ customer: string; supplier: string; salesContractReference: string; purchaseContractReference: string }>;

export function completeProjectSetup(project: ProjectRecord, input: ProjectSetupInput, now: string): ProjectRecord {
  if (project.status !== "SETUP") throw new Error("INVALID_PROJECT_SETUP_STATE");
  const customer = input.customer.trim();
  const supplier = input.supplier.trim();
  const contractReference = input.salesContractReference.trim();
  const purchaseContractReference = input.purchaseContractReference.trim();
  if (!customer || !supplier || !contractReference || !purchaseContractReference || !isValidMutationTimestamp(now, project)) throw new Error("INVALID_PROJECT_SETUP");
  return { ...project, customer, supplier, contractReference, purchaseContractReference, status: "ACTIVE", updatedAt: now };
}

function isValidMutationTimestamp(now: string, project: ProjectRecord): boolean {
  return isStrictTimestamp(now) && isStrictTimestamp(project.updatedAt) && now >= project.updatedAt;
}

export type SupplierShipmentInput = Readonly<{ reference: string; expectedArrival: string; quantity: string }>;

export function recordSupplierShipment(project: ProjectRecord, input: SupplierShipmentInput, now: string): ProjectRecord {
  if (project.status !== "ACTIVE" || project.supplierShipment) throw new Error("INVALID_SUPPLIER_SHIPMENT_STATE");
  const reference = input.reference.trim();
  const expectedArrival = input.expectedArrival.trim();
  const quantity = input.quantity.trim();
  const numericQuantity = Number(quantity);
  if (!reference || !isStrictDate(expectedArrival) || expectedArrival < project.startDate || !Number.isFinite(numericQuantity) || numericQuantity <= 0 || numericQuantity > Number(project.quantity) || !isValidMutationTimestamp(now, project)) throw new Error("INVALID_SUPPLIER_SHIPMENT");
  return { ...project, supplierShipment: { reference, expectedArrival, quantity }, updatedAt: now };
}

export type CustomerShipmentInput = Readonly<{ reference: string; plannedDispatchDate: string; quantity: string }>;

export function recordCustomerShipment(project: ProjectRecord, input: CustomerShipmentInput, now: string): ProjectRecord {
  if (project.status !== "ACTIVE" || !project.supplierShipment || project.customerShipment) throw new Error("INVALID_CUSTOMER_SHIPMENT_STATE");
  const reference = input.reference.trim();
  const plannedDispatchDate = input.plannedDispatchDate.trim();
  const quantity = input.quantity.trim();
  const numericQuantity = Number(quantity);
  if (!reference || !isStrictDate(plannedDispatchDate) || !Number.isFinite(numericQuantity) || numericQuantity <= 0 ||
      numericQuantity > Number(project.quantity) || numericQuantity > Number(project.supplierShipment.quantity) || plannedDispatchDate < project.supplierShipment.expectedArrival || !isValidMutationTimestamp(now, project)) {
    throw new Error("INVALID_CUSTOMER_SHIPMENT");
  }
  return { ...project, customerShipment: { reference, plannedDispatchDate, quantity }, updatedAt: now };
}

export function markCustomerShipmentReviewed(project: ProjectRecord, now: string): ProjectRecord {
  if (project.status !== "ACTIVE" || !project.customerShipment || project.customerShipmentReviewedAt) throw new Error("INVALID_CUSTOMER_SHIPMENT_REVIEW_STATE");
  if (!isValidMutationTimestamp(now, project)) throw new Error("INVALID_CUSTOMER_SHIPMENT_REVIEW");
  return { ...project, customerShipmentReviewedAt: now, updatedAt: now };
}


export type SupplierInvoiceInput = Readonly<{ reference: string; invoiceDate: string; amount: string }>;

export function recordSupplierInvoice(project: ProjectRecord, input: SupplierInvoiceInput, now: string): ProjectRecord {
  if (project.status !== "ACTIVE" || !project.customerShipment || !project.customerShipmentReviewedAt || project.supplierInvoice) throw new Error("INVALID_SUPPLIER_INVOICE_STATE");
  const supplierInvoice = { reference: input.reference.trim(), invoiceDate: input.invoiceDate.trim(), amount: input.amount.trim() };
  const amount = Number(supplierInvoice.amount);
  if (!supplierInvoice.reference || !isStrictDate(supplierInvoice.invoiceDate) || supplierInvoice.invoiceDate < project.customerShipment.plannedDispatchDate ||
      !Number.isFinite(amount) || amount <= 0 || amount > project.value || !isValidMutationTimestamp(now, project)) throw new Error("INVALID_SUPPLIER_INVOICE");
  return { ...project, supplierInvoice, updatedAt: now };
}

export type SupplierPaymentInput = Readonly<{ reference: string; paymentDate: string; amount: string }>;

export function recordSupplierPayment(project: ProjectRecord, input: SupplierPaymentInput, now: string): ProjectRecord {
  if (project.status !== "ACTIVE" || !project.supplierInvoice || project.supplierPayment) throw new Error("INVALID_SUPPLIER_PAYMENT_STATE");
  const supplierPayment = { reference: input.reference.trim(), paymentDate: input.paymentDate.trim(), amount: input.amount.trim() };
  if (!supplierPayment.reference || !isStrictDate(supplierPayment.paymentDate) || supplierPayment.paymentDate < project.supplierInvoice.invoiceDate ||
      Number(supplierPayment.amount) !== Number(project.supplierInvoice.amount) || Number(supplierPayment.amount) <= 0 || !isValidMutationTimestamp(now, project)) throw new Error("INVALID_SUPPLIER_PAYMENT");
  return { ...project, supplierPayment, updatedAt: now };
}

export type CustomerInvoiceInput = Readonly<{ reference: string; invoiceDate: string; amount: string }>;

export function recordCustomerInvoice(project: ProjectRecord, input: CustomerInvoiceInput, now: string, expectedUpdatedAt = project.updatedAt): ProjectRecord {
  if (project.status !== "ACTIVE" || !project.customerShipment || !project.supplierPayment || project.customerInvoice || project.updatedAt !== expectedUpdatedAt) throw new Error("INVALID_CUSTOMER_INVOICE_STATE");
  const customerInvoice = { reference: input.reference.trim(), invoiceDate: input.invoiceDate.trim(), amount: input.amount.trim() };
  const amount = parseMoneyUnits(customerInvoice.amount);
  if (!customerInvoice.reference || !isStrictDate(customerInvoice.invoiceDate) || customerInvoice.invoiceDate < project.customerShipment.plannedDispatchDate ||
      amount === null || amount <= 0n || Number(customerInvoice.amount) > project.value || !isValidMutationTimestamp(now, project)) throw new Error("INVALID_CUSTOMER_INVOICE");
  return { ...project, customerInvoice, customerCollections: [], updatedAt: now };
}

export type CustomerCollectionInput = Readonly<{ reference: string; collectionDate: string; amount: string }>;

export function recordCustomerCollection(project: ProjectRecord, input: CustomerCollectionInput, now: string, expectedUpdatedAt = project.updatedAt): ProjectRecord {
  if (project.status !== "ACTIVE" || !project.customerInvoice || project.updatedAt !== expectedUpdatedAt) throw new Error("INVALID_CUSTOMER_COLLECTION_STATE");
  const customerCollection = { reference: input.reference.trim(), collectionDate: input.collectionDate.trim(), amount: input.amount.trim() };
  const amount = parseMoneyUnits(customerCollection.amount);
  const invoiceAmount = parseMoneyUnits(project.customerInvoice.amount);
  const existing = project.customerCollections ?? [];
  const collected = existing.reduce((sum, item) => sum + (parseMoneyUnits(item.amount) ?? 0n), 0n);
  if (!customerCollection.reference || existing.some((item) => item.reference === customerCollection.reference) || !isStrictDate(customerCollection.collectionDate) ||
      customerCollection.collectionDate < project.customerInvoice.invoiceDate || amount === null || amount <= 0n || invoiceAmount === null || collected + amount > invoiceAmount ||
      !isValidMutationTimestamp(now, project)) throw new Error("INVALID_CUSTOMER_COLLECTION");
  return { ...project, customerCollections: [...existing, customerCollection], updatedAt: now };
}


export type ProjectExpenseInput = Readonly<{ reference: string; occurredOn: string; category: string; vendor: string; amount: string }>;

export function recordProjectExpense(project: ProjectRecord, input: ProjectExpenseInput, now: string, expectedUpdatedAt = project.updatedAt): ProjectRecord {
  if (project.status !== "ACTIVE" || project.updatedAt !== expectedUpdatedAt) throw new Error("INVALID_PROJECT_EXPENSE_STATE");
  const expense = { reference: input.reference.trim(), occurredOn: input.occurredOn.trim(), category: input.category.trim(), vendor: input.vendor.trim(), amount: input.amount.trim() };
  const existing = project.expenses ?? [];
  const amount = parseMoneyUnits(expense.amount);
  if (!expense.reference || existing.some((item) => item.reference === expense.reference) || !isStrictDate(expense.occurredOn) || expense.occurredOn < project.startDate ||
      !expense.category || !expense.vendor || amount === null || amount <= 0n || !isValidMutationTimestamp(now, project)) throw new Error("INVALID_PROJECT_EXPENSE");
  return { ...project, expenses: [...existing, expense], updatedAt: now };
}

export type ProjectClaimInput = Readonly<{ reference: string; type: ProjectClaimType; claimDate: string; claimant: string; respondent: string; description: string; amount?: string }>;

export function recordProjectClaim(project: ProjectRecord, input: ProjectClaimInput, now: string, expectedUpdatedAt = project.updatedAt): ProjectRecord {
  if (project.status !== "ACTIVE" || !project.supplier || project.updatedAt !== expectedUpdatedAt) throw new Error("INVALID_PROJECT_CLAIM_STATE");
  const reference = input.reference.trim();
  const claimant = input.claimant.trim();
  const respondent = input.respondent.trim();
  const claimDate = input.claimDate.trim();
  const description = input.description.trim();
  const rawAmount = input.amount?.trim() ?? "";
  const amount = rawAmount === "" ? null : parseMoneyUnits(rawAmount);
  const partiesValid = (claimant === project.customer && respondent === project.supplier) || (claimant === project.supplier && respondent === project.customer);
  if (reference !== input.reference || !reference || (project.claims ?? []).some((item) => item.reference === reference) ||
      !PROJECT_CLAIM_TYPES.includes(input.type) || !isStrictDate(claimDate) || claimDate < project.startDate || !partiesValid || claimant === respondent || description.length < 3 ||
      (rawAmount !== "" && (amount === null || amount <= 0n)) || !isValidMutationTimestamp(now, project)) throw new Error("INVALID_PROJECT_CLAIM");
  const claim: ProjectClaim = { reference, type: input.type, claimDate, claimant, respondent, description, ...(rawAmount ? { amount: rawAmount } : {}), status: "OPEN", createdAt: now };
  return { ...project, claims: [...(project.claims ?? []), claim].sort(compareClaims), updatedAt: now };
}

export type ProjectClaimResolutionInput = Readonly<{ reference: string; resolutionNote: string; resolutionDate: string }>;

export function resolveProjectClaim(project: ProjectRecord, input: ProjectClaimResolutionInput, now: string, expectedUpdatedAt = project.updatedAt): ProjectRecord {
  if (project.status !== "ACTIVE" || project.updatedAt !== expectedUpdatedAt) throw new Error("INVALID_PROJECT_CLAIM_RESOLUTION_STATE");
  const reference = input.reference.trim();
  const note = input.resolutionNote.trim();
  const resolutionDate = input.resolutionDate.trim();
  const claim = (project.claims ?? []).find((item) => item.reference === reference);
  if (!claim || claim.status !== "OPEN" || reference !== input.reference || !note || note !== input.resolutionNote || !isStrictDate(resolutionDate) ||
      resolutionDate < claim.claimDate || resolutionDate < project.startDate || !isValidMutationTimestamp(now, project) || now < claim.createdAt) throw new Error("INVALID_PROJECT_CLAIM_RESOLUTION");
  const claims = (project.claims ?? []).map((item): ProjectClaim => item.reference === reference
    ? { ...item, status: "RESOLVED", resolutionNote: note, resolutionDate, resolvedAt: now }
    : item);
  return { ...project, claims, updatedAt: now };
}

export function projectClaimSummary(project: ProjectRecord): Readonly<{ count: number; open: number; resolved: number; amountTotal: string }> {
  const claims = project.claims ?? [];
  const amountTotal = claims.reduce((sum, item) => sum + (item.amount ? parseMoneyUnits(item.amount) ?? 0n : 0n), 0n);
  return { count: claims.length, open: claims.filter((item) => item.status === "OPEN").length, resolved: claims.filter((item) => item.status === "RESOLVED").length, amountTotal: formatMoneyUnits(amountTotal) };
}

export function removeProjectExpense(project: ProjectRecord, reference: string, expectedUpdatedAt: string, now: string): ProjectRecord {
  if (project.status !== "ACTIVE" || project.updatedAt !== expectedUpdatedAt) throw new Error("INVALID_PROJECT_EXPENSE_STATE");
  const cleanReference = reference.trim();
  const existing = project.expenses ?? [];
  if (!cleanReference || !existing.some((item) => item.reference === cleanReference) || !isValidMutationTimestamp(now, project)) throw new Error("INVALID_PROJECT_EXPENSE");
  return { ...project, expenses: existing.filter((item) => item.reference !== cleanReference), updatedAt: now };
}

export function projectExpenseSummary(project: ProjectRecord): Readonly<{ count: number; total: string }> {
  const expenses = project.expenses ?? [];
  const total = expenses.reduce((sum, item) => sum + (parseMoneyUnits(item.amount) ?? 0n), 0n);
  return { count: expenses.length, total: formatMoneyUnits(total) };
}

export function resetCustomerFinance(project: ProjectRecord, expectedUpdatedAt: string, now: string): ProjectRecord {
  if (project.status !== "ACTIVE" || !project.customerInvoice || project.updatedAt !== expectedUpdatedAt) throw new Error("INVALID_CUSTOMER_FINANCE_RESET_STATE");
  if (!isValidMutationTimestamp(now, project)) throw new Error("INVALID_CUSTOMER_FINANCE_RESET");
  const { customerInvoice: _invoice, customerCollections: _collections, ...rest } = project;
  return { ...rest, updatedAt: now };
}

export function resetSupplierFinance(project: ProjectRecord, expectedUpdatedAt: string, now: string): ProjectRecord {
  if (project.status !== "ACTIVE" || !project.supplierInvoice || project.updatedAt !== expectedUpdatedAt) throw new Error("INVALID_SUPPLIER_FINANCE_RESET_STATE");
  if (!isValidMutationTimestamp(now, project)) throw new Error("INVALID_SUPPLIER_FINANCE_RESET");
  const { supplierInvoice: _invoice, supplierPayment: _payment, customerInvoice: _customerInvoice, customerCollections: _customerCollections, ...rest } = project;
  return { ...rest, updatedAt: now };
}

export function customerReceivableSummary(project: ProjectRecord): Readonly<{ collected: string; remaining: string; complete: boolean }> {
  const invoiceAmount = parseMoneyUnits(project.customerInvoice?.amount);
  const collected = (project.customerCollections ?? []).reduce((sum, item) => sum + (parseMoneyUnits(item.amount) ?? 0n), 0n);
  const remaining = invoiceAmount === null || collected >= invoiceAmount ? 0n : invoiceAmount - collected;
  return { collected: formatMoneyUnits(collected), remaining: formatMoneyUnits(remaining), complete: invoiceAmount !== null && collected === invoiceAmount };
}

export type ProjectClosureBlocker = "SHIPMENT_HANDOVER" | "SUPPLIER_PAYMENT" | "CUSTOMER_COLLECTION" | "OPEN_CLAIMS" | "REOPEN_REVIEW";
export function assessProjectClosure(project: ProjectRecord): Readonly<{ ready: boolean; blockers: ProjectClosureBlocker[] }> {
  const blockers: ProjectClosureBlocker[] = [];
  if (!project.customerShipmentReviewedAt) blockers.push("SHIPMENT_HANDOVER");
  if (!project.supplierPayment) blockers.push("SUPPLIER_PAYMENT");
  if (!customerReceivableSummary(project).complete) blockers.push("CUSTOMER_COLLECTION");
  if ((project.claims ?? []).some((claim) => claim.status === "OPEN")) blockers.push("OPEN_CLAIMS");
  if (project.closure?.reopenedAt && !project.closure.reopenReviewedAt) blockers.push("REOPEN_REVIEW");
  return { ready: blockers.length === 0, blockers };
}

export type CloseProjectInput = Readonly<{ closedOn: string; note: string }>;
export function closeProject(project: ProjectRecord, input: CloseProjectInput, now: string, expectedUpdatedAt = project.updatedAt): ProjectRecord {
  if (project.status !== "ACTIVE" || project.updatedAt !== expectedUpdatedAt) throw new Error("INVALID_PROJECT_CLOSE_STATE");
  if (!assessProjectClosure(project).ready) throw new Error("PROJECT_NOT_READY_TO_CLOSE");
  const closedOn = input.closedOn.trim(), note = input.note.trim();
  const latestCloseDate = [latestProjectBusinessDate(project), project.closure?.reopenedOn, project.closure?.reopenReviewedAt?.slice(0, 10)].filter((date): date is string => Boolean(date)).sort().at(-1) ?? project.startDate;
  if (!isStrictDate(closedOn) || closedOn < latestCloseDate || closedOn > now.slice(0, 10) || note !== input.note || note.length < 3 || !isValidMutationTimestamp(now, project)) throw new Error("INVALID_PROJECT_CLOSE");
  return { ...project, status: "CLOSED", closure: { closedOn, note, closedAt: now }, updatedAt: now };
}

export type ReopenProjectInput = Readonly<{ reopenedOn: string; reason: string }>;
export function reopenProject(project: ProjectRecord, input: ReopenProjectInput, now: string, expectedUpdatedAt = project.updatedAt): ProjectRecord {
  if (project.status !== "CLOSED" || !project.closure || project.updatedAt !== expectedUpdatedAt) throw new Error("INVALID_PROJECT_REOPEN_STATE");
  const reopenedOn = input.reopenedOn.trim(), reason = input.reason.trim();
  if (!isStrictDate(reopenedOn) || reopenedOn < project.closure.closedOn || reopenedOn > now.slice(0, 10) || reason !== input.reason || reason.length < 3 || !isValidMutationTimestamp(now, project)) throw new Error("INVALID_PROJECT_REOPEN");
  return { ...project, status: "ACTIVE", closure: { ...project.closure, reopenedOn, reopenReason: reason, reopenedAt: now }, updatedAt: now };
}

export function reviewReopenedProject(project: ProjectRecord, now: string, expectedUpdatedAt = project.updatedAt): ProjectRecord {
  if (project.status !== "ACTIVE" || !project.closure?.reopenedAt || project.closure.reopenReviewedAt || project.updatedAt !== expectedUpdatedAt || !isValidMutationTimestamp(now, project)) throw new Error("INVALID_REOPEN_REVIEW_STATE");
  return { ...project, closure: { ...project.closure, reopenReviewedAt: now }, updatedAt: now };
}

export type ProjectAction = Readonly<{ label: string; detail: string; href: string }>;
export function projectNextAction(project: ProjectRecord, locale: "ar" | "en"): ProjectAction | null;
export function projectNextAction(status: ProjectStatus, locale: "ar" | "en", projectId: string): ProjectAction;
export function projectNextAction(projectOrStatus: ProjectRecord | ProjectStatus, locale: "ar" | "en", projectId?: string): ProjectAction | null {
  const project = typeof projectOrStatus === "string" ? null : projectOrStatus;
  const status = typeof projectOrStatus === "string" ? projectOrStatus : projectOrStatus.status;
  const id = encodeURIComponent(project?.id ?? projectId ?? "");
  if (status === "CLOSED" && project) return null;
  if (status === "ACTIVE" && project) {
    if (project.closure?.reopenedAt && !project.closure.reopenReviewedAt) return locale === "ar"
      ? { label: "مراجعة العمل بعد إعادة الفتح", detail: `راجع سبب إعادة الفتح: ${project.closure.reopenReason}. سجل أي تعديلات لازمة ثم أكد المراجعة.`, href: `/projects/${id}/closure` }
      : { label: "Review reopened work", detail: `Review the reopen reason: ${project.closure.reopenReason}. Record any required changes, then confirm the review.`, href: `/projects/${id}/closure` };
    if (!project.supplierShipment) return locale === "ar"
      ? { label: "تسجيل شحنة المورد", detail: "أضف مرجع شحنة المورد وموعد الوصول المتوقع والكمية المخططة.", href: `/projects/${id}/overview#supplier-shipment` }
      : { label: "Record supplier shipment", detail: "Add the supplier shipment reference, expected arrival, and planned quantity.", href: `/projects/${id}/overview#supplier-shipment` };
    if (!project.customerShipment) return locale === "ar"
      ? { label: "تسجيل شحنة العميل", detail: "أضف مرجع شحنة العميل وتاريخ الإرسال المخطط والكمية.", href: `/projects/${id}/overview#customer-shipment` }
      : { label: "Record customer shipment", detail: "Add the customer shipment reference, planned dispatch date, and quantity.", href: `/projects/${id}/overview#customer-shipment` };
    if (!project.customerShipmentReviewedAt) return locale === "ar"
      ? { label: "مراجعة تسليم الشحنة", detail: `راجع وأكد شحنة العميل المسجلة ${project.customerShipment.reference} للانتقال إلى بيانات المورد المالية.`, href: `/projects/${id}/overview#customer-shipment` }
      : { label: "Review shipment handover", detail: `Review and confirm recorded customer shipment ${project.customerShipment.reference} before recording supplier finance.`, href: `/projects/${id}/overview#customer-shipment` };
    if (!project.supplierInvoice) return locale === "ar"
      ? { label: "تسجيل فاتورة المورد", detail: `أضف مرجع فاتورة ${project.supplier ?? "المورد"} وتاريخها وقيمتها.`, href: `/projects/${id}/overview#supplier-finance` }
      : { label: "Record supplier invoice", detail: `Add the invoice reference, date, and amount for ${project.supplier ?? "the supplier"}.`, href: `/projects/${id}/overview#supplier-finance` };
    if (!project.supplierPayment) return locale === "ar"
      ? { label: "تسجيل دفعة المورد", detail: `سجل الدفعة الكاملة للفاتورة ${project.supplierInvoice.reference}. لا ينفذ ORB أي تحويل مالي.`, href: `/projects/${id}/overview#supplier-finance` }
      : { label: "Record supplier payment", detail: `Record the full payment for invoice ${project.supplierInvoice.reference}. ORB does not execute a transfer.`, href: `/projects/${id}/overview#supplier-finance` };
    if (!project.customerInvoice) return locale === "ar"
      ? { label: "تسجيل فاتورة العميل", detail: `أضف مرجع فاتورة ${project.customer} وتاريخها وقيمتها.`, href: `/projects/${id}/overview#customer-finance` }
      : { label: "Record customer invoice", detail: `Add the invoice reference, date, and amount for ${project.customer}.`, href: `/projects/${id}/overview#customer-finance` };
    const receivable = customerReceivableSummary(project);
    if (!receivable.complete) {
      const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(Number(receivable.remaining));
      return locale === "ar"
        ? { label: "تسجيل تحصيل من العميل", detail: `سجل التحصيل الوارد فقط؛ المتبقي ${amount} ${project.currency}. لا يتصل ORB بالبنك.`, href: `/projects/${id}/overview#customer-finance` }
        : { label: "Record customer collection", detail: `Record received funds only; ${amount} ${project.currency} remains. ORB does not connect to a bank.`, href: `/projects/${id}/overview#customer-finance` };
    }
    if (!(project.expenses?.length)) return locale === "ar"
      ? { label: "تسجيل مصروف للمشروع", detail: "أضف أول تكلفة مباشرة دُفعت لهذا المشروع؛ يسجلها ORB فقط ولا ينفذ أي دفعة.", href: `/projects/${id}/expenses` }
      : { label: "Record project expense", detail: "Add the first direct cost paid for this project; ORB records it only and does not make a payment.", href: `/projects/${id}/expenses` };
    const openClaim = project.claims?.find((claim) => claim.status === "OPEN");
    if (openClaim) return locale === "ar"
      ? { label: "حل المطالبة المفتوحة", detail: `راجع المطالبة المفتوحة ${openClaim.reference} وحلها.`, href: `/projects/${id}/claims` }
      : { label: "Resolve open claim", detail: `Review and resolve the open project claim ${openClaim.reference}.`, href: `/projects/${id}/claims` };
    return locale === "ar"
      ? { label: "إغلاق المشروع", detail: "راجع الجاهزية وسجل سبب الإغلاق وتاريخه. لا يرسل ORB أي بيانات خارجية.", href: `/projects/${id}/closure` }
      : { label: "Close project", detail: "Review readiness and record the closure date and note. ORB sends nothing externally.", href: `/projects/${id}/closure` };
  }
  const copy = {
    SETUP: { en: { label: "Complete project setup", detail: "Confirm the customer, supplier, sales contract, and purchase contract.", href: `/projects/${id}/overview#project-data` }, ar: { label: "إكمال إعداد المشروع", detail: "أكد العميل والمورد ومرجعي عقد البيع والشراء.", href: `/projects/${id}/overview#project-data` } },
    ACTIVE: { en: { label: "Review saved project data", detail: "Review the parties, contracts, route, and commercial details saved for this project.", href: `/projects/${id}/overview#project-data` }, ar: { label: "مراجعة بيانات المشروع المحفوظة", detail: "راجع الأطراف والعقود والمسار والبيانات التجارية المحفوظة لهذا المشروع.", href: `/projects/${id}/overview#project-data` } },
    CLOSED: { en: { label: "Review project closure", detail: "Review the recorded closure state and project data.", href: `/projects/${id}/overview#lifecycle` }, ar: { label: "مراجعة إغلاق المشروع", detail: "راجع حالة الإغلاق وبيانات المشروع المسجلة.", href: `/projects/${id}/overview#lifecycle` } },
  } as const;
  return copy[status][locale];
}

export function projectStatusLabel(status: ProjectStatus, locale: "ar" | "en"): string {
  return ({ SETUP: locale === "ar" ? "قيد الإعداد" : "Setup", ACTIVE: locale === "ar" ? "نشط" : "Active", CLOSED: locale === "ar" ? "مغلق" : "Closed" })[status];
}
