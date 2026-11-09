#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT"
MANIFEST=${2:-artifacts/candidates/beta/manifest.json}
fail() { printf 'freeze-candidate: %s\n' "$*" >&2; exit 2; }
sha_file() { sha256sum "$1" | cut -d ' ' -f 1; }
require_hex() { case "$2" in *[!0-9a-f]*|'') fail "$1 must be lowercase hexadecimal";; esac; [ "${#2}" -eq 64 ] || fail "$1 must contain 64 hexadecimal characters"; }
canonical_payload() {
  python3 - "$1" <<'INNER'
import json, sys
with open(sys.argv[1], encoding="utf-8") as handle: document = json.load(handle)
sys.stdout.write(json.dumps(document["signedPayload"], sort_keys=True, separators=(",", ":"), ensure_ascii=False))
INNER
}
verify_manifest() {
  [ -f "$MANIFEST" ] || fail "manifest does not exist: $MANIFEST"
  : "${ORB_RELEASE_PUBLIC_KEY_PATH:?ORB_RELEASE_PUBLIC_KEY_PATH is required for verification}"
  [ -f "$ORB_RELEASE_PUBLIC_KEY_PATH" ] || fail "release public key does not exist"
  tmp=$(mktemp -d); trap 'rm -rf -- "$tmp"' EXIT HUP INT TERM
  canonical_payload "$MANIFEST" > "$tmp/payload.json"
  python3 - "$MANIFEST" "$tmp/signature.bin" <<'INNER'
import base64, json, sys
with open(sys.argv[1], encoding="utf-8") as handle: document = json.load(handle)
assert document.get("schemaVersion") == 1
assert document.get("signature", {}).get("algorithm") == "RSA-SHA256"
with open(sys.argv[2], "wb") as handle: handle.write(base64.b64decode(document["signature"]["valueBase64"], validate=True))
INNER
  openssl dgst -sha256 -verify "$ORB_RELEASE_PUBLIC_KEY_PATH" -signature "$tmp/signature.bin" "$tmp/payload.json" >/dev/null || fail "manifest signature verification failed"
  expected_key=$(openssl pkey -pubin -in "$ORB_RELEASE_PUBLIC_KEY_PATH" -outform DER 2>/dev/null | sha256sum | cut -d ' ' -f 1)
  actual_key=$(python3 - "$MANIFEST" <<'INNER'
import json, sys
with open(sys.argv[1], encoding="utf-8") as handle: print(json.load(handle)["signature"]["publicKeySha256"])
INNER
)
  [ "$expected_key" = "$actual_key" ] || fail "manifest signing-key fingerprint mismatch"
  python3 - "$MANIFEST" <<'INNER'
import json, re, sys
with open(sys.argv[1], encoding="utf-8") as handle: p = json.load(handle)["signedPayload"]
assert p["candidate"] == "beta"
assert p["evidenceAwarded"] is False and p["deploymentPerformed"] is False
assert p["openapiOperationCount"] == 79
for key in ("sourceSha256", "lockSha256", "openapiSha256", "buildManifestSha256", "containerSha256", "sbomSha256"):
    assert re.fullmatch(r"[0-9a-f]{64}", p[key]), key
assert re.fullmatch(r"[0-9a-f]{40,64}", p["gitCommit"])
assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", p["frozenAtUtc"])
INNER
  printf 'verified signed beta candidate manifest: %s\n' "$MANIFEST"
}
case "${1:-}" in
  --verify) verify_manifest; exit 0 ;;
  --freeze) ;;
  *) fail "usage: $0 --freeze [manifest] | --verify [manifest]" ;;
