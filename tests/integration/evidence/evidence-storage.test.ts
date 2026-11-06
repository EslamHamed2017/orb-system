import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const EVIDENCE_ID = "019a5f9b-7c00-7000-8000-000000000101";
const SUBJECT_ID = "019a5f9b-7c00-7000-8000-000000000102";
const ACTOR_ID = "019a5f9b-7c00-7000-8000-000000000103";
const RETENTION_UNTIL = "2033-11-06T00:00:00.000Z";
const CONTENT = Buffer.from("immutable ORB evidence\n", "utf8");
const SHA256 = createHash("sha256").update(CONTENT).digest("hex");

interface HashStreamModule {
  streamAndHash(input: {
    source: AsyncIterable<Uint8Array>;
    maxBytes: number;
    write(chunk: Uint8Array): Promise<void>;
  }): Promise<{ sha256: string; byteLength: number }>;
}

interface EvidenceModule {
  uploadEvidence(input: Record<string, unknown>): Promise<Record<string, unknown>>;
}

async function loadHashStream(): Promise<HashStreamModule> {
  return import("../../../src/platform/object-store/hash-stream.ts") as Promise<HashStreamModule>;
}

async function loadEvidence(): Promise<EvidenceModule> {
  return import("../../../src/modules/evidence/evidence-service.ts") as Promise<EvidenceModule>;
}

async function* chunks(...values: readonly Uint8Array[]): AsyncIterable<Uint8Array> {
  for (const value of values) yield value;
}

function uploadInput(overrides: Record<string, unknown> = {}) {
  const persisted: Record<string, unknown>[] = [];
  const objectWrites: Record<string, unknown>[] = [];
  const auditEvents: Record<string, unknown>[] = [];
  const input = {
    id: EVIDENCE_ID,
    content: chunks(CONTENT.subarray(0, 7), CONTENT.subarray(7)),
    expectedSha256: SHA256,
    originalFilename: "origin-certificate.pdf",
    mediaType: "application/pdf",
    maxBytes: 1024,
    retentionUntil: RETENTION_UNTIL,
    sourceLink: { subjectType: "SalesShipment", subjectId: SUBJECT_ID, purpose: "ORIGIN_CERTIFICATE" },
    actor: { userId: ACTOR_ID, displayName: "Operations User", roles: ["OPERATIONS"] },
    transaction: { id: "evidence-upload-transaction" },
    malwareScanner: { scan: async () => ({ clean: true as const }) },
    objectStore: {
      putImmutable: async (request: Record<string, unknown>) => {
        const stored: Buffer[] = [];
        for await (const chunk of request.body as AsyncIterable<Uint8Array>) stored.push(Buffer.from(chunk));
        const bytes = Buffer.concat(stored);
        objectWrites.push({ ...request, body: bytes });
        return {
          objectKey: `evidence/${EVIDENCE_ID}`,
          objectVersionId: "version-0001",
          retentionUntil: RETENTION_UNTIL,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          byteLength: bytes.byteLength,
        };
      },
    },
    repository: {
      insertEvidence: async (_transaction: object, record: Record<string, unknown>) => { persisted.push(record); },
    },
    audit: { append: async (_transaction: object, event: Record<string, unknown>) => { auditEvents.push(event); } },
    ...overrides,
  };
  return { input, persisted, objectWrites, auditEvents };
}

test("streamAndHash hashes exact chunks while streaming and enforces the byte limit", async () => {
  const hashStream = await loadHashStream();
  const written: Buffer[] = [];
  const result = await hashStream.streamAndHash({
    source: chunks(CONTENT.subarray(0, 3), CONTENT.subarray(3, 11), CONTENT.subarray(11)),
    maxBytes: CONTENT.byteLength,
    write: async (chunk) => { written.push(Buffer.from(chunk)); },
  });
  assert.deepEqual(result, { sha256: SHA256, byteLength: CONTENT.byteLength });
  assert.deepEqual(Buffer.concat(written), CONTENT);

  await assert.rejects(hashStream.streamAndHash({
    source: chunks(CONTENT), maxBytes: CONTENT.byteLength - 1, write: async () => undefined,
  }), /size|bytes|limit/i);
});

test("upload retains immutable bytes with an object version and one typed source link", async () => {
  const evidence = await loadEvidence();
  const fixture = uploadInput();
  const metadata = await evidence.uploadEvidence(fixture.input);

  assert.equal(fixture.objectWrites.length, 1);
  assert.deepEqual(fixture.objectWrites[0], {
    body: CONTENT,
    contentType: "application/pdf",
    objectKey: `evidence/${EVIDENCE_ID}`,
    retentionUntil: RETENTION_UNTIL,
    requireVersioning: true,
    requireRetentionLock: true,
  });
  assert.equal(fixture.persisted.length, 1);
  assert.deepEqual(metadata, {
    id: EVIDENCE_ID,
    sha256: SHA256,
    byteLength: CONTENT.byteLength,
    mediaType: "application/pdf",
    originalFilename: "origin-certificate.pdf",
    verificationState: "PENDING",
    verifiedAt: null,
    verifiedBy: null,
    uploadedBy: fixture.input.actor,
    uploadedAt: metadata.uploadedAt,
    sourceLinks: [fixture.input.sourceLink],
    immutable: true,
    retentionUntil: RETENTION_UNTIL,
  });
  assert.equal((fixture.persisted[0] as Record<string, unknown>).objectVersionId, "version-0001");
  assert.equal(fixture.auditEvents.length, 1);
});

test("hash mismatch, malware, disallowed type, oversize, and missing object lock fail closed", async () => {
  const evidence = await loadEvidence();
  const cases: Array<[string, Record<string, unknown>]> = [
    ["hash", { expectedSha256: "0".repeat(64) }],
    ["malware", { malwareScanner: { scan: async () => ({ clean: false, signature: "test-signature" }) } }],
    ["type", { mediaType: "text/html" }],
    ["size", { maxBytes: CONTENT.byteLength - 1 }],
    ["version", { objectStore: { putImmutable: async () => ({ objectKey: "evidence/unlocked", objectVersionId: "", retentionUntil: null }) } }],
  ];

  for (const [label, override] of cases) {
    const fixture = uploadInput(override);
    await assert.rejects(evidence.uploadEvidence(fixture.input), /hash|malware|media|type|size|bytes|version|retention|lock/i, label);
    assert.equal(fixture.persisted.length, 0, `${label} must not persist evidence metadata`);
  }
});

test("EvidenceObject content identity is immutable while verification fields remain controlled", () => {
  const migration = readFileSync("prisma/migrations/202611050001_r1_initial/migration.sql", "utf8");
  assert.match(migration, /CREATE TRIGGER "EvidenceObject_immutable_content" BEFORE UPDATE ON "EvidenceObject"/);
  assert.match(migration, /orb_guard_immutable_content\('verification_state', 'verified_by', 'verified_at'\)/);
  assert.match(migration, /UNIQUE \(evidence_id, subject_type, subject_id, purpose\)/);
  assert.match(migration, /UNIQUE \(object_key, object_version_id\)/);
});
