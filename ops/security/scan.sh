#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
node --test tests/security/*.test.ts tests/integration/access/session-lifecycle.test.ts
report="$(mktemp)"
trap 'rm -f "$report"' EXIT
corepack pnpm audit --prod --json >"$report" || true
node scripts/verify-build-manifest.mjs --assert-audit "$report"
printf "ORB security scan PASS: abuse suite passed; zero High/Critical production dependency findings.\n"
