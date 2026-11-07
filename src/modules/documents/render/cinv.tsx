export interface CommercialDocumentPayload {
  readonly kind: "CINV" | "PACKING_LIST";
  readonly language: "AR" | "EN" | "BILINGUAL";
  readonly sourceDatasetId: string;
  readonly sharedFields: Readonly<Record<string, unknown>>;
}

export function commercialInvoicePayload(input: Omit<CommercialDocumentPayload, "kind">): CommercialDocumentPayload {
  return Object.freeze({ ...structuredClone(input), kind: "CINV" as const });
}
