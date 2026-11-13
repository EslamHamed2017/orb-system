import assert from "node:assert/strict";
import test from "node:test";

import { buildProjectContextLinks } from "../../../src/ui/navigation/project-context-links.ts";
import {
  filterProjectTransactions,
  summarizeProjectTransactions,
  type ProjectTransaction,
} from "../../../src/ui/features/projects/project-transactions.ts";

const rows: readonly ProjectTransaction[] = [
  { id:"c1",projectId:"demo",type:"CUSTOMER_COMMERCIAL_INVOICE",occurredOn:"2026-11-10",state:"PARTIALLY_PAID",reference:"CINV-33",partyName:"Northstar",sourceHref:"/accounts/sales-invoices",currency:"USD",amount:"1000.000000",paidAmount:"400.000000",outstandingAmount:"600.000000" },
  { id:"s1",projectId:"demo",type:"SUPPLIER_COMMERCIAL_INVOICE",occurredOn:"2026-11-11",state:"CONFIRMED",reference:"ET-109",partyName:"Arbor Export",sourceHref:"/accounts/supplier-invoices",currency:"USD",amount:"700.000000",paidAmount:"200.000000",outstandingAmount:"500.000000" },
  { id:"e1",projectId:"demo",type:"EXPENSE",occurredOn:"2026-11-09",state:"APPROVED",reference:"EXP-22",partyName:"Port Services",sourceHref:"/accounts/expenses",currency:"USD",amount:"50.000000",paidAmount:"50.000000",outstandingAmount:"0.000000" },
  { id:"col1",projectId:"demo",type:"COLLECTION",occurredOn:"2026-11-12",state:"POSTED",reference:"COL-14",partyName:"Northstar",sourceHref:"/accounts/collections",currency:"USD",amount:"400.000000",paidAmount:"400.000000",outstandingAmount:"0.000000" },
  { id:"pay1",projectId:"demo",type:"SUPPLIER_PAYMENT",occurredOn:"2026-11-12",state:"POSTED",reference:"PAY-19",partyName:"Arbor Export",sourceHref:"/accounts/supplier-payments",currency:"USD",amount:"200.000000",paidAmount:"200.000000",outstandingAmount:"0.000000" },
  { id:"void",projectId:"demo",type:"CUSTOMER_COMMERCIAL_INVOICE",occurredOn:"2026-11-13",state:"CANCELLED",reference:"CINV-VOID",partyName:"Northstar",sourceHref:"/accounts/sales-invoices",currency:"USD",amount:"999.000000",paidAmount:"0.000000",outstandingAmount:"999.000000" },
  { id:"other",projectId:"atlas",type:"EXPENSE",occurredOn:"2026-11-13",state:"APPROVED",reference:"EXP-90",partyName:"Agent",sourceHref:"/accounts/expenses",currency:"AED",amount:"75.000000",paidAmount:"75.000000",outstandingAmount:"0.000000" },
];

test("project context follows the approved QuickBooks-style six-destination order", () => {
  assert.deepEqual(buildProjectContextLinks("en","demo").map(x=>[x.key,x.label]),[
    ["overview","Overview"],
    ["transactions","Transactions"],
    ["shipments","Shipments"],
    ["documents","Documents"],
    ["reports","Project reports"],
    ["activity","Activity"],
  ]);
});

test("transaction register is project-scoped, excludes inactive rows and filters before newest-first sorting", () => {
  assert.deepEqual(filterProjectTransactions(rows,{projectId:"demo",type:"ALL",status:"ALL",query:""}).map(x=>x.id),["col1","pay1","s1","c1","e1"]);
  assert.deepEqual(filterProjectTransactions(rows,{projectId:"demo",type:"SUPPLIER_COMMERCIAL_INVOICE",status:"ALL",query:"arbor"}).map(x=>x.id),["s1"]);
  assert.throws(()=>filterProjectTransactions(rows,{projectId:" ",type:"ALL",status:"ALL",query:""}),/Project ID is required/);
});

test("transaction summary keeps source currencies separate and uses commercial documents once", () => {
  assert.deepEqual(summarizeProjectTransactions(filterProjectTransactions(rows,{projectId:"demo",type:"ALL",status:"ALL",query:""})),[
    { currency:"USD",customerCommercialInvoiced:"1000",supplierCommercialInvoiced:"700",approvedExpenses:"50",collected:"400",supplierPaid:"200",customerOutstanding:"600",supplierOutstanding:"500",actualOperationalMargin:"250",cashPosition:"150" },
  ]);
});
