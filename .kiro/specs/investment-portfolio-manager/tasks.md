# Implementation Plan: Investment Portfolio Manager

## Overview

Implementação incremental de uma aplicação web SPA para gerenciamento de carteira de investimentos pessoal, utilizando TypeScript + React (frontend MVVM com Zustand), Node.js + Express/Fastify (backend), PostgreSQL + Prisma ORM, com atualização automática de cotações, cálculos financeiros e visualização gráfica. Cada tarefa constrói sobre as anteriores, garantindo integração contínua sem código órfão.

## Tasks

- [x] 1. Set up project structure, shared models and core infrastructure
  - [x] 1.1 Initialize monorepo structure with frontend (React + Vite + TypeScript) and backend (Node.js + TypeScript + Fastify/Express) packages
    - Create `/frontend` and `/backend` directories with `package.json`, `tsconfig.json`
    - Configure Vite for React 18+ with TypeScript strict mode
    - Configure backend with ts-node/tsx for development
    - Install shared dependencies: zod, vitest, fast-check
    - Configure Tailwind CSS with Mobile First breakpoints
    - _Requirements: 12.1_

  - [x] 1.2 Define shared domain types, interfaces, DTOs and Zod validation schemas
    - Create `shared/` directory with `types.ts`, `schemas.ts`, `validators.ts`
    - Implement all TypeScript interfaces: `CreateRendaFixaDTO`, `CreateFIIDTO`, `CreateAporteDTO`, `PortfolioSummary`, `PatrimonyPoint`, `DividendPoint`, `FIIPerformanceData`, `ExportRow`
    - Implement Zod schemas: `rendaFixaSchema`, `fiiSchema`, `aporteRendaFixaSchema`, `aporteFIISchema`
    - Include enums: `RateType`, `AssetType`, `OperationType`, `IndexType`
    - _Requirements: 1.1, 1.2, 1.7, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2_

  - [x] 1.3 Write property tests for Renda Fixa validation (Property 1)
    - **Property 1: Validação de Renda Fixa aceita entradas válidas e rejeita inválidas**
    - Test that valid inputs (institution 1-100 chars, amount 0.01-999999999.99, future date, CDI 1-999% or IPCA+ 0.01-99.99%) pass validation
    - Test that invalid inputs (empty fields, value ≤ 0, past date, rate out of range) are rejected with error messages
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.5, 1.6, 1.7**

  - [x] 1.4 Write property tests for FII validation (Property 2)
    - **Property 2: Validação de FII aceita tickers válidos e rejeita inválidos**
    - Test ticker validation against `/^[A-Z]{4}\d{2}$/` pattern
    - Test that shares ≤ 0 or averagePrice ≤ 0 are rejected
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 2. Set up database schema and repository layer
  - [x] 2.1 Configure PostgreSQL with Prisma ORM and create database schema
    - Create `prisma/schema.prisma` with all models: User, Session, RendaFixa, FII, FIIQuote, FIIDividend, Aporte, MarketIndex, CronLog
    - Define all relations, indexes, enums (RateType, AssetType, OperationType, IndexType)
    - Generate initial migration
    - Configure database connection with environment variables
    - _Requirements: 1.1, 2.1, 3.4, 4.2, 5.2_

  - [x] 2.2 Implement repository layer with Prisma for all entities
    - Create `RendaFixaRepository` with CRUD operations
    - Create `FIIRepository` with CRUD + quote/dividend relations
    - Create `AporteRepository` with filtering by asset and user
    - Create `UserRepository` with session management
    - Create `MarketIndexRepository` for CDI/IPCA values
    - Create `CronLogRepository` for execution logging
    - Implement transactional support for composite operations
    - _Requirements: 3.6, 4.2, 5.2_

