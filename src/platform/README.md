# ORB platform boundary

`src/platform` contains domain-neutral infrastructure shared by the modular monolith: validated configuration, persistence and transaction primitives, security controls, immutable object storage adapters, logging, and observability.

Platform code must not import `src/modules`, `src/ui`, or `src/app`. Those layers may depend on platform services through narrow exported interfaces. Platform code must not encode trade workflow policy or become a holding area for deferred features.

Dependency direction:

```text
src/app -> src/ui -> src/modules -> src/platform
```

Imports may also skip left-to-right layers when appropriate, but they never point rightward against this direction.
