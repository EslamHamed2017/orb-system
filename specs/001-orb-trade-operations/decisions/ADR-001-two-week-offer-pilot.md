# ADR-001: Two-Week Offer Pilot

**Status:** Accepted
**Date:** 2026-11-05
**Deadline:** 2026-11-19

## Decision

Deliver a deployed, sales-ready working pilot that proves one complete ORB Core Trade cycle within fourteen calendar days. The milestone is not represented as full production completion.

## Reason

Eslam has a fixed commercial opportunity window; missing the date risks losing the offer. Scope reduction is safer than removing integrity, review, or security controls.

## Delivery Rules

- Preview checkpoints no later than days 2, 5, 8, 11, and 14.
- Use fixed roles, approval matrix, route checklists, and simple controlled claims.
- One primary supplier source per sales shipment in the pilot.
- Direct expense assignment only.
- No bank, tax pack, or historical migration in the pilot.
- No automatic external sending; Eslam approves exact outputs and recipients.
- No claim of production readiness until the post-pilot hardening gate passes.

## Consequences

The implementation plan, OpenAPI, UI workflows, data model, quickstart, and tasks must be regenerated or revised to match this cut before coding. Deferred capabilities become separate future Spec Kit features.
