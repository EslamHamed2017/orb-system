# ORB domain modules

`src/modules` contains the business capabilities of the ORB modular monolith. Release 1 has these fixed capability groups:

- access/masters
- projects/contracts
- shipments/routes
- evidence/documents/outbound
- supplier invoices/money/statements
- expenses/claims
- profit/closure
- audit/recovery

A module owns its domain rules, application services, repository interfaces, and API-facing use cases. Modules may import `src/platform` and other domain modules when an accepted cross-module workflow requires one PostgreSQL transaction. They must not import `src/ui` or `src/app`; UI and framework concerns depend on modules, never the reverse.

Cross-module calls must use an exported capability boundary rather than another module's internal files. Shared technical mechanisms belong in `src/platform`, not in a domain module. Release 1 must not create modules, routes, jobs, or placeholders for deferred scope.
