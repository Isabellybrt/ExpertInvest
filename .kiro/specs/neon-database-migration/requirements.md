# Requirements Document

## Introduction

Migração do banco de dados PostgreSQL do projeto ExpertInvest para o Neon (PostgreSQL serverless), com suporte a deploy na Vercel. O projeto é um monorepo com backend Node.js usando Prisma ORM. O objetivo é configurar o datasource do Prisma, variáveis de ambiente e scripts de deploy para que o banco funcione corretamente tanto em desenvolvimento local quanto em produção na Vercel usando o Neon como provider.

## Glossary

- **Prisma_Schema**: Arquivo de configuração do Prisma ORM localizado em `backend/prisma/schema.prisma` que define o datasource, generators e modelos do banco de dados.
- **Neon**: Provedor de PostgreSQL serverless que oferece connection pooling nativo e branches de desenvolvimento.
- **Connection_Pooler**: Endpoint do Neon que gerencia um pool de conexões para ambientes serverless, evitando esgotamento de conexões.
- **Direct_Connection**: Conexão direta ao banco de dados Neon sem pooling, necessária para operações de migração do Prisma.
- **DATABASE_URL**: Variável de ambiente que contém a string de conexão do connection pooler do Neon.
- **DIRECT_URL**: Variável de ambiente que contém a string de conexão direta ao banco Neon, usada pelo Prisma para migrations.
- **Vercel**: Plataforma de deploy serverless onde o frontend e potencialmente o backend do ExpertInvest são hospedados.
- **Migration_Script**: Script npm que executa `prisma migrate deploy` para aplicar migrations pendentes em produção.
- **Deploy_Documentation**: Documento (DEPLOY.md) que descreve os passos necessários para configurar o banco Neon e realizar deploys na Vercel.
- **Env_Example_File**: Arquivo `.env.example` que serve como template das variáveis de ambiente necessárias para o projeto.

## Requirements

### Requirement 1: Configuração do Datasource Prisma para Neon

**User Story:** As a developer, I want to configure the Prisma datasource to support both pooled and direct connections, so that the application works correctly in serverless environments like Vercel.

#### Acceptance Criteria

1. THE Prisma_Schema SHALL define a `datasource db` block with `provider = "postgresql"`, `url = env("DATABASE_URL")`, and `directUrl = env("DIRECT_URL")`
2. THE Prisma_Schema SHALL configure the `generator client` block with `provider = "prisma-client-js"`
3. WHILE the application is running in a serverless environment, THE Prisma_Client SHALL use the pooled connection string provided by `DATABASE_URL` for all runtime database queries
4. WHEN a Prisma migration command is executed (e.g., `prisma migrate dev` or `prisma migrate deploy`), THE Prisma_CLI SHALL connect using the `directUrl` value instead of the pooled `url` value
5. THE .env.example file SHALL document both `DATABASE_URL` (pooled connection string) and `DIRECT_URL` (direct connection string) environment variables with placeholder values indicating the expected Neon connection string format

### Requirement 2: Atualização das Variáveis de Ambiente

**User Story:** As a developer, I want the environment variable template to document both pooled and direct connection URLs, so that new team members can configure the project correctly.

#### Acceptance Criteria

1. THE Env_Example_File SHALL contain a DATABASE_URL variable with a placeholder value following the format `postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech:5432/DATABASE?sslmode=require`, indicating it is the Neon connection pooler URL
2. THE Env_Example_File SHALL contain a DIRECT_URL variable with a placeholder value following the format `postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech:5432/DATABASE?sslmode=require`, indicating it is the Neon direct connection URL (without the `-pooler` suffix in the hostname)
3. THE Env_Example_File SHALL include a comment above DATABASE_URL stating that it is used by Prisma Client for queries via the Neon connection pooler, and a comment above DIRECT_URL stating that it is used by Prisma Migrate for schema migrations via the direct connection
4. THE Env_Example_File SHALL include a comment indicating that DATABASE_URL uses the pooler endpoint (host contains `-pooler` suffix) and DIRECT_URL uses the direct endpoint (host without `-pooler` suffix), both on port 5432
5. THE Env_Example_File SHALL place the DATABASE_URL and DIRECT_URL variables in a grouped section with a heading comment identifying them as database connection variables

### Requirement 3: Script de Deploy de Migrations

**User Story:** As a developer, I want a dedicated migration deploy script in the backend package.json, so that I can apply pending migrations to production in a repeatable manner.

#### Acceptance Criteria

