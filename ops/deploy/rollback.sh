#!/bin/sh
set -eu

COMPOSE_FILE=${COMPOSE_FILE:-compose.acceptance.yml}
STATE_DIR=${STATE_DIR:-.orb-deploy}
PREVIOUS="$STATE_DIR/previous.env"
[ -f "$PREVIOUS" ] || { echo "No attested previous deployment is available" >&2; exit 2; }

previous_image=$(sed -n 's/^ORB_IMAGE=//p' "$PREVIOUS")
previous_lock=$(sed -n 's/^ORB_LOCK_DIGEST=//p' "$PREVIOUS")
[ -n "$previous_image" ] && [ -n "$previous_lock" ] || { echo "Previous attestation is incomplete" >&2; exit 2; }
case "$previous_image" in *@sha256:*) digest=${previous_image##*@sha256:} ;; *) echo "Previous image is not digest-pinned" >&2; exit 2;; esac
[ "${#digest}" -eq 64 ] || { echo "Previous image is not digest-pinned" >&2; exit 2; }
case "$digest" in *[!0-9a-f]*) echo "Previous image is not digest-pinned" >&2; exit 2;; esac

# Database migrations are forward-only. Rollback restores the prior compatible
# app image after its readiness gate; destructive down-migrations are forbidden.
ORB_IMAGE=$previous_image export ORB_IMAGE
docker compose -f "$COMPOSE_FILE" config --quiet
docker compose -f "$COMPOSE_FILE" up -d --no-deps --wait app
docker compose -f "$COMPOSE_FILE" up -d --no-deps --wait gateway
curl --fail --silent --show-error --retry 12 --retry-delay 2 \
  --cacert "${ORB_CA_CERT:?set ORB_CA_CERT}" \
  "https://${ORB_HOSTNAME:?set ORB_HOSTNAME}:${ORB_HTTPS_PORT:-8443}/api/health/ready" >/dev/null
cp "$STATE_DIR/current.env" "$STATE_DIR/failed.env"
cp "$PREVIOUS" "$STATE_DIR/current.env"