esac
[ -z "$(git status --porcelain --untracked-files=all)" ] || fail "working tree must be completely clean before freezing"
: "${ORB_CANDIDATE_IMAGE:?ORB_CANDIDATE_IMAGE must end in @sha256:<64 lowercase hex>}"
: "${ORB_SBOM_FILE:?ORB_SBOM_FILE is required}"
: "${ORB_RELEASE_SIGNING_KEY_PATH:?ORB_RELEASE_SIGNING_KEY_PATH is required}"
[ -f "$ORB_SBOM_FILE" ] && [ ! -L "$ORB_SBOM_FILE" ] || fail "SBOM must be a regular non-symlink file"
[ -f "$ORB_RELEASE_SIGNING_KEY_PATH" ] && [ ! -L "$ORB_RELEASE_SIGNING_KEY_PATH" ] || fail "signing key must be a regular non-symlink file"
[ -f .next/build-manifest.json ] || fail "missing .next/build-manifest.json; run the accepted production build first"
case "$ORB_CANDIDATE_IMAGE" in *@sha256:*) container_sha=${ORB_CANDIDATE_IMAGE##*@sha256:} ;; *) fail "candidate image must be digest pinned";; esac
require_hex "container digest" "$container_sha"
corepack pnpm exec node --test tests/contract/openapi-contract.test.ts tests/contract/traceability.test.ts tests/contract/deferred-surface.test.ts
git_commit=$(git rev-parse HEAD)
source_sha=$(git archive --format=tar "$git_commit" | sha256sum | cut -d ' ' -f 1)
lock_sha=$(sha_file pnpm-lock.yaml)
openapi_sha=$(sha_file specs/001-orb-trade-operations/contracts/openapi.yaml)
build_sha=$(sha_file .next/build-manifest.json)
sbom_sha=$(sha_file "$ORB_SBOM_FILE")
frozen_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
mkdir -p "$(dirname -- "$MANIFEST")"
tmp=$(mktemp -d); trap 'rm -rf -- "$tmp"' EXIT HUP INT TERM
openssl pkey -in "$ORB_RELEASE_SIGNING_KEY_PATH" -pubout -out "$tmp/public.pem" 2>/dev/null || fail "release signing key is not usable"
public_sha=$(openssl pkey -pubin -in "$tmp/public.pem" -outform DER 2>/dev/null | sha256sum | cut -d ' ' -f 1)
python3 - "$tmp/payload.json" "$frozen_at" "$git_commit" "$source_sha" "$lock_sha" "$openapi_sha" "$build_sha" "$ORB_CANDIDATE_IMAGE" "$container_sha" "$ORB_SBOM_FILE" "$sbom_sha" <<'INNER'
import json, sys
(_, output, frozen_at, git_commit, source_sha, lock_sha, openapi_sha, build_sha, image, container_sha, sbom_file, sbom_sha) = sys.argv
payload = {"candidate":"beta","frozenAtUtc":frozen_at,"gitCommit":git_commit,"sourceSha256":source_sha,"lockSha256":lock_sha,"openapiSha256":openapi_sha,"openapiOperationCount":79,"buildManifestSha256":build_sha,"containerImage":image,"containerSha256":container_sha,"sbomFile":sbom_file,"sbomSha256":sbom_sha,"contractGuard":"50 tests passed: openapi-contract, traceability, deferred-surface","evidenceAwarded":False,"deploymentPerformed":False}
with open(output, "w", encoding="utf-8") as handle: json.dump(payload, handle, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
INNER
openssl dgst -sha256 -sign "$ORB_RELEASE_SIGNING_KEY_PATH" -out "$tmp/signature.bin" "$tmp/payload.json"
python3 - "$tmp/payload.json" "$tmp/signature.bin" "$MANIFEST.tmp" "$public_sha" <<'INNER'
import base64, json, os, sys
with open(sys.argv[1], encoding="utf-8") as handle: payload=json.load(handle)
with open(sys.argv[2], "rb") as handle: signature=base64.b64encode(handle.read()).decode("ascii")
document={"schemaVersion":1,"signedPayload":payload,"signature":{"algorithm":"RSA-SHA256","publicKeySha256":sys.argv[4],"valueBase64":signature}}
with open(sys.argv[3], "w", encoding="utf-8") as handle: json.dump(document,handle,indent=2,sort_keys=True); handle.write("\n")
os.chmod(sys.argv[3],0o644)
INNER
mv "$MANIFEST.tmp" "$MANIFEST"
ORB_RELEASE_PUBLIC_KEY_PATH="$tmp/public.pem" "$0" --verify "$MANIFEST"
printf 'candidate frozen without deployment or E evidence: %s\n' "$MANIFEST"
