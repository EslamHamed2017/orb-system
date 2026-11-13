# ORB QuickBooks-Style Project Workspace Design

**Approved by:** Eslam El Berkawy on 2026-11-13 (`اعمل التعديلات`) after reviewing the proposed QuickBooks mapping.

## Goal
Make the Project the primary working context, following QuickBooks Projects information architecture while retaining ORB's shipment execution and trade-document workflows.

## Navigation
The project-level primary navigation is: **Overview | Transactions | Shipments | Documents | Project Reports | Activity**. Contracts, claims, expenses, collections and payments remain reachable through contextual actions and the unified transaction register instead of competing primary tabs.

## Commercial invoice rule
There is no separate generic customer invoice plus Commercial Invoice. ORB's sales invoice is presented as **Customer Commercial Invoice (CINV)**. The supplier invoice received from a supplier is presented as **Supplier Commercial Invoice**. Internal route and domain identifiers may remain `sales-invoices`, `SalesInvoice`, and `SupplierInvoice` for backward compatibility; the user-facing copy and source descriptions must use the approved commercial-invoice terminology.

## Project transactions
A new project transaction register combines contracts, shipments, Customer Commercial Invoices, Supplier Commercial Invoices, collections, supplier payments and approved expenses. It supports type/status/search filters, retains source currency, shows paid and outstanding amounts, and links each row to its source record. Cancelled/reversed rows are excluded by default.

## Overview and reports
The overview prioritizes invoiced sales, supplier cost, approved expenses, collections/payments, outstanding balances, actual operational margin and cash position by source currency. Project reports preserve separate currencies and provide source drill-down links. No General Ledger, journal-entry, inventory-valuation or accounting-suite language is introduced.

## Shipment and documents extension
ORB adds **Shipments** and **Documents** to QuickBooks' project model. Customer and supplier Commercial Invoices, Packing Lists, Bills of Lading, certificates and evidence stay linked to their shipment and project. Existing immutable evidence and document-revision controls remain unchanged.

## Safety and compatibility
Posted or paid commercial invoices are not silently reassigned. Existing route paths remain valid. Existing permissions, audit, approval, reversal, document revision and currency-partitioning behavior must continue to pass tests.
