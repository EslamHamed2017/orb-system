import assert from "node:assert/strict";
import test from "node:test";

import { isCustomerCollection, isServerCustomer } from "../../../src/ui/features/masters/customer-response-validation.ts";

const customer = {
  id: "11111111-1111-4111-8111-111111111111",
  reference: "CUS-101",
  legalName: "Atlas Trading",
  contactName: "Mona Ali",
  email: "accounts@atlas.example",
  phone: "+971 50 123 4567",
  legalNameAr: null,
  countryCode: null,
  taxRegistrationNumber: null,
  paymentTermsDays: 0,
  billingAddress: null,
  status: "ACTIVE",
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
    { ...customer, reference: "cus-101" },
    { ...customer, reference: "CUS 101" },
    { ...customer, legalName: "\t" },
    { ...customer, contactName: "" },
    { ...customer, email: "not-an-email" },
    { ...customer, email: "Accounts@Atlas.Example" },
    { ...customer, legalName: " Atlas Trading" },
    { ...customer, contactName: "Mona  Ali" },
    { ...customer, legalName: "Atlas\tTrading" },
    { ...customer, contactName: "Mona\nAli" },
    { ...customer, phone: "050123" },
  ]) assert.equal(isServerCustomer(malformed), false, JSON.stringify(malformed));
});

test("customer success validation rejects invalid lifecycle, contact, and version values", () => {
  for (const malformed of [
    { ...customer, status: "ARCHIVED" },
    { ...customer, status: true },
    { ...customer, contactName: 12 },
    { ...customer, email: null, phone: null },
    { ...customer, version: "1" },
    { ...customer, version: 0 },
    { ...customer, version: -1 },
    { ...customer, version: 1.5 },
    { ...customer, version: Number.MAX_SAFE_INTEGER + 1 },
  ]) assert.equal(isServerCustomer(malformed), false, JSON.stringify(malformed));
});


test("customer wire shape includes the persisted business profile", () => {
  const profiled = { ...customer, legalNameAr: "شركة أطلس", countryCode: "AE", taxRegistrationNumber: "100200300", paymentTermsDays: 30, billingAddress: { line1: "Coffee District", line2: null, city: "Dubai", region: "Dubai", postalCode: null } };
  assert.equal(isServerCustomer(profiled), true);
  assert.equal(isServerCustomer({ ...profiled, countryCode: "UAE" }), false);
  assert.equal(isServerCustomer({ ...profiled, paymentTermsDays: -1 }), false);
});
