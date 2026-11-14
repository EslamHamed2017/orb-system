export const PROJECT_STORAGE_KEY = "orb.user-projects.owner-1.v1";

export type ProjectStatus = "SETUP" | "ACTIVE" | "CLOSED";
export type ProjectRecord = Readonly<{
  id: string; code: string; customer: string; reference: string; contractReference: string;
  startDate: string; commodity: string; quantity: string; unit: string; currency: string;
  unitPrice: string; value: number; origin: string; destination: string;
  status: ProjectStatus; createdAt: string; updatedAt: string;
}>;
export type ProjectInput = Readonly<Omit<ProjectRecord, "id" | "code" | "value" | "status" | "createdAt" | "updatedAt">>;

const textFields = ["id", "code", "customer", "reference", "contractReference", "startDate", "commodity", "quantity", "unit", "currency", "unitPrice", "origin", "destination", "createdAt", "updatedAt"] as const;

export function createProjectRecord(input: ProjectInput, options: Readonly<{ id: string; now: string; sequence: number }>): ProjectRecord {
  const clean = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value).trim()])) as unknown as ProjectInput;
  const quantity = Number(clean.quantity), unitPrice = Number(clean.unitPrice);
  if (textFields.slice(2, 13).some((key) => !clean[key as keyof ProjectInput]) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("INVALID_PROJECT_INPUT");
  const value = quantity * unitPrice;
  if (!Number.isFinite(value)) throw new Error("INVALID_PROJECT_INPUT");
  return { ...clean, id: options.id, code: `ORB-P-${String(options.sequence).padStart(4, "0")}`, value, status: "SETUP", createdAt: options.now, updatedAt: options.now };
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return textFields.every((key) => typeof item[key] === "string" && item[key] !== "") && typeof item.value === "number" && Number.isFinite(item.value) && ["SETUP", "ACTIVE", "CLOSED"].includes(String(item.status));
}

export function parseProjectRecords(raw: string | null): ProjectRecord[] {
  if (!raw) return [];
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("CORRUPT_PROJECT_STORAGE"); }
  if (!Array.isArray(value) || !value.every(isProjectRecord)) throw new Error("CORRUPT_PROJECT_STORAGE");
  return value;
}

export function projectNextAction(status: ProjectStatus, locale: "ar" | "en", projectId: string): Readonly<{ label: string; detail: string; href: string }> {
  const id = encodeURIComponent(projectId);
  const copy = {
    SETUP: { en: { label: "Review project setup", detail: "Confirm the customer, contract, and route saved for this project.", href: `/projects/${id}/overview#project-data` }, ar: { label: "مراجعة إعداد المشروع", detail: "راجع العميل والعقد والمسار المحفوظة لهذا المشروع.", href: `/projects/${id}/overview#project-data` } },
    ACTIVE: { en: { label: "Review project activity", detail: "Review the recorded lifecycle state and project data.", href: `/projects/${id}/overview#lifecycle` }, ar: { label: "مراجعة نشاط المشروع", detail: "راجع حالة دورة العمل وبيانات المشروع المسجلة.", href: `/projects/${id}/overview#lifecycle` } },
    CLOSED: { en: { label: "Review project closure", detail: "Review the recorded closure state and project data.", href: `/projects/${id}/overview#lifecycle` }, ar: { label: "مراجعة إغلاق المشروع", detail: "راجع حالة الإغلاق وبيانات المشروع المسجلة.", href: `/projects/${id}/overview#lifecycle` } },
  } as const;
  return copy[status][locale];
}

export function projectStatusLabel(status: ProjectStatus, locale: "ar" | "en"): string {
  return ({ SETUP: locale === "ar" ? "قيد الإعداد" : "Setup", ACTIVE: locale === "ar" ? "نشط" : "Active", CLOSED: locale === "ar" ? "مغلق" : "Closed" })[status];
}
