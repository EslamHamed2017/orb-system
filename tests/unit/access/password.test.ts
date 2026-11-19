import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";

const sample = () => `Tst${randomBytes(8).toString("hex")}9`;
import { hashPassword, passwordPolicyViolation, verifyPassword } from "../../../src/modules/access/password.ts";

test("scrypt hashes verify the right password and reject the wrong one", async () => {
  const secret = sample();
  const hash = await hashPassword(secret);
  assert.match(hash, /^scrypt\$32768\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.equal(await verifyPassword(secret, hash), true);
  assert.equal(await verifyPassword(secret.toLowerCase(), hash), false);
  assert.notEqual(await hashPassword(secret), hash, "salts must differ");
});

test("malformed stored hashes never verify", async () => {
  for (const stored of ["", "plain", "scrypt$1$2$3", "bcrypt$a$b$c$d$e", "scrypt$x$8$1$AAAA$BBBB"]) {
    assert.equal(await verifyPassword("anything-123", stored), false, stored);
  }
});

test("password policy requires length, letters, and digits (Arabic letters count)", () => {
  assert.match(passwordPolicyViolation("short1") ?? "", /at least 10/);
  assert.match(passwordPolicyViolation("onlyletters-here") ?? "", /letters and digits/);
  assert.match(passwordPolicyViolation("1234567890") ?? "", /letters and digits/);
  assert.equal(passwordPolicyViolation(sample()), null);
  assert.equal(passwordPolicyViolation("كلمةمرور٢٠٢٦ab1"), null);
  assert.match(passwordPolicyViolation(undefined) ?? "", /required/);
});
