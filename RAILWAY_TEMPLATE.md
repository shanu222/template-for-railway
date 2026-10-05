# Railway Marketplace Metadata

Use these values when publishing this repository as a Railway template.

## Name

Production Full-Stack SaaS Starter

## Short description

Deploy a full-stack Next.js and Node.js application with PostgreSQL, Prisma, Redis, authentication, and Railway-ready infrastructure.

## Category

Starters / Full Stack

## Suggested tags

- Next.js
- Node.js
- TypeScript
- PostgreSQL
- Redis
- Prisma
- SaaS
- Full Stack
- Authentication
- REST API

## Recommended services

| Service | Source | Notes |
|---------|--------|-------|
| `web` | `apps/web` or `docker/Dockerfile.web` | Public HTTP service |
| `api` | Root `Dockerfile` | Public HTTP service, health check `/api/health` |
| `Postgres` | Railway PostgreSQL plugin | Private networking only |
| `Redis` | Railway Redis plugin | Private networking only |

## Suggested variable wiring

### API service

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `JWT_SECRET` | Railway generated secret (min 32 chars) |
| `JWT_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `CORS_ORIGIN` | `${{web.RAILWAY_PUBLIC_DOMAIN}}` with `https://` prefix |
| `NODE_ENV` | `production` |

### Web service

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` |
| `NODE_ENV` | `production` |

## Notes for Template Composer

1. Do not expose PostgreSQL or Redis publicly.
2. Keep Postgres and Redis on Railway private networking.
3. Generate `JWT_SECRET` rather than hardcoding it.
4. Point the web service at the API public URL through `NEXT_PUBLIC_API_URL`.
5. Point the API CORS origin at the web public URL.
6. The API Dockerfile runs `prisma migrate deploy` on startup.
