import {
  GetBucketVersioningCommand, GetObjectCommand, GetObjectLockConfigurationCommand, GetObjectRetentionCommand,
  PutObjectCommand, type S3Client,
} from "@aws-sdk/client-s3";

export interface ImmutableObjectPut {
  readonly objectKey: string;
  readonly body: AsyncIterable<Uint8Array> | Uint8Array;
  readonly contentType: string;
  readonly retentionUntil: string;
  readonly requireVersioning: true;
  readonly requireRetentionLock: true;
}

export interface ImmutableObjectIdentity {
  readonly objectKey: string;
  readonly objectVersionId: string;
  readonly retentionUntil: string;
  readonly sha256?: string;
  readonly byteLength?: number;
}

export interface ImmutableObjectRead {
  readonly body: unknown;
  readonly contentType: string;
  readonly byteLength: number;
}

export interface ImmutableObjectStore {
  putImmutable(input: ImmutableObjectPut): Promise<ImmutableObjectIdentity>;
  getImmutable(input: { readonly objectKey: string; readonly objectVersionId: string }): Promise<ImmutableObjectRead>;
}

export function assertImmutableObject(result: ImmutableObjectIdentity, expected: { objectKey: string; retentionUntil: string }): void {
  if (!result.objectVersionId?.trim()) throw new Error("object storage version lock is required");
  if (result.objectKey !== expected.objectKey) throw new Error("object storage version returned an unexpected object key");
  if (!result.retentionUntil || Date.parse(result.retentionUntil) < Date.parse(expected.retentionUntil)) {
    throw new Error("object storage retention lock is missing or too short");
  }
}


export class S3ImmutableObjectStore implements ImmutableObjectStore {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(client: S3Client, bucket: string) {
    this.client = client;
    this.bucket = bucket;
    if (!bucket.trim()) throw new TypeError("object-store bucket is required");
  }

  async putImmutable(input: ImmutableObjectPut): Promise<ImmutableObjectIdentity> {
    if (!input.requireVersioning || !input.requireRetentionLock) throw new Error("immutable object controls are required");
    const retentionDate = new Date(input.retentionUntil);
    if (!Number.isFinite(retentionDate.valueOf()) || retentionDate <= new Date()) throw new TypeError("future retention date is required");
    const [versioning, lock] = await Promise.all([
      this.client.send(new GetBucketVersioningCommand({ Bucket: this.bucket })),
      this.client.send(new GetObjectLockConfigurationCommand({ Bucket: this.bucket })),
    ]);
    if (versioning.Status !== "Enabled") throw new Error("object storage versioning is not enabled");
    if (lock.ObjectLockConfiguration?.ObjectLockEnabled !== "Enabled") throw new Error("object storage retention lock is not enabled");
    const result = await this.client.send(new PutObjectCommand({
      Bucket: this.bucket, Key: input.objectKey, Body: input.body as never, ContentType: input.contentType,
      ObjectLockMode: "COMPLIANCE", ObjectLockRetainUntilDate: retentionDate,
    }));
    if (!result.VersionId) throw new Error("object storage did not return a version id");
    const retained = await this.client.send(new GetObjectRetentionCommand({ Bucket: this.bucket, Key: input.objectKey, VersionId: result.VersionId }));
    const actualRetention = retained.Retention?.RetainUntilDate;
    if (retained.Retention?.Mode !== "COMPLIANCE" || !actualRetention || actualRetention < retentionDate) {
      throw new Error("object storage retention lock was not confirmed");
    }
    return { objectKey: input.objectKey, objectVersionId: result.VersionId, retentionUntil: actualRetention.toISOString() };
  }

  async getImmutable(input: { readonly objectKey: string; readonly objectVersionId: string }): Promise<ImmutableObjectRead> {
    if (!input.objectVersionId.trim()) throw new TypeError("immutable object version is required");
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: input.objectKey, VersionId: input.objectVersionId }));
    if (!result.Body) throw new Error("immutable object body is missing");
    return { body: result.Body, contentType: result.ContentType ?? "application/octet-stream", byteLength: result.ContentLength ?? 0 };
  }
}
