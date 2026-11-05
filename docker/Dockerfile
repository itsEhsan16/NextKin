# syntax=docker/dockerfile:1.7
#
# One image definition, four targets (spec §9.5, ImBackendImplementationPlan P1-07):
#   web      Next.js standalone server: the web app and the /api/v1 backend
#   worker   the background worker, with Chromium and bundled fonts for PDF export
#   migrate  the one-off migration task
#   latex    the sealed LaTeX compile service and its relay (end of file)
#
# Build from the repository root, with versions from docker/versions.env:
#   docker build -f docker/Dockerfile --target web    --build-arg NODE_IMAGE=... .
#   docker build -f docker/Dockerfile --target worker --build-arg NODE_IMAGE=... --build-arg PLAYWRIGHT_VERSION=... .
# `pnpm stack:up -- --profile app` builds and runs web and worker with the right arguments.
# Fargate runs arm64; laptops run amd64. Use `docker buildx build --platform linux/amd64,linux/arm64`.

ARG NODE_IMAGE

# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS base
ENV CI=true \
    NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# pnpm comes from the root package.json's packageManager field.
RUN corepack enable
WORKDIR /repo

# ---------------------------------------------------------------------------------------------
# Dependencies for web and server only. Every workspace manifest is copied so the frozen lockfile
# validates; only the filtered projects are installed (no Expo or React Native toolchain).
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
COPY packages/engines/package.json packages/engines/
COPY packages/server/package.json packages/server/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@nextkin/web..." --filter "@nextkin/server..."

# ---------------------------------------------------------------------------------------------
FROM deps AS build
# The web app's backend switch is read at build time (NEXT_PUBLIC_*). Empty: the mock, as before.
ARG NEXT_PUBLIC_DATA_SOURCE=
ARG NEXT_PUBLIC_API_BASE_URL=
# Clerk's publishable key (public; toreview §169). Empty: the designed sign-in, no Clerk.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
ENV NEXT_PUBLIC_DATA_SOURCE=$NEXT_PUBLIC_DATA_SOURCE \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
COPY apps/web apps/web
COPY packages packages
RUN pnpm --filter @nextkin/web build && pnpm --filter @nextkin/server build

# ---------------------------------------------------------------------------------------------
# Shared runtime: tini as PID 1 (reaps Chromium's child processes, forwards SIGTERM), non-root user.
FROM ${NODE_IMAGE} AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
ENTRYPOINT ["/usr/bin/tini", "--"]

# ---------------------------------------------------------------------------------------------
FROM runtime AS web
ENV PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]

# ---------------------------------------------------------------------------------------------
FROM runtime AS migrate
COPY --from=build --chown=node:node /repo/packages/server/dist/migrate.mjs ./dist/migrate.mjs
# The AWS demo seeds from this image too: `node dist/seed.mjs` (toreview §133).
COPY --from=build --chown=node:node /repo/packages/server/dist/seed.mjs ./dist/seed.mjs
# The seed hashes the demo accounts' passwords with argon2, a native addon kept out of the bundle.
ARG ARGON2_VERSION
RUN npm install --no-save --no-audit --no-fund "@node-rs/argon2@~${ARGON2_VERSION}" && rm -rf /root/.npm
# The local identity provider's store, which migrate applies when IDENTITY_ADAPTER=local (the AWS
# demo): read from ../auth/adapters/local/ relative to dist/.
COPY --chown=node:node packages/server/src/auth/adapters/local/schema.sql ./auth/adapters/local/schema.sql
# The runner reads MIGRATIONS_DIR (default aws/migrations) relative to /app.
COPY --chown=node:node aws/migrations ./aws/migrations
USER node
CMD ["node", "dist/migrate.mjs"]

