import { createHash } from "node:crypto";
export type DocumentLanguage = "AR" | "EN" | "BILINGUAL";
export type DocumentKind = "CINV" | "PACKING_LIST";
export interface RenderedCommercialDocument {
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly language: DocumentLanguage;
  readonly direction: "rtl" | "ltr" | "mixed";
  readonly sharedFields: Readonly<Record<string, unknown>>;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export async function renderCommercialDocument(input: Readonly<{
  kind: DocumentKind;
  language: DocumentLanguage;
  sourceDatasetId: string;
  sharedFields: Readonly<Record<string, unknown>>;
}>): Promise<RenderedCommercialDocument> {
  // Keep the native Node test path free of runtime .tsx imports; the owned React templates consume this same canonical payload in Next.js.
  const payload = { kind: input.kind, language: input.language, sourceDatasetId: input.sourceDatasetId, sharedFields: structuredClone(input.sharedFields) };
  const bytes = new TextEncoder().encode(`ORB-COMMERCIAL-DOCUMENT-V1
${canonical(payload)}
`);
  return Object.freeze({
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    language: input.language,
    direction: input.language === "EN" ? "ltr" : input.language === "AR" ? "rtl" : "mixed",
    sharedFields: Object.freeze(structuredClone(input.sharedFields)),
  });
}
