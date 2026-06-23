#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
# Use the self-contained CLI baked into the image (prisma-cli stage) so startup
# never depends on network access to fetch the CLI or the schema-engine binary.
# Run via `bun`: the oven/bun image has no `node` for the prisma shebang.
bun ./prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema=/app/schema.prisma
echo "[entrypoint] Migrations applied. Starting server..."

exec "$@"
