# ADR-001: Two-Week Operational Beta and Offer Pilot

**Status**: Accepted
**Date**: 2026-11-05
**Deciders**: Eslam / ORB

## Context

ORB needs a deployed system used for daily work by 2026-11-12, one week of evidence-led correction, and a stabilized offer pilot by 2026-11-19. The former broad specification could not be delivered or honestly accepted in that window.

## Decision

Release 1 is the limited operational slice defined in `../spec.md`: fixed roles/approvals, essential masters, one Project per independent sales contract, purchase contracts, exactly one primary supplier source per sales shipment, three fixed route checklists, versioned CINV/Packing List, simple supplier invoice, money movements and settlement, direct expenses, basic statements, four separate margin/cash figures, simple claims, independent financial/final closure, bilingual ORB MD3 UI, security/audit/backup, and exact-manifest review-first external sending.

The milestones are fixed:

- deployed limited daily-use beta: **2026-11-12**;
- real-use correction window: **2026-11-12 through 2026-11-18**;
- stabilized offer pilot: **2026-11-19**.

Bank import, tax pack, historical migration, multi-source allocation, shared-expense allocation, configurable approval design, dynamic route design, and advanced claim settlement are future features. They have no Release 1 endpoint, UI control, acceptance credit, or closure dependency.

## Consequences

All Phase 1 artifacts must implement only this cut. “Pilot” does not mean mock screens: the daily cycle must persist, authorize, audit, recover, and execute end to end. Production-scale hardening beyond the stated baseline follows later. The exact dependency compatibility spike remains a blocking gate and is not accepted by this ADR.
