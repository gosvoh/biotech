#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
# The self-contained CLI and schema engine are baked into the image.
bun ./prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema=/app/schema.prisma
echo "[entrypoint] Migrations applied. Starting server and VK worker..."

# The supervisor shares one cache secret with web, importer and warm-cache,
# owns their lifecycle and forwards shutdown to the importer through IPC.
exec bun ./scripts/start-with-vk.ts standalone "$@"
