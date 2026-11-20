import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectContextLinks } from "../../../src/ui/navigation/project-context-links.ts";

test("project context exposes the approved granular 360-degree destinations", () => {
  assert.deepEqual(buildProjectContextLinks("en","demo").map(x=>[x.key,x.label]),[
    ["overview","Overview"],
    ["contracts","Contracts"],
    ["supplierContainer","Supplier container"],
    ["salesShipment","Sales shipment"],
    ["accounts","Accounts"],
    ["expenses","Expenses"],
    ["claims","Claims"],
    ["closure","Project closure"],
    ["audit","Audit"],
    ["reports","Project reports"],
  ]);
});
