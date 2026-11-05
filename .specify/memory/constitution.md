<!--
SYNC IMPACT REPORT
- Version change: template/unratified → 1.0.0
- Added principles: Spec Kit First; Focused Trade Operations; Google Material Design 3 + ORB Identity; Evidence Integrity; Acceptance and Test First; Review-First External Delivery
- Added sections: Product and Security Constraints; Development and Plan Gates
- Removed sections: none (initial ratification)
- Deferred TODOs: none
-->
# ORB Trade Operations System Constitution

## Core Principles

### I. Spec Kit First — NON-NEGOTIABLE
Every feature MUST follow the approved Spec Kit sequence: constitution → specify → clarify → plan → tasks → analyze → implement → converge. No production implementation may begin from informal chat notes or superseded blueprints. A failed Plan Gate returns the feature to specification repair.

### II. Focused Trade Operations, Not ERP
ORB is a compact international coffee trade operations system centered on Project → Contracts → Shipments → Documents → Money Movements → Profitability. Odoo, general ledger, journal entries, chart of accounts, financial statements, warehouse valuation, and unrelated CRM scope are prohibited unless the constitution is formally amended and approved by Eslam.

### III. Google Material Design 3 + ORB Identity
The product MUST use Google Material Design 3 principles for component behavior, hierarchy, spacing, accessibility, forms, tables, navigation, states, and responsive layouts. It MUST use ORB's official logo, palette, and document identity rather than Google's branding. Arabic RTL and English LTR are equal first-class experiences. Users choose Arabic, English, or bilingual output at print time without creating duplicate business records.

### IV. Evidence, Integrity, and Traceability
Original imported documents and bank evidence are immutable. Every business record uses stable identifiers, versioning, duplicate prevention, source links, and an auditable history. Approved commercial documents are revised, never silently overwritten. Migration, bank imports, and allocations MUST be idempotent and reconcilable to their source files.

### V. Acceptance and Test First
Every user story MUST define executable acceptance scenarios before implementation. Critical scenarios include advances before invoice, partial and split shipments, contract amendments, quality/quantity claims, expenses, bank matching, document revisions, project closure, historical migration, and tax-pack exceptions. No task is complete without tests and verified evidence.

### VI. Review-First External Delivery
Tax packs, emails, reports, and any external output MUST be reviewed by and sent to Eslam first. Nothing may be sent to a customer, supplier, tax adviser, authority, or other third party without explicit approval of the exact version, recipients, and attachments.

## Product and Security Constraints

- Standalone custom web application; no Odoo dependency.
- Project is the canonical primary operating entity; use of competing terms such as Deal must be explicitly mapped or removed.
- Tax functionality is an evidence/review pack only, not legal determination, automated VAT filing, or professional tax advice.
- Sensitive bank, supplier cost, margin, identity, and tax data require least-privilege access.
- Encryption, secure secret handling, audit events, backups, restore tests, retention rules, and incident logging are mandatory before production.
- Direct bank integrations, automated authority filing, advanced OCR, customer portals, and supplier portals are deferred until separately specified and approved.

## Development and Plan Gates

1. Constitution compliance check.
2. One authoritative feature specification and terminology baseline.
3. Clarification of unresolved business rules.
4. Data model, API contracts, state models, screen map, security model, migration rules, and acceptance criteria.
5. Independent Plan Gate review.
6. Task generation only after Plan Gate ACCEPT.
7. Cross-artifact analysis before implementation.
8. Implementation with tests and evidence.
9. Convergence review before release.

Failed gates block downstream phases. Complexity requires written justification. Superseded planning artifacts are reference material only and cannot authorize code.

## Governance

This constitution supersedes informal plans and prior conflicting ORB blueprints. Amendments require: written rationale, impact assessment, Eslam approval, version increment, and updates to affected specifications and tests. Reviews must verify scope, Material Design 3 compliance, bilingual behavior, evidence integrity, security, review-first delivery, and no-accounting boundaries.

**Version**: 1.0.0 | **Ratified**: 2026-11-05 | **Last Amended**: 2026-11-05
