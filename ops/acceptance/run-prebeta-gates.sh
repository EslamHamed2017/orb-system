#!/usr/bin/env bash
set -euo pipefail
umask 077
fail() { printf 'pre-beta gate: %s\n' "$*" >&2; return 1; }
require() { [[ -n "${!1:-}" ]] || fail "$1 is required"; }
run_gates() {
  require ORB_PREBETA_BASE_URL; require ORB_PREBETA_ARTIFACT_DIGEST; require ORB_PREBETA_ENVIRONMENT_ID
  require ORB_PREBETA_ADAPTER_DIR; require ORB_PREBETA_OUTPUT_DIR
  [[ "${ORB_PREBETA_ALLOW_HTTP:-0}" == 1 || "$ORB_PREBETA_BASE_URL" =~ ^https:// ]] || fail 'ORB_PREBETA_BASE_URL must use HTTPS'
  [[ "$ORB_PREBETA_ARTIFACT_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || fail 'artifact digest must be sha256:<64 lowercase hex>'
  [[ "$ORB_PREBETA_ENVIRONMENT_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$ ]] || fail 'invalid environment identity'
  [[ -d "$ORB_PREBETA_ADAPTER_DIR" ]] || fail 'adapter directory does not exist'
  mkdir -p "$ORB_PREBETA_OUTPUT_DIR"
  local names=(scan security audit backup restore) name adapter report
  for name in "${names[@]}"; do
    adapter="$ORB_PREBETA_ADAPTER_DIR/$name"; report="$ORB_PREBETA_OUTPUT_DIR/$name.json"
    [[ -x "$adapter" && ! -L "$adapter" ]] || fail "missing regular executable adapter: $name"
    rm -f "$report"
    ORB_PREBETA_BASE_URL="$ORB_PREBETA_BASE_URL" ORB_PREBETA_ARTIFACT_DIGEST="$ORB_PREBETA_ARTIFACT_DIGEST" \
      ORB_PREBETA_ENVIRONMENT_ID="$ORB_PREBETA_ENVIRONMENT_ID" FAIL_GATE="${FAIL_GATE:-}" "$adapter" "$report" >"$ORB_PREBETA_OUTPUT_DIR/$name.log" 2>&1 || {
        printf 'adapter %s failed; see %s\n' "$name" "$ORB_PREBETA_OUTPUT_DIR/$name.log" >&2; return 1; }
    [[ -f "$report" && ! -L "$report" ]] || fail "$name adapter did not create a regular JSON report"
  done
  node --input-type=module - "$ORB_PREBETA_OUTPUT_DIR" "$ORB_PREBETA_ARTIFACT_DIGEST" "$ORB_PREBETA_ENVIRONMENT_ID" <<'NODE' || return 1
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [directory, artifactDigest, environmentId] = process.argv.slice(2);
const names = ['scan', 'security', 'audit', 'backup', 'restore'];
const reports = Object.fromEntries(names.map((name) => {
  const path = join(directory, `${name}.json`); let value;
  try { value = JSON.parse(readFileSync(path, 'utf8')); } catch (error) { throw new Error(`${name} report is not valid JSON: ${error.message}`); }
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(`${name} report must be an object`);
  if (value.artifactDigest !== artifactDigest || value.environmentId !== environmentId) throw new Error(`${name} report identity mismatch`);
  return [name, value];
}));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(reports.scan.passed === true && reports.scan.criticalFindings === 0, 'scan must pass with zero unaccepted Critical findings');
assert(reports.security.passed === true, 'security checks did not pass');
for (const key of ['sessionRotation','csrf','idor','upload','rateLimit','redaction','tls','encryption','immutability'])
  assert(reports.security.checks?.[key] === true, `security check failed or missing: ${key}`);
assert(reports.audit.passed === true && Number.isInteger(reports.audit.chainsVerified) && reports.audit.chainsVerified > 0 && reports.audit.hashMismatches === 0,
  'audit recomputation must verify at least one chain with zero mismatches');
assert(reports.backup.passed === true && reports.backup.encrypted === true && reports.backup.separateCopy === true, 'backup must be encrypted and separately copied');
assert(typeof reports.backup.backupId === 'string' && reports.backup.backupId.length > 0, 'backup ID is required');
assert(typeof reports.backup.objectSnapshotId === 'string' && reports.backup.objectSnapshotId.length > 0, 'object snapshot ID is required');
assert(Number.isFinite(reports.backup.rpoMinutes) && reports.backup.rpoMinutes >= 0 && reports.backup.rpoMinutes <= 15, 'backup RPO exceeds 15 minutes');
assert(reports.restore.passed === true && reports.restore.isolated === true, 'restore must pass in an isolated environment');
assert(reports.restore.targetEnvironment && reports.restore.targetEnvironment !== reports.restore.productionEnvironment, 'restore target must differ from production');
assert(!/(^|[-_.])prod(?:uction)?($|[-_.])/i.test(reports.restore.targetEnvironment), 'restore target looks like production');
assert(reports.restore.backupId === reports.backup.backupId && reports.restore.objectSnapshotId === reports.backup.objectSnapshotId, 'restore did not use the paired database/object snapshot');
assert(Number.isFinite(reports.restore.rtoMinutes) && reports.restore.rtoMinutes >= 0 && reports.restore.rtoMinutes <= 240, 'restore RTO exceeds four hours');
for (const key of ['rowsAndVersions','hashes','allocations','approvals','auditChain','objectLinks'])
  assert(reports.restore.integrity?.[key] === true, `restore integrity failed or missing: ${key}`);
assert(typeof reports.restore.evidenceId === 'string' && reports.restore.evidenceId.length > 0, 'restore evidence ID is required');
const reportSha256 = Object.fromEntries(names.map((name) => [name, createHash('sha256').update(readFileSync(join(directory, `${name}.json`))).digest('hex')]));
writeFileSync(join(directory, 'result-manifest.json'), `${JSON.stringify({ diagnosticOnly:true, earnsEvidence:false, artifactDigest, environmentId, reportSha256, gates:names, passed:true }, null, 2)}\n`, { mode:0o600 });
NODE
  printf 'pre-beta diagnostic gates passed: %s/result-manifest.json\n' "$ORB_PREBETA_OUTPUT_DIR"
}
self_test() {
  local root adapter_dir output name gate
  root="$(mktemp -d)"; trap 'rm -rf "$root"' RETURN; adapter_dir="$root/adapters"; mkdir -p "$adapter_dir"
  for name in scan security audit backup restore; do
    python3 - "$adapter_dir/$name" "$name" <<'PYADAPTER'
from pathlib import Path
import sys
path, name = sys.argv[1:]
body = '''#!/usr/bin/env bash
set -euo pipefail
out=$1
case NAME in
scan) critical=0; [[ ${FAIL_GATE:-} == scan ]] && critical=1; printf '{"artifactDigest":"%s","environmentId":"%s","passed":true,"criticalFindings":%s}\\n' "$ORB_PREBETA_ARTIFACT_DIGEST" "$ORB_PREBETA_ENVIRONMENT_ID" "$critical" >"$out" ;;
security) printf '{"artifactDigest":"%s","environmentId":"%s","passed":true,"checks":{"sessionRotation":true,"csrf":true,"idor":true,"upload":true,"rateLimit":true,"redaction":true,"tls":true,"encryption":true,"immutability":true}}\\n' "$ORB_PREBETA_ARTIFACT_DIGEST" "$ORB_PREBETA_ENVIRONMENT_ID" >"$out" ;;
audit) mismatches=0; [[ ${FAIL_GATE:-} == audit ]] && mismatches=1; printf '{"artifactDigest":"%s","environmentId":"%s","passed":true,"chainsVerified":2,"hashMismatches":%s}\\n' "$ORB_PREBETA_ARTIFACT_DIGEST" "$ORB_PREBETA_ENVIRONMENT_ID" "$mismatches" >"$out" ;;
backup) rpo=10; [[ ${FAIL_GATE:-} == backup ]] && rpo=16; printf '{"artifactDigest":"%s","environmentId":"%s","passed":true,"backupId":"db-1","objectSnapshotId":"obj-1","encrypted":true,"separateCopy":true,"rpoMinutes":%s}\\n' "$ORB_PREBETA_ARTIFACT_DIGEST" "$ORB_PREBETA_ENVIRONMENT_ID" "$rpo" >"$out" ;;
restore) links=true; [[ ${FAIL_GATE:-} == restore ]] && links=false; printf '{"artifactDigest":"%s","environmentId":"%s","passed":true,"isolated":true,"targetEnvironment":"orb-restore-test","productionEnvironment":"orb-production","backupId":"db-1","objectSnapshotId":"obj-1","rtoMinutes":30,"evidenceId":"ev-1","integrity":{"rowsAndVersions":true,"hashes":true,"allocations":true,"approvals":true,"auditChain":true,"objectLinks":%s}}\\n' "$ORB_PREBETA_ARTIFACT_DIGEST" "$ORB_PREBETA_ENVIRONMENT_ID" "$links" >"$out" ;;
esac
'''.replace('NAME', name)
Path(path).write_text(body); Path(path).chmod(0o700)
PYADAPTER
  done
  local digest="sha256:$(printf self-test | sha256sum | cut -d ' ' -f 1)" environment='orb-self-test'
  output="$root/pass"
  ORB_PREBETA_BASE_URL=http://127.0.0.1 ORB_PREBETA_ALLOW_HTTP=1 ORB_PREBETA_ARTIFACT_DIGEST="$digest" ORB_PREBETA_ENVIRONMENT_ID="$environment" \
    ORB_PREBETA_ADAPTER_DIR="$adapter_dir" ORB_PREBETA_OUTPUT_DIR="$output" run_gates >/dev/null
  [[ -f "$output/result-manifest.json" ]] || fail 'passing fixture produced no manifest'
  for gate in scan audit backup restore; do
    output="$root/fail-$gate"
    if (export FAIL_GATE="$gate"; ORB_PREBETA_BASE_URL=http://127.0.0.1 ORB_PREBETA_ALLOW_HTTP=1 ORB_PREBETA_ARTIFACT_DIGEST="$digest" ORB_PREBETA_ENVIRONMENT_ID="$environment" \
      ORB_PREBETA_ADAPTER_DIR="$adapter_dir" ORB_PREBETA_OUTPUT_DIR="$output" run_gates >/dev/null 2>&1); then fail "failing $gate fixture was accepted"; fi
    [[ ! -e "$output/result-manifest.json" ]] || fail "failing $gate fixture emitted a manifest"
  done
  printf 'pre-beta harness self-test passed: one passing fixture; scan/audit/backup/restore failures rejected\n'
}
case "${1:-}" in
  --self-test) [[ $# -eq 1 ]] || fail '--self-test accepts no additional arguments'; self_test ;;
  '') run_gates ;;
  *) fail "unknown argument: $1" ;;
esac
