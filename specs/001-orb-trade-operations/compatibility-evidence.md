# Compatibility Spike Evidence

**Date:** 2026-11-05  
**Result:** PASS  
**Environment:** Linux 6.8.0-147-generic / x86_64  
**Registry:** `https://registry.npmjs.org/`

## Exact verified baseline

- Node.js `24.22.2`; pnpm `12.16.1`; TypeScript `7.0.2`; `@types/node` `24.19.2`
- Next.js `16.4.5`; React/React DOM `19.3.1`
- MUI `9.5.0`; Emotion `11.14.0` / `11.14.1`; TanStack React Table `9.3.1`
- Prisma/Client `7.10.1`; Zod `4.6.7`; Better Auth `1.7.18`; PostgreSQL provider schema
- Vitest `5.1.0`; Playwright `1.64.1`; AWS S3 client `3.1162.0`

## Final clean command

```bash
node -v
pnpm install --strict-peer-dependencies --frozen-lockfile
pnpm run prisma:generate
pnpm run typecheck
pnpm run build
pnpm exec vitest --version
pnpm exec playwright --version
pnpm --version
```

The command ran under an ephemeral exact Node `24.22.2` environment. No force, legacy-peer, or peer-range bypass was used. pnpm `allowBuilds` permitted only `prisma` and `@prisma/engines`. `skipLibCheck: true` matches the planned Next.js baseline and avoids checking third-party declaration internals while application source remains strict.

## Verified results

- Frozen lockfile install: exit `0`; 335 packages.
- Prisma PostgreSQL-provider client generation: exit `0`.
- `tsc --noEmit`: exit `0`.
- Next.js `16.4.5` production build: exit `0`; static `/` and `/_not-found` generated.
- Vitest reported `5.1.0` on Node `24.22.2`.
- Playwright reported `1.64.1`.

## Integrity hashes

- package.json: `10144211831b9dc93cf33e914393e673ac4ee7e80369490675454c8dc4b2502f`
- pnpm-lock.yaml: `6a265d19e788b73d3fd9d9cad075b1152aeb58117b4401ec1f0ea6695afc37be`
- pnpm-workspace.yaml: `e199d060687739e4ba1f0f3c567259e71994cae00059460c4eb8c46df13a6b65`
- tsconfig.json: `754fb85b3fd9ba8716095d41ffdcef59d3014988b362a03206ddd6428c1c9665`
- prisma/schema.prisma: `d78ea2db6a50344ceb9c290eb3d27444d3fda7c81c7e8506e676d7266920f16b`
- src/index.tsx: `a14bd1ead45b46890d0f2d8e8ed53248a17e19fd828c1f3738de42c9196a34e9`
- final raw log: `c4f4522bd08bfad9714affea61557e52ab776bc948fadf17174363b6b48cdd85`

## Rejected candidates and corrections

- Playwright `1.65.0` was rejected because stable `playwright-core@1.65.0` was unavailable; `1.64.1` passed.
- Node `26.13.0` completed compilation but Prisma `7.10.1` explicitly reported it unsupported; Node `24.22.2` passed without that warning.
- pnpm `12.16.1` requires explicit `allowBuilds`; only Prisma packages were authorized.

## Limits

This spike proves dependency resolution, generation, TypeScript compatibility, and framework production build. It does not replace integration tests against the deployed PostgreSQL/object-storage services or feature acceptance tests.
