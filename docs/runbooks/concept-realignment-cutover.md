# Concept realignment cutover and rollback

This procedure applies only to the approved ORB concept realignment. It is expand–migrate–contract: this release expands the database, T018 backfills and reconciles legacy rows, and destructive cleanup is deferred until after pilot stabilization and owner review.

## Safety invariants

- Take and verify an isolated backup/restore before any environment change.
- Run `prisma migrate deploy` with the migration identity; never run `migrate dev` against shared data.
- The expand migration retains all Release 1 columns and is compatible with the preceding application image.
- Rollback is application-only. There is **no database down-migration**.
- Do not advance while reconciliation, error-rate, or authorization checks are red.

## Staged flags

Flags are server-side runtime configuration. Values outside this closed set fail startup. `compare` and `v2` reads require dual writes.

| Stage | `ORB_REALIGNMENT_DUAL_WRITE` | `ORB_REALIGNMENT_READ_PATH` | Gate |
|---|---:|---|---|
| Pre-migration / old app | `0` | `legacy` | Baseline health and backup verified |
| Expanded schema | `0` | `legacy` | Migration deploy and old-app smoke pass |
| Backfill / shadow writes | `1` | `legacy` | T018 idempotent backfill and reconciliation pass |
| Read comparison | `1` | `compare` | No row, quantity, value, hash, permission, or attachment-scope mismatch |
| Cutover | `1` | `v2` | Lifecycle tests and owner review pass |

Literal environment examples used by automation and review:

```text
ORB_REALIGNMENT_DUAL_WRITE=0
ORB_REALIGNMENT_READ_PATH=legacy
ORB_REALIGNMENT_DUAL_WRITE=1
ORB_REALIGNMENT_READ_PATH=compare
ORB_REALIGNMENT_READ_PATH=v2
```

## Forward procedure

1. Deploy the expand migration while the old application remains active.
2. Re-run readiness plus the legacy contract/shipment/evidence smoke tests against the expanded schema.
3. Deploy the new application with legacy reads and dual writes disabled.
4. After T018 is verified, enable dual writes while retaining legacy reads.
5. Reconcile v1 and v2 projections, then use comparison reads.
6. Move to v2 reads only after all release gates are green. Keep dual writes enabled through the pilot soak.
7. A later owner-approved contract migration may enforce backfilled nullability and remove legacy fields; it is not part of this migration.

## Application rollback

1. Stop traffic advancement and record the failed image/flag state without including secrets or user data.
2. Set `ORB_REALIGNMENT_READ_PATH=legacy`. Keep `ORB_REALIGNMENT_DUAL_WRITE=1` when the current application remains deployed; the preceding image ignores both flags.
3. Restore the preceding immutable application image and run readiness plus legacy lifecycle smoke tests.
4. Leave the expanded schema and migrated rows in place. Do not drop tables, columns, enums, indexes, or migration-history rows.
5. Resume only after legacy reads/writes are healthy. Investigate and repair forward in a new additive migration.
