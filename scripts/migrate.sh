#!/bin/sh
set -e

# Apply Prisma migrations (safe for production with migrate deploy).
# Railway: configured as the API service releaseCommand so it runs
# once per deployment, not on every replica process start.
echo "Applying Prisma migrations..."
npx prisma migrate deploy --schema=prisma/schema.prisma
echo "Migrations complete."