- [x] 3. Implement authentication system
  - [x] 3.1 Implement auth service with JWT + OAuth 2.0 (Google)
    - Create `AuthService` implementing `IAuthService` interface
    - Implement email/password registration with bcrypt hashing
    - Implement email/password login with JWT token generation
    - Implement Google OAuth flow
    - Implement refresh token rotation
    - Implement session creation with 30-minute inactivity timeout
    - Implement account lockout after 5 failed attempts (15 min block)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 3.2 Implement auth middleware and route protection
    - Create JWT validation middleware
    - Implement session activity tracking (update lastActivity on each request)
    - Implement automatic session expiration check
    - Create protected route wrapper that returns 401/redirects to login
    - _Requirements: 14.4, 14.5_

  - [x] 3.3 Write property tests for authentication (Properties 14, 15)
    - **Property 14: Bloqueio de Conta após Tentativas Falhas**
    - Test that exactly 5 consecutive failed attempts trigger lockout for 15 min
    - **Property 15: Expiração de Sessão por Inatividade**
    - Test that session is valid iff (now - lastActivity) ≤ 30 minutes
    - **Validates: Requirements 14.2, 14.4**

  - [x] 3.3 Implement frontend auth views and ViewModel
    - Create `LoginView.tsx` with email/password form and Google OAuth button
    - Create `RegisterView.tsx` with registration form
    - Implement `useAuthViewModel.ts` with login, register, logout actions
    - Implement `authStore.ts` with Zustand for session state
    - Implement `authService.ts` for API calls
    - Handle error display (generic message on invalid credentials)
    - Implement automatic redirect to login on 401 responses
    - _Requirements: 14.1, 14.2, 14.3, 14.5, 14.6_

  - [x] 3.4 Create auth.routes.ts with all authentication endpoints
    - Create `backend/src/routes/auth.routes.ts` implementing all 6 auth endpoints
    - POST /register — email/password registration
    - POST /login — email/password login
    - POST /google — Google OAuth login
    - POST /refresh — refresh token rotation
    - POST /logout — session termination (protected)
    - GET /me — get current user (protected)
    - Wire AuthService and authMiddleware into route handlers
    - Implement error mapping (AuthError codes to HTTP status codes)
    - _Requirements: 14.1, 14.2, 14.3, 14.5, 14.6_

  - [x] 3.5 Register auth routes in server.ts with prefix /api/auth
    - Import `authRoutes` from `./routes/auth.routes.js` in `backend/src/server.ts`
    - Register with Fastify: `await fastify.register(authRoutes, { prefix: '/api/auth' })`
    - Ensure registration is placed alongside other route registrations (renda-fixa, fiis, aportes, export, dashboard)
    - _Requirements: 14.1, 14.2, 14.3, 14.5, 14.6_

- [x] 4. Checkpoint - Ensure infrastructure and auth tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Renda Fixa CRUD (backend + frontend)
  - [x] 5.1 Implement Renda Fixa backend service and API endpoints
    - Create `RendaFixaService` with create, update, delete, list methods
    - Implement Zod validation on incoming DTOs
    - Create REST endpoints: GET/POST/PUT/DELETE `/api/renda-fixa`
    - Validate institution max 100 chars, amount 0.01-999999999.99, future maturity date, rate format
    - Return proper HTTP status codes and validation error messages
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 5.2 Implement Renda Fixa frontend form and ViewModel
    - Create `RendaFixaForm.tsx` with all fields (institution, amount, maturity date, rate type selector, rate value)
    - Implement `useRendaFixaViewModel.ts` with form validation, create, update, delete actions
    - Display inline validation errors per field
    - Show success/error toasts (5s auto-dismiss for success, persistent for error)
    - Show confirmation modal on delete action
    - Display new title in asset list on successful creation
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 13.2, 13.3, 13.4, 13.5_

- [x] 6. Implement FII CRUD (backend + frontend)
  - [x] 6.1 Implement FII backend service and API endpoints
    - Create `FIIService` with create, update, delete, list methods
    - Implement ticker validation (4 uppercase letters + 2 digits)
    - Implement shares (integer ≥ 1) and averagePrice (> 0) validation
    - Create REST endpoints: GET/POST/PUT/DELETE `/api/fiis`
    - Return proper HTTP status codes and validation error messages
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 6.2 Implement FII frontend form and ViewModel
    - Create `FIIForm.tsx` with ticker, shares, average price, purchase date fields
    - Implement `useFIIViewModel.ts` with ticker validation, form submission, CRUD actions
    - Display inline validation errors (ticker format, shares > 0, price > 0)
    - Show success/error toasts and confirmation modals
    - Display new FII in asset list on successful creation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 13.2, 13.4, 13.5_

