# syntax=docker/dockerfile:1.19
ARG NODE_IMAGE=node:24.22.2-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9
ARG MINIO_CLIENT_IMAGE=cgr.dev/chainguard/minio-client:latest@sha256:10388d580a724f356b94c9b2631b5a179039cabe8c76e9b37d86ed007d569b05

FROM ${MINIO_CLIENT_IMAGE} AS minio-client
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN apt-get update && apt-get install --yes --no-install-recommends openssl ca-certificates \
    && apt-get clean \
    && corepack enable && corepack prepare pnpm@12.16.1 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --strict-peer-dependencies

FROM dependencies AS build
# Prisma loads DATABASE_URL while generating the client; this loopback value is build-only and non-secret.
ENV DATABASE_URL=postgresql://orb_build:orb_build@127.0.0.1:5432/orb_build
COPY --exclude=node_modules --exclude=.next --exclude=.git --exclude=test-results . .
RUN pnpm run prisma:generate && pnpm run build && pnpm prune --prod

FROM base AS runtime
ARG ORB_BUILD_DIGEST=unattested
ARG ORB_LOCK_DIGEST=unattested
LABEL org.opencontainers.image.title="ORB Trade Operations" \
      org.opencontainers.image.revision="${ORB_BUILD_DIGEST}" \
      com.orb.lock.digest="${ORB_LOCK_DIGEST}"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
RUN groupadd --system --gid 10001 orb && useradd --system --uid 10001 --gid orb orb
COPY --from=build --chown=orb:orb /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --chown=orb:orb /app/node_modules ./node_modules
COPY --from=build --chown=orb:orb /app/.next ./.next
COPY --from=build --chown=orb:orb /app/public ./public
COPY --from=build --chown=orb:orb /app/prisma ./prisma
COPY --from=minio-client /usr/bin/mc /usr/local/bin/mc
USER orb
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=6 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
