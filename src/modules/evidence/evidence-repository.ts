export interface EvidenceSourceLink {
  readonly subjectType: string;
  readonly subjectId: string;
  readonly purpose: string;
  readonly projectId?: string;
  readonly authorizationParentType?: string;
  readonly authorizationParentId?: string;
}

export interface AuthorizedEvidenceSourceLink extends EvidenceSourceLink {
  readonly projectId: string;
  readonly authorizationParentType: string;
  readonly authorizationParentId: string;
}

export interface EvidenceListFilter {
  readonly projectId: string;
  readonly subjectType?: string;
  readonly subjectId?: string;
}

export interface StoredEvidence {
  readonly id: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly mediaType: string;
  readonly objectKey: string;
  readonly objectVersionId: string;
  readonly originalFilename: string;
  readonly verificationState: "PENDING" | "VERIFIED" | "REJECTED";
  readonly verifiedAt: string | null;
  readonly verifiedBy: unknown | null;
  readonly uploadedBy: unknown;
  readonly uploadedAt: string;
  readonly retentionUntil: string;
  readonly sourceLinks: readonly AuthorizedEvidenceSourceLink[];
  readonly projectId: string;
}

export interface EvidenceRepository<Transaction = unknown> {
  insertEvidence(transaction: Transaction, evidence: StoredEvidence): Promise<void>;
  findEvidenceById(id: string): Promise<StoredEvidence | null>;
  listEvidence(filter: EvidenceListFilter): Promise<readonly StoredEvidence[]>;
}

interface EvidenceRow {
  id: string; sha256: string; byte_length: bigint; media_type: string; object_key: string; object_version_id: string;
  original_filename: string; verification_state: "PENDING" | "VERIFIED" | "REJECTED"; verified_at: Date | null;
  verified_by: string | null; uploaded_by: string; uploaded_at: Date; retention_until: Date;
  project_id: string;
  EvidenceLink: Array<{ subject_type: string; subject_id: string; purpose: string; project_id: string; authorization_parent_type: string; authorization_parent_id: string }>;
}

export interface EvidencePrismaClient {
  evidenceObject: {
    create(args: Record<string, unknown>): Promise<unknown>;
    findUnique(args: Record<string, unknown>): Promise<EvidenceRow | null>;
    findMany(args: Record<string, unknown>): Promise<EvidenceRow[]>;
  };
}

export class PrismaEvidenceRepository implements EvidenceRepository<EvidencePrismaClient> {
  private readonly client: EvidencePrismaClient;
  constructor(client: EvidencePrismaClient) { this.client = client; }

  async insertEvidence(transaction: EvidencePrismaClient, evidence: StoredEvidence): Promise<void> {
    await transaction.evidenceObject.create({ data: {
      id: evidence.id, project_id: evidence.projectId, sha256: evidence.sha256, byte_length: BigInt(evidence.byteLength), media_type: evidence.mediaType,
      object_key: evidence.objectKey, object_version_id: evidence.objectVersionId, original_filename: evidence.originalFilename,
      verification_state: evidence.verificationState, verified_at: evidence.verifiedAt === null ? null : new Date(evidence.verifiedAt),
      verified_by: typeof evidence.verifiedBy === "string" ? evidence.verifiedBy : null,
      uploaded_by: (evidence.uploadedBy as { userId: string }).userId, uploaded_at: new Date(evidence.uploadedAt),
      retention_until: new Date(evidence.retentionUntil),
      EvidenceLink: { create: evidence.sourceLinks.map((link) => ({ project_id: link.projectId, subject_type: link.subjectType, subject_id: link.subjectId, authorization_parent_type: link.authorizationParentType, authorization_parent_id: link.authorizationParentId, purpose: link.purpose })) },
    } });
  }

  async findEvidenceById(id: string): Promise<StoredEvidence | null> {
    const row = await this.client.evidenceObject.findUnique({ where: { id }, include: { EvidenceLink: true } });
    if (row === null) return null;
    return mapEvidenceRow(row);
  }

  async listEvidence(filter: EvidenceListFilter): Promise<readonly StoredEvidence[]> {
    const links = filter.subjectType || filter.subjectId ? { some: {
      ...(filter.subjectType ? { subject_type: filter.subjectType } : {}),
      ...(filter.subjectId ? { subject_id: filter.subjectId } : {}),
    } } : undefined;
    const rows = await this.client.evidenceObject.findMany({
      where: { project_id: filter.projectId, ...(links ? { EvidenceLink: links } : {}) },
      include: { EvidenceLink: true },
      orderBy: [{ uploaded_at: "desc" }, { id: "asc" }],
    });
    return rows.map(mapEvidenceRow);
  }
}

function mapEvidenceRow(row: EvidenceRow): StoredEvidence {
  const byteLength = Number(row.byte_length);
  if (!Number.isSafeInteger(byteLength)) throw new Error("evidence byte length exceeds safe API range");
  return {
    id: row.id, projectId: row.project_id, sha256: row.sha256, byteLength, mediaType: row.media_type, objectKey: row.object_key,
    objectVersionId: row.object_version_id, originalFilename: row.original_filename, verificationState: row.verification_state,
    verifiedAt: row.verified_at?.toISOString() ?? null, verifiedBy: row.verified_by, uploadedBy: row.uploaded_by,
    uploadedAt: row.uploaded_at.toISOString(), retentionUntil: row.retention_until.toISOString(),
    sourceLinks: row.EvidenceLink.map((link) => ({ projectId: link.project_id, subjectType: link.subject_type, subjectId: link.subject_id, authorizationParentType: link.authorization_parent_type, authorizationParentId: link.authorization_parent_id, purpose: link.purpose })),
  };
}
