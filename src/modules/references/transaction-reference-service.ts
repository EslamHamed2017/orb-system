import { randomUUID } from "node:crypto";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { problemError } from "../../platform/http/problem.ts";

export const TRANSACTION_TYPES = [
  "PROJECT", "SALES_CONTRACT", "PURCHASE_CONTRACT", "SALES_SHIPMENT", "SUPPLIER_CONTAINER",
  "SALES_INVOICE", "SUPPLIER_INVOICE", "COLLECTION", "SUPPLIER_PAYMENT", "EXPENSE",
] as const;
export type TransactionType = typeof TRANSACTION_TYPES[number];

const PREFIX: Readonly<Record<TransactionType, string>> = Object.freeze({
  PROJECT: "PRJ", SALES_CONTRACT: "SC", PURCHASE_CONTRACT: "PC", SALES_SHIPMENT: "SS",
  SUPPLIER_CONTAINER: "CONT", SALES_INVOICE: "SI", SUPPLIER_INVOICE: "PI", COLLECTION: "COL",
  SUPPLIER_PAYMENT: "PAY", EXPENSE: "EXP",
});

export interface TransactionSerialRecord {
  readonly id: string;
  readonly projectId: string;
  readonly transactionType: TransactionType;
  readonly subjectId: string;
  readonly serial: string;
  readonly seriesKey: string;
  readonly sequenceNo: bigint;
  readonly allocatedAt: string;
  readonly allocatedBy: string;
}

export interface LockedTransactionSerialRepository {
  findBySubject(transactionType: TransactionType, subjectId: string): Promise<TransactionSerialRecord | null>;
  nextSequence(seriesKey: string): Promise<bigint>;
  insert(record: TransactionSerialRecord): Promise<TransactionSerialRecord>;
}

export interface TransactionSerialRepository {
  runSerializable<T>(seriesKey: string, work: (locked: LockedTransactionSerialRepository) => Promise<T>): Promise<T>;
}

export interface TransactionReferenceInput {
  readonly projectId: string;
  readonly transactionType: TransactionType;
  readonly subjectId: string;
  readonly allocatedBy: string;
  readonly correlationId: string;
}

export interface TransactionReferenceAllocator {
  allocate(input: TransactionReferenceInput): Promise<TransactionSerialRecord>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPE_SET = new Set<string>(TRANSACTION_TYPES);
const MAX_SEQUENCE = 999999n;

function fail(code: string, status: number, correlationId: string): never {
  throw problemError({ code, status, correlationId });
}

function validateId(value: string, correlationId: string): void {
  if (!UUID.test(value)) fail("VALIDATION_FAILED", 400, correlationId);
}

function reference(type: TransactionType, year: number, sequenceNo: bigint): string {
  return `ORB-${PREFIX[type]}-${year}-${sequenceNo.toString().padStart(6, "0")}`;
}

export function createTransactionReferenceAllocator(options: {
  readonly repository: TransactionSerialRepository;
  readonly now?: () => Date;
  readonly newId?: () => string;
}): TransactionReferenceAllocator {
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? randomUUID;
  return Object.freeze({
    async allocate(input: TransactionReferenceInput) {
      validateId(input.projectId, input.correlationId);
      validateId(input.subjectId, input.correlationId);
      validateId(input.allocatedBy, input.correlationId);
      if (!TYPE_SET.has(input.transactionType)) fail("VALIDATION_FAILED", 400, input.correlationId);
      const allocatedAt = now();
      if (Number.isNaN(allocatedAt.getTime())) throw new Error("transaction reference clock returned an invalid date");
      const year = allocatedAt.getUTCFullYear();
      const seriesKey = `${input.transactionType}:${year}`;
      return options.repository.runSerializable(seriesKey, async (locked) => {
        const existing = await locked.findBySubject(input.transactionType, input.subjectId);
        if (existing) {
          if (existing.projectId !== input.projectId) fail("SERIAL_SUBJECT_CONFLICT", 409, input.correlationId);
          return existing;
        }
        const sequenceNo = await locked.nextSequence(seriesKey);
        if (sequenceNo < 1n || sequenceNo > MAX_SEQUENCE) fail("SERIAL_SERIES_EXHAUSTED", 409, input.correlationId);
        return locked.insert(Object.freeze({
          id: newId(), projectId: input.projectId, transactionType: input.transactionType,
          subjectId: input.subjectId, serial: reference(input.transactionType, year, sequenceNo),
          seriesKey, sequenceNo, allocatedAt: allocatedAt.toISOString(), allocatedBy: input.allocatedBy,
        }));
      });
    },
  });
}
