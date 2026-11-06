import type { AuditEvent } from "./audit-service.ts";

export interface AuditPageRepository {
  listProjectEvents(input: { readonly projectId: string; readonly cursor: string | null; readonly limit: number }): Promise<{
    readonly items: readonly AuditEvent[];
    readonly nextCursor: string | null;
    readonly pageStartPreviousEventHash: string | null;
  }>;
}

export const AUDIT_PAGE_METADATA = Object.freeze({
  order: "sequenceNo ASC",
  canonicalizationStandard: "RFC 8785 JSON Canonicalization Scheme (JCS)",
  textEncoding: "UTF-8",
  hashAlgorithm: "SHA-256",
  eventHashFormula: "lowercase-hex(SHA-256(UTF-8(JCS(hashPayload))))",
  genesisPreviousEventHash: null,
  nullAndOmissionRule: "Every enumerated hashPayload key is present; unavailable optional values are JSON null; no additional keys are hashed.",
});

export async function listProjectAuditEvents(input: {
  readonly projectId: string;
  readonly cursor: string | null;
  readonly limit: number;
  readonly repository: AuditPageRepository;
}) {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new RangeError("audit page limit must be an integer from 1 through 100");
  }
  const page = await input.repository.listProjectEvents({ projectId: input.projectId, cursor: input.cursor, limit: input.limit });
  let expectedPreviousHash = page.pageStartPreviousEventHash;
  let previousSequence: number | null = null;
  for (const event of page.items) {
    if (event.projectId !== input.projectId) throw new Error("audit page contains a cross-project event");
    if (!Number.isSafeInteger(event.sequenceNo) || event.sequenceNo < 1) throw new Error("audit sequence is invalid");
    if (previousSequence !== null && event.sequenceNo !== previousSequence + 1) {
      throw new Error("audit sequence is not strictly contiguous and ascending");
    }
    if (event.previousEventHash !== expectedPreviousHash) throw new Error("audit continuity hash is broken");
    expectedPreviousHash = event.eventHash;
    previousSequence = event.sequenceNo;
  }

  return {
    projectId: input.projectId,
    ...AUDIT_PAGE_METADATA,
    pageStartPreviousEventHash: page.pageStartPreviousEventHash,
    pageEndEventHash: expectedPreviousHash,
    items: page.items,
    nextCursor: page.nextCursor,
  };
}
