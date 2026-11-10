# ORB-R1-1205 bilingual MD3/WCAG harness

This directory defines the **predeployment** E15 harness. Local output is diagnostic only and never earns E15.

## Automated matrix

Run the four task-owned Playwright specs against an immutable target using `ORB_TEST_BASE_URL`:

```sh
corepack pnpm exec playwright test tests/acceptance/ui/{md3-visual,accessibility,keyboard,bidi}.spec.ts --project=chromium
```

The harness covers all 21 contracted route patterns (22 concrete pages) in English and Arabic. Visual captures use 1440x900, 768x1024, and 390x844 viewports. Bidi/reflow checks use 320x844. It verifies document language/direction, horizontal containment, clipped leaf text, isolated mixed-direction operational references, structural accessible names/headings/landmarks, visible keyboard focus, dialog focus restoration, and reduced motion. JSON reports and PNG captures are Playwright attachments.

## Manual capture checklist

For each locale, viewport, route, and role-shaped state:

1. Compare EN/AR journeys and confirm no control, state, or next action is missing or untranslated.
2. Inspect Material 3 hierarchy, token use, raw colors, component states, 48px targets, and focus visibility.
3. Inspect Arabic shaping, bidi IDs/codes/dates/currencies, clipping, wrapping, table scrolling, and mirrored layout.
4. Run a screen-reader pass: landmarks, heading order, names, state/value announcements, validation, dialogs, and live regions.
5. Measure WCAG AA contrast for text, icons, focus indicators, disabled states, and status colors.
6. Confirm 320px reflow, keyboard-only completion, and reduced-motion behavior.
7. Record every critical/serious finding; the result is acceptable only when the unresolved count is zero.

## E15 boundary

ORB-R1-1309 or ORB-R1-1315 must rerun this harness against the deployed frozen candidate only after E01 passes. The retained manifest must bind target URL, immutable artifact digest, environment identity, locale, browser/version, viewport, timestamp, report hashes, screenshot hashes, reviewer, and zero unresolved critical/serious findings. Localhost, mutable builds, mocked dependencies, and predeployment captures are explicitly non-evidence.
