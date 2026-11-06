import assert from "node:assert/strict";
import test from "node:test";
import { runSerializable } from "../../../src/platform/database/transaction.ts";
import { CurrencyAmount, DecimalAmount } from "../../../src/platform/decimal/index.ts";

test("exact decimal arithmetic never converts fractional quantities or money to binary floats", () => {
  assert.equal(DecimalAmount.parse("0.1").add(DecimalAmount.parse("0.2")).toString(), "0.3");
  assert.equal(DecimalAmount.parse("999999999999999999.999999").add(DecimalAmount.parse("0.000001")).toString(), "1000000000000000000");
  assert.equal(DecimalAmount.parse("12.50").subtract(DecimalAmount.parse("2.125")).toString(), "10.375");
  assert.equal(DecimalAmount.parse("3.25").multiply(DecimalAmount.parse("4")).toString(), "13");
  assert.throws(() => DecimalAmount.parse(0.1), /safe integers/);
});

test("currency arithmetic preserves ISO currency partitions and rejects silent cross-currency sums", () => {
  assert.equal(CurrencyAmount.parse("usd", "10.10").add(CurrencyAmount.parse("USD", "0.90")).amount.toString(), "11");
  assert.throws(() => CurrencyAmount.parse("USD", "1").add(CurrencyAmount.parse("AED", "1")), /unlike currencies/);
  assert.throws(() => CurrencyAmount.parse("US", "1"), /ISO currency/);
});

test("serializable conflicts retry in a fresh transaction and eventually commit one result", async () => {
  let attempts = 0;
  const retries: number[] = [];
  const result = await runSerializable(async (work) => {
    attempts++;
    return work({ attempt: attempts });
  }, async (transaction) => {
    if (transaction.attempt < 3) throw Object.assign(new Error("serialization conflict"), { code: "40001" });
    return `committed-${transaction.attempt}`;
  }, { maxAttempts: 3, baseDelayMs: 0, onRetry: (_error, attempt) => { retries.push(attempt); } });

  assert.equal(result, "committed-3");
  assert.equal(attempts, 3);
  assert.deepEqual(retries, [1, 2]);
});

test("deadlocks and Prisma transaction conflicts retry, while ordinary failures do not", async () => {
  for (const code of ["40P01", "P2034"]) {
    let attempts = 0;
    await runSerializable(async (work) => work(++attempts), async (attempt) => {
      if (attempt === 1) throw Object.assign(new Error(code), { code });
      return attempt;
    }, { baseDelayMs: 0 });
    assert.equal(attempts, 2);
  }

  let ordinaryAttempts = 0;
  const ordinary = new Error("validation failed");
  await assert.rejects(runSerializable(async (work) => work(++ordinaryAttempts), async () => { throw ordinary; },
    { maxAttempts: 5, baseDelayMs: 0 }), (error) => error === ordinary);
  assert.equal(ordinaryAttempts, 1);
});

test("serializable retry stops at the configured bound and preserves the final conflict", async () => {
  let attempts = 0;
  await assert.rejects(runSerializable(async (work) => work(++attempts), async () => {
    throw Object.assign(new Error(`conflict-${attempts}`), { code: "40001" });
  }, { maxAttempts: 2, baseDelayMs: 0 }), /conflict-2/);
  assert.equal(attempts, 2);
});