- [x] 7. Implement Aporte (contribution) system
  - [x] 7.1 Implement Aporte backend service with transactional logic
    - Create `AporteService` implementing registration for Renda Fixa and FII
    - Implement Renda Fixa aporte: sum amount to existing balance within transaction
    - Implement FII aporte: recalculate average price with formula `(Q1*P1 + Q2*P2) / (Q1 + Q2)` within transaction
    - Implement new position creation (delegate to Renda Fixa/FII create logic)
    - Register all aportes in history with date, amount, asset ID, operation type
    - Implement rollback on failure (Prisma transaction ensures atomicity)
    - Create REST endpoints: GET/POST `/api/aportes`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 7.2 Write property tests for Aporte calculations (Properties 3, 4, 5)
    - **Property 3: Aporte em Renda Fixa soma ao saldo existente**
    - Test that for any valid aporte V, new balance = S + V
    - **Property 4: Recálculo de Preço Médio de FII**
    - Test that new average = (Q1*P1 + Q2*P2) / (Q1 + Q2)
    - **Property 5: Completude do Histórico de Aportes**
    - Test that N successful aportes result in exactly N history entries
    - **Validates: Requirements 3.1, 3.2, 3.4**

  - [x] 7.3 Implement Aporte frontend form and ViewModel
    - Create `AporteForm.tsx` with asset selection, type-specific fields
    - Implement `useAporteViewModel.ts` with registration and history retrieval
    - Handle both new position and existing position flows
    - Display validation errors, success/error toasts
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 13.4, 13.5_

- [x] 8. Checkpoint - Ensure CRUD and Aporte tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement market data integration (Cron Jobs)
  - [x] 9.1 Implement Market Data service with retry logic and rate limiting
    - Create `MarketDataService` implementing `IMarketDataService`
    - Implement `fetchQuote(ticker)` with 30-second timeout per request
    - Implement `fetchDividendData(ticker)` for provento/dividend yield
    - Implement retry logic: max 3 attempts per execution, 60s wait between retries
    - Implement error handling: maintain last valid quote on failure, log errors
    - _Requirements: 4.1, 4.3, 5.1, 5.3, 11.3, 11.4_

  - [x] 9.2 Implement Cron Service for scheduled quote updates
    - Create `CronService` implementing `ICronService` using node-cron
    - Schedule execution max 2x/day with minimum 8h interval
    - On execution: fetch quotes for all user FIIs, persist price + sourceDate + updatedAt
    - Fetch dividend data (dividendPerShare, dividendYield, paymentDate) in same job
    - Log execution results in CronLog (successCount, failureCount, duration)
    - Implement local cache with validity until next cron execution
    - _Requirements: 4.1, 4.2, 4.5, 5.1, 5.2, 11.1, 11.2_

  - [x] 9.3 Write property tests for retry logic (Property 13)
    - **Property 13: Limite de Retentativas na API Externa**
    - Test that for any cron execution with API errors, max 3 retries occur with ≥ 60s intervals
    - **Validates: Requirements 11.3**

