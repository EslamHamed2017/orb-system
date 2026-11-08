# ORB immutable deployment manifests

These files define a diagnostic/rehearsal deployment for ORB-R1-1305. They do not deploy an acceptance candidate and do not produce E01 or E17 evidence.

## Guarantees

- The ORB image must be referenced as `repository@sha256:<digest>`. The Docker build records source/build and `pnpm-lock.yaml` digests as OCI labels.
- The Node build base, PostgreSQL 18.1, TLS gateway, MinIO server, and the MinIO client copied into the ORB runtime are registry-digest locked. PostgreSQL and MinIO use TLS; only the gateway binds a host port.
- `orb_app` is the runtime database identity; `orb_migrator` is the separate, one-shot migration identity. The migration runner idempotently provisions `orb_app` with runtime DML/sequence privileges before applying schema changes. The migrator owns schema changes and its credentials never enter the app container.
- The object bucket is created with object lock, versioning, and default governance retention. The bootstrap removes broad `readwrite` access and assigns a bucket-scoped application policy without object deletion or retention-bypass actions; root credentials remain outside the application and must be protected offline.
- Deployment orders dependency health, additive/backward-compatible migration, new app readiness, then TLS gateway readiness. A failed gate does not advance `current.env`.
- Rollback is application-only and restores the prior digest after readiness. Database down-migrations are intentionally forbidden; every migration must remain compatible with the preceding app until rollout is complete.

## Required inputs

Set the variables referenced with `${NAME:?…}` in `compose.acceptance.yml`, including digest-pinned `ORB_IMAGE`, distinct database and object-store credentials, TLS certificate paths, `ORB_HOSTNAME`, `ORB_CA_CERT`, a 32-byte base64 encryption key, telemetry URL, and backup-status URL. PostgreSQL certificate private keys must be mode `0600`; PostgreSQL rejects broader key permissions. The MinIO key must be owned by/readable only to the MinIO container identity (UID 65532; mode `0400`), because local Compose file-backed secrets preserve host ownership rather than implementing secret `uid` remapping.

The PostgreSQL certificate must authenticate `postgres`, and the MinIO secret directory must present `public.crt` and `private.key` using the deployment platform's secret mapping. The checked-in Compose file contains no secret values.

## Build and capture identities

```sh
export BUILD_DIGEST="$(git rev-parse HEAD)"
export LOCK_DIGEST="sha256:$(sha256sum pnpm-lock.yaml | cut -d ' ' -f 1)"
docker build --build-arg ORB_BUILD_DIGEST="$BUILD_DIGEST" --build-arg ORB_LOCK_DIGEST="$LOCK_DIGEST" -t orb-r1-1305:rehearsal .
docker image inspect orb-r1-1305:rehearsal --format '{{json .Config.Labels}}'
```

Push/signing is outside this task. For an ephemeral local migration rehearsal, obtain the local immutable image ID with `docker image inspect --format '{{.Id}}'` and set `ORB_EPHEMERAL_REHEARSAL=1`; only the migration runner accepts that explicit local exception. Deploy and rollback continue to require a registry-style `@sha256:` reference and must not be used for a real deployment during ORB-R1-1305.

## Render and ephemeral rehearsal

With disposable volumes, disposable credentials, and test certificates only:

```sh
docker compose -f compose.acceptance.yml config --quiet
ORB_EPHEMERAL_REHEARSAL=1 COMPOSE_FILE=compose.acceptance.yml ops/deploy/run-migrations.sh
COMPOSE_FILE=compose.acceptance.yml ops/deploy/deploy.sh
COMPOSE_FILE=compose.acceptance.yml ops/deploy/rollback.sh
```

Never rehearse against production data, credentials, volumes, buckets, or endpoints. Remove only the explicitly named disposable Compose project when finished. A production operator must separately provision least-privilege roles, encrypted PITR/separate backups, external certificate management, monitoring, and the deployment evidence owned by later release tasks.
