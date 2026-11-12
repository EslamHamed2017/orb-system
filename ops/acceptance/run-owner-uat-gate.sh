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
[[ "$ORB_TEST_BASE_URL" =~ ^https://[^/]+(/.*)?$ ]] || {
  echo "owner UAT target must use HTTPS" >&2
  exit 2
}
python3 - "$ORB_TEST_BASE_URL" <<'PYURL'
from urllib.parse import urlparse
import ipaddress
import sys

parsed = urlparse(sys.argv[1])
host = parsed.hostname or ""
if parsed.username or parsed.password or parsed.fragment:
    raise SystemExit("owner UAT target must not contain credentials or a fragment")
if host.lower() == "localhost" or host.lower().endswith(".local"):
    raise SystemExit("owner UAT target must be an owner-approved deployed host")
try:
    address = ipaddress.ip_address(host)
except ValueError:
    pass
else:
    if address.is_loopback or address.is_private or address.is_link_local:
        raise SystemExit("owner UAT target must not be loopback, private, or link-local")
PYURL

corepack pnpm exec playwright test tests/acceptance/owner-uat.spec.ts --project=chromium
