import { createHash } from "node:crypto";

export interface StreamAndHashInput {
  readonly source: AsyncIterable<Uint8Array>;
  readonly maxBytes: number;
  readonly write: (chunk: Uint8Array) => Promise<void>;
}

export async function streamAndHash(input: StreamAndHashInput): Promise<{ sha256: string; byteLength: number }> {
  if (!Number.isSafeInteger(input.maxBytes) || input.maxBytes < 1) throw new RangeError("maxBytes must be a positive safe integer");
  const hash = createHash("sha256");
  let byteLength = 0;
  for await (const value of input.source) {
    const chunk = Buffer.from(value);
    byteLength += chunk.byteLength;
    if (byteLength > input.maxBytes) throw new RangeError("evidence size exceeds byte limit");
    hash.update(chunk);
    await input.write(chunk);
  }
  return { sha256: hash.digest("hex"), byteLength };
}
