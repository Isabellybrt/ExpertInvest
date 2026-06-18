# Implementation Plan: Neon Database Migration

## Overview

Migrate the ExpertInvest PostgreSQL database configuration to Neon (serverless PostgreSQL) with Vercel deploy support. This involves updating the Prisma datasource, environment variable templates, adding a deploy script, updating the Prisma Client module for clarity, and creating deployment documentation. No application code changes — only infrastructure configuration and documentation.

## Tasks

- [x] 1. Update Prisma schema datasource for Neon dual-URL support
  - [x] 1.1 Add directUrl property to the datasource block in `backend/prisma/schema.prisma`
    - Modify the `datasource db` block to include `directUrl = env("DIRECT_URL")` alongside the existing `url = env("DATABASE_URL")`
    - Keep `provider = "postgresql"` unchanged
    - Keep the `generator client` block with `provider = "prisma-client-js"` unchanged
    - Run `npx prisma validate` to confirm the schema is valid
    - _Requirements: 1.1, 1.2, 1.4, 5.6_

- [x] 2. Update environment variable template
  - [x] 2.1 Rewrite the database section of `backend/.env.example` with Neon connection formats
    - Replace the existing `DATABASE_URL` placeholder with the Neon pooler format: `postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech:5432/DATABASE?sslmode=require`
    - Add a `DIRECT_URL` variable with the Neon direct format: `postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech:5432/DATABASE?sslmode=require`
    - Group both variables under a `# Database Connection` heading comment
    - Add comments explaining: DATABASE_URL uses the pooler endpoint (host with `-pooler` suffix, port 5432) for Prisma Client runtime queries; DIRECT_URL uses the direct endpoint (host without `-pooler` suffix, port 5432) for Prisma Migrate
    - Add comments showing example DATABASE_URL values for local PostgreSQL (`postgresql://USER:PASSWORD@localhost:5432/DATABASE`) and Neon dev branch, each clearly labeled
    - Add comment indicating DIRECT_URL is optional and only required for Neon pooled connections
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.4, 5.5_

- [x] 3. Add migration deploy script to package.json
  - [x] 3.1 Add `prisma:deploy` script to `backend/package.json`
    - Add `"prisma:deploy": "prisma migrate deploy"` to the scripts section
    - Keep all existing prisma scripts (`prisma:generate`, `prisma:migrate`, `prisma:studio`) unchanged
    - Verify the script is correctly placed in the scripts object
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Checkpoint - Validate configuration changes
  - Ensure `npx prisma validate` passes with the updated schema, ask the user if questions arise.

- [x] 5. Verify Prisma Client serverless compatibility
  - [x] 5.1 Review and document the `backend/src/lib/prisma.ts` module
    - Verify the existing pattern caches PrismaClient on `globalThis` in non-production mode (avoids connection exhaustion during hot reload)
    - Verify that in production mode a new PrismaClient instance is created per module load (serverless lifecycle manages cleanup)
    - Confirm no error swallowing occurs — Prisma propagates connection errors with original cause
    - No code changes are expected; if the pattern already matches the design, leave the file unchanged
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [x] 6. Create deployment documentation
  - [x] 6.1 Create `DEPLOY.md` at the repository root
    - Document steps to create a new Neon project and database (project naming, region selection, PostgreSQL version)
    - Document how to obtain pooled and direct connection strings from the Neon dashboard, explaining how to distinguish between the two formats (host with/without `-pooler` suffix)
    - Document how to configure `DATABASE_URL` and `DIRECT_URL` as environment variables in Vercel project settings
    - Document the `schema.prisma` change adding `directUrl = env("DIRECT_URL")`
    - Document the command to run migrations in production: `npx prisma migrate deploy` from the `backend` directory, and the `prisma:deploy` script addition
    - Document how to use Neon branches for development environments (creating a branch, obtaining branch connection strings)
    - Keep the file under 500 lines
    - Ensure all steps in sequence are sufficient for a new Vercel project deployment without external references beyond linked official docs
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [x] 7. Final checkpoint - Ensure all configuration is valid
  - Ensure `npx prisma validate` passes, `npx prisma generate` succeeds, and all files are consistent. Ask the user if questions arise.

## Notes

- No property-based tests are included because this feature involves only infrastructure configuration changes (no algorithms, no data transformations, no business logic)
- The existing Prisma Client module (`backend/src/lib/prisma.ts`) already follows the recommended serverless pattern — task 5.1 is a verification step
- All existing Prisma schema models remain unchanged; only the `datasource db` block is modified
- When `DIRECT_URL` is not set, Prisma automatically falls back to `DATABASE_URL` for migrations — this preserves local development compatibility
- Each task references specific requirements for traceability

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "3.1"] },
    { "id": 1, "tasks": ["5.1", "6.1"] }
  ]
}
```
