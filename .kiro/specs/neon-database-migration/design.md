# Design Document: Neon Database Migration

## Overview

This design describes the migration of the ExpertInvest PostgreSQL database infrastructure to Neon (serverless PostgreSQL), enabling seamless deployment on Vercel. The migration involves updating the Prisma datasource configuration to support dual connection URLs (pooled for runtime, direct for migrations), updating environment variable templates, adding a deploy script, creating deployment documentation, and ensuring the Prisma Client initialization handles serverless lifecycle correctly.

The core principle is **zero application code changes** — only infrastructure configuration, environment templates, and documentation are modified. The existing Prisma schema models, repositories, services, and routes remain untouched.

### Design Decisions

1. **Neon Connection Pooler for runtime, Direct for migrations**: Neon's built-in connection pooler (PgBouncer-based) is used via `DATABASE_URL` for all runtime queries. The direct connection via `DIRECT_URL` is used exclusively by Prisma Migrate, which requires a direct connection for DDL operations.

2. **No driver adapter needed**: The current Prisma version (6.x) supports Neon's pooler natively via the `directUrl` property without needing the `driverAdapters` preview feature. The standard `@prisma/client` works with Neon's pooler endpoint directly.

3. **Preserve existing Prisma Client pattern**: The current `prisma.ts` singleton pattern (global caching in dev, fresh instance in prod) is already the recommended pattern for serverless. Only minor adjustments are needed for documentation clarity.

4. **DEPLOY.md at repo root**: Deployment documentation lives at the repository root for discoverability, following the same pattern as the existing `README.md` and `TUTORIAL.md`.

## Architecture

```mermaid
graph TD
    subgraph "Vercel (Production)"
        A[Serverless Function] --> B[Prisma Client]
        B -->|DATABASE_URL pooled| C[Neon Connection Pooler]
        C --> D[Neon PostgreSQL]
    end

    subgraph "CI/CD or Developer Machine"
        E[prisma migrate deploy] -->|DIRECT_URL| D
    end

    subgraph "Local Development"
        F[Dev Server] --> G[Prisma Client]
        G -->|DATABASE_URL| H{Local PG or Neon Branch}
        I[prisma migrate dev] -->|DIRECT_URL or DATABASE_URL| H
    end
```

### Connection Flow

- **Runtime queries (production)**: `Application → Prisma Client → DATABASE_URL (pooler endpoint) → Neon PgBouncer → PostgreSQL`
- **Migrations (production)**: `prisma migrate deploy → DIRECT_URL (direct endpoint) → PostgreSQL`
- **Local development**: `Application → Prisma Client → DATABASE_URL (localhost or Neon branch) → PostgreSQL`

## Components and Interfaces

### 1. Prisma Schema Datasource (`backend/prisma/schema.prisma`)

The datasource block is updated to include the `directUrl` property:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Behavior**:
- Prisma Client uses `url` (DATABASE_URL) for all runtime queries
- Prisma Migrate uses `directUrl` (DIRECT_URL) when set, falls back to `url` when not set
- This dual-URL approach is the standard Neon + Prisma configuration

### 2. Environment Variable Template (`backend/.env.example`)

Updated to document both connection URLs with clear comments:

```env
# =====================
# Database Connection
# =====================
# DATABASE_URL: Used by Prisma Client for runtime queries.
# Uses the Neon connection pooler endpoint (host contains `-pooler` suffix), port 5432.
# For local development with PostgreSQL, use: postgresql://USER:PASSWORD@localhost:5432/DATABASE
# For Neon dev branch, use: postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech:5432/DATABASE?sslmode=require
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech:5432/DATABASE?sslmode=require"

# DIRECT_URL: Used by Prisma Migrate for schema migrations via direct connection.
# Uses the Neon direct endpoint (host without `-pooler` suffix), port 5432.
# Optional: only required when using Neon pooled connections. Not needed for local PostgreSQL.
DIRECT_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech:5432/DATABASE?sslmode=require"
```

### 3. Deploy Script (`backend/package.json`)

A new `prisma:deploy` script is added alongside existing scripts:

```json
{
  "scripts": {
    "prisma:deploy": "prisma migrate deploy",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  }
}
```

