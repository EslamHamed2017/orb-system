#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

: "${ORB_TEST_BASE_URL:?owner-approved UAT target is required}"
: "${ORB_OWNER_UAT_AUTHORIZATION:?explicit owner UAT authorization is required}"
[[ "$ORB_OWNER_UAT_AUTHORIZATION" == "OWNER_APPROVED" ]] || {
  echo "owner UAT authorization was not explicitly granted" >&2
  exit 2
}
python3 ops/acceptance/validate_owner_uat_target.py "$ORB_TEST_BASE_URL"

[[ ! -e "$ORB_OWNER_UAT_EVIDENCE_DIR" ]] || {
  echo "owner UAT evidence directory already exists" >&2
  exit 2
}
mkdir -m 700 -- "$ORB_OWNER_UAT_EVIDENCE_DIR"
report="$ORB_OWNER_UAT_EVIDENCE_DIR/playwright-report.json"
manifest="$ORB_OWNER_UAT_EVIDENCE_DIR/manifest.json"

export ORB_EXPECTED_RELEASE_COMMIT="$(git rev-parse HEAD)"
PLAYWRIGHT_JSON_OUTPUT_FILE="$report" corepack pnpm exec playwright test \
  tests/acceptance/owner-uat.spec.ts --project=chromium --reporter=html,json
[[ -f "$report" && ! -L "$report" ]] || {
  echo "owner UAT JSON report was not produced safely" >&2
  exit 2
}
node scripts/owner-uat-evidence.mjs --report "$report" --output "$manifest"
printf 'owner UAT technical evidence recorded: %s\n' "$manifest"
