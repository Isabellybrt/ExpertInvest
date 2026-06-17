# Implementation Plan: FII Portfolio Table

## Overview

Implement a read-only FII portfolio table that displays consolidated fund data with calculated dividend metrics. The feature spans backend (new service, repository method, route) and frontend (new service, viewmodel, view component) following the existing MVVM architecture with TypeScript throughout.

## Tasks

- [x] 1. Backend: Repository and Service Layer
  - [x] 1.1 Add `findByUserIdWithAllDividends` method to FIIRepository
    - Add new method to `backend/src/repositories/fii.repository.ts`
    - Query FIIs by userId with ALL dividends included (ordered by paymentDate desc)
    - Order FIIs by createdAt desc
    - _Requirements: 1.5, 6.1, 6.3_

  - [x] 1.2 Create FIIPortfolioService class
    - Create new file `backend/src/services/fii-portfolio.service.ts`
    - Define `FIIPortfolioItem` interface (ticker, shares, averagePrice, lastMonthDividend, projectedMonthlyYield)
    - Implement `getPortfolio(userId)` method that fetches FIIs with dividends and maps to portfolio items
    - Implement `getPreviousMonthRange(referenceDate)` returning [start, end] of previous calendar month
    - Implement `calculateLastMonthDividend(shares, dividends, referenceDate)` summing dividendPerShare × shares for dividends in previous month
    - Implement `calculateProjectedMonthlyYield(shares, dividends)` using most recent dividendPerShare × shares
    - All monetary values rounded to 2 decimal places
    - Return 0 when no dividend data available or shares is 0
    - _Requirements: 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 6.1_

  - [x] 1.3 Write property tests for FIIPortfolioService (Properties 4, 5, 6)
    - Create `backend/src/services/__tests__/fii-portfolio.property.test.ts`
    - Use fast-check with minimum 100 iterations per property
    - **Property 4: Last month dividend calculation** — verify sum of dividendPerShare × shares for dividends in previous month, 0 when none
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - **Property 5: Previous month range computation** — verify start/end always span exactly one calendar month
    - **Validates: Requirements 2.4**
    - **Property 6: Projected monthly yield calculation** — verify most recent dividendPerShare × shares, 0 when empty or shares=0
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

  - [x] 1.4 Write unit tests for FIIPortfolioService
    - Create `backend/src/services/fii-portfolio.service.test.ts`
    - Test: getPortfolio returns empty array for user with no FIIs
    - Test: getPortfolio returns 0 for calculated fields when FII has no dividends
    - Test: getPortfolio correctly calculates lastMonthDividend with multiple dividend records in previous month
    - Test: getPortfolio correctly calculates projectedMonthlyYield with most recent dividend
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 6.5_

- [x] 2. Backend: Route and Integration
  - [x] 2.1 Add GET /portfolio route to fii.routes.ts
    - Add `GET /portfolio` handler in `backend/src/routes/fii.routes.ts`
    - Register the route BEFORE the `/:id` parametric routes to avoid Fastify matching "portfolio" as an id
    - Instantiate FIIPortfolioService and call `getPortfolio(userId)`
    - Return 200 with portfolio items array
    - Return 500 with `{ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' }` on service errors
    - Auth middleware is already applied via the plugin-level hook
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 2.2 Write property tests for portfolio endpoint (Properties 1, 2, 3)
    - Add to `backend/src/services/__tests__/fii-portfolio.property.test.ts`
    - **Property 1: Portfolio returns exactly the user's FIIs** — N FIIs in → N items out, correct ticker set, no cross-user leakage
    - **Validates: Requirements 1.1, 6.3**
    - **Property 2: Portfolio response fields are correctly rounded to 2 decimal places** — averagePrice, lastMonthDividend, projectedMonthlyYield all rounded
    - **Validates: Requirements 1.2, 6.1**
    - **Property 3: Portfolio is sorted by creation date descending** — consecutive items have non-increasing creation dates
    - **Validates: Requirements 1.5**

  - [x] 2.3 Write property tests for weighted average (Properties 7, 8)
    - Add to `backend/src/services/__tests__/fii-portfolio.property.test.ts`
    - **Property 7: Weighted average price on new aporte** — verify formula: round2((currentShares × currentAvgPrice + newShares × newPricePerShare) / totalShares)
    - **Validates: Requirements 4.2, 4.3**
    - **Property 8: Reverse weighted average on aporte deletion** — verify reverse formula and 0 when resulting shares = 0
    - **Validates: Requirements 4.4**

