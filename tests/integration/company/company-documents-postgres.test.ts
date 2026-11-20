import assert from "node:assert/strict";
import test from "node:test";
import { buildTrade, params } from "../support/trade-fixture.ts";

/** Company settings print on documents; VAT chosen at issue is added to what the customer owes, revenue stays net. */
const databaseUrl = process.env.ORB_TEST_DATABASE_URL;
const integration = databaseUrl ? test : test.skip;
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const today = new Date().toISOString().slice(0, 10);

integration("owners keep the company profile; tax invoices print it with VAT added to the amount due", async () => {
  const t = await buildTrade(databaseUrl!);
  const settings = await import("../../../src/app/api/settings/route.ts");
  const issue = await import("../../../src/app/api/sales-shipments/[shipmentId]/sales-invoice/route.ts");
  const printData = await import("../../../src/app/api/sales-invoices/[invoiceId]/print-data/route.ts");
  const accounts = await import("../../../src/app/api/accounts/[recordType]/route.ts");
  const profit = await import("../../../src/app/api/projects/[projectId]/profit/route.ts");
  const patch = (who: "owner" | "finance", version: number, body: unknown) => {
    const request = t.post("/api/settings", who, body);
    const headers = new Headers(request.headers); headers.set("if-match", `"${version}"`);
    return settings.PATCH(new Request(request.url, { method: "PATCH", headers, body: JSON.stringify(body) }));
  };
  try {
    const initial = await t.ok<{ version: number; company: { legalNameEn: string; vatRegistered: boolean } }>(await settings.GET(t.get("/api/settings", "owner")));
    assert.equal(initial.company.vatRegistered, false);
    assert.equal((await settings.GET(t.get("/api/settings", "finance"))).status, 403, "owner only");
    const company = { legalNameEn: "Gulf Bean Trading LLC", legalNameAr: "الخليج للبن ذ.م.م", addressEn: "Office 1204, Business Bay, Dubai", phone: "+971 4 000 0000", email: "accounts@gulfbean.ae",
      trn: "100000000000003", licenceNo: "1234567", bankName: "Emirates NBD", bankAccountName: "Gulf Bean Trading LLC", iban: "AE070331234567890123456", swift: "EBILAEAD", bankCurrency: "AED",
      termsEn: "Payment within 30 days.", termsAr: "السداد خلال 30 يوماً.", brandColor: "#0b5d3b", documentLanguage: "BILINGUAL", vatRegistered: true, standardVatRate: "5", logoDataUrl: PNG };
    assert.equal((await patch("owner", initial.version, { reason: "Set company details", patch: { company: { ...company, trn: "123" } } })).status, 422, "TRN has 15 digits");
    assert.equal((await patch("owner", initial.version, { reason: "x", patch: { company } })).status, 422, "a reason is required");
    const saved = await t.ok<{ version: number; company: typeof company }>(await patch("owner", initial.version, { reason: "Set company details", patch: { company } }));
    assert.equal(saved.company.iban, "AE070331234567890123456");
    assert.equal(saved.company.logoDataUrl, PNG);
    assert.equal((await patch("owner", initial.version, { reason: "Stale update", patch: { company: { phone: "1" } } })).status, 409, "stale version");
    assert.equal((await patch("finance", saved.version, { reason: "Not allowed", patch: { company: { phone: "1" } } })).status, 403);

    await t.confirmShipments();
    const invoice = await t.ok<{ id: string; amount: string; vat: { treatment: string; rate: string; amount: string; net: string } }>(
      await issue.POST(t.post(`/api/sales-shipments/${t.salesShipment.id}/sales-invoice`, "finance", { invoiceDate: today, vatTreatment: "STANDARD" }), params({ shipmentId: t.salesShipment.id })), 201);
    assert.deepEqual([invoice.vat.treatment, invoice.vat.rate, invoice.vat.net, invoice.vat.amount, invoice.amount], ["STANDARD", "5.00", "117120.00", "5856.00", "122976.00"]);

    const print = await t.ok<{ company: { legalNameEn: string; trn: string; iban: string; logoDataUrl: string; vatRegistered: boolean }; invoice: { vat: { amount: string } } }>(
      await printData.GET(t.get(`/api/sales-invoices/${invoice.id}/print-data`, "finance"), params({ invoiceId: invoice.id })));
    assert.deepEqual([print.company.legalNameEn, print.company.trn, print.company.iban, print.company.vatRegistered], ["Gulf Bean Trading LLC", "100000000000003", "AE070331234567890123456", true]);
    assert.equal(print.company.logoDataUrl, PNG);

    const register = await t.ok<{ items: { id: string; amount: string; outstandingAmount: string }[] }>(await accounts.GET(t.get(`/api/accounts/sales-invoices?projectId=${t.project.id}`, "finance"), params({ recordType: "sales-invoices" })));
    assert.deepEqual(register.items.filter((r) => r.id === invoice.id).map((r) => [r.amount, r.outstandingAmount]), [["122976.000000", "122976.000000"]], "the customer owes the VAT too");
    const margin = await t.ok<{ measures: { actual: { revenue: string } } }>(await profit.GET(t.get(`/api/projects/${t.project.id}/profit`, "finance"), params({ projectId: t.project.id })));
    assert.equal(margin.measures.actual.revenue, "117120.00", "revenue is net of VAT");

    const history = (await t.sql.query(`SELECT "version", "logo_changed" FROM "CompanyProfileHistory" WHERE "tenant_id" = $1 ORDER BY "version"`, [t.tenant])).rows;
    assert.deepEqual(history.map((r) => [r.version, r.logo_changed]), [[2, true]]);
  } finally {
    await t.sql.end();
  }
});

