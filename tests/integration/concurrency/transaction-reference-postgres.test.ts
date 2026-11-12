import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import pg from "pg";
import { PrismaTransactionSerialRepository } from "../../../src/modules/references/transaction-reference-repository.ts";
import { createTransactionReferenceAllocator } from "../../../src/modules/references/transaction-reference-service.ts";

const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
const enabled = databaseUrl ? undefined : "ORB_TEST_DATABASE_URL not supplied; real serial contention requires isolated PostgreSQL";
const uuidv7 = (): string => {
  const parts = randomUUID().split("-");
  parts[2] = `7${parts[2].slice(1)}`;
  parts[3] = `8${parts[3].slice(1)}`;
  return parts.join("-");
};

interface SerialRow {
  id: string; project_id: string; transaction_type: string; subject_id: string; serial: string;
  series_key: string; sequence_no: bigint; allocated_at: Date; allocated_by: string;
}

function postgresRepository(pool: pg.Pool): PrismaTransactionSerialRepository {
  return new PrismaTransactionSerialRepository({
    async $transaction<T>(work: (transaction: any) => Promise<T>, options: { isolationLevel: "Serializable" }): Promise<T> {
      assert.deepEqual(options, { isolationLevel: "Serializable" });
      const client = await pool.connect();
      try {
        await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
        const transaction = {
          $queryRawUnsafe: async (query: string, ...values: unknown[]) => (await client.query(query, values)).rows,
          transactionSerial: {
            findUnique: async ({ where }: any): Promise<SerialRow | null> => {
              const key = where.transaction_type_subject_id;
              const result = await client.query<SerialRow>(
                'SELECT * FROM "TransactionSerial" WHERE transaction_type = $1 AND subject_id = $2',
                [key.transaction_type, key.subject_id],
              );
              const found = result.rows[0];
              return found ? { ...found, sequence_no: BigInt(found.sequence_no) } : null;
            },
            findFirst: async ({ where }: any): Promise<Pick<SerialRow, "sequence_no"> | null> => {
              const result = await client.query<Pick<SerialRow, "sequence_no">>(
                'SELECT sequence_no FROM "TransactionSerial" WHERE series_key = $1 ORDER BY sequence_no DESC LIMIT 1',
                [where.series_key],
              );
              const found = result.rows[0];
              return found ? { sequence_no: BigInt(found.sequence_no) } : null;
            },
            create: async ({ data }: any): Promise<SerialRow> => {
              const result = await client.query<SerialRow>(`INSERT INTO "TransactionSerial"
                (id, project_id, transaction_type, subject_id, serial, series_key, sequence_no, allocated_at, allocated_by)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
                [data.id, data.project_id, data.transaction_type, data.subject_id, data.serial, data.series_key,
                  data.sequence_no.toString(), data.allocated_at, data.allocated_by]);
              return { ...result.rows[0], sequence_no: BigInt(result.rows[0].sequence_no) };
            },
          },
        };
        const result = await work(transaction);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  });
}

test("isolated PostgreSQL keeps 50 concurrent references unique and subject allocation immutable", { skip: enabled, timeout: 120_000 }, async () => {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 55 });
  const runId = randomUUID().slice(0, 8);
  const actorId = uuidv7();
  const partyId = uuidv7();
  const projectId = uuidv7();
  const subjectIds = Array.from({ length: 50 }, () => uuidv7());
  try {
    const currencyCode = `T${runId.slice(0, 2).toUpperCase()}`;
    await pool.query(`INSERT INTO "User" (id, auth_subject, name_ar, name_en, locale, status, mfa_state, updated_at)
      VALUES ($1, $2, 'مختبر الترقيم', 'Serial test', 'en', 'ACTIVE', 'ENABLED', now())`,
      [actorId, `t079-user-${runId}`]);
    await pool.query(`INSERT INTO "Party" (id, reference, legal_name_ar, legal_name_en, country_code, customer, supplier, status)
      VALUES ($1, $2, 'عميل اختبار', 'Serial test customer', 'AE', true, false, 'ACTIVE')`,
      [partyId, `T079-PARTY-${runId}`]);
    await pool.query('INSERT INTO "Currency" (id, code, decimals, active) VALUES ($1, $2, 2, true)',
      [uuidv7(), currencyCode]);
    await pool.query('INSERT INTO "Project" (id, reference, customer_id, management_currency) VALUES ($1, $2, $3, $4)',
      [projectId, `T079-PROJECT-${runId}`, partyId, currencyCode]);

    const repository = postgresRepository(pool);
    const allocator = createTransactionReferenceAllocator({
      repository, now: () => new Date("2026-11-12T12:00:00.000Z"), newId: uuidv7,
    });
    const records = await Promise.all(subjectIds.map((subjectId, index) => allocator.allocate({
      projectId, transactionType: "SALES_SHIPMENT", subjectId, allocatedBy: actorId,
      correlationId: `t079-concurrent-${index}`,
    })));

    assert.equal(new Set(records.map((record) => record.serial)).size, 50);
    assert.deepEqual(records.map((record) => Number(record.sequenceNo)).sort((a, b) => a - b),
      Array.from({ length: 50 }, (_, index) => index + 1));
    const persisted = await pool.query<{ count: string; distinct_serials: string; min_sequence: string; max_sequence: string }>(`
      SELECT count(*)::text AS count, count(DISTINCT serial)::text AS distinct_serials,
        min(sequence_no)::text AS min_sequence, max(sequence_no)::text AS max_sequence
      FROM "TransactionSerial" WHERE project_id = $1 AND transaction_type = 'SALES_SHIPMENT'`, [projectId]);
    assert.deepEqual(persisted.rows[0], { count: "50", distinct_serials: "50", min_sequence: "1", max_sequence: "50" });

    const replayAllocator = createTransactionReferenceAllocator({
      repository, now: () => new Date("2027-01-01T00:00:00.000Z"), newId: uuidv7,
    });
    const replay = await replayAllocator.allocate({ projectId, transactionType: "SALES_SHIPMENT", subjectId: subjectIds[0],
      allocatedBy: actorId, correlationId: "t079-year-boundary-replay" });
    assert.deepEqual(replay, records[0]);
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM "TransactionSerial" WHERE project_id = $1', [projectId])).rows[0].count, 50);
  } finally {
    await pool.query('DELETE FROM "TransactionSerial" WHERE project_id = $1', [projectId]).catch(() => undefined);
    await pool.query('DELETE FROM "Project" WHERE id = $1', [projectId]).catch(() => undefined);
    await pool.query('DELETE FROM "Party" WHERE id = $1', [partyId]).catch(() => undefined);
    await pool.query('DELETE FROM "User" WHERE id = $1', [actorId]).catch(() => undefined);
    await pool.end();
  }
});
