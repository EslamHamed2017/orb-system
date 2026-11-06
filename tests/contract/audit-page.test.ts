import assert from "node:assert/strict";
import test from "node:test";

const PROJECT_ID = "019a5f9b-7c00-7000-8000-000000000001";
const HASH_1 = "1".repeat(64);
const HASH_2 = "2".repeat(64);
const HASH_3 = "3".repeat(64);

interface AuditEvent {
  readonly projectId: string;
  readonly sequenceNo: number;
  readonly previousEventHash: string | null;
  readonly eventHash: string;
  readonly [key: string]: unknown;
}

interface AuditPageModule {
  listProjectAuditEvents(input: {
    readonly projectId: string;
    readonly cursor: string | null;
    readonly limit: number;
    readonly repository: {
      listProjectEvents(input: { projectId: string; cursor: string | null; limit: number }): Promise<{
        items: readonly AuditEvent[];
        nextCursor: string | null;
        pageStartPreviousEventHash: string | null;
      }>;
    };
  }): Promise<Record<string, unknown>>;
}

async function loadAuditPageModule(): Promise<AuditPageModule> {
  const modulePath = "../../src/modules/audit/audit-query.ts";
  return import(modulePath) as Promise<AuditPageModule>;
}

function row(sequenceNo: number, previousEventHash: string | null, eventHash: string): AuditEvent {
  return { projectId: PROJECT_ID, sequenceNo, previousEventHash, eventHash };
}

class PagedRepository {
  readonly calls: Array<{ projectId: string; cursor: string | null; limit: number }> = [];
  async listProjectEvents(input: { projectId: string; cursor: string | null; limit: number }) {
    this.calls.push(input);
    if (input.cursor === null) return {
      items: [row(1, null, HASH_1), row(2, HASH_1, HASH_2)],
      nextCursor: "cursor-2",
      pageStartPreviousEventHash: null,
    };
    return {
      items: [row(3, HASH_2, HASH_3)],
      nextCursor: null,
      pageStartPreviousEventHash: HASH_2,
    };
  }
}

const METADATA = {
  order: "sequenceNo ASC",
  canonicalizationStandard: "RFC 8785 JSON Canonicalization Scheme (JCS)",
  textEncoding: "UTF-8",
  hashAlgorithm: "SHA-256",
  eventHashFormula: "lowercase-hex(SHA-256(UTF-8(JCS(hashPayload))))",
  genesisPreviousEventHash: null,
  nullAndOmissionRule: "Every enumerated hashPayload key is present; unavailable optional values are JSON null; no additional keys are hashed.",
};

test("audit page is strictly ascending and returns exact contract metadata and continuity anchors", async () => {
  const auditPage = await loadAuditPageModule();
  const repository = new PagedRepository();
  const first = await auditPage.listProjectAuditEvents({ projectId: PROJECT_ID, cursor: null, limit: 2, repository });
  assert.deepEqual(first, {
    projectId: PROJECT_ID,
    ...METADATA,
    pageStartPreviousEventHash: null,
    pageEndEventHash: HASH_2,
    items: [row(1, null, HASH_1), row(2, HASH_1, HASH_2)],
    nextCursor: "cursor-2",
  });

  const second = await auditPage.listProjectAuditEvents({ projectId: PROJECT_ID, cursor: first.nextCursor as string, limit: 2, repository });
  assert.deepEqual(second, {
    projectId: PROJECT_ID,
    ...METADATA,
    pageStartPreviousEventHash: HASH_2,
    pageEndEventHash: HASH_3,
    items: [row(3, HASH_2, HASH_3)],
    nextCursor: null,
  });
  assert.equal(second.pageStartPreviousEventHash, first.pageEndEventHash);
  assert.deepEqual(repository.calls, [
    { projectId: PROJECT_ID, cursor: null, limit: 2 },
    { projectId: PROJECT_ID, cursor: "cursor-2", limit: 2 },
  ]);
});

test("audit page fails closed on non-ascending, cross-Project, or broken chain rows", async () => {
  const auditPage = await loadAuditPageModule();
  const badPages = [
    { items: [row(2, HASH_1, HASH_2), row(1, null, HASH_1)], pageStartPreviousEventHash: HASH_1 },
    { items: [{ ...row(1, null, HASH_1), projectId: "019a5f9b-7c00-7000-8000-000000000099" }], pageStartPreviousEventHash: null },
    { items: [row(2, HASH_3, HASH_2)], pageStartPreviousEventHash: HASH_1 },
  ];
  for (const bad of badPages) {
    await assert.rejects(auditPage.listProjectAuditEvents({
      projectId: PROJECT_ID,
      cursor: null,
      limit: 20,
      repository: { listProjectEvents: async () => ({ ...bad, nextCursor: null }) },
    }), /audit|continuity|sequence|project/i);
  }
});

test("empty audit pages preserve the supplied continuity anchor", async () => {
  const auditPage = await loadAuditPageModule();
  const page = await auditPage.listProjectAuditEvents({
    projectId: PROJECT_ID,
    cursor: "cursor-after-3",
    limit: 20,
    repository: { listProjectEvents: async () => ({ items: [], nextCursor: null, pageStartPreviousEventHash: HASH_3 }) },
  });
  assert.equal(page.pageStartPreviousEventHash, HASH_3);
  assert.equal(page.pageEndEventHash, HASH_3);
  assert.deepEqual(page.items, []);
});
