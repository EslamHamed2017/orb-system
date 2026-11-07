#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${RESTORE_TARGET_ENVIRONMENT:?RESTORE_TARGET_ENVIRONMENT is required}"
: "${PRODUCTION_ENVIRONMENT:?PRODUCTION_ENVIRONMENT is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${RESTORE_OBJECT_TARGET:?RESTORE_OBJECT_TARGET is required}"
: "${RESTORE_SNAPSHOT_PREFIX:?RESTORE_SNAPSHOT_PREFIX is required}"
if [[ "$RESTORE_TARGET_ENVIRONMENT" == "$PRODUCTION_ENVIRONMENT" || "$RESTORE_TARGET_ENVIRONMENT" =~ (^|[-_.])prod(uction)?($|[-_.]) ]]; then echo "refusing production restore target" >&2; exit 2; fi
[[ "$RESTORE_DATABASE_URL" != "${PRODUCTION_DATABASE_URL:-__unset__}" ]] || { echo "refusing production database" >&2; exit 2; }
command -v age >/dev/null && command -v pg_restore >/dev/null && command -v sha256sum >/dev/null
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
for item in database.dump objects.tar manifest.sha256 manifest.json; do age --decrypt --output "$work/$item" "${RESTORE_SNAPSHOT_PREFIX}-${item}.age"; done
(cd "$work" && sha256sum --check manifest.sha256)
mkdir -p "$RESTORE_OBJECT_TARGET"; tar --extract --file="$work/objects.tar" --directory="$RESTORE_OBJECT_TARGET"
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" "$work/database.dump"
printf '%s\n' "isolated restore completed: $RESTORE_TARGET_ENVIRONMENT"
