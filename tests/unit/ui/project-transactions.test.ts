import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectContextLinks } from "../../../src/ui/navigation/project-context-links.ts";

test("project context exposes the five QuickBooks-style tabs", () => {
  assert.deepEqual(buildProjectContextLinks("en","demo").map(x=>[x.key,x.label]),[
    ["overview","Overview"],["transactions","Transactions"],["shipments","Shipments"],["reports","Project reports"],["documents","Attachments"],
  ]);
});