1. THE backend package.json SHALL contain a script named `prisma:deploy` that executes `prisma migrate deploy`
2. THE Prisma schema datasource block SHALL include a `directUrl` field set to `env("DIRECT_URL")` so that `prisma migrate deploy` connects directly to the database bypassing connection pooling
3. THE backend package.json SHALL retain all existing prisma-related scripts (`prisma:generate`, `prisma:migrate`, `prisma:studio`) unchanged
4. WHEN the `prisma:deploy` script completes successfully, THE process SHALL exit with code 0
5. IF the `prisma:deploy` script fails due to a missing `DIRECT_URL` environment variable or a migration error, THEN THE process SHALL exit with a non-zero exit code and output an error message indicating the failure reason

### Requirement 4: Documentação de Deploy

**User Story:** As a developer, I want clear documentation on how to create a Neon database, configure environment variables on Vercel, and run migrations in production, so that the deploy process is reproducible and well-understood.

#### Acceptance Criteria

1. THE Deploy_Documentation SHALL describe the steps to create a new project and database on the Neon console, including project naming, region selection, and PostgreSQL version selection
2. THE Deploy_Documentation SHALL describe how to obtain the pooled connection string (for application queries) and the direct connection string (for migrations) from the Neon dashboard, including how to distinguish between the two formats
3. THE Deploy_Documentation SHALL describe how to configure DATABASE_URL (pooled connection string) and DIRECT_URL (direct connection string) as environment variables in the Vercel project settings, and describe the required change to `schema.prisma` to add the `directUrl = env("DIRECT_URL")` property in the datasource block
4. THE Deploy_Documentation SHALL describe the command to run migrations in production using `npx prisma migrate deploy` executed from the `backend` directory, and SHALL describe the addition of a `prisma:deploy` script (with value `prisma migrate deploy`) to the backend `package.json`
5. THE Deploy_Documentation SHALL describe how to use Neon branches for development environments as an alternative to a local PostgreSQL instance, including the steps to create a branch from the main database branch and how to obtain a branch-specific connection string
6. THE Deploy_Documentation SHALL be created as a `DEPLOY.md` file in the root of the repository with a maximum length of 500 lines
7. IF the developer executes all documented steps in sequence on a new Vercel project with no prior configuration, THEN the Deploy_Documentation SHALL have provided sufficient information to result in a successful deployment without requiring external references beyond linked official documentation URLs

### Requirement 5: Compatibilidade com Desenvolvimento Local

**User Story:** As a developer, I want the database configuration to work seamlessly in local development with either a local PostgreSQL instance or a Neon dev branch, so that I can develop and test without affecting production.

#### Acceptance Criteria

1. WHEN DIRECT_URL is not set in the environment, THE Prisma_Schema SHALL use DATABASE_URL for both runtime queries and migration operations without producing connection errors
2. WHILE running in local development with a local PostgreSQL instance, THE Prisma_Schema SHALL accept a DATABASE_URL in the format `postgresql://USER:PASSWORD@localhost:PORT/DATABASE` and successfully execute `prisma migrate dev` and `prisma db push` commands without errors
3. WHILE running in local development with a Neon dev branch, THE Prisma_Schema SHALL use DATABASE_URL pointing to the Neon branch pooler endpoint for runtime queries and DIRECT_URL pointing to the branch direct endpoint for migrations, with both configured via the `directUrl` property in the datasource block
4. THE Env_Example_File SHALL include a DIRECT_URL variable entry with a comment indicating it is optional and only required for Neon pooled connections
5. THE Env_Example_File SHALL include comments showing example DATABASE_URL values for both local PostgreSQL (localhost format) and Neon dev branch (pooler endpoint format), with each example clearly labeled by its use case
6. THE Prisma_Schema datasource block SHALL declare `directUrl = env("DIRECT_URL")` so that when DIRECT_URL is set, Prisma uses it for migration operations instead of the pooled DATABASE_URL

### Requirement 6: Compatibilidade do Prisma Client com Ambiente Serverless

**User Story:** As a developer, I want the Prisma Client to be properly configured for serverless execution, so that the application handles connection lifecycle correctly on Vercel.

#### Acceptance Criteria

1. IF the Prisma version in use requires `previewFeatures = ["driverAdapters"]` for Neon compatibility, THEN THE Prisma_Schema generator client block SHALL include that preview feature flag
2. WHILE the application is running in development mode (NODE_ENV is not "production"), THE Prisma client initialization module SHALL cache the PrismaClient instance on the global object so that subsequent imports reuse the same instance instead of creating new connections
3. WHILE the application is running in production mode (NODE_ENV is "production"), THE Prisma client initialization module SHALL create a new PrismaClient instance per module load without global caching, relying on the serverless function lifecycle for cleanup
4. THE Prisma client initialization module SHALL connect to the database using the DATABASE_URL environment variable, which must point to a connection pooler endpoint (e.g., Neon pooler with `?pgbouncer=true` or pooler subdomain) when deployed on Vercel
5. IF the database connection fails during a Prisma query, THEN THE Prisma client SHALL propagate the error without swallowing it, including the original error cause so that calling code can identify the failure as a connection error
