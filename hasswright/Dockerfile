# The compiler runs on the build host. Its output is architecture-independent JS/CSS.
ARG BUILD_FROM=ghcr.io/home-assistant/base:3.22
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /build
COPY app/package.json app/package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund --ignore-scripts
COPY app/tsconfig.json app/tsconfig.ui.json ./
COPY app/src ./src
COPY app/public ./public
COPY app/ui ./ui
COPY app/scripts ./scripts
RUN npm run build

# Home Assistant mounts /data root-owned. Keep its normal add-on root convention.
FROM ${BUILD_FROM} AS runtime
ARG BUILD_ARCH
ARG BUILD_VERSION=unknown
LABEL io.hass.name="Hasswright" \
      io.hass.type="addon" \
      io.hass.arch="${BUILD_ARCH}" \
      org.opencontainers.image.source="https://github.com/0libote/Hasswright" \
      org.opencontainers.image.version="${BUILD_VERSION}"
ENV LANG=C.UTF-8 \
    NODE_ENV=production \
    HASSWRIGHT_PORT=8099 \
    HASSWRIGHT_DATA_DIR=/data
RUN apk add --no-cache nodejs && node --version
WORKDIR /app
# The backend only imports Node built-ins; UI dependencies are already bundled.
# No compiler, npm install, or node_modules is needed at runtime.
COPY --from=build /build/dist ./dist
COPY --from=build /build/public ./public
COPY --from=build /build/package.json ./package.json
COPY run.sh /run.sh
RUN chmod +x /run.sh
EXPOSE 8099
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8099/api/health || exit 1
CMD ["/run.sh"]