- [x] 10. Implement financial calculation engine
  - [x] 10.1 Implement CalculationService for all financial computations
    - Create `CalculationService` implementing `ICalculationService`
    - Implement CDI compound interest: `V * (1 + R * P/100)^D`
    - Implement IPCA + fixed rate: `V * (1 + I + T/100)^(D/252)`
    - Implement average price calculation: `(Q1*P1 + Q2*P2) / (Q1+Q2)`
    - Implement dividend projection: `Σ(Qi × Di)` for all FIIs
    - Implement total patrimony: `Σ(RF_j) + Σ(Qi × Ci)`
    - Implement allocation percentages (must sum to 100%)
    - Implement FII variation percent: `((CA - PM) / PM) * 100`
    - Implement staleness detection (>48h for quotes, >60 days for dividends)
    - Use last valid index value when CDI/IPCA unavailable
    - _Requirements: 6.1, 6.4, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 10.2 Write property tests for financial calculations (Properties 7, 8, 9, 10, 11, 12)
    - **Property 7: Cálculo de Projeção de Dividendos** — Σ(Qi × Di) with 2 decimal precision
    - **Property 8: Cálculo de Rentabilidade CDI** — V × (1 + R × P/100)^D
    - **Property 9: Cálculo de Rentabilidade IPCA** — V × (1 + I + T/100)^(D/252)
    - **Property 10: Cálculo do Patrimônio Total** — Σ(RFj) + Σ(Qi × Ci)
    - **Property 11: Percentuais de Alocação Somam 100%** — RF% + FII% = 100%
    - **Property 12: Cálculo de Variação Percentual de FII** — ((CA - PM) / PM) × 100
    - **Validates: Requirements 6.1, 6.4, 7.1, 7.3, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**

  - [x] 10.3 Write property test for staleness detection (Property 6)
    - **Property 6: Detecção de Dados Desatualizados (Staleness)**
    - Test isStale = true iff (now - T) > 48h for quotes
    - Test dividend staleness iff (now - P) > 60 days
    - **Validates: Requirements 4.4, 5.5**

- [x] 11. Checkpoint - Ensure calculation and integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement Dashboard views and charts
  - [x] 12.1 Implement Dashboard backend endpoints
    - Create `DashboardService` with summary, patrimony history, dividends, allocation methods
    - Create REST endpoints: GET `/api/dashboard/summary`, `/api/dashboard/patrimony-history`, `/api/dashboard/dividends`, `/api/dashboard/allocation`
    - Calculate patrimony history with monthly granularity (1-60 months)
    - Calculate dividend history (last 12 months) + projection (next 6 months)
    - Serve all data from local cache (no direct API calls)
    - _Requirements: 8.1, 8.2, 9.1, 9.2, 10.1, 10.2_

  - [x] 12.2 Implement Dashboard frontend with patrimony summary and allocation chart
    - Create `DashboardView.tsx` as main container
    - Create `AssetSummaryCard.tsx` showing total patrimony, RF total, FII total
    - Create `AllocationPieChart.tsx` using Recharts/Chart.js (donut/pie chart showing RF% vs FII%)
    - Show green/red/neutral variation with non-chromatic indicators (arrows)
    - Show staleness badge when quote > 48h old
    - Implement `useDashboardViewModel.ts` with data fetching and formatting
    - Render numeric values and layout within 1 second (before charts)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 4.4, 13.1, 16.2_

  - [x] 12.3 Implement patrimony evolution line chart
    - Create `PatrimonyChart.tsx` with monthly data points (line or bar chart)
    - X-axis: months, Y-axis: patrimony value in BRL
    - Support 1-60 months of history
    - Show message when < 2 months of data available
    - Render within 3 seconds, show loading spinner if delayed
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 16.1, 16.3_

  - [x] 12.4 Implement dividend evolution bar chart
    - Create `DividendChart.tsx` with historical (12 months) + projected (6 months) bars
    - Use distinct visual pattern for projections (reduced opacity or different color)
    - X-axis: month/year format, Y-axis: total dividends in BRL
    - Auto-update when new proventos are registered (no page reload)
    - Show empty state with message when no dividend data
    - Show detailed breakdown per FII (ticker, shares, last dividend, projected value)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 6.1, 6.2, 6.3, 6.4_

