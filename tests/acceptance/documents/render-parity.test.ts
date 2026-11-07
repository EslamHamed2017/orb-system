import assert from "node:assert/strict";
import test from "node:test";

const sharedFields = Object.freeze({
  shipmentReference: "ORB-SAL-0009",
  customerReference: "PO-2026-0042",
  coffeeSpecification: "Arabica Grade 1",
  bagCount: 320,
  netWeight: "19200.000000",
  grossWeight: "19360.000000",
  origin: "ET",
  destination: "AE",
});
type Language = "AR" | "EN" | "BILINGUAL";
type RenderedDocument = Readonly<{
  bytes: Uint8Array;
  sha256: string;
  language: Language;
  direction: "rtl" | "ltr" | "mixed";
  sharedFields: typeof sharedFields;
}>;
interface RendererModule {
  renderCommercialDocument(input: Readonly<{
    kind: "CINV" | "PACKING_LIST";
    language: Language;
    sourceDatasetId: string;
    sharedFields: typeof sharedFields;
  }>): Promise<RenderedDocument>;
}
async function renderer(): Promise<RendererModule> {
  return import("../../../src/modules/documents/render/bilingual.ts") as Promise<RendererModule>;
}

test("English, Arabic and bilingual CINV/Packing outputs have byte-backed zero shared-field mismatch", async () => {
  const { renderCommercialDocument } = await renderer();
  for (const language of ["EN", "AR", "BILINGUAL"] as const) {
    const input = { language, sourceDatasetId: "019a5f9b-7c00-7000-8000-000000000901", sharedFields };
    const cinv = await renderCommercialDocument({ ...input, kind: "CINV" });
    const packing = await renderCommercialDocument({ ...input, kind: "PACKING_LIST" });
    assert.deepEqual(cinv.sharedFields, sharedFields);
    assert.deepEqual(packing.sharedFields, sharedFields);
    assert.deepEqual(cinv.sharedFields, packing.sharedFields, `${language} shared fields diverged`);
    assert.ok(cinv.bytes.byteLength > 0 && packing.bytes.byteLength > 0);
    assert.match(cinv.sha256, /^[a-f0-9]{64}$/);
    assert.match(packing.sha256, /^[a-f0-9]{64}$/);
    assert.notDeepEqual(cinv.bytes, packing.bytes);
    assert.equal(cinv.direction, language === "EN" ? "ltr" : language === "AR" ? "rtl" : "mixed");
    assert.equal(packing.direction, cinv.direction);
  }
});

test("rendering is deterministic for an exact dataset, kind and language", async () => {
  const { renderCommercialDocument } = await renderer();
  const input = {
    kind: "CINV" as const,
    language: "BILINGUAL" as const,
    sourceDatasetId: "019a5f9b-7c00-7000-8000-000000000901",
    sharedFields,
  };
  const first = await renderCommercialDocument(input);
  const second = await renderCommercialDocument(input);
  assert.equal(second.sha256, first.sha256);
  assert.deepEqual(second.bytes, first.bytes);
});
