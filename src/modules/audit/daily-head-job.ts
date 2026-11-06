import { createHash } from "node:crypto";
// @ts-expect-error Node native TypeScript execution requires the source extension.
import { canonicalizeJson } from "../../platform/canonical-json/rfc8785.ts";

export interface ProjectAuditHead {
  readonly projectId: string;
  readonly sequenceNo: number;
  readonly eventHash: string;
}

export interface DailyHeadRepository {
  listLatestProjectHeads(asOf: Date): Promise<readonly ProjectAuditHead[]>;
}

export interface DailyHeadSigner {
  readonly keyId: string;
  sign(bytes: Uint8Array): Promise<Uint8Array>;
}

export interface ImmutableHeadStore {
  putIfAbsent(input: {
    readonly key: string;
    readonly body: Uint8Array;
    readonly contentType: "application/json";
    readonly sha256: string;
    readonly retainUntil: Date;
  }): Promise<{ readonly versionId: string }>;
}

export async function retainSignedDailyAuditHead(input: {
  readonly day: string;
  readonly generatedAt: Date;
  readonly retainUntil: Date;
  readonly repository: DailyHeadRepository;
  readonly signer: DailyHeadSigner;
  readonly store: ImmutableHeadStore;
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) throw new TypeError("daily audit head requires an ISO calendar day");
  const heads = [...await input.repository.listLatestProjectHeads(input.generatedAt)].sort((a, b) => a.projectId.localeCompare(b.projectId));
  for (let index = 1; index < heads.length; index += 1) {
    if (heads[index - 1]!.projectId === heads[index]!.projectId) throw new Error("duplicate Project daily audit head");
  }
  const payload = { day: input.day, generatedAt: input.generatedAt.toISOString(), algorithm: "SHA-256", heads };
  const payloadBytes = Buffer.from(canonicalizeJson(payload), "utf8");
  const payloadSha256 = createHash("sha256").update(payloadBytes).digest("hex");
  const signature = await input.signer.sign(payloadBytes);
  const envelope = {
    payload,
    payloadSha256,
    signature: { algorithm: "external-asymmetric-signature", keyId: input.signer.keyId, value: Buffer.from(signature).toString("base64") },
  };
  const body = Buffer.from(canonicalizeJson(envelope), "utf8");
  const sha256 = createHash("sha256").update(body).digest("hex");
  const key = `audit-heads/${input.day}.json`;
  const stored = await input.store.putIfAbsent({ key, body, contentType: "application/json", sha256, retainUntil: input.retainUntil });
  return { key, versionId: stored.versionId, sha256, payloadSha256, projectCount: heads.length };
}
