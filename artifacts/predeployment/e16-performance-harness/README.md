# ORB-R1-1304 E16 concurrency and performance harness

This harness is predeployment construction only. Local and dry-run results are diagnostic and **do not earn or claim E16**. E16 is earned only by ORB-R1-1310 or ORB-R1-1315 against the recorded frozen candidate and deployed environment that already passed E01.

## Construction checks

```sh
corepack pnpm dlx node@24.22.2 --test tests/integration/concurrency/tolerance-settlement-closure.test.ts
ORB_R1_LOAD_MODE=dry-run corepack pnpm dlx node@24.22.2 tests/performance/r1-load.ts
```

The integration suite exercises the real in-memory command boundaries for simultaneous settlement allocation, tolerance decisions, final close, and fail-closed document sending. It asserts one-effect/stale-write behavior, exact balances and approval binding, final-state integrity, and immutable failed-send evidence.

The dry run creates exactly 50 logical sessions, executes every timing class twice per session, collects sample counts, p95 and maximum durations, and applies the accepted thresholds: reads <=500 ms p95, mutations <=800 ms p95, document acceptance <=2 seconds p95, and rendering <=30 seconds p95. It exists only to prove load generation, metric collection, redaction and fail-closed assertions.

## Deployed mode

`ORB_R1_LOAD_MODE=deployed` requires `ORB_R1_LOAD_CONFIG` to name a JSON file. The config must contain a non-local HTTPS `origin`, a positive `iterationsPerSession`, exactly 50 session records (`cookie` beginning `__Host-orb_session=` plus its session-bound `csrfToken`), and request templates named `read`, `mutation`, `documentAccept`, and `documentRender`. Each template has `method`, an absolute-path `path`, optional JSON `body`, and non-empty `acceptedStatuses`. `{session}` and `{iteration}` placeholders are replaced in paths and bodies so callers can bind isolated fixtures.

The harness sends Origin, Referer, cookie, and CSRF controls but never emits their values. Its report contains only mode, aggregate timing metrics, session/sample counts, and normalized failure codes. Missing samples, request failures, unsafe/local targets, malformed session inventory, non-finite timings, or any exceeded threshold fail closed. ORB-R1-1310/1315 must additionally bind the config and retained report to the exact candidate manifest, E01 result, environment identity, database/object-store state, and concurrent invariant evidence; this task does not create that release evidence.
