import assert from "node:assert/strict";
import test from "node:test";
import * as commandPlatform from "../../../src/platform/http/command.ts";
import { ProblemError } from "../../../src/platform/http/problem.ts";
import {
  InMemoryIdempotencyStore,
  executeIdempotently,
} from "../../../src/platform/idempotency/store.ts";

const KEY = "0123456789abcdef";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accepted) => { resolve = accepted; });
  return { promise, resolve };
}

test("concurrent identical commands execute one effect and replay the stored response", async () => {
  const store = new InMemoryIdempotencyStore();
  const release = deferred<void>();
  let effects = 0;
  const invoke = () => executeIdempotently(store, {
    actorId: "actor-1",
    operationId: "confirmSalesShipment",
    key: KEY,
    request: { shipmentId: "shipment-1", expectedVersion: 7 },
    correlationId: "correlation-1",
  }, async () => {
    effects++;
    await release.promise;
    return { status: 200, value: { version: 8 } };
  });

  const owner = invoke();
  const duplicate = invoke();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(effects, 1, "a concurrent replay must not execute a duplicate effect");
  release.resolve();

  assert.deepEqual(await owner, { status: 200, value: { version: 8 }, replayed: false });
  assert.deepEqual(await duplicate, { status: 200, value: { version: 8 }, replayed: true });
  assert.deepEqual(await invoke(), { status: 200, value: { version: 8 }, replayed: true });
  assert.equal(effects, 1);
});

test("same actor/operation/key with a changed request fails as IDEMPOTENCY_KEY_REUSED", async () => {
  const store = new InMemoryIdempotencyStore();
  const base = { actorId: "actor-1", operationId: "recordMoneyMovement", key: KEY, correlationId: "correlation-2" };
  await executeIdempotently(store, { ...base, request: { amount: "10.00", currency: "USD" } },
    async () => ({ status: 201, value: { id: "movement-1" } }));

  await assert.rejects(
    executeIdempotently(store, { ...base, request: { amount: "11.00", currency: "USD" } },
      async () => ({ status: 201, value: { id: "movement-2" } })),
    (error: unknown) => error instanceof ProblemError
      && error.problem.status === 409
      && error.problem.code === "IDEMPOTENCY_KEY_REUSED"
      && error.problem.correlationId === "correlation-2",
  );
});

test("quoted If-Match accepts one positive aggregate version and fails closed otherwise", () => {
  const parseQuotedIfMatch = (commandPlatform as Record<string, unknown>).parseQuotedIfMatch;
  assert.equal(typeof parseQuotedIfMatch, "function", "ORB-R1-0204 must export parseQuotedIfMatch");
  const parse = parseQuotedIfMatch as (value: string | null | undefined, context?: unknown) => number;
  assert.equal(parse('"12"'), 12);
  for (const value of [undefined, null, "", "12", 'W/"12"', '"0"', '"01"', '"1", "2"']) {
    assert.throws(() => parse(value), (error: unknown) => error instanceof ProblemError
      && ["PRECONDITION_REQUIRED", "VALIDATION_FAILED"].includes(error.problem.code), String(value));
  }
});

test("command envelope rejects a stale aggregate before executing its effect", async () => {
  let effects = 0;
  await assert.rejects(commandPlatform.executeCommand({
    operationId: "updateMasterRecord",
    actorId: "actor-1",
    idempotencyKey: KEY,
    request: { name: "changed" },
    expectedVersion: 3,
    correlationId: "correlation-stale",
    idempotencyStore: new InMemoryIdempotencyStore(),
    transact: async (work) => work({ locked: true }),
    loadCurrentVersion: async () => 4,
    handle: async () => { effects++; return { status: 200, value: {} }; },
  }), (error: unknown) => error instanceof ProblemError
    && error.problem.status === 412
    && error.problem.code === "STALE_VERSION"
    && error.problem.expectedVersion === 3
    && error.problem.currentVersion === 4);
  assert.equal(effects, 0);
});

test("session-bound CSRF hook validates token and allow-listed request source before mutation", () => {
  const assertCsrfRequest = (commandPlatform as Record<string, unknown>).assertCsrfRequest;
  assert.equal(typeof assertCsrfRequest, "function", "ORB-R1-0204 must export assertCsrfRequest");
  const verify = assertCsrfRequest as (input: Record<string, unknown>) => void;
  const valid = {
    expectedToken: "a".repeat(32), csrfToken: "a".repeat(32),
    origin: "https://orb.example.com", referer: null,
    allowedOrigins: ["https://orb.example.com"], correlationId: "correlation-csrf",
  };
  assert.doesNotThrow(() => verify(valid));
  for (const mutation of [
    { csrfToken: undefined },
    { csrfToken: "b".repeat(32) },
    { origin: "https://attacker.example" },
    { origin: null, referer: null },
    { origin: null, referer: "https://attacker.example/path" },
  ]) assert.throws(() => verify({ ...valid, ...mutation }), ProblemError);
});
