#!/usr/bin/env bash
set -euo pipefail

[[ "$#" -eq 3 ]] || {
  echo "usage: verify-owner-uat-candidate.sh MANIFEST PUBLIC_KEY APPROVED_COMMIT" >&2
  exit 2
}
manifest="$1"
public_key="$2"
approved_commit="$3"
[[ -f "$manifest" && ! -L "$manifest" ]] || {
  echo "release-candidate manifest must be a regular non-symlink file" >&2
  exit 2
}
[[ -f "$public_key" && ! -L "$public_key" ]] || {
  echo "release-candidate public key must be a regular non-symlink file" >&2
  exit 2
}
[[ "$approved_commit" =~ ^[a-f0-9]{40}$ ]] || {
  echo "approved release commit must be a full lowercase SHA-1" >&2
  exit 2
}
snapshot_dir="$(mktemp -d)"
trap 'rm -rf -- "$snapshot_dir"' EXIT HUP INT TERM
manifest_snapshot="$snapshot_dir/manifest.json"
python3 - "$manifest" "$manifest_snapshot" <<'PY'
import os, stat, sys

source_fd = os.open(sys.argv[1], os.O_RDONLY | os.O_NOFOLLOW)
try:
    source_stat = os.fstat(source_fd)
    if not stat.S_ISREG(source_stat.st_mode):
        raise SystemExit("release-candidate manifest must be a regular non-symlink file")
    output_fd = os.open(sys.argv[2], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(source_fd, "rb", closefd=False) as source, os.fdopen(output_fd, "wb") as output:
        output.write(source.read())
finally:
    os.close(source_fd)
PY
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
ORB_RELEASE_PUBLIC_KEY_PATH="$public_key" ops/release/verify-candidate.sh "$manifest_snapshot"
candidate_commit="$(python3 - "$manifest_snapshot" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as handle:
    print(json.load(handle)["signedPayload"]["gitCommit"])
PY
)"
[[ "$candidate_commit" == "$approved_commit" ]] || {
  echo "signed release-candidate commit does not match the owner-approved commit" >&2
  exit 2
}
