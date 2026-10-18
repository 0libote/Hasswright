# NOTE (docker:S6471): this image intentionally runs as root. Home Assistant
# add-ons run as root by platform convention: the Supervisor bind-mounts /data
# root-owned, so a non-root USER would break persistence on HA OS. The image is
# single-purpose (node server on unprivileged port 8099, no shell/SSH), so this
# was reviewed as safe. The Dockerfile parser ignores NOSONAR comments, so this
# accepted risk is closed via "Accept" in the SonarCloud UI, not in code.
ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:3.21
FROM ${BUILD_FROM} AS base

ARG BUILD_ARCH=amd64
ENV LANG=C.UTF-8 \
    NODE_ENV=production \
    HASSWRIGHT_PORT=8099

# Node 22 LTS (Alpine). No native modules required by the app.
RUN apk add --no-cache \
  nodejs \
  npm \
 && node --version && npm --version

WORKDIR /app
# Install deps first for layer caching, then build TypeScript in-image
# (dist/ is gitignored, so it must be built here, not COPYed).
# NOTE (docker:S8543): package-lock.json is committed and installed with
# `npm ci` so resolved dependency versions are locked.
# `--include=dev` is required: ENV NODE_ENV=production above would otherwise
# skip devDependencies (typescript), breaking the in-image `tsc` build.
COPY app/package.json app/package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund --ignore-scripts
COPY app/tsconfig.json ./
COPY app/src ./src
RUN ./node_modules/.bin/tsc -p tsconfig.json && npm prune --omit=dev --no-audit --no-fund && rm -rf src tsconfig.json
COPY app/public ./public
COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 8099
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8099/api/health || exit 1

CMD ["/run.sh"]
