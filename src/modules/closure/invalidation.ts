import type { ClosureAssessment } from "./assessment-service.ts";

export const CLOSURE_INVALIDATORS = Object.freeze(new Set([
  "ALLOCATION_REVERSAL", "MONEY_MOVEMENT_REVERSAL", "CUSTOMER_REFUND", "SHIPMENT_CANCELLED", "SHIPMENT_REJECTED",
  "DOCUMENT_CANCELLED", "DOCUMENT_REVISED", "EXPENSE_CORRECTED", "CLAIM_OPENED", "CLAIM_REOPENED",
]));

export function invalidateClosureBasis(input: {
  project: { finalState: string; assessmentValid: boolean };
  assessments: Iterable<ClosureAssessment>;
  kind: unknown;
}) {
  if (!CLOSURE_INVALIDATORS.has(String(input.kind))) throw new TypeError("Unknown closure basis invalidator");
  for (const assessment of input.assessments) if (assessment.state === "CURRENT") assessment.state = "INVALIDATED";
  input.project.finalState = "OPEN";
  input.project.assessmentValid = false;
}