**Behavior**:
- Uses `DIRECT_URL` for the database connection (via Prisma's directUrl resolution)
- Exits with code 0 on success
- Exits with non-zero code and error message on failure (missing env var, migration error)

### 4. Prisma Client Module (`backend/src/lib/prisma.ts`)

The existing implementation already follows the recommended serverless pattern:

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**No changes required** — this pattern:
- Caches the client on `globalThis` in development (avoids connection exhaustion during hot reload)
- Creates a fresh instance in production (serverless function lifecycle manages cleanup)
- Propagates connection errors without swallowing them (Prisma default behavior)
- Connects via `DATABASE_URL` which points to the pooler endpoint in production

### 5. Deployment Documentation (`DEPLOY.md`)

A markdown file at the repository root documenting:
- Neon project creation steps
- Connection string retrieval (pooled vs direct)
- Vercel environment variable configuration
- Running production migrations
- Using Neon branches for development

## Data Models

No changes to the existing data models. The migration is purely an infrastructure concern. All existing models (User, Session, RendaFixa, FII, FIIQuote, FIIDividend, Aporte, MarketIndex, CronLog) remain unchanged.

The Prisma schema generator and model definitions stay identical — only the `datasource db` block is modified.

## Error Handling

### Connection Errors

| Scenario | Behavior | Resolution |
|----------|----------|------------|
| Missing `DATABASE_URL` | Prisma Client throws on initialization | Application fails to start with clear error |
| Invalid pooler connection string | Prisma query throws `P1001` (can't reach database) | Check DATABASE_URL format and Neon status |
| Missing `DIRECT_URL` during migration | Prisma falls back to `DATABASE_URL` | Works for local PG; may fail for pooled connections |
| Pooler timeout | Prisma throws `P2024` (timed out fetching connection) | Retry or check Neon compute status (auto-suspend) |
| Neon compute cold start | First query may take 300-500ms | Expected behavior; subsequent queries are fast |

### Migration Errors

| Scenario | Behavior | Resolution |
|----------|----------|------------|
| `prisma:deploy` with missing `DIRECT_URL` on Neon | Migration fails with connection error | Set DIRECT_URL to direct endpoint |
| `prisma:deploy` with pending migration conflict | Non-zero exit with migration error details | Resolve migration manually or use `prisma migrate resolve` |
| `prisma migrate dev` locally without `DIRECT_URL` | Falls back to `DATABASE_URL` (localhost) | Works correctly for local PostgreSQL |

### Prisma Error Propagation

The Prisma Client propagates all errors including the original cause. No error swallowing occurs:
- `PrismaClientKnownRequestError` — database constraint violations
- `PrismaClientUnknownRequestError` — unexpected database errors
- `PrismaClientInitializationError` — connection failures

## Testing Strategy

### Why Property-Based Testing Does Not Apply

This feature involves exclusively **infrastructure configuration changes**:
- Modifying a Prisma datasource block (declarative configuration)
- Updating environment variable templates (static documentation)
- Adding a deploy script (single CLI command)
- Writing deployment documentation (prose)
- Verifying existing Prisma Client pattern (no logic changes)

There are no pure functions with variable input/output behavior, no data transformations, no algorithms, and no business logic introduced. PBT is not applicable here.

### Testing Approach

**Unit Tests (example-based)**:
- Verify Prisma schema parses correctly with `prisma validate`
- Verify `prisma:deploy` script exists and is correctly defined
- Verify `.env.example` contains required variables

**Integration Tests**:
- Connect to a test Neon database using pooled URL and execute a query
- Run `prisma migrate deploy` against a test Neon branch using `DIRECT_URL`
- Verify fallback behavior when `DIRECT_URL` is unset (uses `DATABASE_URL`)

**Smoke Tests**:
- `prisma validate` passes with the updated schema
- `prisma generate` succeeds with the updated datasource
- Application starts and responds to health check with Neon connection

**Manual Verification**:
- Deploy to Vercel staging environment
- Verify all API endpoints function correctly
- Verify migration can be run in production via `prisma:deploy`
- Verify local development works with both localhost PG and Neon branch
