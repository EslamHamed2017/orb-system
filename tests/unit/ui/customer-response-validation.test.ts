import assert from "node:assert/strict";
import test from "node:test";

import { isCustomerCollection, isServerCustomer } from "../../../src/ui/features/masters/customer-response-validation.ts";

const customer = {
  id: "11111111-1111-4111-8111-111111111111",
  reference: "CUS-101",
  legalNameAr: "شركة أطلس",
  legalNameEn: "Atlas Trading",
  countryCode: "AE",
  active: true,
  version: 1,
};

test("customer success wire shapes are closed", () => {
  assert.equal(isServerCustomer(customer), true);
  assert.equal(isCustomerCollection({ items: [customer], nextCursor: null }), true);
  assert.equal(isServerCustomer({ ...customer, unexpected: true }), false);
  assert.equal(isCustomerCollection({ items: [customer], nextCursor: null, unexpected: true }), false);
  assert.equal(isCustomerCollection({ items: [customer] }), false);
  assert.equal(isCustomerCollection({ items: [customer], nextCursor: "cursor" }), false);
});

test("customer success validation rejects malformed identities and required values", () => {
  for (const malformed of [
    { ...customer, id: "not-a-uuid" },
    { ...customer, reference: "   " },
    { ...customer, legalNameAr: "\t" },
    { ...customer, legalNameEn: "" },
  ]) assert.equal(isServerCustomer(malformed), false, JSON.stringify(malformed));
});

test("customer success validation rejects invalid country, status, and version values", () => {
  for (const malformed of [
    { ...customer, countryCode: "ae" },
    { ...customer, countryCode: "ARE" },
    { ...customer, countryCode: 12 },
    { ...customer, active: "true" },
    { ...customer, version: "1" },
    { ...customer, version: 0 },
    { ...customer, version: -1 },
    { ...customer, version: 1.5 },
    { ...customer, version: Number.MAX_SAFE_INTEGER + 1 },
  ]) assert.equal(isServerCustomer(malformed), false, JSON.stringify(malformed));
});
