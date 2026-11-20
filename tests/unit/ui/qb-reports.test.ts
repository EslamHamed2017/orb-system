import assert from "node:assert/strict";
import test from "node:test";
import { QB_GROUPS, QB_REPORT_KEYS, agingBucket, buildQbReport, periodPreset, type QbRecord } from "../../../src/ui/features/reports/qb-reports.ts";
import { buildXlsx } from "../../../src/ui/features/reports/xlsx-export.ts";

const rec = (r: Partial<QbRecord> & Pick<QbRecord, "type" | "occurredOn" | "state" | "amount" | "aedAmount">): QbRecord => ({
  id: r.reference ?? "x", projectId: "p", partyId: r.partyId ?? "c1", reference: "R", currency: "USD", outstandingAmount: "0", projectReference: "PRJ-1", partyName: "Hamburg",
  href: "/x", aedOutstanding: r.aedOutstanding ?? "0", ...r,
});
const opts = { asOf: "2026-11-20", locale: "en" as const, partyHref: (t: string, id: string) => `/${t}s/${id}` };
const records: QbRecord[] = [
  rec({ type: "SALES_INVOICE", reference: "INV-1", occurredOn: "2026-11-01", state: "ISSUED", amount: "1000", vatAmount: "0", aedAmount: "3672.50", outstandingAmount: "400", aedOutstanding: "1469.00", dueDate: "2026-10-01" }),
  rec({ type: "SALES_INVOICE", reference: "INV-2", occurredOn: "2026-11-10", state: "CANCELLED", amount: "500", aedAmount: "1836.25" }),
  rec({ type: "SUPPLIER_INVOICE", reference: "BILL-1", partyId: "s1", partyName: "Aden", occurredOn: "2026-11-02", state: "CONFIRMED", amount: "600", aedAmount: "2203.50", outstandingAmount: "600", aedOutstanding: "2203.50", dueDate: "2026-12-02" }),
  rec({ type: "EXPENSE", reference: "Freight", partyName: "Gulf", occurredOn: "2026-11-03", state: "APPROVED", amount: "100", aedAmount: "367.25" }),
  rec({ type: "EXPENSE", reference: "Freight", partyName: "Gulf", occurredOn: "2025-01-03", state: "APPROVED", amount: "100", aedAmount: "367.25" }),
];

test("the reports center is grouped like QuickBooks and every computed report has a page", () => {
  assert.deepEqual(QB_GROUPS.map((g) => g.en), ["Business overview", "Who owes you", "Sales and customers", "What you owe", "Expenses and suppliers", "Projects", "Shipments"]);
  assert.equal(QB_REPORT_KEYS.length, 11);
});

test("profit and loss counts issued invoices, confirmed bills and saved expenses in the period, in AED", () => {
  const t = buildQbReport("profit-and-loss", records, { ...opts, from: "2026-11-01", to: "2026-11-30" });
  const line = (label: string) => t.rows.find((r) => r.cells[0] === label)?.cells[1];
  assert.equal(line("Total income"), 3672.5);
  assert.equal(line("Supplier bills"), 2203.5);
  assert.equal(line("Gross profit"), 1469);
  assert.equal(line("Freight"), 367.25, "last year's expense is outside the period");
  assert.equal(line("Net profit"), 1101.75);
});

test("aging puts each open amount in its bucket and totals per party", () => {
  assert.deepEqual([agingBucket(undefined, "2026-11-20"), agingBucket("2026-11-25", "2026-11-20"), agingBucket("2026-11-01", "2026-11-20"), agingBucket("2026-09-01", "2026-11-20"), agingBucket("2026-01-01", "2026-11-20")], [0, 0, 1, 3, 4]);
  const ar = buildQbReport("ar-aging", records, opts);
  assert.deepEqual(ar.rows[0].cells, ["Hamburg", 0, 0, 1469, 0, 0, 1469]);
  assert.equal(ar.rows[0].href, "/customers/c1");
  const ap = buildQbReport("ap-aging", records, opts);
  assert.deepEqual(ap.rows.at(-1)!.cells, ["Total", 2203.5, 0, 0, 0, 0, 2203.5]);
});

test("profit and loss leaves VAT out of income", () => {
  const vat = [rec({ type: "SALES_INVOICE", occurredOn: "2026-11-05", state: "ISSUED", amount: "1050", vatAmount: "50", aedAmount: "3856.13" })];
  const t = buildQbReport("profit-and-loss", vat, { ...opts, from: "2026-11-01", to: "2026-11-30" });
  assert.equal(t.rows.find((r) => r.cells[0] === "Total income")?.cells[1], 3672.5);
});

test("lists and per-party reports skip cancelled amounts and report unconverted records", () => {
  const list = buildQbReport("invoice-list", records, { ...opts, from: "2026-11-01", to: "2026-11-30" });
  assert.equal(list.rows.length, 3);
  assert.equal(list.rows.at(-1)!.cells.at(-1), 3672.5);
  const unconverted = buildQbReport("sales-by-customer", [rec({ type: "SALES_INVOICE", occurredOn: "2026-11-05", state: "ISSUED", amount: "9", aedAmount: null })], opts);
  assert.equal(unconverted.unconverted, 1);
  assert.deepEqual(periodPreset("last-month", "2026-11-20"), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(periodPreset("this-quarter", "2026-11-20"), { from: "2026-10-01", to: "2026-12-31" });
});

test("Excel export is a real .xlsx (zip with a worksheet)", () => {
  const bytes = buildXlsx("Profit and loss", [["Account", "AED"], ["Income", 1]]);
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  assert.ok(Buffer.from(bytes).includes(Buffer.from("xl/worksheets/sheet1.xml")));
});
