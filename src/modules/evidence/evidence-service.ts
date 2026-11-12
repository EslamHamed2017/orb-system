import { createHash } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertImmutableObject, type ImmutableObjectStore } from "../../platform/object-store/client.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { streamAndHash } from "../../platform/object-store/hash-stream.ts";
import type { AuthorizedEvidenceSourceLink, EvidenceRepository, EvidenceSourceLink, StoredEvidence } from "./evidence-repository.ts";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { assertServerPermission, type OperationPrincipal } from "../access/permissions.ts";

const ALLOWED_MEDIA_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const SUBJECT_TYPES = new Set(["PROJECT", "CONTRACT", "SALES_SHIPMENT", "SUPPLIER_CONTAINER", "SALES_INVOICE", "SUPPLIER_INVOICE", "MONEY_MOVEMENT", "EXPENSE", "CLAIM", "COMMERCIAL_DOCUMENT", "ROUTE_CHECKLIST_ITEM", "APPROVAL"]);

interface Actor extends OperationPrincipal { readonly displayName?: string }
interface AuditAppender { append(...args: unknown[]): Promise<unknown> }
interface MalwareScanner { scan(bytes: Uint8Array): Promise<{ clean: boolean; signature?: string }> }

type Authorize = (input: { evidence: StoredEvidence; actor: Actor; sourceLinks: readonly AuthorizedEvidenceSourceLink[] }) => Promise<boolean>;
type ResolveSourceAuthorization = (input: { actor: Actor; sourceLink: EvidenceSourceLink }) => Promise<AuthorizedEvidenceSourceLink | null>;

function publicMetadata(evidence: StoredEvidence) {
  const { objectKey: _objectKey, objectVersionId: _objectVersionId, projectId: _projectId, retentionUntil: _retentionUntil, sourceLinks, ...metadata } = evidence;
  return { ...metadata, sourceLinks: sourceLinks.map(({ subjectType, subjectId, purpose }) => ({ subjectType, subjectId, purpose })), immutable: true, retentionUntil: evidence.retentionUntil };
}

function assertEvidenceId(value: string): void {
  if (!UUID.test(value)) throw new TypeError("invalid evidence identifier");
}

function hasValidEvidenceScope(evidence: StoredEvidence): boolean {
  return UUID.test(evidence.projectId)
    && evidence.sourceLinks.length > 0
    && evidence.sourceLinks.every((link) =>
      link.projectId === evidence.projectId
      && SUBJECT_TYPES.has(link.subjectType)
      && UUID.test(link.subjectId)
      && SUBJECT_TYPES.has(link.authorizationParentType)
      && UUID.test(link.authorizationParentId)
      && link.purpose.trim().length > 0);
}

async function loadAuthorized(input: {
  evidenceId: string; actor: Actor; repository: Pick<EvidenceRepository, "findEvidenceById">; authorize: Authorize;
}): Promise<StoredEvidence> {
  assertEvidenceId(input.evidenceId);
  const evidence = await input.repository.findEvidenceById(input.evidenceId);
  if (evidence === null) throw new Error("evidence not found");
  if (!hasValidEvidenceScope(evidence)) throw new Error("invalid evidence authorization scope");
  if (!await input.authorize({ evidence, actor: input.actor, sourceLinks: evidence.sourceLinks })) throw new Error("forbidden evidence access");
  return evidence;
}

