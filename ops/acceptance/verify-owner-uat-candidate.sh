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
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
ORB_RELEASE_PUBLIC_KEY_PATH="$public_key" ops/release/verify-candidate.sh "$manifest"
candidate_commit="$(python3 - "$manifest" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as handle:
    print(json.load(handle)["signedPayload"]["gitCommit"])
PY
)"
[[ "$candidate_commit" == "$approved_commit" ]] || {
  echo "signed release-candidate commit does not match the owner-approved commit" >&2
  exit 2
}
