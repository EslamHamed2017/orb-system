import assert from "node:assert/strict";
import test from "node:test";
import { ProblemError } from "../../../src/platform/http/problem.ts";
import {
  createTransactionReferenceAllocator,
  type LockedTransactionSerialRepository,
  type TransactionSerialRecord,
  type TransactionSerialRepository,
  type TransactionType,
} from "../../../src/modules/references/transaction-reference-service.ts";

const PROJECT = "019a5f9b-7c00-7000-8000-000000009001";
const ACTOR = "019a5f9b-7c00-7000-8000-000000009002";
const CORRELATION = "serial-allocation-test";
const TYPES: readonly TransactionType[] = [
  "PROJECT", "SALES_CONTRACT", "PURCHASE_CONTRACT", "SALES_SHIPMENT", "SUPPLIER_CONTAINER",
  "SALES_INVOICE", "SUPPLIER_INVOICE", "COLLECTION", "SUPPLIER_PAYMENT", "EXPENSE",
];
const PREFIX: Readonly<Record<TransactionType, string>> = {
  PROJECT: "PRJ", SALES_CONTRACT: "SC", PURCHASE_CONTRACT: "PC", SALES_SHIPMENT: "SS",
  SUPPLIER_CONTAINER: "CONT", SALES_INVOICE: "SI", SUPPLIER_INVOICE: "PI", COLLECTION: "COL",
  SUPPLIER_PAYMENT: "PAY", EXPENSE: "EXP",
};
const id = (value: number) => `019a5f9b-7c00-7000-8000-${value.toString().padStart(12, "0")}`;

class MemoryRepository implements TransactionSerialRepository {
  readonly rows: TransactionSerialRecord[] = [];
  private tails = new Map<string, Promise<void>>();

  async runSerializable<T>(seriesKey: string, work: (locked: LockedTransactionSerialRepository) => Promise<T>): Promise<T> {
    const prior = this.tails.get(seriesKey) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.tails.set(seriesKey, prior.then(() => current));
    await prior;
    try {
      return await work({
        findBySubject: async (transactionType, subjectId) => this.rows.find((row) => row.transactionType === transactionType && row.subjectId === subjectId) ?? null,
        nextSequence: async (key) => BigInt(Math.max(0, ...this.rows.filter((row) => row.seriesKey === key).map((row) => Number(row.sequenceNo)))) + 1n,
        insert: async (row) => { this.rows.push(row); return row; },
      });
    } finally {
      release();
      if (this.tails.get(seriesKey) === current) this.tails.delete(seriesKey);
    }
  }
}

function subject(repository = new MemoryRepository()) {
  return { repository, allocator: createTransactionReferenceAllocator({
    repository,
    now: () => new Date("2026-11-11T09:30:00.000Z"),
    newId: () => id(990000 + repository.rows.length),
  }) };
}

test("allocator covers every core movement with a stable year-scoped human-readable series", async () => {
  const { allocator } = subject();
  for (const [index, transactionType] of TYPES.entries()) {
    const allocated = await allocator.allocate({ projectId: PROJECT, transactionType, subjectId: id(index + 1), allocatedBy: ACTOR, correlationId: CORRELATION });
    assert.equal(allocated.seriesKey, `${transactionType}:2026`);
    assert.equal(allocated.sequenceNo, 1n);
    assert.equal(allocated.serial, `ORB-${PREFIX[transactionType]}-2026-000001`);
    assert.equal(allocated.transactionType, transactionType);
  }
});

test("concurrent allocations in one series are unique, gap-free, and immutable", async () => {
  const { repository, allocator } = subject();
  const records = await Promise.all(Array.from({ length: 50 }, (_, index) => allocator.allocate({
    projectId: PROJECT, transactionType: "SALES_SHIPMENT", subjectId: id(index + 100), allocatedBy: ACTOR, correlationId: `${CORRELATION}-${index}`,
  })));
  assert.equal(new Set(records.map((row) => row.serial)).size, 50);
  assert.deepEqual(records.map((row) => Number(row.sequenceNo)).sort((a, b) => a - b), Array.from({ length: 50 }, (_, index) => index + 1));
  assert.equal(repository.rows.length, 50);
  assert.equal(records.find((row) => row.sequenceNo === 50n)?.serial, "ORB-SS-2026-000050");
});

test("repeated allocation for one subject returns the original immutable registry fact", async () => {
  const { repository, allocator } = subject();
  const input = { projectId: PROJECT, transactionType: "EXPENSE" as const, subjectId: id(800), allocatedBy: ACTOR, correlationId: CORRELATION };
  const first = await allocator.allocate(input);
  const replay = await allocator.allocate({ ...input, allocatedBy: id(801), correlationId: "replay" });
  assert.deepEqual(replay, first);
  assert.equal(repository.rows.length, 1);
});

test("allocator rejects unknown types, malformed identifiers, invalid dates, and cross-project subject reuse", async () => {
  const { allocator } = subject();
  const valid = { projectId: PROJECT, transactionType: "PROJECT" as const, subjectId: id(900), allocatedBy: ACTOR, correlationId: CORRELATION };
  await allocator.allocate(valid);
  const invalid = [
    { ...valid, transactionType: "INVENTORY" as TransactionType, subjectId: id(901) },
    { ...valid, projectId: "not-a-uuid", subjectId: id(902) },
  ];
  for (const input of invalid) await assert.rejects(allocator.allocate(input), (error: unknown) => error instanceof ProblemError && error.problem.code === "VALIDATION_FAILED");
  await assert.rejects(allocator.allocate({ ...valid, projectId: id(999) }), (error: unknown) => error instanceof ProblemError && error.problem.code === "SERIAL_SUBJECT_CONFLICT" && error.problem.status === 409);

  const badClock = createTransactionReferenceAllocator({ repository: new MemoryRepository(), now: () => new Date("invalid") });
  await assert.rejects(badClock.allocate({ ...valid, subjectId: id(903) }), (error: unknown) => error instanceof Error && error.message === "transaction reference clock returned an invalid date");
});
