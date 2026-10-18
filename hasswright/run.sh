#!/bin/sh
set -e
DATA_DIR="${HASSWRIGHT_DATA_DIR:-/data}"
PORT="${HASSWRIGHT_PORT:-8099}"
echo "[hasswright] starting on port ${PORT}, data dir ${DATA_DIR}"
mkdir -p "${DATA_DIR}"
exec node /app/dist/server.js
