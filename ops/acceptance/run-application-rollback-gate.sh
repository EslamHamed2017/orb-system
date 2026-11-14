#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# Last application revision before the concept-realignment expand migration.
readonly PINNED_ROLLBACK_APP_REVISION=05a09d8c7b714635975a5dd109cd2877d4154987
ORB_ROLLBACK_APP_REVISION=${ORB_ROLLBACK_APP_REVISION:-$PINNED_ROLLBACK_APP_REVISION}
if [[ "$ORB_ROLLBACK_APP_REVISION" != "$PINNED_ROLLBACK_APP_REVISION" ]]; then
  echo "rollback revision substitution is not permitted" >&2
  exit 2
fi
readonly ORB_ROLLBACK_APP_REVISION
POSTGRES_IMAGE=postgres:18.1-bookworm@sha256:cc9f4143a8d2fa8cf3749d0cb4d26ecf2d53a77a2ac807e9ebd67ae22426221a
container="orb-rollback-$RANDOM-$$"
work="$(mktemp -d)"
app_pid=""

free_port() { python3 - <<'PYPORT'
import socket
with socket.socket() as sock:
    sock.bind(("127.0.0.1", 0))
    print(sock.getsockname()[1])
PYPORT
}

db_port=$(free_port)
app_port=$(free_port)
db_password=$(openssl rand -hex 24)
database_url="postgresql://orb_migrator:${db_password}@127.0.0.1:${db_port}/orb_rollback?sslmode=disable"

