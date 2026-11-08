#!/bin/sh
set -eu

COMPOSE_FILE=${COMPOSE_FILE:-compose.acceptance.yml}
: "${ORB_IMAGE:?ORB_IMAGE must be an immutable image reference ending in @sha256:<64 hex>}"
case "$ORB_IMAGE" in
  *@sha256:*) digest=${ORB_IMAGE##*@sha256:} ;;
  sha256:*)
    [ "${ORB_EPHEMERAL_REHEARSAL:-0}" = 1 ] || { echo "local image IDs are allowed only for an explicit ephemeral rehearsal" >&2; exit 2; }
    digest=${ORB_IMAGE#sha256:} ;;
  *) echo "ORB_IMAGE is not digest-pinned" >&2; exit 2;;
esac
[ "${#digest}" -eq 64 ] || { echo "ORB_IMAGE is not digest-pinned" >&2; exit 2; }
case "$digest" in *[!0-9a-f]*) echo "ORB_IMAGE is not digest-pinned" >&2; exit 2;; esac

docker compose -f "$COMPOSE_FILE" config --quiet
docker compose -f "$COMPOSE_FILE" up -d --wait postgres object-store
docker compose -f "$COMPOSE_FILE" up --no-deps --abort-on-container-exit --exit-code-from object-store-init object-store-init
docker compose -f "$COMPOSE_FILE" exec -T -e ORB_APP_DB_PASSWORD="$ORB_APP_DB_PASSWORD" postgres sh -eu -c '
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=app_password="$ORB_APP_DB_PASSWORD" <<"SQL"
SELECT format('"'"'CREATE ROLE orb_app LOGIN PASSWORD %L'"'"', :'"'"'app_password'"'"')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '"'"'orb_app'"'"') \gexec
SELECT format('"'"'ALTER ROLE orb_app PASSWORD %L'"'"', :'"'"'app_password'"'"') \gexec
GRANT CONNECT ON DATABASE orb TO orb_app;
GRANT USAGE ON SCHEMA public TO orb_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO orb_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO orb_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO orb_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO orb_app;
SQL
'
docker compose -f "$COMPOSE_FILE" --profile migration run --rm migrate
expected=0
for migration in prisma/migrations/*/migration.sql; do
  [ -f "$migration" ] || continue
  expected=$((expected + 1))
done
actual=$(docker compose -f "$COMPOSE_FILE" exec -T postgres psql --username orb_migrator --dbname orb --tuples-only --no-align --command 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')
[ "$expected" -gt 0 ] && [ "$actual" = "$expected" ] || { echo "migration verification failed: expected $expected, applied $actual" >&2; exit 2; }
