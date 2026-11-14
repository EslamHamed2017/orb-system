#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

assert_clean_checkout() {
  [[ -z "$(git status --porcelain=v1 --untracked-files=all)" ]] || {
    echo "owner UAT checkout must be clean so evidence matches the tested commit" >&2
    exit 2
  }
}

: "${ORB_TEST_BASE_URL:?owner-approved UAT target is required}"
: "${ORB_APPROVED_RELEASE_COMMIT:?owner-approved release candidate commit is required}"
[[ "$ORB_APPROVED_RELEASE_COMMIT" =~ ^[a-f0-9]{40}$ ]] || {
  echo "approved release commit must be a full lowercase SHA-1" >&2
  exit 2
}
: "${ORB_RELEASE_CANDIDATE_MANIFEST:?signed release-candidate manifest is required}"
: "${ORB_RELEASE_PUBLIC_KEY_PATH:?release-candidate public key is required}"
ops/acceptance/verify-owner-uat-candidate.sh \
  "$ORB_RELEASE_CANDIDATE_MANIFEST" "$ORB_RELEASE_PUBLIC_KEY_PATH" "$ORB_APPROVED_RELEASE_COMMIT"
: "${ORB_OWNER_UAT_AUTHORIZATION:?explicit owner UAT authorization is required}"
[[ "$ORB_OWNER_UAT_AUTHORIZATION" == "OWNER_APPROVED" ]] || {
  echo "owner UAT authorization was not explicitly granted" >&2
  exit 2
}
python3 ops/acceptance/validate_owner_uat_target.py "$ORB_TEST_BASE_URL"
assert_clean_checkout

[[ ! -e "$ORB_OWNER_UAT_EVIDENCE_DIR" ]] || {
  echo "owner UAT evidence directory already exists" >&2
  exit 2
}
mkdir -m 700 -- "$ORB_OWNER_UAT_EVIDENCE_DIR"
report="$ORB_OWNER_UAT_EVIDENCE_DIR/playwright-report.json"
manifest="$ORB_OWNER_UAT_EVIDENCE_DIR/manifest.json"
playwright_output="$ORB_OWNER_UAT_EVIDENCE_DIR/playwright-output"
cleanup_sensitive_artifacts() {
  rm -f -- "$report"
  rm -rf -- "$playwright_output"
}
trap cleanup_sensitive_artifacts EXIT

readonly release_commit="$(git rev-parse HEAD)"
[[ "$release_commit" =~ ^[a-f0-9]{40}$ ]] || {
  echo "owner UAT checkout does not resolve to a full commit" >&2
  exit 2
}
[[ "$release_commit" == "$ORB_APPROVED_RELEASE_COMMIT" ]] || {
  echo "owner UAT checkout does not match the approved release candidate commit" >&2
  exit 2
}
export ORB_EXPECTED_RELEASE_COMMIT="$release_commit"
PLAYWRIGHT_JSON_OUTPUT_FILE="$report" corepack pnpm exec playwright test \
  tests/acceptance/owner-uat.spec.ts --project=chromium --workers=1 --timeout=30000 --retries=0 --repeat-each=1 --output="$playwright_output" --reporter=json
assert_clean_checkout
[[ -f "$report" && ! -L "$report" ]] || {
  echo "owner UAT JSON report was not produced safely" >&2
  exit 2
}
[[ "$(git rev-parse HEAD)" == "$release_commit" ]] || {
  echo "owner UAT checkout changed while the technical journey was running" >&2
  exit 2
}
node scripts/owner-uat-evidence.mjs --report "$report" --output "$manifest" --git-commit "$release_commit"
printf 'owner UAT technical evidence recorded: %s\n' "$manifest"
