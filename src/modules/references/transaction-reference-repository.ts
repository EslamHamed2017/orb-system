// @ts-expect-error Native Node TypeScript tests require source extensions.
import { runSerializable } from "../../platform/database/transaction.ts";
import type {
  LockedTransactionSerialRepository,
  TransactionSerialRecord,
  TransactionSerialRepository,
  TransactionType,
} from "./transaction-reference-service.ts";

interface TransactionSerialRow {
  id: string;
  project_id: string;
  transaction_type: TransactionType;
  subject_id: string;
  serial: string;
  series_key: string;
  sequence_no: bigint;
  allocated_at: Date;
  allocated_by: string;
}

export interface TransactionSerialPrismaTransaction {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  transactionSerial: {
    findUnique(args: Record<string, unknown>): Promise<TransactionSerialRow | null>;
    findFirst(args: Record<string, unknown>): Promise<Pick<TransactionSerialRow, "sequence_no"> | null>;
    create(args: Record<string, unknown>): Promise<TransactionSerialRow>;
  };
}

export interface TransactionSerialPrismaClient {
  $transaction<T>(
    work: (transaction: TransactionSerialPrismaTransaction) => Promise<T>,
    options: { isolationLevel: "Serializable" },
  ): Promise<T>;
}

function toRecord(row: TransactionSerialRow): TransactionSerialRecord {
  return Object.freeze({
    id: row.id,
    projectId: row.project_id,
    transactionType: row.transaction_type,
    subjectId: row.subject_id,
    serial: row.serial,
    seriesKey: row.series_key,
    sequenceNo: row.sequence_no,
    allocatedAt: row.allocated_at.toISOString(),
    allocatedBy: row.allocated_by,
  });
}

export class PrismaTransactionSerialRepository implements TransactionSerialRepository {
  private readonly client: TransactionSerialPrismaClient;
  constructor(client: TransactionSerialPrismaClient) { this.client = client; }

  async runSerializable<T>(seriesKey: string, work: (locked: LockedTransactionSerialRepository) => Promise<T>): Promise<T> {
    return runSerializable<TransactionSerialPrismaTransaction, T>(
      (transactionWork) => this.client.$transaction(transactionWork, { isolationLevel: "Serializable" }),
      async (transaction) => {
        await transaction.$queryRawUnsafe(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          seriesKey,
        );
        const locked: LockedTransactionSerialRepository = {
          async findBySubject(transactionType, subjectId) {
            // An absent registry row cannot be locked. This advisory lock serializes the same
            // immutable subject even if concurrent calls straddle two year-scoped series.
            await transaction.$queryRawUnsafe(
              "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
              `subject:${transactionType}:${subjectId}`,
            );
            const row = await transaction.transactionSerial.findUnique({
              where: { transaction_type_subject_id: { transaction_type: transactionType, subject_id: subjectId } },
            });
            return row === null ? null : toRecord(row);
          },
          async nextSequence(requestedSeriesKey) {
            if (requestedSeriesKey !== seriesKey) throw new Error("transaction serial series lock mismatch");
            const tail = await transaction.transactionSerial.findFirst({
              where: { series_key: seriesKey }, orderBy: { sequence_no: "desc" }, select: { sequence_no: true },
            });
            return (tail?.sequence_no ?? 0n) + 1n;
          },
          async insert(record) {
            if (record.seriesKey !== seriesKey) throw new Error("transaction serial series lock mismatch");
            const row = await transaction.transactionSerial.create({ data: {
              id: record.id,
              project_id: record.projectId,
              transaction_type: record.transactionType,
              subject_id: record.subjectId,
              serial: record.serial,
              series_key: record.seriesKey,
              sequence_no: record.sequenceNo,
              allocated_at: new Date(record.allocatedAt),
              allocated_by: record.allocatedBy,
            } });
            return toRecord(row);
          },
        };
        return work(locked);
      },
    );
  }
}
