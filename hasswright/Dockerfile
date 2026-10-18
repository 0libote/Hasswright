ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:3.21
FROM ${BUILD_FROM} AS base

ARG BUILD_ARCH=amd64
ENV LANG=C.UTF-8 \
    NODE_ENV=production \
    HASSWRIGHT_PORT=8099

# Node 22 LTS (nodejs.org binary for amd64/aarch64)
RUN apk add --no-cache nodejs npm python3 make g++ \
 && node --version && npm --version

WORKDIR /app
COPY app/package.json app/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY app/dist ./dist
COPY app/public ./public
COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 8099
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8099/api/health || exit 1

CMD ["/run.sh"]
