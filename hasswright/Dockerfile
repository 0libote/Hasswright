ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:3.21
FROM ${BUILD_FROM} AS base

ARG BUILD_ARCH=amd64
ENV LANG=C.UTF-8 \
    NODE_ENV=production \
    HASSWRIGHT_PORT=8099

# Node 22 LTS (Alpine nodejs). No native modules required by the app.
RUN apk add --no-cache nodejs npm \
 && node --version && npm --version

WORKDIR /app
# Install deps first for layer caching, then build TypeScript in-image
# (dist/ is gitignored, so it must be built here, not COPYed).
COPY app/package.json ./
RUN npm install --omit=dev --no-audit --no-fund \
 && npm install --no-audit --no-fund typescript @types/node
COPY app/tsconfig.json ./
COPY app/src ./src
RUN npx tsc -p tsconfig.json && npm prune --omit=dev && rm -rf src tsconfig.json
COPY app/public ./public
COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 8099
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8099/api/health || exit 1

CMD ["/run.sh"]
