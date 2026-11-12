#!/bin/sh
set -eu
BASE_URL=${1:-${ORB_CANDIDATE_BASE_URL:-}}
OUTPUT=${ORB_HEALTH_EVIDENCE_FILE:-}
[ -n "$BASE_URL" ] || { printf 'health-check: candidate base URL is required\n' >&2; exit 2; }
[ -n "$OUTPUT" ] || { printf 'health-check: ORB_HEALTH_EVIDENCE_FILE is required\n' >&2; exit 2; }
case "$BASE_URL" in http://127.0.0.1:*|http://localhost:*|https://*) ;; *) printf 'health-check: only loopback HTTP or HTTPS is allowed\n' >&2; exit 2;; esac
tmp=$(mktemp -d); trap 'rm -rf -- "$tmp"' EXIT HUP INT TERM
curl --fail --silent --show-error --max-time 10 "$BASE_URL/api/health/live" > "$tmp/live.json"
curl --fail --silent --show-error --max-time 10 "$BASE_URL/api/health/ready" > "$tmp/ready.json"
python3 - "$tmp/live.json" "$tmp/ready.json" "$OUTPUT" <<'INNER'
import hashlib, json, os, sys
live_path, ready_path, output = sys.argv[1:]
with open(live_path, encoding="utf-8") as handle: live=json.load(handle)
with open(ready_path, encoding="utf-8") as handle: ready=json.load(handle)
assert live.get("status") == "live", live
assert ready.get("status") == "ready", ready
assert ready.get("checks") == {"auditChain":"up","database":"up","objectStorage":"up"}, ready
payload={"schemaVersion":1,"liveStatus":"live","readyStatus":"ready","checks":ready["checks"],"liveResponseSha256":hashlib.sha256(open(live_path,"rb").read()).hexdigest(),"readyResponseSha256":hashlib.sha256(open(ready_path,"rb").read()).hexdigest()}
os.makedirs(os.path.dirname(os.path.abspath(output)), exist_ok=True)
with open(output+".tmp","w",encoding="utf-8") as handle: json.dump(payload,handle,indent=2,sort_keys=True); handle.write("\n")
os.replace(output+".tmp",output)
INNER
printf 'candidate liveness and readiness passed: %s\n' "$OUTPUT"
