import assert from "node:assert/strict";
import test from "node:test";
import { completeProjectSetup, createProjectRecord, parseProjectRecords, recordProjectClaim, type ProjectRecord } from "../../../src/modules/projects/daily-projects.ts";
import { mutateProjectStorage } from "../../../src/modules/projects/browser-project-storage.ts";

class MemoryStorage {
  private value: string | null;
  constructor(records: readonly ProjectRecord[]) { this.value = JSON.stringify(records); }
  getItem() { return this.value; }
  setItem(_key: string, value: string) { this.value = value; }
}

function active(id: string, sequence: number): ProjectRecord {
  const draft = createProjectRecord({ customer: `Customer ${id}`, reference: `REF-${id}`, contractReference: `SC-${id}`, startDate: "2026-11-14", commodity: "Coffee", quantity: "1", unit: "MT", currency: "USD", unitPrice: "100", origin: "Mombasa", destination: "Dubai" }, { id, now: "2026-11-14T10:00:00.000Z", sequence });
  return completeProjectSetup(draft, { customer: `Customer ${id}`, supplier: `Supplier ${id}`, salesContractReference: `SC-${id}`, purchaseContractReference: `PC-${id}` }, "2026-11-14T11:00:00.000Z");
}

test("shared project storage lock serializes concurrent writes to different projects and preserves both", async () => {
  const storage = new MemoryStorage([active("one", 1), active("two", 2)]);
  let releaseFirst!: () => void;
  const firstPaused = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let firstEntered!: () => void;
  const entered = new Promise<void>((resolve) => { firstEntered = resolve; });
  const order: string[] = [];

  const first = mutateProjectStorage(storage, parseProjectRecords, async (records) => {
    order.push("first-start"); firstEntered(); await firstPaused; order.push("first-end");
    return { records: records.map((row) => row.id === "one" ? { ...row, origin: "Lamu" } : row), result: undefined };
  });
  await entered;
  const second = mutateProjectStorage(storage, parseProjectRecords, async (records) => {
    order.push("second-start");
    return { records: records.map((row) => row.id === "two" ? { ...row, destination: "Abu Dhabi" } : row), result: undefined };
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(order, ["first-start"]);
  releaseFirst();
  await Promise.all([first, second]);

  assert.deepEqual(order, ["first-start", "first-end", "second-start"]);
  const saved = parseProjectRecords(storage.getItem());
  assert.equal(saved.find((row) => row.id === "one")?.origin, "Lamu");
  assert.equal(saved.find((row) => row.id === "two")?.destination, "Abu Dhabi");
});

test("shared project storage lock retains claim expectedUpdatedAt conflict behavior", async () => {
  const initial = active("claim", 1);
  const storage = new MemoryStorage([initial]);
  const save = (reference: string) => mutateProjectStorage(storage, parseProjectRecords, (records) => {
    const index = records.findIndex((row) => row.id === initial.id);
    const updated = recordProjectClaim(records[index], { reference, type: "QUALITY", claimDate: "2026-11-14", claimant: "Customer claim", respondent: "Supplier claim", description: "Quality issue" }, reference === "FIRST" ? "2026-11-14T12:00:00.000Z" : "2026-11-14T13:00:00.000Z", initial.updatedAt);
    records[index] = updated;
    return { records, result: updated };
  });

  const outcomes = await Promise.allSettled([save("FIRST"), save("SECOND")]);
  assert.deepEqual(outcomes.map((outcome) => outcome.status), ["fulfilled", "rejected"]);
  const saved = parseProjectRecords(storage.getItem())[0];
  assert.deepEqual(saved.claims?.map((claim) => claim.reference), ["FIRST"]);
});


test("invalid mutation output is rejected before replacing valid project storage", async () => {
  const initial = active("valid", 1);
  const storage = new MemoryStorage([initial]);
  await assert.rejects(() => mutateProjectStorage(storage, parseProjectRecords, (records) => ({ records: [{ ...records[0], origin: "" }], result: undefined })), /CORRUPT_PROJECT_STORAGE/);
  assert.deepEqual(parseProjectRecords(storage.getItem()), [initial]);
});
