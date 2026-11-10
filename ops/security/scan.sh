#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
node --test tests/security/*.test.ts tests/integration/access/session-lifecycle.test.ts
corepack pnpm audit --prod --audit-level critical
printf "ORB security scan PASS: abuse suite passed; zero Critical production dependency findings.\n"
