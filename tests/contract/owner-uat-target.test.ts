import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const validator = resolve(ROOT, "ops/acceptance/validate_owner_uat_target.py");

function validateWithAddresses(target: string, addresses: string[]) {
  const code = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("validator", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
addresses = json.loads(sys.argv[3])
def resolver(host, port, type=None):
    return [(2, 1, 6, "", (address, port)) for address in addresses]
module.validate_target(sys.argv[2], resolver=resolver)
`;
  return spawnSync("python3", ["-c", code, validator, target, JSON.stringify(addresses)], { encoding: "utf8" });
}

test("owner UAT target accepts credential-free HTTPS only when every resolved address is global", () => {
  const result = validateWithAddresses("https://uat.orb.example/review", ["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("owner UAT target rejects DNS names resolving to non-global infrastructure", () => {
  for (const address of ["127.0.0.1", "10.0.0.8", "169.254.169.254", "192.0.2.10", "::1", "fd00::8", "fe80::1"]) {
    const result = validateWithAddresses("https://uat.orb.example", ["93.184.216.34", address]);
    assert.notEqual(result.status, 0, `accepted non-global address ${address}`);
    assert.match(result.stderr, /globally routable/i);
  }
});

test("owner UAT target rejects malformed, credentialed, local, fragmented, or unresolved targets", () => {
  for (const target of ["http://uat.orb.example", "https://user:secret@uat.orb.example", "https://localhost", "https://orb.local", "https://uat.orb.example/#token"]) {
    const result = validateWithAddresses(target, ["93.184.216.34"]);
    assert.notEqual(result.status, 0, `accepted unsafe target ${target}`);
  }
  const unresolved = validateWithAddresses("https://uat.orb.example", []);
  assert.notEqual(unresolved.status, 0);
  assert.match(unresolved.stderr, /did not resolve/i);
});
