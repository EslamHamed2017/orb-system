import { createHash } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { canonicalizeJson } from "../../platform/canonical-json/rfc8785.ts";

export interface ClaimOutcomeProposal {
  id: string;
  claimId: string;
  claimVersion: number;
  proposedOutcome: "RESOLVED" | "REJECTED";
  reason: string;
  evidenceId: string | null;
  subjectHash: string;
  state: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXPIRED" | "APPLIED";
}

export function claimOutcomeHash(value: Readonly<Record<string, unknown>>): string {
  return createHash("sha256").update(canonicalizeJson(value), "utf8").digest("hex");
}

export function outcomeSubject(input: {
  readonly claimId: string;
  readonly claimVersion: number;
  readonly proposedOutcome: "RESOLVED" | "REJECTED";
  readonly reason: string;
  readonly evidenceId: string | null;
}) {
  return Object.freeze({ claimId: input.claimId, claimVersion: input.claimVersion, proposedOutcome: input.proposedOutcome,
    reason: input.reason, evidenceId: input.evidenceId });
}
