# Customer duplicate-reference visual evidence

Captured 2026-11-17 from the production build of the candidate based on `e4825f6`.

## Scope and provenance

These four screenshots demonstrate only the bilingual, responsive UI response to a duplicate Customer reference. A Playwright route interception supplied an empty authorized Customer collection for `GET /api/customers` and a mocked HTTP `409` problem with code `DUPLICATE_REFERENCE` for `POST /api/customers`. No PostgreSQL write, tenant session, audit event, or persistence across reload was exercised by this visual capture. The automated Customer PostgreSQL acceptance remains separate evidence and requires `ORB_TEST_DATABASE_URL`.

- `en-desktop.png`: English, 1440×1000 viewport
- `en-mobile.png`: English, 390×844 viewport
- `ar-desktop.png`: Arabic RTL, 1440×1000 viewport
- `ar-mobile.png`: Arabic RTL, 390×844 viewport

The visible values are synthetic review data. They are not imported business records.