- [x] 13. Implement data export feature
  - [x] 13.1 Implement export backend service
    - Create `ExportService` implementing `IExportService`
    - Implement CSV generation using csv-writer with columns: date, asset name, type, invested amount, shares, current balance
    - Implement Excel generation using ExcelJS with same columns
    - Date format: ISO 8601 (YYYY-MM-DD), amounts with 2 decimal places
    - Enforce 5-second response time for up to 5000 records, cancel after 30s with error message
    - Create REST endpoints: POST `/api/export/csv`, POST `/api/export/excel`
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 13.2 Write property test for export completeness (Property 16)
    - **Property 16: Completude dos Dados de Exportação**
    - Test that for N aportes, export contains exactly N data rows with all required columns
    - **Validates: Requirements 15.1, 15.2**

  - [x] 13.3 Implement export frontend view
    - Create `ExportView.tsx` with format selector (CSV/Excel) and export button
    - Implement `useExportViewModel.ts` with export actions and progress state
    - Show loading state during generation, error toast on failure
    - Trigger file download on success
    - _Requirements: 15.1, 15.3, 15.4, 13.4, 13.5_

- [x] 14. Implement responsive design and visual feedback system
  - [x] 14.1 Implement Mobile First responsive layout and UI feedback components
    - Configure Tailwind breakpoints: mobile < 768px (single column), tablet/desktop ≥ 768px
    - Ensure no horizontal scrollbar from 320px to 1920px
    - Ensure minimum 44x44px touch targets on mobile
    - Ensure minimum 16px font size on mobile
    - Create reusable `Toast` component (success: green, 5s auto-dismiss; error: red, manual dismiss)
    - Create reusable `ConfirmModal` component for destructive actions
    - Add non-chromatic indicators (up/down arrows) alongside color-based indicators
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 14.2 Write unit tests for responsive layout and UI components
    - Test layout changes at 768px breakpoint
    - Test toast auto-dismiss timing (5 seconds)
    - Test confirmation modal cancel preserves state
    - Test touch target sizes
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 13.2, 13.3_

- [x] 15. Implement performance optimization and loading states
  - [x] 15.1 Implement loading states, skeleton screens and performance optimization
    - Add skeleton/loading placeholders for chart areas
    - Implement progressive rendering: numeric values first (<1s), then charts (<3s)
    - Add animated loading indicator for charts exceeding 3s
    - Add error state with retry button if dashboard exceeds 10s to load
    - Implement data caching in Zustand store to minimize re-fetches
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 16. Final integration and wiring
  - [x] 16.1 Wire all components together with routing and navigation
    - Set up React Router with protected routes (redirect to login if unauthenticated)
    - Create main navigation layout (responsive sidebar/bottom nav on mobile)
    - Connect all views to their ViewModels
    - Wire auth interceptor for automatic token refresh and 401 handling
    - Ensure logout clears session and redirects within 2 seconds
    - _Requirements: 14.3, 14.5, 14.6_

  - [x] 16.2 Write integration tests for critical flows
    - Test login → dashboard access → asset creation → dashboard update flow
    - Test aporte registration with balance/average price update
    - Test export generation with real data
    - Test session expiration redirect
    - _Requirements: 14.1, 14.3, 14.5, 3.1, 3.2, 15.1_

- [x] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at reasonable breaks
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All financial calculations use 2 decimal precision as specified in requirements
- Transactional operations (aportes) use Prisma transactions for atomicity
- Cron jobs run max 2x/day with 8h minimum interval as per requirements
- Frontend follows MVVM: Views → ViewModels (hooks + Zustand) → Services → API
- Backend follows layered architecture: Controllers → Services → Repositories → Database

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "2.2"] },
    { "id": 3, "tasks": ["3.1", "3.2"] },
    { "id": 4, "tasks": ["3.3", "3.4", "5.1", "6.1"] },
    { "id": 5, "tasks": ["3.5", "5.2", "6.2", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3"] },
    { "id": 7, "tasks": ["9.1", "10.1"] },
    { "id": 8, "tasks": ["9.2", "9.3", "10.2", "10.3"] },
    { "id": 9, "tasks": ["12.1", "13.1"] },
    { "id": 10, "tasks": ["12.2", "12.3", "12.4", "13.2", "13.3"] },
    { "id": 11, "tasks": ["14.1", "15.1"] },
    { "id": 12, "tasks": ["14.2", "16.1"] },
    { "id": 13, "tasks": ["16.2"] }
  ]
}
```
