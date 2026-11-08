# E16 security and audit harness (predeployment)

`ops/acceptance/run-prebeta-gates.sh` validates deployed-target security reports before release execution. Construction and local runs are diagnostic only: they do not earn E16 or any numbered evidence.

Provide five regular executable adapters named `scan`, `security`, `audit`, `backup`, and `restore`. Each receives the JSON output path. The harness exports the target URL, artifact digest, and environment ID; every report must repeat the exact identities. Symlink adapters/reports are rejected.

Security requires zero unaccepted Critical findings; passing session rotation, CSRF, IDOR, upload, rate-limit, redaction, TLS, encryption, and immutability checks; and at least one recomputed audit chain with zero mismatches. Provider adapters must fail closed rather than synthesize results.

```sh
ops/acceptance/run-prebeta-gates.sh --self-test
ORB_PREBETA_BASE_URL=https://candidate.example \
ORB_PREBETA_ARTIFACT_DIGEST=sha256:<64-lowercase-hex> \
ORB_PREBETA_ENVIRONMENT_ID=<recorded-environment-id> \
ORB_PREBETA_ADAPTER_DIR=/secure/path/to/adapters \
ORB_PREBETA_OUTPUT_DIR=/secure/path/to/diagnostics \
ops/acceptance/run-prebeta-gates.sh
```

HTTP is rejected outside the disposable self-test. A pass writes a mode-0600 manifest with report hashes and `diagnosticOnly: true`; it cannot substitute for ORB-R1-1310/1315.
