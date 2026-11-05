# ADR-001: Two-Week Offer Pilot

**Status:** Accepted
**Date:** 2026-11-05
**Operational Beta:** 2026-11-12
**Stabilized Offer Pilot:** 2026-11-19

## Decision

Deliver a deployed, limited daily-use operational beta that proves one complete ORB Core Trade cycle by 2026-11-12. Use the second week for live-use correction and stabilization, then deliver the offer-ready stabilized pilot by 2026-11-19. Neither milestone is represented as final full-scope production completion.

## Reason

Eslam has a fixed commercial opportunity window; missing the date risks losing the offer. Scope reduction is safer than removing integrity, review, or security controls.

## Delivery Rules

- Preview checkpoints no later than days 2 and 5; operational beta by day 7; correction previews on days 9 and 11; stabilized offer pilot by day 14.
- Use fixed roles, approval matrix, route checklists, and simple controlled claims.
- One primary supplier source per sales shipment in the pilot.
- Direct expense assignment only.
- No bank, tax pack, or historical migration in the pilot.
- No automatic external sending; Eslam approves exact outputs and recipients.
- No claim of production readiness until the post-pilot hardening gate passes.

## Consequences

The implementation plan, OpenAPI, UI workflows, data model, quickstart, and tasks must be regenerated or revised to match this cut before coding. Deferred capabilities become separate future Spec Kit features.
