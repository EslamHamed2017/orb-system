export interface EvidenceSourceLink {
  readonly subjectType: string;
  readonly subjectId: string;
  readonly purpose: string;
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
  readonly sourceLinks: readonly EvidenceSourceLink[];
  readonly projectId?: string;
}

export interface EvidenceRepository<Transaction = unknown> {
  insertEvidence(transaction: Transaction, evidence: StoredEvidence): Promise<void>;
  findEvidenceById(id: string): Promise<StoredEvidence | null>;
}

interface EvidenceRow {
  id: string; sha256: string; byte_length: bigint; media_type: string; object_key: string; object_version_id: string;
  original_filename: string; verification_state: "PENDING" | "VERIFIED" | "REJECTED"; verified_at: Date | null;
  verified_by: string | null; uploaded_by: string; uploaded_at: Date; retention_until: Date;
  EvidenceLink: Array<{ subject_type: string; subject_id: string; purpose: string }>;
}

export interface EvidencePrismaClient {
  evidenceObject: {
    create(args: Record<string, unknown>): Promise<unknown>;
    findUnique(args: Record<string, unknown>): Promise<EvidenceRow | null>;
  };
}

export class PrismaEvidenceRepository implements EvidenceRepository<EvidencePrismaClient> {
  private readonly client: EvidencePrismaClient;
  constructor(client: EvidencePrismaClient) { this.client = client; }

  async insertEvidence(transaction: EvidencePrismaClient, evidence: StoredEvidence): Promise<void> {
    await transaction.evidenceObject.create({ data: {
      id: evidence.id, sha256: evidence.sha256, byte_length: BigInt(evidence.byteLength), media_type: evidence.mediaType,
      object_key: evidence.objectKey, object_version_id: evidence.objectVersionId, original_filename: evidence.originalFilename,
      verification_state: evidence.verificationState, verified_at: evidence.verifiedAt === null ? null : new Date(evidence.verifiedAt),
      verified_by: typeof evidence.verifiedBy === "string" ? evidence.verifiedBy : null,
      uploaded_by: (evidence.uploadedBy as { userId: string }).userId, uploaded_at: new Date(evidence.uploadedAt),
      retention_until: new Date(evidence.retentionUntil),
      EvidenceLink: { create: evidence.sourceLinks.map((link) => ({ subject_type: link.subjectType, subject_id: link.subjectId, purpose: link.purpose })) },
    } });
  }

  async findEvidenceById(id: string): Promise<StoredEvidence | null> {
    const row = await this.client.evidenceObject.findUnique({ where: { id }, include: { EvidenceLink: true } });
    if (row === null) return null;
    const byteLength = Number(row.byte_length);
    if (!Number.isSafeInteger(byteLength)) throw new Error("evidence byte length exceeds safe API range");
    return {
      id: row.id, sha256: row.sha256, byteLength, mediaType: row.media_type, objectKey: row.object_key,
      objectVersionId: row.object_version_id, originalFilename: row.original_filename, verificationState: row.verification_state,
      verifiedAt: row.verified_at?.toISOString() ?? null, verifiedBy: row.verified_by, uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at.toISOString(), retentionUntil: row.retention_until.toISOString(),
      sourceLinks: row.EvidenceLink.map((link) => ({ subjectType: link.subject_type, subjectId: link.subject_id, purpose: link.purpose })),
    };
  }
}
