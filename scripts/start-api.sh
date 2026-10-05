#!/bin/sh
set -e

# Start only. Schema migrations are intentionally NOT run here.
# On Railway, migrations run once per deploy via releaseCommand
# (see railway.json) to avoid races when multiple replicas start.
echo "Starting API on PORT=${PORT:-4000}..."
exec node apps/api/dist/index.js
