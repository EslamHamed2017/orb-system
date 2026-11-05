# Problem Details Contract

Every non-2xx API result is `application/problem+json` conforming to RFC 9457. `type` is a stable URI, `title` and `detail` are localized from `Accept-Language`, and clients branch only on `code`/status. Validation includes `errors[]` with JSON Pointer `pointer`, stable `code`, and localized `message`. Every problem includes `correlationId`; sensitive values and authorization existence leaks are forbidden.

| HTTP | Stable codes |
|---|---|
| 400 | `VALIDATION_FAILED`, `FILE_HASH_MISMATCH`, `UNSUPPORTED_MEDIA_TYPE` |
| 401/403/404 | `AUTHENTICATION_REQUIRED`, `PERMISSION_DENIED`, `RESOURCE_NOT_FOUND`, `SELF_APPROVAL_FORBIDDEN` |
| 409 | `DUPLICATE_REFERENCE`, `INVALID_STATE_TRANSITION`, `OUTSIDE_TOLERANCE_APPROVAL_REQUIRED`, `PRIMARY_SOURCE_REQUIRED`, `PRIMARY_SOURCE_INVALID`, `ROUTE_ITEM_INCOMPLETE`, `ALLOCATION_EXCEEDS_AVAILABLE`, `ALLOCATION_PARTY_OR_CURRENCY_MISMATCH`, `APPROVAL_REQUIRED`, `APPROVAL_VERSION_MISMATCH`, `SEND_MANIFEST_CHANGED`, `DOCUMENT_NOT_READY`, `IMMUTABLE_VERSION`, `CLOSURE_BLOCKED`, `IDEMPOTENCY_KEY_REUSED`, `DEFERRED_FEATURE_NOT_AVAILABLE` |
| 412/428 | `STALE_VERSION`, `PRECONDITION_REQUIRED` |
| 413/422 | `UPLOAD_TOO_LARGE`, `UNPROCESSABLE_EVIDENCE` |
| 429/500/503 | `RATE_LIMITED`, `INTERNAL_ERROR`, `DEPENDENCY_UNAVAILABLE` |

`CLOSURE_BLOCKED` includes current `assessmentId` and blocker codes/subject links. Tolerance problems include field, allowed lower/upper, actual, dataset version. Manifest mismatch includes only safe changed-field names. Allocation problems include safe available/outstanding amounts. Unknown API paths, including deferred-feature paths, normally return `RESOURCE_NOT_FOUND`; `DEFERRED_FEATURE_NOT_AVAILABLE` may be used only by an explicitly version-negotiated client and does not imply an endpoint exists.
