# E02 predeployment harness

This directory documents the ORB-R1-1302 harness. Building or running it locally is predeployment work and **does not earn, award, or claim E02**. E02 exists only when ORB-R1-1309 or ORB-R1-1315 runs the harness after E01 against the same frozen candidate digest and deployed environment identity.

## What is enforced

`e02-operation-sweep.spec.ts` derives its inventory from the authoritative OpenAPI file and fails unless it finds exactly 79 unique operations, 58 `Idempotency-Key` controls, 57 CSRF controls, 53 existing-aggregate `If-Match` controls, and the exact fixed `x-required-roles` matrix. A deployed run invokes each operation exactly once with an allowed role and exactly once with a denied role (or an invalid unauthenticated sign-in), requires every allowed result to be an explicitly accepted 2xx status, and validates every denied/invalid response as RFC 9457 `application/problem+json`. A passing deployed run retains a JSON Playwright attachment containing only normalized binding metadata, the exact aggregate totals, operation IDs, and allowed/denied-invalid HTTP statuses. It never records cookies, CSRF values, request bodies, fixture headers, credentials, or response bodies.

`e02-forbidden-paths.spec.ts` scans structured OpenAPI identifiers plus the actual application page/API route filenames, navigation href inventory, and any available Next route/build manifests. Prose-only exclusions and acceptance-test source are not treated as application surface. Its deployed crawl requires all seven immutable API probes `/bank-imports`, `/tax-packs`, `/migration-records`, `/source-allocations`, `/expense-allocations`, `/approval-policies`, and `/route-templates`, plus at least one probe in each of `api`, `schema`, `navigation`, and `build`; extra deferred probes are allowed. Every probe must return RFC 9457 `404 RESOURCE_NOT_FOUND`. A passing deployed crawl retains only binding metadata and probe category/path/status in its JSON Playwright attachment.

## Fail-closed modes

There is no implicit local target. With no mode/configuration, the runtime harness fails. The expected initial RED command is:

```sh
npx playwright test tests/acceptance/e02-operation-sweep.spec.ts tests/acceptance/e02-forbidden-paths.spec.ts --project=chromium
```

Construction can be checked without network calls using the explicitly non-evidence dry run:

```sh
ORB_E02_MODE=dry-run npx playwright test tests/acceptance/e02-operation-sweep.spec.ts tests/acceptance/e02-forbidden-paths.spec.ts --project=chromium
```

A deployed execution requires `ORB_E02_MODE=deployed`, `ORB_E02_DEPLOYED_CONFIG`, and `ORB_E02_FORBIDDEN_CONFIG`. Each spec parses both documents and fails closed unless both bind the exact same normalized HTTPS non-local target origin, 64-character lowercase `candidateDigest`, exact non-empty `environmentId`, and `e01Passed: true`. The release runner must additionally compare those values with the ORB-R1-1307/1313 candidate manifest and ORB-R1-1308/1314 deployment record before retaining results.

`ORB_E02_DEPLOYED_CONFIG` supplies:

- `origin`, equal to the target origin;
- deployed `sessions` for `OWNER_ADMIN`, `OPERATIONS`, and `FINANCE_VIEWER`, each with an exact `__Host-orb_session` cookie and session-bound CSRF token;
- exactly 79 `operations` keys, one per operationId;
- for each operation, explicit `allowed` and `denied` invocations containing the role, fully substituted path, optional query/body/additional headers, and optional exact accepted status list.

Fixtures must be isolated/pre-seeded so each allowed call is valid without reusing an operation. The allowed role must belong to the operation's OpenAPI role extension. The denied role must be outside it (or `UNAUTHENTICATED` where all fixed roles are allowed); `signIn` uses an invalid unauthenticated fixture. The harness supplies declared idempotency, CSRF/origin/referer, and `If-Match` headers and rejects incomplete role/session inventories.

`ORB_E02_FORBIDDEN_CONFIG` supplies a `probes` array containing each of the seven exact API paths above exactly once and at least one deferred-looking path in every category: `api`, `schema`, `navigation`, and `build`. Caller-selected alternatives cannot replace any of the seven required API paths. Localhost, HTTP, mismatched bindings, missing E01, partial fixtures, role drift, non-problem errors, missing controls, unexpected statuses, or any non-404 forbidden probe fails closed.

Run only the `chromium` project for retained E02 results. The specs skip other browser projects so the API inventory cannot accidentally execute more than once.