- [x] 3. Checkpoint - Backend verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend: Service and ViewModel
  - [x] 4.1 Create fiiPortfolioService
    - Create new file `frontend/src/services/fiiPortfolioService.ts`
    - Define `FIIPortfolioItem` interface matching backend response
    - Implement `getPortfolio()` method using apiClient GET `/fiis/portfolio`
    - _Requirements: 6.1, 5.1_

  - [x] 4.2 Create useFIIPortfolioViewModel hook
    - Create new file `frontend/src/viewmodels/useFIIPortfolioViewModel.ts`
    - Expose state: `portfolioItems`, `isLoading`, `error`
    - Implement `loadPortfolio()` that fetches portfolio data with AbortController (10s timeout)
    - Implement `retry()` that re-triggers loadPortfolio
    - Set user-friendly error message on API failure or timeout
    - _Requirements: 1.1, 1.4, 1.6, 5.1, 5.3_

  - [x] 4.3 Write unit tests for useFIIPortfolioViewModel
    - Create `frontend/src/viewmodels/__tests__/useFIIPortfolioViewModel.test.ts`
    - Test: loadPortfolio calls API and sets portfolioItems
    - Test: sets error state on API failure
    - Test: retry re-fetches data successfully
    - Test: handles 10s timeout with error message
    - _Requirements: 1.6, 5.3_

- [x] 5. Frontend: View Component and Routing
  - [x] 5.1 Create FIIPortfolioTable view component
    - Create new file `frontend/src/views/portfolio/FIIPortfolioTable.tsx`
    - Render loading spinner while `isLoading` is true
    - Render error state with retry button when `error` is set
    - Render empty state message when portfolioItems is empty (inviting user to register first FII)
    - Render responsive HTML table with columns: Ticker, Cotas, Preço Médio, Dividendo Último Mês, Rendimento Projetado
    - Format all monetary values in pt-BR locale (R$ X.XXX,XX) with 2 decimal places
    - No edit/delete/action buttons — purely read-only with no editable input fields
    - Use Tailwind CSS matching existing project styling patterns
    - Call `loadPortfolio()` on component mount
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 4.1, 7.1, 7.2, 7.3_

  - [x] 5.2 Register /carteira-fiis route in App.tsx
    - Add `<Route path="/carteira-fiis" element={<FIIPortfolioTable />} />` inside protected routes in `frontend/src/App.tsx`
    - Import FIIPortfolioTable component
    - _Requirements: 1.1, 5.1_

  - [x] 5.3 Write unit tests for FIIPortfolioTable component
    - Create `frontend/src/views/portfolio/__tests__/FIIPortfolioTable.test.tsx`
    - Test: renders table with correct column headers
    - Test: shows empty state when no items returned
    - Test: shows error state with retry button on failure
    - Test: no edit/delete buttons are rendered (read-only)
    - Test: formats monetary values in pt-BR locale
    - Test: displays loading state while fetching
    - _Requirements: 1.2, 1.4, 1.6, 7.1, 7.2, 7.3_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The GET /portfolio route MUST be registered before /:id routes in fii.routes.ts to avoid route conflicts
- All monetary calculations are rounded to 2 decimal places server-side
- The frontend uses AbortController with 10s timeout for the portfolio fetch

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "4.1"] },
    { "id": 1, "tasks": ["1.2", "4.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "2.1", "4.3"] },
    { "id": 3, "tasks": ["2.2", "2.3", "5.1"] },
    { "id": 4, "tasks": ["5.2", "5.3"] }
  ]
}
```
