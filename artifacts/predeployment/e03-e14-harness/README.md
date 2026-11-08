# ORB-R1-1303 E03–E14 predeployment harness

This is construction-only. It neither awards nor claims numbered evidence. E03–E14 can be retained only when ORB-R1-1309/1315 runs the harness against the recorded deployment that already passed E01 for the same frozen candidate.

## Safe construction run

Use the repository pins (Node 24.22.2 and pnpm 12.16.1 through Corepack):

```sh
ORB_E03_E14_MODE=self-test corepack pnpm exec playwright test tests/acceptance/e03-e14-daily-use.spec.ts --project=chromium
```

Self-test makes no network request. It validates the exact 79-operation OpenAPI inventory and parses roles only from each operation's `x-required-roles`. It validates the frozen E03→E14 operation inventory, lifecycle cardinalities and mandatory approval subsequences, capture-before-use, generated fixture resolvability, concrete replay read-backs, both claim outcomes, and all eight closure invalidators. Every mandatory subsequence is mutation-tested for removal and reorder. Construction tests also prove that typed whole-fixture references preserve objects, arrays, numbers and booleans in exact JSON request bytes, nested substitutions resolve, missing/malformed references fail, and evidence hashes cannot contain or vary with cookie/CSRF secrets.

## Deployed input boundary

`ORB_E03_E14_MODE=deployed` requires `ORB_E03_E14_DEPLOYED_CONFIG` with exactly four keys:

- `candidateManifestPath`: the recorded beta/stabilization `manifest.json` beneath `artifacts/candidates`;
- `environmentIdentityPath`: the matching `environment-identity.json` beneath `artifacts/deployed`;
- `e01ResultPath`: the matching recorded E01 JSON beneath `artifacts/deployed`;
- `cycles`: exactly `en` and `ar`. Each locale contains its own `sessions` (the three active fixed-role sessions plus a dedicated `terminated` session) and `fixtures` (initial IDs, versions, strict request values, evidence metadata, deterministic failures, and sign-in inputs).

The two cycle fixture sets must use distinct deterministic Project, contract, shipment, document, manifest, invoice, expense, claim, closure and external references. Their destructive records must not overlap. The dedicated terminated session is revoked and denied without invalidating the three active sessions used by the rest of that locale's lifecycle.

The caller cannot supply steps, operations, roles, order, expected results, assertions, invariant coverage, cardinalities, or request paths. Missing fixture values fail before their request.

The harness resolves real paths and rejects symlink/path escapes. It loads all three binding documents, checks their object shape and recorded identity fields, requires E01 `PASS`, validates candidate/environment/OpenAPI/URL cross-binding, computes the exact bytes hash of every input for the report, and rejects HTTP or local targets. Candidate digest, environment identity and OpenAPI digest must agree across the independently recorded files. The harness does not claim cryptographic signature or standalone file-integrity verification because these artifacts do not expose an independently anchored immutable hash/signature reference for each binding file.

## Execution and replay

English and Arabic each execute the complete embedded lifecycle independently with locale-specific sessions, fixtures, captures, idempotency keys and deterministic references. Arabic is not a GET-only verification pass. Every successful authenticated step is checked against its exact OpenAPI role list, every permission-denied probe uses a disallowed role, and public `signIn` is handled without inventing a role requirement. At the end of each locale cycle, Owner/Admin, Operations and Finance/Viewer each call `signOutCurrentSession`; the harness validates the exact non-null termination metadata and then proves the same session cannot read Projects.

Before a request, the harness fully interpolates and snapshots URL/query, serialized body bytes, and complete headers. An idempotent replay reuses that exact snapshot—including the same idempotency key—without consulting captures from response one. A named subsequent read asserts the effect count/version/history remains singular.

Required invariants are runtime comparisons or negative RFC 9457 probes; there are no declarative invariant markers. Request evidence hashes canonical method, URL, a sorted redacted header set, and the body hash; Cookie and CSRF values are excluded. Response evidence hashes a canonical recursively sanitized response representation. The normalized attachment contains binding-input hashes, redacted canonical request metadata, deterministic request/response hashes, locale, operation key and status. It excludes cookies, CSRF tokens, raw request/response bodies and secret fields.