# ---------------------------------------------------------------------------------------------
FROM runtime AS worker
ARG PLAYWRIGHT_VERSION
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Metric-compatible fonts so exported PDFs lay out the same everywhere (spec §7.12):
# Liberation Sans for Arial, Carlito for Calibri.
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-liberation fonts-crosextra-carlito \
 && rm -rf /var/lib/apt/lists/*
# playwright-core is the one runtime dependency left out of the bundle (it locates its browser at
# runtime). The Chromium build must match the library version exactly.
RUN npm install --no-save --no-audit --no-fund "playwright-core@${PLAYWRIGHT_VERSION}" \
 && npx playwright-core install --with-deps chromium \
 && rm -rf /var/lib/apt/lists/* /root/.npm
# Parsing (P7): pdfjs-dist loads its worker script and tesseract.js its WASM at runtime, so they are
# installed beside the bundle at the versions docker/versions.env pins; the language data is vendored.
ARG PDFJS_VERSION
ARG TESSERACT_VERSION
# One install for all three: a later `npm install --no-save` prunes packages an earlier one added.
RUN npm install --no-save --no-audit --no-fund "playwright-core@${PLAYWRIGHT_VERSION}" "pdfjs-dist@~${PDFJS_VERSION}" "tesseract.js@~${TESSERACT_VERSION}" --ignore-scripts  && rm -rf /root/.npm
COPY --from=build --chown=node:node /repo/packages/server/dist/worker.mjs ./dist/worker.mjs
COPY --from=build --chown=node:node /repo/packages/server/dist/parse-worker.mjs ./dist/parse-worker.mjs
COPY --from=build --chown=node:node /repo/packages/server/dist/render-check.mjs ./dist/render-check.mjs
COPY --chown=node:node packages/server/vendor/tessdata ./vendor/tessdata
# Export (P10-04): the templates load only these fonts, served by the renderer; nothing is fetched.
COPY --chown=node:node packages/server/assets/fonts ./assets/fonts
USER node
CMD ["node", "dist/worker.mjs"]

# =============================================================================================
# link-reader: pages from the open web run here (toreview §144.3). It holds no database, no storage
# and no model key: only its bearer token. Chromium has no sandbox to use in a container with no
# capabilities, so the container is the sandbox: compose and the task definition keep it apart from
# everything of the app's, and every request a page makes leaves through its own address check.
FROM runtime AS link-reader
ARG PLAYWRIGHT_VERSION
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright LINK_READER_HOST=0.0.0.0 LINK_READER_NO_SANDBOX=true HOME=/tmp
RUN npm install --no-save --no-audit --no-fund "playwright-core@${PLAYWRIGHT_VERSION}" \
 && npx playwright-core install --with-deps chromium \
 && rm -rf /var/lib/apt/lists/* /root/.npm
COPY --from=build --chown=node:node /repo/packages/server/dist/link-reader.mjs ./dist/link-reader.mjs
USER node
CMD ["node", "dist/link-reader.mjs"]

# =============================================================================================
# latex: the sealed LaTeX compile service (toreview §111). Tectonic 0.17 (static musl build,
# checksum-pinned in docker/versions.env) plus only the TeX Live 2022 bundle files the resume
# template uses, cached at build time; at run time it has no network (compose `latex` profile).
#   docker build -f docker/Dockerfile --target latex --build-arg NODE_IMAGE=... \
#     --build-arg TECTONIC_VERSION=... --build-arg TECTONIC_SHA256_X86_64=... \
#     --build-arg TECTONIC_SHA256_AARCH64=... .
# `pnpm stack:up -- --profile latex` passes them from docker/versions.env.

# The service bundle and the warm-up documents, from the server package alone.
FROM base AS latex-bundle
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
COPY packages/engines/package.json packages/engines/
COPY packages/server/package.json packages/server/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@nextkin/server"
COPY packages/server packages/server
RUN cd packages/server \
 && node build.mjs latex-service latex-relay latex-warmup \
 && node dist/latex-warmup.mjs /warmup

# Tectonic and its cache. The download is the only networked step besides the first warm-up.
FROM ${NODE_IMAGE} AS latex-tex
ARG TARGETARCH
ARG TECTONIC_VERSION
ARG TECTONIC_SHA256_X86_64
ARG TECTONIC_SHA256_AARCH64
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN set -eu; \
    case "${TARGETARCH:-amd64}" in \
      amd64) triple=x86_64-unknown-linux-musl; sum="${TECTONIC_SHA256_X86_64}" ;; \
      arm64) triple=aarch64-unknown-linux-musl; sum="${TECTONIC_SHA256_AARCH64}" ;; \
      *) echo "no Tectonic pin for ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    test -n "${TECTONIC_VERSION}" && test -n "$sum"; \
    url="https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-${triple}.tar.gz"; \
    node -e "fetch(process.argv[1]).then(async r=>{if(!r.ok)throw new Error(r.status);require('fs').writeFileSync('/tmp/tectonic.tgz',Buffer.from(await r.arrayBuffer()))}).catch(e=>{console.error(e);process.exit(1)})" "$url"; \
    echo "$sum  /tmp/tectonic.tgz" | sha256sum -c -; \
    tar -xzf /tmp/tectonic.tgz -C /usr/local/bin tectonic; \
    rm /tmp/tectonic.tgz; \
    tectonic --version
ENV TECTONIC_CACHE_DIR=/opt/tectonic/cache \
    FONTCONFIG_FILE=/opt/tectonic/fonts.conf
COPY docker/latex/fonts.conf docker/latex/warmup.sh /opt/tectonic/
COPY --from=latex-bundle /warmup /opt/tectonic/warmup
# Fill the cache: the template's own output for every density x paper (network on). Tectonic
# writes the format file 0600, so open the cache to the service user (it stays root-owned).
# Then mark the bundle as checked far in the future (2100): with a network, Tectonic re-checks a
# stale bundle even with --only-cached and rewrites this stamp, which the service user cannot do,
# so every compile failed on the AWS demo once the build-time stamp aged (toreview §168).
RUN sh /opt/tectonic/warmup.sh /opt/tectonic/warmup \
 && for lock in /opt/tectonic/cache/bundles/hashes/*.lock; do printf %s 4102444800 > "$lock"; done \
 && chmod -R a+rX /opt/tectonic/cache
# Prove it is complete and usable as at run time: the same documents again as the service user,
# from the cache alone (which that user cannot write), with no network at all.
USER node
RUN --network=none sh /opt/tectonic/warmup.sh /opt/tectonic/warmup --only-cached

FROM runtime AS latex
# pdfinfo (page count) and pdftoppm (PNG previews).
RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils \
 && rm -rf /var/lib/apt/lists/*
ENV TECTONIC_CACHE_DIR=/opt/tectonic/cache \
    FONTCONFIG_FILE=/opt/tectonic/fonts.conf \
    LATEX_PORT=8790
COPY --from=latex-tex /usr/local/bin/tectonic /usr/local/bin/tectonic
# Owned by root and read-only to the service: nothing at run time can add to the cache.
COPY --from=latex-tex /opt/tectonic/cache /opt/tectonic/cache
COPY --from=latex-tex /opt/tectonic/fonts.conf /opt/tectonic/fonts.conf
COPY --from=latex-bundle /repo/packages/server/dist/latex-service.mjs /repo/packages/server/dist/latex-relay.mjs ./dist/
USER node
EXPOSE 8790
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.LATEX_PORT||8790)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/latex-service.mjs"]
