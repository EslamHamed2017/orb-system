import type { CommercialDocumentPayload } from "./cinv.tsx";

export function packingListPayload(input: Omit<CommercialDocumentPayload, "kind">): CommercialDocumentPayload {
  return Object.freeze({ ...structuredClone(input), kind: "PACKING_LIST" as const });
}
