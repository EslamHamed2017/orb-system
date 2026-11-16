import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Native Node TypeScript tests require source extensions.
import { parseSupplierCollection, parseSupplierRecord } from "../../../src/ui/features/masters/supplier-response-validation.ts";
const valid = { id:"11111111-1111-4111-8111-111111111111", reference:"SUP-1", registeredName:"Atlas Coffee", displayNameAr:"أطلس للقهوة", countryCode:"ET", contactName:"Hana", email:"hana@example.com", phone:"+251 911 000 000", paymentCurrency:"USD", paymentTermsDays:30, status:"ACTIVE", version:1 };
test("supplier response validation accepts only the closed public contract", () => {
  assert.deepEqual(parseSupplierRecord(valid), valid);
  assert.deepEqual(parseSupplierCollection({items:[valid],nextCursor:null}), {items:[valid],nextCursor:null});
  for (const value of [{...valid,tenantId:"secret"},{...valid,countryCode:"ZZ"},{...valid,paymentCurrency:"US"},{...valid,email:null,phone:null},{...valid,version:0}]) assert.throws(()=>parseSupplierRecord(value));
});