integration("statements of account list invoices with VAT and age them; every role reads the document letterhead", async () => {
  const t = await buildTrade(databaseUrl!);
  const statements = await import("../../../src/app/api/statements/[statementType]/[subjectId]/route.ts");
  const letterhead = await import("../../../src/app/api/company/document-profile/route.ts");
  const issue = await import("../../../src/app/api/sales-shipments/[shipmentId]/sales-invoice/route.ts");
  const read = (who: "ops" | "finance" | "owner", type: string, id: string) => statements.GET(t.get(`/api/statements/${type}/${id}`, who), params({ statementType: type, subjectId: id }));
  try {
    await t.confirmShipments();
    await t.ok(await issue.POST(t.post(`/api/sales-shipments/${t.salesShipment.id}/sales-invoice`, "finance", { invoiceDate: today, vatTreatment: "STANDARD" }), params({ shipmentId: t.salesShipment.id })), 201);
    const statement = await t.ok<{ party: { name: string }; company: { legalNameEn: string }; sections: { currency: string; closing: string; lines: { type: string; charge: string; balance: string }[]; aging: { current: string } }[] }>(await read("finance", "customer", t.customer));
    assert.equal(statement.sections.length, 1);
    const [section] = statement.sections;
    assert.deepEqual(section.lines.map((l) => [l.type, Number(l.charge).toFixed(2)]), [["INVOICE", "122976.00"]], "the invoice is charged with its VAT");
    assert.equal(Number(section.closing).toFixed(2), "122976.00");
    assert.equal(Number(section.aging.current).toFixed(2), "122976.00", "not yet due");
    assert.equal((await read("ops", "customer", t.customer)).status, 403, "operations cannot read statements");
    assert.equal((await read("finance", "partner", t.customer)).status >= 400, true);
    const supplier = await t.ok<{ sections: unknown[] }>(await read("owner", "supplier", t.supplier));
    assert.ok(Array.isArray(supplier.sections));
    const head = await t.ok<{ legalNameEn: string }>(await letterhead.GET(t.get("/api/company/document-profile", "ops")));
    assert.equal(typeof head.legalNameEn, "string", "operations print shipment documents with the letterhead");
  } finally {
    await t.sql.end();
  }
});
