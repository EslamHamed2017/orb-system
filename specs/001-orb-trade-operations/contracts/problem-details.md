# Error and Problem Details Contract

All non-2xx API responses use `application/problem+json` (RFC 9457) with:

```json
{
  "type": "https://orb.example/problems/concurrency-conflict",
  "title": "The record changed",
  "status": 412,
  "detail": "Reload and reconcile your changes.",
  "instance": "/api/projects/019...",
  "code": "CONCURRENCY_CONFLICT",
  "correlationId": "019...",
  "errors": [{"pointer": "/quantity", "code": "OUTSIDE_TOLERANCE", "messageKey": "errors.quantity.outsideTolerance"}],
  "currentVersion": 8
}
```

`detail` is safe for display and contains no secrets. `messageKey` is rendered equivalently in Arabic and English; server codes remain stable. Validation errors use JSON Pointer. Authorization responses do not reveal record existence.

| HTTP | Stable code | Acceptance meaning |
|---|---|---|
| 400 | `MALFORMED_REQUEST` | Body/parameter cannot be parsed |
| 401 | `AUTHENTICATION_REQUIRED` | No valid session |
| 403 | `PERMISSION_DENIED` | Authenticated but action/field/export is forbidden |
| 404 | `RESOURCE_NOT_FOUND` | Missing or deliberately concealed resource |
| 409 | `DUPLICATE_REFERENCE` | Scoped stable reference already exists |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Same key was used with a different canonical request |
| 409 | `ALLOCATION_EXCEEDS_AVAILABLE` | Money/source/expense allocation would oversubscribe |
| 409 | `STATE_TRANSITION_NOT_ALLOWED` | Command is invalid from current state |
| 409 | `CLOSURE_BLOCKED` | Response includes blocker codes and eligible exception action |
| 412 | `CONCURRENCY_CONFLICT` | `If-Match` does not equal current version |
| 422 | `VALIDATION_FAILED` | One or more field/business validation failures |
| 422 | `OUTSIDE_TOLERANCE_APPROVAL_REQUIRED` | Exact exception approval and reason are absent |
| 422 | `ROUTE_REQUIREMENT_INCOMPLETE` | Named requirement blocks confirm/final closure |
| 423 | `IMMUTABLE_REVISION` | Attempt to alter approved/sent evidence or document revision |
| 429 | `RATE_LIMITED` | Retry only after `Retry-After` |
| 500 | `INTERNAL_ERROR` | Opaque error with correlation ID |
| 503 | `DEPENDENCY_UNAVAILABLE` | Transactional dependency unavailable; safe retry semantics stated |

Mutating responses return `ETag: "<version>"`. A retriable serialization failure is retried server-side at most three times; if still unsuccessful it returns 409 `CONCURRENT_ALLOCATION_RETRY` and no partial mutation. Upload hash mismatch returns 422 `FILE_HASH_MISMATCH`; unsupported/corrupt/password-protected content returns 422 with its specific stable code.
