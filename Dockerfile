# Multi-stage production image for the API service.
# Build context: repository root
# Railway service root directory: /

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY prisma ./prisma
RUN npm install --workspace=@app/api --workspace=@repo/shared --include-workspace-root

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY tsconfig.base.json ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/api ./apps/api
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build -w @repo/shared
RUN npm run build -w @app/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat openssl \
  && addgroup -S nodejs \
  && adduser -S nodejs -G nodejs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY scripts/start-api.sh ./scripts/start-api.sh
COPY scripts/migrate.sh ./scripts/migrate.sh

RUN chmod +x ./scripts/start-api.sh ./scripts/migrate.sh \
  && chown -R nodejs:nodejs /app

USER nodejs
EXPOSE 4000
# Railway uses deploy.healthcheckPath from railway.json.
# Migrations are NOT run in CMD; use releaseCommand / scripts/migrate.sh.
CMD ["node", "apps/api/dist/index.js"]
