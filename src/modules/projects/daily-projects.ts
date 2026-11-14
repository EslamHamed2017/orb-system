export const PROJECT_STORAGE_KEY = "orb.user-projects.owner-1.v1";

export type ProjectStatus = "SETUP" | "ACTIVE" | "CLOSED";
export type SupplierShipment = Readonly<{ reference: string; expectedArrival: string; quantity: string }>;
export type CustomerShipment = Readonly<{ reference: string; plannedDispatchDate: string; quantity: string }>;
export type ProjectRecord = Readonly<{
  id: string; code: string; customer: string; supplier?: string; reference: string; contractReference: string; purchaseContractReference?: string;
  startDate: string; commodity: string; quantity: string; unit: string; currency: string;
  unitPrice: string; value: number; origin: string; destination: string;
  status: ProjectStatus; supplierShipment?: SupplierShipment; customerShipment?: CustomerShipment; customerShipmentReviewedAt?: string; createdAt: string; updatedAt: string;
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

export function createProjectRecord(input: ProjectInput, options: Readonly<{ id: string; now: string; sequence: number }>): ProjectRecord {
  const clean = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value).trim()])) as unknown as ProjectInput;
  const quantity = Number(clean.quantity), unitPrice = Number(clean.unitPrice);
  if (textFields.slice(2, 13).some((key) => !clean[key as keyof ProjectInput]) || !isStrictDate(clean.startDate) || !isStrictTimestamp(options.now) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("INVALID_PROJECT_INPUT");
  const value = quantity * unitPrice;
  if (!Number.isFinite(value)) throw new Error("INVALID_PROJECT_INPUT");
  return { ...clean, id: options.id, code: `ORB-P-${String(options.sequence).padStart(4, "0")}`, value, status: "SETUP", createdAt: options.now, updatedAt: options.now };
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (!textFields.every((key) => typeof item[key] === "string" && (item[key] as string).trim() !== "")) return false;
  if (typeof item.status !== "string" || !["SETUP", "ACTIVE", "CLOSED"].includes(item.status)) return false;
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.unitPrice);
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !isStrictDate(item.startDate as string)) return false;
  if (!isStrictTimestamp(item.createdAt) || !isStrictTimestamp(item.updatedAt) || item.createdAt > item.updatedAt) return false;
  if (typeof item.value !== "number" || !Number.isFinite(item.value) || item.value !== quantity * unitPrice) return false;
  const validOptionalText = ["supplier", "purchaseContractReference"].every((key) => item[key] === undefined || (typeof item[key] === "string" && (item[key] as string).trim() !== ""));
  if (!validOptionalText) return false;
  if (item.status !== "SETUP" && (typeof item.supplier !== "string" || typeof item.purchaseContractReference !== "string")) return false;
  if (item.customerShipmentReviewedAt !== undefined &&
      (!isStrictTimestamp(item.customerShipmentReviewedAt) || item.customerShipmentReviewedAt < item.createdAt || item.customerShipmentReviewedAt > item.updatedAt || !item.customerShipment || !["ACTIVE", "CLOSED"].includes(item.status))) return false;
  return isValidShipment(item.supplierShipment, item.status, item.quantity, item.startDate) &&
    isValidCustomerShipment(item.customerShipment, item.status, item.quantity, item.supplierShipment);
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

export type ProjectAction = Readonly<{ label: string; detail: string; href: string }>;
export function projectNextAction(project: ProjectRecord, locale: "ar" | "en"): ProjectAction | null;
export function projectNextAction(status: ProjectStatus, locale: "ar" | "en", projectId: string): ProjectAction;
export function projectNextAction(projectOrStatus: ProjectRecord | ProjectStatus, locale: "ar" | "en", projectId?: string): ProjectAction | null {
  const project = typeof projectOrStatus === "string" ? null : projectOrStatus;
  const status = typeof projectOrStatus === "string" ? projectOrStatus : projectOrStatus.status;
  const id = encodeURIComponent(project?.id ?? projectId ?? "");
  if (project?.customerShipmentReviewedAt) return null;
  if (status === "ACTIVE" && project) {
    if (!project.supplierShipment) return locale === "ar"
      ? { label: "تسجيل شحنة المورد", detail: "أضف مرجع شحنة المورد وموعد الوصول المتوقع والكمية المخططة.", href: `/projects/${id}/overview#supplier-shipment` }
      : { label: "Record supplier shipment", detail: "Add the supplier shipment reference, expected arrival, and planned quantity.", href: `/projects/${id}/overview#supplier-shipment` };
    if (!project.customerShipment) return locale === "ar"
      ? { label: "تسجيل شحنة العميل", detail: "أضف مرجع شحنة العميل وتاريخ الإرسال المخطط والكمية.", href: `/projects/${id}/overview#customer-shipment` }
      : { label: "Record customer shipment", detail: "Add the customer shipment reference, planned dispatch date, and quantity.", href: `/projects/${id}/overview#customer-shipment` };
    return locale === "ar"
      ? { label: "مراجعة تسليم الشحنة", detail: `راجع وأكد شحنة العميل المسجلة ${project.customerShipment.reference} لإكمال هذا المسار المحدود.`, href: `/projects/${id}/overview#customer-shipment` }
      : { label: "Review shipment handover", detail: `Review and confirm recorded customer shipment ${project.customerShipment.reference} to complete this bounded flow.`, href: `/projects/${id}/overview#customer-shipment` };
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
