#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
# Use the self-contained CLI baked into the image (prisma-cli stage) so startup
# never depends on network access to fetch the CLI or the schema-engine binary.
./prisma-cli/node_modules/.bin/prisma migrate deploy --schema=/app/schema.prisma
echo "[entrypoint] Migrations applied. Starting server..."

exec "$@"
