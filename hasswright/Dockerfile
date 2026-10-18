# NOTE (docker:S6471): HA add-ons run as root by platform convention (s6-overlay, /data).
# Deliberate; reviewed as safe for this image. See SonarCloud Accepted issue if still flagged.
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
COPY app/package.json ./
RUN npm install --no-audit --no-fund --ignore-scripts typescript@5.6.3 @types/node@22.7.0
COPY app/tsconfig.json ./
COPY app/src ./src
RUN ./node_modules/.bin/tsc -p tsconfig.json && npm prune --omit=dev && rm -rf src tsconfig.json
COPY app/public ./public
COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 8099
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8099/api/health || exit 1

CMD ["/run.sh"]
