export type AttachmentLocale = "en" | "ar";
export type AttachmentSubjectType = "CONTRACT" | "SALES_SHIPMENT" | "SUPPLIER_CONTAINER" | "SALES_INVOICE" | "SUPPLIER_INVOICE" | "MONEY_MOVEMENT" | "EXPENSE" | "CLAIM";
export type AttachmentVerificationState = "PENDING" | "VERIFIED" | "REJECTED";

export interface AttachmentIndexItem {
  readonly id: string;
  readonly projectId: string;
  readonly projectReference: string;
  readonly subjectType: AttachmentSubjectType;
  readonly subjectId: string;
  readonly subjectReference: string;
  readonly purpose: string;
  readonly originalFilename: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly uploadedAt: string;
  readonly verificationState: AttachmentVerificationState;
}

export interface AttachmentFilters {
  readonly projectId?: string;
  readonly subjectType?: AttachmentSubjectType;
  readonly verificationState?: AttachmentVerificationState;
  readonly query?: string;
}

export function filterAttachments(items: readonly AttachmentIndexItem[], filters: AttachmentFilters): readonly AttachmentIndexItem[] {
  if (filters.projectId !== undefined && !filters.projectId.trim()) throw new TypeError("Project filter cannot be blank");
  const query = filters.query?.trim().toLocaleLowerCase("en-US") ?? "";
  return items.filter((item) =>
    (filters.projectId === undefined || item.projectId === filters.projectId)
    && (filters.subjectType === undefined || item.subjectType === filters.subjectType)
    && (filters.verificationState === undefined || item.verificationState === filters.verificationState)
    && (!query || [item.originalFilename, item.purpose, item.projectReference, item.subjectReference].some((value) => value.toLocaleLowerCase("en-US").includes(query))))
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt) || left.id.localeCompare(right.id));
}

export function buildAttachmentSourceHref(input: Readonly<{ subjectType: AttachmentSubjectType; subjectId: string; projectId: string; locale: AttachmentLocale }>): string {
  const projectId = encodeURIComponent(input.projectId);
  const subjectId = encodeURIComponent(input.subjectId);
  const context = `locale=${input.locale}`;
  switch (input.subjectType) {
    case "CONTRACT": return `/projects/${projectId}/contracts?${context}&recordId=${subjectId}`;
    case "SALES_SHIPMENT": return `/sales-shipments/${subjectId}?${context}&projectId=${projectId}`;
    case "SUPPLIER_CONTAINER": return `/supplier-shipments/${subjectId}?${context}&projectId=${projectId}`;
    case "SALES_INVOICE": return `/accounts/sales-invoices?${context}&projectId=${projectId}&recordId=${subjectId}`;
    case "SUPPLIER_INVOICE": return `/accounts/supplier-invoices?${context}&projectId=${projectId}&recordId=${subjectId}`;
    case "MONEY_MOVEMENT": return `/projects/${projectId}/money?${context}&recordId=${subjectId}`;
    case "EXPENSE": return `/accounts/expenses?${context}&projectId=${projectId}&recordId=${subjectId}`;
    case "CLAIM": return `/projects/${projectId}/claims?${context}&recordId=${subjectId}`;
  }
}

const SUBJECT_TYPES: readonly AttachmentSubjectType[] = ["CONTRACT","SALES_SHIPMENT","SUPPLIER_CONTAINER","SALES_INVOICE","SUPPLIER_INVOICE","MONEY_MOVEMENT","EXPENSE","CLAIM"];
export function isAttachmentSubjectType(value: string | undefined): value is AttachmentSubjectType { return SUBJECT_TYPES.includes(value as AttachmentSubjectType); }
export function isAttachmentVerificationState(value: string | undefined): value is AttachmentVerificationState { return value === "PENDING" || value === "VERIFIED" || value === "REJECTED"; }
