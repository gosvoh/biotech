#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations (prisma migrate deploy)..."
# Use the self-contained CLI baked into the image (prisma-cli stage) so startup
# never depends on network access to fetch the CLI or the schema-engine binary.
# Run via `bun`: the oven/bun image has no `node` for the prisma shebang.
bun ./prisma-cli/node_modules/prisma/build/index.js migrate deploy --schema=/app/schema.prisma
echo "[entrypoint] Migrations applied. Starting server..."

# Run in the background (instead of `exec`) so we can warm the "use cache"
# pages against the just-migrated runtime database before real traffic
# hits the build-time-baked cache entries. Forward TERM/INT since
# backgrounding loses the signal transparency `exec` gave us.
"$@" &
server_pid=$!
trap 'kill -TERM "$server_pid" 2>/dev/null' TERM INT

bun ./scripts/warm-cache.ts &

wait "$server_pid"
