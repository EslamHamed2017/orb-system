#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
free_port() { python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()'; }
export NODE_ENV=production
export ORB_TEST_PORT="${ORB_TEST_PORT:-$(free_port)}"
export ORB_TEST_BASE_URL="http://127.0.0.1:${ORB_TEST_PORT}"
export ORB_APP_ORIGIN="$ORB_TEST_BASE_URL"
export ORB_ALLOWED_ORIGINS="$ORB_TEST_BASE_URL"
export AUTH_IDLE_MINUTES=30 AUTH_ABSOLUTE_MINUTES=120
export ENCRYPTION_KEY_BASE64="${ENCRYPTION_KEY_BASE64:-$(openssl rand -base64 32)}"
export TELEMETRY_ENDPOINT=http://127.0.0.1/telemetry
export BACKUP_STATUS_ENDPOINT=http://127.0.0.1/backup
export ORB_AUDIT_CHAIN_HEALTHY=1
if [[ "${ORB_CROSS_BROWSER_SKIP_BUILD:-0}" != 1 ]]; then
  corepack pnpm build
fi
ORB_TEST_MANAGED_SERVER=1 corepack pnpm exec playwright test tests/acceptance/cross-browser-smoke.spec.ts \
  --project=firefox \
  --project=webkit
printf 'cross-browser smoke passed: firefox=passed; webkit=passed; locales=en,ar\n'
