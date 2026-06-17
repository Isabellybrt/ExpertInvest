# Implementation Plan: Aporte Asset Selector

## Overview

This implementation adds two capabilities to the Aporte system: (1) resolving and returning asset names in the aporte history endpoint, and (2) a new endpoint that returns the user's registered assets formatted for dropdown selection. The work modifies the existing repository, service, and routes layers using Prisma joins and TypeScript interfaces.

## Tasks

- [x] 1. Define interfaces and update repository layer
  - [x] 1.1 Add new TypeScript interfaces for asset selector feature
    - Add `AporteResultWithAsset`, `AssetOption`, and `UserAssetsResponse` interfaces to `aporte.service.ts`
    - `AporteResultWithAsset` extends `AporteResult` with an `assetName: string` field
    - `AssetOption` has `id: string` and `label: string`
    - `UserAssetsResponse` has `fii: AssetOption[]` and `rendaFixa: AssetOption[]`
    - _Requirements: 4.1, 3.2, 3.3_

  - [x] 1.2 Add `findByUserIdWithAssets` method to `AporteRepository`
    - Add a new method to `backend/src/repositories/aporte.repository.ts`
    - Use Prisma `include` to join `fii` (select `ticker`) and `rendaFixa` (select `institution`, `rateType`, `rateValue`)
    - Order by `date: 'desc'`
    - This resolves asset names in a single query (N+1 prevention)
    - _Requirements: 4.5, 4.2, 4.3_

- [x] 2. Implement service methods for asset resolution and listing
  - [x] 2.1 Add `toResultWithAsset` helper method to `AporteService`
    - Map an aporte record (with included fii/rendaFixa) to `AporteResultWithAsset`
    - If `fii` relation is present, set `assetName` to `fii.ticker`
    - If `rendaFixa` relation is present, set `assetName` to `rendaFixa.institution`
    - If both are null, set `assetName` to `"Ativo removido"`
    - _Requirements: 4.2, 4.3, 4.4_

  - [x] 2.2 Modify `listByUser` method to return asset names
    - Change return type from `AporteResult[]` to `AporteResultWithAsset[]`
    - Call `findByUserIdWithAssets` instead of `findByUserId`
    - Use `toResultWithAsset` mapper instead of `toResult`
    - _Requirements: 4.1, 1.5_

  - [x] 2.3 Add `formatRendaFixaLabel` helper method to `AporteService`
    - Format as `"{institution} - {rateValue}% CDI"` for CDI_PERCENTAGE rate type
    - Format as `"{institution} - {rateValue}% IPCA+"` for IPCA_PLUS rate type
    - _Requirements: 2.3, 3.3_

  - [x] 2.4 Add `listUserAssets` method to `AporteService`
    - Fetch FIIs and RendaFixas in parallel using `Promise.all`
    - Map FIIs to `{ id, label: ticker }`
    - Map RendaFixas to `{ id, label: formatRendaFixaLabel(r) }`
    - Return `UserAssetsResponse` shape
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 2.1_

  - [x] 2.5 Write property tests for asset name resolution and label formatting
    - **Property 1: FII aporte resolves to ticker**
    - **Property 2: Renda Fixa aporte resolves to institution name**
    - **Property 3: Deleted asset fallback label**
    - **Property 4: FII dropdown label equals ticker**
    - **Property 5: Renda Fixa dropdown label format**
    - **Validates: Requirements 1.2, 1.3, 1.4, 2.2, 2.3, 3.2, 3.3, 4.2, 4.3, 4.4**
    - File: `backend/src/services/__tests__/aporte-asset-selector.property.test.ts`

- [x] 3. Checkpoint - Verify service layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Wire up the routes layer
  - [x] 4.1 Add `GET /api/aportes/assets` route
    - Add the new route in `backend/src/routes/aporte.routes.ts`
    - IMPORTANT: Register this route BEFORE the `/:assetId` route to avoid path collision
    - Call `aporteService.listUserAssets(userId)` and return with status 200
    - Authentication is already applied via the existing `preHandler` hook
    - _Requirements: 3.1, 3.4, 2.1_

  - [x] 4.2 Write unit tests for the new endpoint and modified list response
    - Verify `GET /api/aportes` response includes `assetName` field
    - Verify `GET /api/aportes/assets` returns correct shape with `fii` and `rendaFixa` arrays
    - Verify empty arrays returned when user has no assets
    - Verify 401 returned without auth token
    - Extend existing test file: `backend/src/services/aporte.service.test.ts`
    - _Requirements: 1.1, 1.5, 3.4, 3.5, 2.5_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript, matching the existing project stack
- No database schema changes required — existing Prisma relations support this feature
- The `GET /api/aportes/assets` route must be registered before `/:assetId` to avoid Fastify treating "assets" as an assetId parameter

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.3"] },
    { "id": 2, "tasks": ["2.2", "2.4"] },
    { "id": 3, "tasks": ["2.5", "4.1"] },
    { "id": 4, "tasks": ["4.2"] }
  ]
}
```
