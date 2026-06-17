# Requirements Document

## Introduction

This feature enhances the Aporte (contribution) registration flow with two improvements:
1. The aporte history display should show which specific asset (FII ticker or Renda Fixa title) was associated with each aporte entry.
2. The "Selecione o ativo" dropdown should automatically populate with assets the user has already registered in the system (FIIs and Renda Fixa titles), removing the need to pass them externally and making subsequent aportes faster.

## Glossary

- **Aporte_System**: The subsystem responsible for registering, validating, and displaying investment contributions (aportes).
- **Asset_Selector**: The dropdown component labeled "Selecione o ativo" used to pick an existing asset when registering an aporte to an existing position.
- **Aporte_History**: The list displayed below the aporte form showing previously registered contributions with their details.
- **FII**: Fundo de Investimento Imobiliário, identified by a ticker code (e.g., MXRF11).
- **Renda_Fixa**: Fixed income title, identified by institution name and rate details.
- **Asset_Label**: A human-readable identifier for an asset — the ticker for FIIs (e.g., "MXRF11") or the institution name for Renda Fixa (e.g., "Nubank - 110% CDI").

## Requirements

### Requirement 1: Display asset name in aporte history

**User Story:** As an investor, I want to see which specific asset each aporte was made to in the history list, so that I can quickly identify my contributions without needing to cross-reference other screens.

#### Acceptance Criteria

1. WHEN the Aporte_History is rendered, THE Aporte_System SHALL display the Asset_Label for each aporte entry alongside the existing information (date, amount, operation type).
2. WHEN the aporte is of type FII, THE Aporte_System SHALL display the FII ticker as the Asset_Label (e.g., "MXRF11").
3. WHEN the aporte is of type RENDA_FIXA, THE Aporte_System SHALL display the institution name as the Asset_Label (e.g., "Nubank").
4. IF the associated asset has been deleted from the system, THEN THE Aporte_System SHALL display "Ativo removido" as the Asset_Label.
5. WHEN the backend returns the aporte list, THE Aporte_System SHALL include the asset name in the response payload for each aporte record.

### Requirement 2: Auto-populate asset selector with user's registered assets

**User Story:** As an investor, I want the "Selecione o ativo" dropdown to be pre-populated with my already-registered FIIs and Renda Fixa titles, so that I can register new aportes faster without needing to remember asset details.

#### Acceptance Criteria

1. WHEN the aporte form loads, THE Aporte_System SHALL fetch the list of the user's registered assets from the backend.
2. WHEN the user selects asset type FII, THE Asset_Selector SHALL display all FII positions registered by the user, with each option showing the ticker (e.g., "MXRF11").
3. WHEN the user selects asset type RENDA_FIXA, THE Asset_Selector SHALL display all Renda Fixa positions registered by the user, with each option showing the institution name and rate info (e.g., "Nubank - 110% CDI").
4. WHEN the user switches between asset types, THE Asset_Selector SHALL update the options to show only assets of the selected type.
5. IF the user has no registered assets of the selected type, THEN THE Asset_Selector SHALL display an empty state with the text "Nenhum ativo cadastrado" as a disabled option.

### Requirement 3: Backend endpoint for user assets listing

**User Story:** As a frontend developer, I want a unified endpoint that returns the user's assets formatted for selection, so that the aporte form can populate the dropdown without multiple API calls.

#### Acceptance Criteria

1. WHEN the frontend requests available assets, THE Aporte_System SHALL provide a GET endpoint that returns both FII and Renda Fixa assets for the authenticated user.
2. THE Aporte_System SHALL return each FII asset with its id and ticker as the label.
3. THE Aporte_System SHALL return each Renda Fixa asset with its id and a label composed of institution name and rate description.
4. THE Aporte_System SHALL require authentication for the assets listing endpoint.
5. IF the user has no registered assets, THEN THE Aporte_System SHALL return an empty array for each asset type.

### Requirement 4: Include asset details in aporte list response

**User Story:** As a frontend developer, I want the aporte list endpoint to include asset identification data, so that the history can display which asset each aporte belongs to without additional API calls.

#### Acceptance Criteria

1. WHEN the GET /api/aportes endpoint returns aporte records, THE Aporte_System SHALL include an assetName field containing the Asset_Label for each record.
2. WHEN the aporte is linked to a FII, THE Aporte_System SHALL populate assetName with the FII ticker from the related FII record.
3. WHEN the aporte is linked to a Renda Fixa title, THE Aporte_System SHALL populate assetName with the institution name from the related RendaFixa record.
4. IF the related asset record no longer exists (rendaFixaId or fiiId references a deleted record), THEN THE Aporte_System SHALL set assetName to "Ativo removido".
5. THE Aporte_System SHALL resolve asset names using database joins without issuing separate queries per aporte (N+1 prevention).
