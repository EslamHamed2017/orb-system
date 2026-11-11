import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const spec = readFileSync(resolve(ROOT, "specs/002-orb-concept-realignment/spec.md"), "utf8");

test("T005 freezes customer and supplier invoice grouping as distinct invariants", () => {
  assert.match(spec, /## Invoice grouping contract/);
  assert.match(spec, /one active customer sales invoice per sales shipment/i);
  assert.match(spec, /sales invoice lines must reference only lines from that same sales shipment/i);
  assert.match(spec, /one supplier only/i);
  assert.match(spec, /separate supplier invoice for each supplier represented/i);
  assert.match(spec, /physical supplier container does not define invoice grouping/i);
});
