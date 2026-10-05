# Railway Marketplace Template Guide

This document is the source of truth for publishing **Production Full-Stack SaaS Starter** to the Railway Marketplace / Template Composer.

## Marketplace metadata

| Field | Value |
|-------|-------|
| **Name** | Production Full-Stack SaaS Starter |
| **Short description** | Deploy a reusable full-stack starter with Next.js, Node.js, PostgreSQL, Prisma, Redis, authentication, and Railway-ready infrastructure. |
| **Category** | Starters |
| **Tags** | Next.js, Node.js, TypeScript, PostgreSQL, Redis, Prisma, SaaS, Authentication, REST API, Full Stack |

### Long description

Production Full-Stack SaaS Starter is a reusable monorepo template for deploying a Next.js frontend and a Node.js/Express API with PostgreSQL (Prisma), Redis, and email/password authentication on Railway.

It is intentionally generic. Deployers receive a clean foundation for SaaS apps, dashboards, admin panels, APIs, and internal tools — not a finished vertical product and not tied to any private application, domain, or credentials.

The template wires four services (`web`, `api`, `Postgres`, `Redis`) with Railway reference variables, generated secrets, private database/cache networking, and a one-time-per-deploy migration release command.

## Services

| Service name (exact) | Type | Public networking | Purpose |
|----------------------|------|-------------------|---------|
| `web` | GitHub repo service | **Enabled** (HTTP) | Next.js App Router frontend |
| `api` | GitHub repo service | **Enabled** (HTTP) | Express REST API + auth |
| `Postgres` | Railway PostgreSQL plugin | **Disabled** | Primary database (private) |
| `Redis` | Railway Redis plugin | **Disabled** | Cache / queue helpers (private) |

> Service names matter. Reference variables below assume these exact names. If you rename a service in Template Composer, update every `${{ServiceName.*}}` reference.

## Monorepo root directories

Both application services build from the **repository root** because this is an npm workspaces monorepo (`apps/*`, `packages/*`, shared `prisma/`).

| Service | Root Directory | Config as Code file | Dockerfile |
|---------|----------------|---------------------|------------|
| `api` | `/` (repository root / leave empty) | `/railway.json` | `Dockerfile` |
| `web` | `/` (repository root / leave empty) | `/apps/web/railway.json` | `docker/Dockerfile.web` |
| `Postgres` | n/a (plugin) | n/a | n/a |
| `Redis` | n/a (plugin) | n/a | n/a |

Do **not** set Root Directory to `apps/web` or `apps/api` when using the provided Dockerfiles — those Dockerfiles expect the monorepo root as the build context.

### Recommended watch paths

| Service | Watch Paths |
|---------|-------------|
| `api` | `/apps/api/**`, `/packages/**`, `/prisma/**`, `/Dockerfile`, `/package.json`, `/package-lock.json`, `/scripts/**` |
| `web` | `/apps/web/**`, `/packages/**`, `/docker/Dockerfile.web`, `/package.json`, `/package-lock.json` |

## Health checks

| Service | Healthcheck path | Notes |
|---------|------------------|-------|
| `api` | `/api/health` | Lightweight `{ "status": "ok" }`. Does not fail when Redis is down. |
| `web` | `/` | Confirms Next.js responds. |
| `Postgres` | plugin managed | Keep private. |
| `Redis` | plugin managed | Keep private. |

Configured in:

- `/railway.json` → `deploy.healthcheckPath: "/api/health"`
- `/apps/web/railway.json` → `deploy.healthcheckPath: "/"`

## Networking model

```text
Browser  --public HTTPS-->  web
Browser  --public HTTPS-->  api
api      --private------>  Postgres   (${{Postgres.DATABASE_URL}})
api      --private------>  Redis      (${{Redis.REDIS_URL}})
```

### Why the browser talks to the API over the public domain

`NEXT_PUBLIC_API_URL` is embedded in the Next.js **client** bundle. Browser requests cannot use Railway private networking. Therefore:

- `web` and `api` must have **public HTTP networking** enabled
- `Postgres` and `Redis` must **not** be publicly exposed

Private networking is still used for API → database and API → Redis through the plugin connection URLs Railway injects.

## Reference variables

### `api` service variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Private Postgres connection |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` | Private Redis connection |
| `JWT_SECRET` | `${{secret(64)}}` | Auto-generated signing secret |
| `JWT_EXPIRES_IN` | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token lifetime |
| `CORS_ORIGIN` | `https://${{web.RAILWAY_PUBLIC_DOMAIN}}` | Allowed browser origin |
| `NODE_ENV` | `production` | Runtime mode |
| `BCRYPT_SALT_ROUNDS` | `12` | Password hashing cost |

Railway also injects `PORT` automatically. The API listens on `process.env.PORT`.

### `web` service variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_API_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` | Browser API base URL (**build-time**) |
| `NODE_ENV` | `production` | Runtime mode |

Railway injects `PORT` for the Next.js server automatically.

