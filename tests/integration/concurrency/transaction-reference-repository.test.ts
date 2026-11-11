import assert from "node:assert/strict";
import test from "node:test";
import { PrismaTransactionSerialRepository } from "../../../src/modules/references/transaction-reference-repository.ts";
import type { TransactionSerialRecord } from "../../../src/modules/references/transaction-reference-service.ts";

const record: TransactionSerialRecord = Object.freeze({
  id: "019a5f9b-7c00-7000-8000-000000009101", projectId: "019a5f9b-7c00-7000-8000-000000009102",
  transactionType: "SALES_INVOICE", subjectId: "019a5f9b-7c00-7000-8000-000000009103",
  serial: "ORB-SI-2026-000008", seriesKey: "SALES_INVOICE:2026", sequenceNo: 8n,
  allocatedAt: "2026-11-11T10:00:00.000Z", allocatedBy: "019a5f9b-7c00-7000-8000-000000009104",
});
const row = (value: TransactionSerialRecord) => ({
  id: value.id, project_id: value.projectId, transaction_type: value.transactionType,
  subject_id: value.subjectId, serial: value.serial, series_key: value.seriesKey,
  sequence_no: value.sequenceNo, allocated_at: new Date(value.allocatedAt), allocated_by: value.allocatedBy,
});

test("Prisma adapter serializes one series with a transaction-scoped PostgreSQL advisory lock", async () => {
  const calls: Array<{ query: string; values: unknown[] }> = [];
  let options: unknown;
  const transaction = {
    $queryRawUnsafe: async (query: string, ...values: unknown[]) => { calls.push({ query, values }); return []; },
    transactionSerial: {
      findUnique: async () => null,
      findFirst: async () => ({ sequence_no: 7n }),
      create: async () => row(record),
    },
  };
  const client = {
    $transaction: async <T>(work: (tx: typeof transaction) => Promise<T>, value: unknown) => { options = value; return work(transaction); },
  };
  const repository = new PrismaTransactionSerialRepository(client);
  const result = await repository.runSerializable("SALES_INVOICE:2026", async (locked) => {
    assert.equal(await locked.findBySubject("SALES_INVOICE", record.subjectId), null);
    assert.equal(await locked.nextSequence("SALES_INVOICE:2026"), 8n);
    return locked.insert(record);
  });
  assert.deepEqual(options, { isolationLevel: "Serializable" });
  assert.equal(calls.length, 2);
  assert.match(calls[0].query, /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);
  assert.deepEqual(calls[0].values, ["SALES_INVOICE:2026"]);
  assert.match(calls[1].query, /pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);
  assert.deepEqual(calls[1].values, [`subject:SALES_INVOICE:${record.subjectId}`]);
  assert.deepEqual(result, record);
});

test("Prisma adapter maps an existing immutable allocation and starts an empty series at one", async () => {
  const created: unknown[] = [];
  const transaction = {
    $queryRawUnsafe: async () => [],
    transactionSerial: {
      findUnique: async () => row(record),
      findFirst: async () => null,
      create: async (args: unknown) => { created.push(args); return row(record); },
    },
  };
  const repository = new PrismaTransactionSerialRepository({
    $transaction: async <T>(work: (tx: typeof transaction) => Promise<T>) => work(transaction),
  });
  await repository.runSerializable(record.seriesKey, async (locked) => {
    assert.deepEqual(await locked.findBySubject(record.transactionType, record.subjectId), record);
    assert.equal(await locked.nextSequence(record.seriesKey), 1n);
    await locked.insert(record);
  });
  assert.deepEqual(created, [{ data: {
    id: record.id, project_id: record.projectId, transaction_type: record.transactionType,
    subject_id: record.subjectId, serial: record.serial, series_key: record.seriesKey,
    sequence_no: record.sequenceNo, allocated_at: new Date(record.allocatedAt), allocated_by: record.allocatedBy,
  } }]);
});
