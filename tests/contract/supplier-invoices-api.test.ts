import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseYaml } from "./openapi-contract.test.ts";

const api = parseYaml(readFileSync("specs/001-orb-trade-operations/contracts/openapi.yaml", "utf8"));
const invoiceRoles = ["OWNER_ADMIN", "FINANCE_VIEWER"];

function operation(path: string): Record<string, any> {
  const value = api.paths[path]?.post;
  assert.ok(value, `missing POST ${path}`);
  return value;
}

function parameterRefs(value: Record<string, any>): string[] {
  return value.parameters.map((parameter: Record<string, string>) => parameter.$ref);
}

test("supplier invoices expose exactly the accepted create, submit, confirm and cancel operations", () => {
  const expected = [
    ["/supplier-shipments/{shipmentId}/invoices", "createSupplierInvoice"],
    ["/supplier-invoices/{invoiceId}/submit", "submitSupplierInvoice"],
    ["/supplier-invoices/{invoiceId}/confirm", "confirmSupplierInvoice"],
    ["/supplier-invoices/{invoiceId}/cancel", "cancelUnallocatedSupplierInvoice"],
  ] as const;

  for (const [path, operationId] of expected) {
    const command = operation(path);
    assert.equal(command.operationId, operationId);
    assert.deepEqual(command["x-required-roles"], invoiceRoles);
  }

  const invoicePaths = Object.entries(api.paths)
    .filter(([path, item]: [string, any]) => path.includes("supplier-invoice") || item.post?.tags?.includes("SupplierInvoices"))
    .map(([path]) => path)
    .sort();
  assert.deepEqual(invoicePaths, expected.map(([path]) => path).sort(), "no destructive edit/delete or unaccepted invoice endpoint may exist");
});

test("every invoice mutation carries exact concurrency, idempotency and CSRF controls", () => {
  const cases = [
    ["/supplier-shipments/{shipmentId}/invoices", "ShipmentId"],
    ["/supplier-invoices/{invoiceId}/submit", "InvoiceId"],
    ["/supplier-invoices/{invoiceId}/confirm", "InvoiceId"],
    ["/supplier-invoices/{invoiceId}/cancel", "InvoiceId"],
  ] as const;

  for (const [path, idParameter] of cases) {
    assert.deepEqual(
      parameterRefs(operation(path)),
      [idParameter, "IfMatch", "IdempotencyKey", "CsrfToken"].map((name) => `#/components/parameters/${name}`),
      path,
    );
  }
});

test("create requires supplier-attributable container lines and derives the invoice amount", () => {
  const create = operation("/supplier-shipments/{shipmentId}/invoices");
  assert.equal(create.requestBody.required, true);
  assert.equal(create.requestBody.content["application/json"].schema.$ref, "#/components/schemas/SupplierInvoiceInput");
  assert.equal(create.responses["201"].$ref, "#/components/responses/Entity");

  const input = api.components.schemas.SupplierInvoiceInput;
  const fields = ["supplierId", "reference", "invoiceDate", "currency", "evidenceId", "lines"];
  assert.equal(input.additionalProperties, false);
  assert.deepEqual(input.required, fields);
  assert.deepEqual(Object.keys(input.properties), fields);
  assert.equal(input.properties.supplierId.$ref, "#/components/schemas/Uuid");
  assert.equal(input.properties.invoiceDate.format, "date");
  assert.equal(input.properties.currency.$ref, "#/components/schemas/Currency");
  assert.equal(input.properties.evidenceId.$ref, "#/components/schemas/Uuid");
  assert.equal(input.properties.lines.type, "array");
  assert.equal(input.properties.lines.minItems, 1);
  assert.equal(input.properties.lines.items.$ref, "#/components/schemas/SupplierInvoiceLineInput");
  const line = api.components.schemas.SupplierInvoiceLineInput;
  assert.equal(line.additionalProperties, false);
  assert.deepEqual(line.required, ["shipmentLineId", "description", "quantity", "unitPrice"]);
  assert.deepEqual(Object.keys(line.properties), ["shipmentLineId", "description", "quantity", "unitPrice"]);
});

test("submit creates the fixed approval and confirm binds only its exact identifier", () => {
  const submit = operation("/supplier-invoices/{invoiceId}/submit");
  assert.equal(submit.requestBody, undefined, "submit cannot replace invoice facts");
  assert.equal(submit.responses["202"].$ref, "#/components/responses/Approval");

  const confirm = operation("/supplier-invoices/{invoiceId}/confirm");
  assert.equal(confirm.requestBody.$ref, "#/components/requestBodies/ApprovalBinding");
  assert.equal(confirm.responses["200"].$ref, "#/components/responses/Entity");
  const binding = api.components.schemas.ApprovalBinding;
  assert.equal(binding.additionalProperties, false);
  assert.deepEqual(binding.required, ["approvalId"]);
  assert.deepEqual(Object.keys(binding.properties), ["approvalId"]);
});

test("cancel is a reasoned command and all failures use the shared problem contract", () => {
  const cancel = operation("/supplier-invoices/{invoiceId}/cancel");
  assert.equal(cancel.requestBody.$ref, "#/components/requestBodies/Reason");
  assert.equal(cancel.responses["200"].$ref, "#/components/responses/Entity");
  for (const path of [
    "/supplier-shipments/{shipmentId}/invoices",
    "/supplier-invoices/{invoiceId}/submit",
    "/supplier-invoices/{invoiceId}/confirm",
    "/supplier-invoices/{invoiceId}/cancel",
  ]) assert.equal(operation(path).responses.default.$ref, "#/components/responses/Problem", path);
});


test("create route forwards the parsed supplier-attributable line payload", async () => {
  const { createCreateSupplierInvoicePostHandler } = await import("../../src/app/api/supplier-shipments/[shipmentId]/invoices/route.ts");
  let received: any;
  const handler = createCreateSupplierInvoicePostHandler({
    authenticate: async () => ({ userId: "finance", roles: ["FINANCE_VIEWER"] }),
    create: async (input: any) => { received = input; return { id: "invoice" }; },
  });
  const body = { supplierId: "019a5f9b-7c00-7000-8000-000000007004", reference: "S-1", invoiceDate: "2026-11-11", currency: "USD", evidenceId: "019a5f9b-7c00-7000-8000-000000007006", lines: [{ shipmentLineId: "019a5f9b-7c00-7000-8000-000000007021", description: "Coffee", quantity: "1", unitPrice: "2" }] };
  const response = await handler(new Request("https://orb.test/api/supplier-shipments/container/invoices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ shipmentId: "container" }) });
  assert.equal(response.status, 201);
  assert.deepEqual(received.body, body);
});
