import assert from "node:assert/strict";
import test from "node:test";
import { createProblem, isProblemError, problemError } from "../../src/platform/http/problem.ts";

test("RFC 9457 problem details expose stable machine fields and localized English copy", () => {
  const problem = createProblem({
    code: "STALE_VERSION", status: 412, correlationId: "correlation-en", locale: "en-US",
    extensions: { expectedVersion: 3, currentVersion: 4 },
  });
  assert.deepEqual(problem, {
    type: "https://orb.example/problems/stale-version",
    title: "Stale version",
    status: 412,
    detail: "The record changed since it was loaded. Reload it and try again.",
    code: "STALE_VERSION",
    correlationId: "correlation-en",
    expectedVersion: 3,
    currentVersion: 4,
  });
  assert.ok(Object.isFrozen(problem));
});

test("Accept-Language Arabic selection localizes title and detail without changing stable fields", () => {
  const problem = createProblem({ code: "IDEMPOTENCY_KEY_REUSED", status: 409, correlationId: "correlation-ar", locale: "ar-AE,ar;q=0.9,en;q=0.8" });
  assert.equal(problem.type, "https://orb.example/problems/idempotency-key-reused");
  assert.equal(problem.code, "IDEMPOTENCY_KEY_REUSED");
  assert.equal(problem.status, 409);
  assert.equal(problem.correlationId, "correlation-ar");
  assert.match(problem.title, /[\u0600-\u06ff]/);
  assert.match(problem.detail, /[\u0600-\u06ff]/);
});

test("validation problems carry JSON Pointer field errors and protect RFC fields from extensions", () => {
  const errors = [{ pointer: "/amount", code: "DECIMAL_REQUIRED", message: "Enter an exact decimal amount." }];
  const problem = createProblem({
    code: "VALIDATION_FAILED", status: 400, correlationId: "correlation-validation", errors,
    extensions: {
      type: "unsafe", title: "unsafe", status: 200, detail: "unsafe", code: "unsafe", correlationId: "unsafe",
      safeContext: "amount", "unsafe-key": "discarded",
    },
  });
  assert.equal(problem.status, 400);
  assert.equal(problem.code, "VALIDATION_FAILED");
  assert.equal(problem.correlationId, "correlation-validation");
  assert.deepEqual(problem.errors, errors);
  assert.ok(Object.isFrozen(problem.errors));
  assert.equal(problem.safeContext, "amount");
  assert.equal(problem["unsafe-key"], undefined);
});

test("ProblemError retains the safe localized problem and supports type narrowing", () => {
  const error = problemError({ code: "PRECONDITION_REQUIRED", status: 428, correlationId: "correlation-error", locale: "ar" });
  assert.ok(isProblemError(error));
  assert.equal(error.problem.status, 428);
  assert.equal(error.problem.code, "PRECONDITION_REQUIRED");
  assert.equal(error.problem.correlationId, "correlation-error");
  assert.equal(isProblemError(new Error("ordinary")), false);
});

test("unknown internal codes fail closed to generic localized copy without leaking details", () => {
  const problem = createProblem({ code: "UNEXPECTED_DATABASE_SECRET", status: 500, correlationId: "correlation-safe", locale: "en" });
  assert.equal(problem.title, "Internal error");
  assert.equal(problem.detail, "The request could not be completed safely.");
  assert.doesNotMatch(JSON.stringify(problem), /password|stack|sql/i);
});