cleanup() {
  if [[ -n "$app_pid" ]]; then kill "$app_pid" >/dev/null 2>&1 || true; wait "$app_pid" 2>/dev/null || true; fi
  docker rm -f "$container" >/dev/null 2>&1 || true
  git worktree remove --force "$work/preceding-app" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT INT TERM
trap 'echo "application rollback gate failed at line $LINENO" >&2' ERR

# Pin a real preceding commit, require ancestry, and prove it predates expansion.
git cat-file -e "${ORB_ROLLBACK_APP_REVISION}^{commit}"
git merge-base --is-ancestor "$ORB_ROLLBACK_APP_REVISION" HEAD
git cat-file -e "${ORB_ROLLBACK_APP_REVISION}:prisma/migrations/202611050001_r1_initial/migration.sql"
if git cat-file -e "${ORB_ROLLBACK_APP_REVISION}:prisma/migrations/202611110001_concept_realignment_expand/migration.sql" 2>/dev/null; then
  echo "rollback revision already contains the expand migration" >&2
  exit 2
fi
git worktree add --detach "$work/preceding-app" "$ORB_ROLLBACK_APP_REVISION" >/dev/null

# All infrastructure is disposable and published to loopback only.
docker run --detach --name "$container" \
  --publish "127.0.0.1:${db_port}:5432" \
  --env POSTGRES_DB=orb_rollback \
  --env POSTGRES_USER=orb_migrator \
  --env "POSTGRES_PASSWORD=$db_password" \
  "$POSTGRES_IMAGE" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$container" pg_isready -U orb_migrator -d orb_rollback >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$container" pg_isready -U orb_migrator -d orb_rollback >/dev/null

# Materialize the actual preceding app independently; never mutate the main checkout.
(
  cd "$work/preceding-app"
  corepack pnpm install --frozen-lockfile --strict-peer-dependencies --prefer-offline
  DATABASE_URL="$database_url" corepack pnpm run prisma:generate
  DATABASE_URL="$database_url" node node_modules/prisma/build/index.js migrate deploy
)

# ORB-ROLLBACK-SMOKE: seed a legacy-schema marker through the preceding generated Prisma client.
cat > "$work/preceding-app/legacy_app_write.mjs" <<'JS'
import pg from "pg";
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const code = process.argv[2];
await client.connect();
try {
  await client.query(`INSERT INTO "Currency" (code, decimals, active) VALUES ($1, 2, true)`, [code]);
  const result = await client.query(`SELECT decimals, active FROM "Currency" WHERE code = $1`, [code]);
  if (result.rowCount !== 1 || !result.rows[0].active || result.rows[0].decimals !== 2)
    throw new Error("legacy_app_write verification failed");
} finally {
  await client.end();
}
JS
(cd "$work/preceding-app" && DATABASE_URL="$database_url" node legacy_app_write.mjs RLB)

# Expand/backfill in place with the candidate migrations. No reset or down-migration is permitted.
DATABASE_URL="$database_url" node node_modules/prisma/build/index.js migrate deploy
expected=$(python3 - <<'PYCOUNT'
from pathlib import Path
print(sum(1 for p in Path("prisma/migrations").iterdir() if p.is_dir() and (p / "migration.sql").is_file()))
PYCOUNT
)
expected_migration_names=$(python3 - <<'PYNAMES'
from pathlib import Path
print("\n".join(sorted(
    p.name for p in Path("prisma/migrations").iterdir()
    if p.is_dir() and (p / "migration.sql").is_file()
)))
PYNAMES
)
database_migration_names=$(docker exec "$container" psql -X -U orb_migrator -d orb_rollback -At -v ON_ERROR_STOP=1 \
  -c "SELECT string_agg(migration_name, E'\\n' ORDER BY migration_name) FROM _prisma_migrations")
[[ "$database_migration_names" == "$expected_migration_names" ]] || {
  echo "expanded database migration names differ from the candidate filesystem" >&2
  exit 2
}
migration_state() {
  docker exec "$container" psql -X -U orb_migrator -d orb_rollback -At -v ON_ERROR_STOP=1 \
    -c "SELECT count(*) || '|' || count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) || '|' || count(*) FILTER (WHERE rolled_back_at IS NOT NULL) FROM _prisma_migrations"
}
migration_digest() {
  docker exec "$container" psql -X -U orb_migrator -d orb_rollback -At -v ON_ERROR_STOP=1 \
    -c "SELECT encode(digest(COALESCE(jsonb_agg(to_jsonb(m) ORDER BY migration_name)::text, '[]'), 'sha256'), 'hex') FROM _prisma_migrations m"
}
schema_digest() {
  # PostgreSQL 18 emits random \restrict/\unrestrict tokens in otherwise
  # deterministic schema-only dumps; exclude only those client guard lines.
  docker exec "$container" pg_dump --schema-only --no-owner --no-privileges -U orb_migrator orb_rollback \
    | python3 -c 'import hashlib, sys; data = b"".join(line for line in sys.stdin.buffer if not line.startswith((b"\\restrict ", b"\\unrestrict "))); print(hashlib.sha256(data).hexdigest())'
}
before=$(migration_state)
[[ "$before" == "${expected}|${expected}|0" ]] || { echo "expanded migration history is not clean: $before" >&2; exit 2; }
before_digest=$(migration_digest)
[[ "$before_digest" =~ ^[a-f0-9]{64}$ ]] || { echo "expanded migration history digest is invalid" >&2; exit 2; }
before_schema_digest=$(schema_digest)
[[ "$before_schema_digest" =~ ^[a-f0-9]{64}$ ]] || { echo "expanded schema digest is invalid" >&2; exit 2; }
compatible=$(docker exec "$container" psql -X -U orb_migrator -d orb_rollback -At -v ON_ERROR_STOP=1 -c \
  "SELECT to_regclass('public.\"ContractLine\"') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ContractVersion' AND column_name='coffee_specification_id')" \
  | tr -d '[:space:]')
[[ "$compatible" == t ]] || { echo "expanded schema is not preceding-app compatible" >&2; exit 2; }

# The preceding client must still write and read a legacy model after expansion.
(cd "$work/preceding-app" && DATABASE_URL="$database_url" node legacy_app_write.mjs RLA)

# Build and boot the actual preceding application revision against the expanded database.
(
  cd "$work/preceding-app"
  DATABASE_URL="$database_url" corepack pnpm run build
  env \
    NODE_ENV=production PORT="$app_port" DATABASE_URL="$database_url" \
    OBJECT_STORAGE_ENDPOINT=http://127.0.0.1:9 OBJECT_STORAGE_REGION=us-east-1 \
    OBJECT_STORAGE_BUCKET=rollback-smoke OBJECT_STORAGE_ACCESS_KEY_ID=rollback \
    OBJECT_STORAGE_SECRET_ACCESS_KEY=rollback ORB_APP_ORIGIN="http://127.0.0.1:${app_port}" \
    ORB_ALLOWED_ORIGINS="http://127.0.0.1:${app_port}" AUTH_IDLE_MINUTES=30 AUTH_ABSOLUTE_MINUTES=720 \
    ENCRYPTION_KEY_BASE64=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= \
    TELEMETRY_ENDPOINT=http://127.0.0.1:9 BACKUP_STATUS_ENDPOINT=http://127.0.0.1:9 \
    ORB_AUDIT_CHAIN_HEALTHY=1 \
    node node_modules/next/dist/bin/next start -H 127.0.0.1 -p "$app_port"
) >"$work/preceding-app.log" 2>&1 &
app_pid=$!
ready=0
for _ in $(seq 1 90); do
  if curl --fail --silent "http://127.0.0.1:${app_port}/api/health/ready" >"$work/readiness.json"; then ready=1; break; fi
  kill -0 "$app_pid" 2>/dev/null || { python3 - "$work/preceding-app.log" <<'PYLOG'
from pathlib import Path
import sys
print(Path(sys.argv[1]).read_text()[-4000:])
PYLOG
exit 2; }
  sleep 1
done
[[ "$ready" == 1 ]] || { echo "preceding app did not become ready" >&2; exit 2; }
python3 - "$work/readiness.json" <<'PYREADY'
import json, sys
payload=json.load(open(sys.argv[1]))
assert payload["status"] == "ready", payload
assert all(value == "up" for value in payload["checks"].values()), payload
PYREADY
curl --fail --silent --location "http://127.0.0.1:${app_port}/sign-in" | python3 -c 'import sys; body=sys.stdin.read(); assert "ORB" in body'

# Rollback must not alter or roll back migration history, and both legacy writes survive.
after=$(migration_state)
[[ "$after" == "$before" ]] || { echo "application rollback changed migration history: $before -> $after" >&2; exit 2; }
after_digest=$(migration_digest)
[[ "$after_digest" == "$before_digest" ]] || { echo "application rollback mutated migration history" >&2; exit 2; }
after_schema_digest=$(schema_digest)
[[ "$after_schema_digest" == "$before_schema_digest" ]] || { echo "application rollback mutated the expanded database schema" >&2; exit 2; }
markers=$(docker exec "$container" psql -X -U orb_migrator -d orb_rollback -At -v ON_ERROR_STOP=1 -c \
  "SELECT string_agg(trim(code), ',' ORDER BY code) FROM \"Currency\" WHERE trim(code) IN ('RLA','RLB')")
[[ "$markers" == "RLA,RLB" ]] || { echo "legacy write markers missing after rollback" >&2; exit 2; }

printf 'application rollback gate passed: preceding=%s; migrations=%s; legacy_app_write=2; readiness=ready; schema=expanded\n' \
  "$ORB_ROLLBACK_APP_REVISION" "$expected"
