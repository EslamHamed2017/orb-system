#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is required}"
: "${BACKUP_OBJECT_SOURCE:?BACKUP_OBJECT_SOURCE is required}"
: "${BACKUP_SEPARATE_COPY_DIR:?BACKUP_SEPARATE_COPY_DIR is required}"
: "${BACKUP_ENCRYPTION_RECIPIENT:?BACKUP_ENCRYPTION_RECIPIENT is required}"
command -v pg_dump >/dev/null && command -v age >/dev/null && command -v sha256sum >/dev/null
stamp="$(date -u +%Y%m%dT%H%M%SZ)"; work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
mkdir -p "$BACKUP_SEPARATE_COPY_DIR"
case "$(realpath -m "$BACKUP_SEPARATE_COPY_DIR")/" in "$(realpath -m "$BACKUP_OBJECT_SOURCE")/"*) echo "separate copy cannot be inside object source" >&2; exit 2;; esac
pg_dump --format=custom --no-owner --no-privileges --file="$work/database.dump" "$BACKUP_DATABASE_URL"
tar --create --file="$work/objects.tar" --directory="$BACKUP_OBJECT_SOURCE" .
sha256sum "$work/database.dump" "$work/objects.tar" | sed "s#$work/##" > "$work/manifest.sha256"
printf '{"completedAt":"%s","database":"database.dump","objects":"objects.tar"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$work/manifest.json"
for item in database.dump objects.tar manifest.sha256 manifest.json; do age --encrypt --recipient "$BACKUP_ENCRYPTION_RECIPIENT" --output "$BACKUP_SEPARATE_COPY_DIR/${stamp}-${item}.age" "$work/$item"; done
printf '%s\n' "$stamp"
