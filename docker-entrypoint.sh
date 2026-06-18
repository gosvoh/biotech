#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
bunx --yes prisma@6.19.3 migrate deploy
echo "[entrypoint] Migrations applied. Starting server..."

exec "$@"
