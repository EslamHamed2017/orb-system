import { createHash } from "node:crypto";
import { S3Client } from "@aws-sdk/client-s3";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { S3ImmutableObjectStore, assertImmutableObject, type ImmutableObjectStore } from "../../platform/object-store/client.ts";
import type { SqlTransaction } from "../shipments/execution/shipment-execution-store.ts";

/**
 * Business documents (supplier invoices, later contracts/BLs/receipts) stored immutably in
 * S3-compatible storage with versioning and a compliance retention lock. The database keeps the
 * hash, size, type, object version and who uploaded it; the file itself can never be replaced.
 */

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MEDIA: Record<string, (bytes: Buffer) => boolean> = {
  "application/pdf": (b) => b.subarray(0, 5).toString("latin1") === "%PDF-",
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
};

export class DocumentStorageError extends Error {
  readonly code: "INVALID_DOCUMENT" | "STORAGE_UNAVAILABLE" | "NOT_FOUND";
  constructor(code: DocumentStorageError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export interface UploadedDocument {
  readonly bytes: Buffer;
  readonly filename: string;
  readonly mediaType: string;
}

/** Validates type by content (not just the extension), size, and file name. */
export async function readDocument(file: unknown): Promise<UploadedDocument> {
  if (!file || typeof file !== "object" || typeof (file as Blob).arrayBuffer !== "function") throw new DocumentStorageError("INVALID_DOCUMENT", "Attach the invoice document (PDF, JPG or PNG).");
  const blob = file as File;
  if (blob.size === 0) throw new DocumentStorageError("INVALID_DOCUMENT", "The attached file is empty.");
  if (blob.size > MAX_DOCUMENT_BYTES) throw new DocumentStorageError("INVALID_DOCUMENT", "The attached file is larger than 10 MB.");
  const bytes = Buffer.from(await blob.arrayBuffer());
  const mediaType = Object.keys(MEDIA).find((type) => MEDIA[type](bytes));
  if (!mediaType) throw new DocumentStorageError("INVALID_DOCUMENT", "Only PDF, JPG or PNG files are accepted.");
  const filename = (typeof blob.name === "string" && blob.name.trim() ? blob.name : "document").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 200);
  return { bytes, filename, mediaType };
}

let store: ImmutableObjectStore | undefined;

export function documentObjectStore(env: Record<string, string | undefined> = process.env): ImmutableObjectStore {
  if (store) return store;
  const { OBJECT_STORAGE_ENDPOINT: endpoint, OBJECT_STORAGE_REGION: region, OBJECT_STORAGE_BUCKET: bucket, OBJECT_STORAGE_ACCESS_KEY_ID: accessKeyId, OBJECT_STORAGE_SECRET_ACCESS_KEY: secretAccessKey } = env;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) throw new DocumentStorageError("STORAGE_UNAVAILABLE", "Document storage is not configured.");
  store = new S3ImmutableObjectStore(new S3Client({ endpoint, region: region ?? "us-east-1", forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } }), bucket);
  return store;
}

/** For tests: swap the object store. */
export function setDocumentObjectStore(next: ImmutableObjectStore | undefined) { store = next; }

function retentionUntil(now: Date, env: Record<string, string | undefined> = process.env): string {
  const days = Number(env.ORB_EVIDENCE_RETENTION_DAYS ?? 3650);
  return new Date(now.getTime() + (Number.isFinite(days) && days > 0 ? days : 3650) * 86_400_000).toISOString();
}

/** Puts the bytes in immutable storage. Call before the database transaction (an orphaned immutable object is harmless). */
export async function putDocument(document: UploadedDocument, evidenceId: string, now = new Date()) {
  const objectKey = `evidence/${evidenceId}`;
  const retention = retentionUntil(now);
  let stored;
  try {
    stored = await documentObjectStore().putImmutable({ objectKey, body: document.bytes, contentType: document.mediaType, retentionUntil: retention, requireVersioning: true, requireRetentionLock: true });
  } catch (error) {
    if (error instanceof DocumentStorageError) throw error;
    console.error("document storage put failed", error instanceof Error ? error.message : "unknown");
    throw new DocumentStorageError("STORAGE_UNAVAILABLE", "The document could not be stored. Try again in a moment.");
  }
  assertImmutableObject(stored, { objectKey, retentionUntil: retention });
  return { objectKey, objectVersionId: stored.objectVersionId, retentionUntil: stored.retentionUntil, sha256: createHash("sha256").update(document.bytes).digest("hex"), byteLength: document.bytes.byteLength };
}

/** Records the stored document and links it to its business record, inside the caller's transaction. */
export async function recordDocument(tx: SqlTransaction, input: {
  evidenceId: string; projectId: string; actorId: string; document: UploadedDocument; stored: Awaited<ReturnType<typeof putDocument>>;
  subjectType: string; subjectId: string; purpose: string; parentType: string; parentId: string;
}) {
  await tx.$executeRawUnsafe(
    `INSERT INTO "EvidenceObject" ("id","project_id","sha256","byte_length","media_type","object_key","object_version_id","original_filename","uploaded_by","retention_until")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::timestamptz)`,
    input.evidenceId, input.projectId, input.stored.sha256, input.stored.byteLength, input.document.mediaType, input.stored.objectKey,
    input.stored.objectVersionId, input.document.filename, input.actorId, input.stored.retentionUntil);
  await tx.$executeRawUnsafe(
    `INSERT INTO "EvidenceLink" ("evidence_id","project_id","subject_type","subject_id","authorization_parent_type","authorization_parent_id","purpose")
     VALUES ($1,$2,$3::"EvidenceSubjectType",$4,$5::"EvidenceSubjectType",$6,$7)`,
    input.evidenceId, input.projectId, input.subjectType, input.subjectId, input.parentType, input.parentId, input.purpose);
}

/** Streams a document to a signed-in user of the same tenant. */
export async function openDocument(client: SqlTransaction, tenantId: string, evidenceId: string) {
  const row = (await client.$queryRawUnsafe<Array<{ object_key: string; object_version_id: string; media_type: string; original_filename: string }>>(
    `SELECT e."object_key", e."object_version_id", e."media_type", e."original_filename" FROM "EvidenceObject" e JOIN "Project" p ON p."id" = e."project_id"
      WHERE e."id" = $1 AND p."tenant_id" = $2`, evidenceId, tenantId))[0];
  if (!row) throw new DocumentStorageError("NOT_FOUND", "Document not found.");
  const object = await documentObjectStore().getImmutable({ objectKey: row.object_key, objectVersionId: row.object_version_id });
  const body = object.body as { transformToByteArray?: () => Promise<Uint8Array> };
  const bytes = body.transformToByteArray ? await body.transformToByteArray() : new Uint8Array(await new Response(object.body as BodyInit).arrayBuffer());
  return { bytes, contentType: row.media_type, filename: row.original_filename };
}
