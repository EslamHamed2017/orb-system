import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const workflow = readFileSync(resolve(import.meta.dirname, "../../.github/workflows/ci.yml"), "utf8");

test("CI serializes exact-ref evidence without cancelling an in-progress head", () => {
  assert.match(workflow, /^concurrency:\n  group: \${{ github\.workflow }}-\${{ github\.ref }}\n  cancel-in-progress: false$/m);
});