export async function uploadEvidence<Transaction>(input: {
  id: string; content: AsyncIterable<Uint8Array>; expectedSha256: string; originalFilename: string; mediaType: string;
  maxBytes: number; retentionUntil: string; sourceLink: EvidenceSourceLink; actor: Actor; transaction: Transaction;
  resolveSourceAuthorization: ResolveSourceAuthorization; malwareScanner: MalwareScanner; objectStore: Pick<ImmutableObjectStore, "putImmutable">;
  repository: Pick<EvidenceRepository<Transaction>, "insertEvidence">; audit: AuditAppender; now?: () => Date;
}) {
  assertServerPermission(input.actor, "uploadEvidence");
  assertEvidenceId(input.id);
  if (!SHA256.test(input.expectedSha256)) throw new TypeError("invalid expected hash");
  if (!ALLOWED_MEDIA_TYPES.has(input.mediaType)) throw new TypeError("disallowed evidence media type");
  if (!SUBJECT_TYPES.has(input.sourceLink?.subjectType) || !UUID.test(input.sourceLink.subjectId) || !input.sourceLink.purpose.trim()) throw new TypeError("invalid evidence source link");
  const authorizedLink = await input.resolveSourceAuthorization({ actor: input.actor, sourceLink: input.sourceLink });
  if (authorizedLink === null) throw new Error("forbidden evidence source authorization");
  if (!UUID.test(authorizedLink.projectId) || !authorizedLink.authorizationParentType || !UUID.test(authorizedLink.authorizationParentId)
    || authorizedLink.subjectType !== input.sourceLink.subjectType || authorizedLink.subjectId !== input.sourceLink.subjectId
    || authorizedLink.purpose !== input.sourceLink.purpose) throw new TypeError("invalid resolved evidence source authorization");
  const retained: Buffer[] = [];
  const digest = await streamAndHash({ source: input.content, maxBytes: input.maxBytes, write: async (chunk) => { retained.push(Buffer.from(chunk)); } });
  const bytes = Buffer.concat(retained);
  if (digest.sha256 !== input.expectedSha256) throw new Error("evidence hash mismatch");
  const scan = await input.malwareScanner.scan(bytes);
  if (!scan.clean) throw new Error(`malware detected${scan.signature ? `: ${scan.signature}` : ""}`);

  const objectKey = `evidence/${input.id}`;
  async function* immutableBody(): AsyncIterable<Uint8Array> { yield bytes; }
  const stored = await input.objectStore.putImmutable({
    objectKey, body: immutableBody(), contentType: input.mediaType, retentionUntil: input.retentionUntil,
    requireVersioning: true, requireRetentionLock: true,
  });
  assertImmutableObject(stored, { objectKey, retentionUntil: input.retentionUntil });
  if (stored.sha256 !== undefined && stored.sha256 !== digest.sha256) throw new Error("object storage hash mismatch");
  if (stored.byteLength !== undefined && stored.byteLength !== digest.byteLength) throw new Error("object storage byte size mismatch");

  const uploadedAt = (input.now?.() ?? new Date()).toISOString();
  const record: StoredEvidence = {
    id: input.id, sha256: digest.sha256, byteLength: digest.byteLength, mediaType: input.mediaType, objectKey: stored.objectKey,
    objectVersionId: stored.objectVersionId, originalFilename: input.originalFilename, verificationState: "PENDING",
    verifiedAt: null, verifiedBy: null, uploadedBy: structuredClone(input.actor), uploadedAt,
    retentionUntil: stored.retentionUntil, projectId: authorizedLink.projectId, sourceLinks: [structuredClone(authorizedLink)],
  };
  await input.repository.insertEvidence(input.transaction, record);
  await input.audit.append(input.transaction, {
    action: "EVIDENCE_UPLOADED", evidenceId: record.id, actorId: input.actor.userId,
    afterHash: createHash("sha256").update(JSON.stringify(publicMetadata(record))).digest("hex"),
  });
  return publicMetadata(record);
}

export async function getEvidenceMetadata(input: {
  evidenceId: string; actor: Actor; repository: Pick<EvidenceRepository, "findEvidenceById">; authorize: Authorize;
}) {
  assertServerPermission(input.actor, "getEvidenceMetadata");
  return publicMetadata(await loadAuthorized(input));
}

export async function openEvidenceContent(input: {
  evidenceId: string; disposition: "inline" | "attachment"; actor: Actor;
  repository: Pick<EvidenceRepository, "findEvidenceById">; authorize: Authorize;
  objectStore: Pick<ImmutableObjectStore, "getImmutable">; audit: AuditAppender; correlationId?: string;
}) {
  assertServerPermission(input.actor, "viewOrDownloadEvidence");
  if (input.disposition !== "inline" && input.disposition !== "attachment") throw new TypeError("invalid evidence disposition");
  const evidence = await loadAuthorized(input);
  const content = await input.objectStore.getImmutable({ objectKey: evidence.objectKey, objectVersionId: evidence.objectVersionId });
  await input.audit.append({
    action: input.disposition === "inline" ? "EVIDENCE_VIEWED" : "EVIDENCE_DOWNLOADED",
    evidenceId: evidence.id, actorId: input.actor.userId, projectId: evidence.projectId ?? evidence.sourceLinks[0]?.subjectId,
    correlationId: input.correlationId,
  });
  return { ...content, disposition: input.disposition, filename: evidence.originalFilename };
}

export async function listEvidence(input: {
  actor: Actor; projectId: string; subjectType?: string; subjectId?: string;
  repository: Pick<EvidenceRepository, "listEvidence">; authorize: Authorize;
}) {
  assertServerPermission(input.actor, "listEvidence");
  if (!UUID.test(input.projectId)) throw new TypeError("invalid evidence project identifier");
  if ((input.subjectType === undefined) !== (input.subjectId === undefined)) throw new TypeError("evidence subject type and identifier must be supplied together");
  if (input.subjectId !== undefined && !UUID.test(input.subjectId)) throw new TypeError("invalid evidence subject identifier");
  const records = await input.repository.listEvidence({
    projectId: input.projectId,
    ...(input.subjectType ? { subjectType: input.subjectType, subjectId: input.subjectId } : {}),
  });
  const authorized: ReturnType<typeof publicMetadata>[] = [];
  for (const evidence of records) {
    if (evidence.projectId !== input.projectId || !hasValidEvidenceScope(evidence)) continue;
    if (await input.authorize({ evidence, actor: input.actor, sourceLinks: evidence.sourceLinks })) authorized.push(publicMetadata(evidence));
  }
  return authorized;
}
