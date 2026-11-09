# Immutable beta candidate freeze

`freeze-candidate.sh` is the ORB-R1-1307 release gate. It freezes metadata for one already-built, digest-pinned beta image; it does not deploy and awards no numbered evidence.

## Preconditions

- The Git worktree, including untracked files, is completely clean.
- The accepted production build exists at `.next/build-manifest.json`.
- `ORB_CANDIDATE_IMAGE` is an immutable `repository@sha256:<64 lowercase hex>` reference.
- `ORB_SBOM_FILE` names the generated SBOM for that exact image.
- `ORB_RELEASE_SIGNING_KEY_PATH` names an operator-controlled RSA private key outside the repository. Never commit this key.

The freeze reruns the OpenAPI, traceability, and deferred-surface guards (50 tests), computes Git archive/source, lock, exact accepted OpenAPI, Next build-manifest, container, and SBOM identities, records 79 operations and UTC time, and embeds an RSA-SHA256 signature in `manifest.json`.

```sh
ORB_CANDIDATE_IMAGE=registry.example/orb@sha256:<digest> \
ORB_SBOM_FILE=/secure/release/orb-beta.spdx.json \
ORB_RELEASE_SIGNING_KEY_PATH=/secure/release/orb-release.key \
ops/release/freeze-candidate.sh --freeze
```

Verify later with the corresponding public key:

```sh
ORB_RELEASE_PUBLIC_KEY_PATH=/secure/release/orb-release.pub \
ops/release/freeze-candidate.sh --verify artifacts/candidates/beta/manifest.json
```

After freezing, commit only this task’s three exact files. Any application, generated contract, dependency, build input, image, or SBOM change requires a new clean build and a new freeze identity. ORB-R1-1308 alone may deploy and satisfy E01.