### Generated secret variables

| Variable | Generator | Service |
|----------|-----------|---------|
| `JWT_SECRET` | `${{secret(64)}}` | `api` |

Do **not** hardcode JWT secrets in the template, README examples for Railway, or source code.

Optional stronger alphabet form (equivalent intent):

```text
JWT_SECRET=${{secret(64, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")}}
```

The required Marketplace form for this template is:

```text
JWT_SECRET=${{secret(64)}}
```

### Variables that must NOT be set in the template

- Personal domains
- Personal API keys
- Hardcoded Railway `*.up.railway.app` hosts
- Production demo passwords intended for public use
- `SEED_USER_*` / `ALLOW_PROD_SEED` (local/demo only)
- Public TCP proxies for Postgres or Redis

## Migration strategy (important)

**Do not run Prisma migrations in the API process start command when multiple replicas may boot.**

This template uses Railway **releaseCommand** on the `api` service:

```json
"deploy": {
  "releaseCommand": "npx prisma migrate deploy --schema=prisma/schema.prisma",
  "startCommand": "node apps/api/dist/index.js"
}
```

| Step | When it runs | Command |
|------|--------------|---------|
| Release | Once per successful deploy, before traffic shift | `npx prisma migrate deploy --schema=prisma/schema.prisma` |
| Start | Each replica / container start | `node apps/api/dist/index.js` |

Local equivalents:

```bash
npm run db:migrate          # prisma migrate deploy
npm run db:migrate:dev      # prisma migrate dev (development only)
./scripts/migrate.sh        # same as migrate deploy
```

**Seeding is not part of deploy.** `npm run db:seed` is for local/demo data only and refuses `NODE_ENV=production` unless `ALLOW_PROD_SEED=true`.

## Required Template Composer setup

1. **Source repo:** this GitHub repository (`main` branch).
2. Add services:
   - Database → PostgreSQL → name it `Postgres`
   - Database → Redis → name it `Redis`
   - GitHub repo service → name it `api`
   - GitHub repo service → name it `web`
3. For `api` and `web`, point both at the same repo.
4. Set Root Directory for `api` and `web` to repository root (`/` / empty).
5. Set Config as Code:
   - `api` → `/railway.json`
   - `web` → `/apps/web/railway.json`
6. Enable public networking for `api` and `web` only.
7. Confirm Postgres and Redis public networking are **off**.
8. Paste the reference/generated variables from the tables above.
9. Confirm API healthcheck `/api/health` and web healthcheck `/`.
10. Create / publish the template.

## Recommended deployment order / dependencies

1. `Postgres` becomes available (private).
2. `Redis` becomes available (private).
3. `api` builds → **releaseCommand migrates** → starts and passes `/api/health`.
4. `web` builds with `NEXT_PUBLIC_API_URL` pointing at the `api` public domain → serves `/`.

In Template Composer, express soft dependencies mentally as:

```text
web → api → Postgres
       └→ Redis
```

Railway will provision plugins and app services together; the release command ensures schema exists before the API serves traffic.

## Build notes for Next.js

`NEXT_PUBLIC_API_URL` is inlined into the client bundle at **build** time.

- Set it as a `web` service variable before/during image build
- Use `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` (no hardcoded host)
- After changing the API public domain, **redeploy/rebuild `web`**

The web Dockerfile declares:

```dockerfile
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
```

## Authentication summary for deployers

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (Bearer access token)
- `POST /api/auth/logout`
- `POST /api/auth/refresh`

Passwords are bcrypt-hashed. Refresh tokens are stored hashed in PostgreSQL. No demo users are created on Railway deploy.

## Verification checklist before publishing

- [ ] Four services configured with exact names `web`, `api`, `Postgres`, `Redis`
- [ ] Root directory is repo root for `web` and `api`
- [ ] `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- [ ] `REDIS_URL=${{Redis.REDIS_URL}}`
- [ ] `JWT_SECRET=${{secret(64)}}`
- [ ] `CORS_ORIGIN=https://${{web.RAILWAY_PUBLIC_DOMAIN}}`
- [ ] `NEXT_PUBLIC_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}`
- [ ] API healthcheck `/api/health`
- [ ] Web healthcheck `/`
- [ ] Postgres/Redis not public
- [ ] releaseCommand migrates once; startCommand does not migrate
- [ ] No personal credentials, NET360 references, or hardcoded Railway domains
- [ ] Fresh deploy from a clean Railway account succeeds end-to-end

## Config files in this repository

| File | Role |
|------|------|
| `railway.json` | API build/deploy/health/releaseCommand |
| `apps/web/railway.json` | Web build/deploy/health |
| `railway.web.json` | Convenience duplicate of web config at repo root |
| `Dockerfile` | API production image |
| `docker/Dockerfile.web` | Web production image |
| `scripts/migrate.sh` | Manual/CI migration helper |
| `scripts/start-api.sh` | Optional start wrapper (no migrations) |
