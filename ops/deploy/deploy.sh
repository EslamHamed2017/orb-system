#!/bin/sh
set -eu

COMPOSE_FILE=${COMPOSE_FILE:-compose.acceptance.yml}
STATE_DIR=${STATE_DIR:-.orb-deploy}
: "${ORB_IMAGE:?ORB_IMAGE must be an immutable image reference ending in @sha256:<64 hex>}"
case "$ORB_IMAGE" in *@sha256:*) digest=${ORB_IMAGE##*@sha256:} ;; *) echo "ORB_IMAGE is not digest-pinned" >&2; exit 2;; esac
[ "${#digest}" -eq 64 ] || { echo "ORB_IMAGE is not digest-pinned" >&2; exit 2; }
case "$digest" in *[!0-9a-f]*) echo "ORB_IMAGE is not digest-pinned" >&2; exit 2;; esac

mkdir -p "$STATE_DIR"
lock_digest=$(sha256sum pnpm-lock.yaml | cut -d ' ' -f 1)
resolved_digest=$(docker image inspect --format '{{index .RepoDigests 0}}' "$ORB_IMAGE" 2>/dev/null || printf '%s' "$ORB_IMAGE")
if [ -f "$STATE_DIR/current.env" ]; then cp "$STATE_DIR/current.env" "$STATE_DIR/previous.env"; fi
{
  printf 'ORB_IMAGE=%s\n' "$ORB_IMAGE"
  printf 'ORB_RESOLVED_IMAGE=%s\n' "$resolved_digest"
  printf 'ORB_LOCK_DIGEST=sha256:%s\n' "$lock_digest"
  printf 'ORB_DEPLOYED_AT=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$STATE_DIR/pending.env"

docker compose -f "$COMPOSE_FILE" config --quiet
COMPOSE_FILE="$COMPOSE_FILE" ops/deploy/run-migrations.sh
# Only additive/backward-compatible migrations run before replacement. Compose
# recreates the app after migration and does not stop healthy dependencies.
docker compose -f "$COMPOSE_FILE" up -d --no-deps --wait app
docker compose -f "$COMPOSE_FILE" up -d --no-deps --wait gateway
curl --fail --silent --show-error --retry 12 --retry-delay 2 \
  --cacert "${ORB_CA_CERT:?set ORB_CA_CERT}" \
  "https://${ORB_HOSTNAME:?set ORB_HOSTNAME}:${ORB_HTTPS_PORT:-8443}/api/health/ready" >/dev/null
mv "$STATE_DIR/pending.env" "$STATE_DIR/current.env"
