# Requirements Document

## Introduction

Tela de portfólio de Fundos Imobiliários (FIIs) que apresenta uma tabela somente-leitura com as informações consolidadas de cada FII do usuário. A tabela exibe o nome (ticker), preço médio, dividendo pago no mês anterior e rendimento mensal projetado. Novos FIIs criados via fluxo de aporte aparecem automaticamente na tabela, e aportes subsequentes apenas incrementam a quantidade de cotas com recálculo do preço médio.

## Glossary

- **FII_Portfolio_Table**: Componente de tabela React que exibe a lista de FIIs do usuário autenticado em modo somente-leitura
- **FII**: Fundo de Investimento Imobiliário, representado pelo modelo FII no banco de dados (ticker, shares, averagePrice, etc.)
- **Ticker**: Código identificador do FII na bolsa (ex.: HGLG11, XPML11), com até 6 caracteres
- **Average_Price**: Preço médio ponderado de compra das cotas de um FII, recalculado a cada aporte
- **Last_Month_Dividend**: Valor total de dividendos recebidos no mês anterior para um FII específico, calculado como dividendPerShare × shares
- **Projected_Monthly_Yield**: Rendimento mensal projetado para um FII, baseado no último dividendo por cota multiplicado pela quantidade de cotas
- **Cota**: Uma unidade de participação em um FII (share)
- **Aporte**: Contribuição financeira que adiciona cotas a um FII existente ou cria uma nova posição
- **API_Backend**: Servidor Express com rotas protegidas por autenticação JWT que expõe endpoints REST
- **Portfolio_Service**: Módulo de serviço backend responsável por consolidar e calcular os dados do portfólio de FIIs

## Requirements

### Requirement 1: Listar FIIs na Tabela de Portfólio

**User Story:** Como investidor, eu quero ver todos os meus FIIs em uma tabela, para que eu possa acompanhar meu portfólio de fundos imobiliários de forma consolidada.

#### Acceptance Criteria

1. WHEN the authenticated user navigates to the FII portfolio page, THE FII_Portfolio_Table SHALL display all FIIs belonging to that user, showing one row per FII entry
2. THE FII_Portfolio_Table SHALL display the following columns for each FII: Ticker, Quantidade de Cotas (integer), Preço Médio (R$ with 2 decimal places), Dividendo do Último Mês (R$ with 2 decimal places, calculated as shares × lastDividendPerShare from the most recent FIIDividend record), and Rendimento Mensal Projetado (R$ with 2 decimal places, calculated as shares × lastDividendPerShare from the most recent FIIDividend record)
3. IF dividend data is unavailable for a given FII, THEN THE FII_Portfolio_Table SHALL display R$ 0,00 for both the Dividendo do Último Mês and Rendimento Mensal Projetado columns of that FII
4. WHEN the user has no FIIs registered, THE FII_Portfolio_Table SHALL display an empty state message indicating that no FIIs are found and inviting the user to register their first FII
5. THE FII_Portfolio_Table SHALL order FIIs by creation date in descending order (most recent first)
6. IF the FII data request fails due to a network or server error, THEN THE FII_Portfolio_Table SHALL display an error message indicating that data could not be loaded and SHALL provide a retry option

### Requirement 2: Calcular Dividendo do Último Mês

**User Story:** Como investidor, eu quero ver quanto cada FII me pagou no mês passado, para que eu possa avaliar o retorno real dos meus fundos.

#### Acceptance Criteria

1. WHEN a FII has one or more dividend records with paymentDate within the previous calendar month, THE Portfolio_Service SHALL calculate the Last_Month_Dividend as the sum of (dividendPerShare × current number of shares held) for each dividend record in that month, rounded to 2 decimal places
2. WHEN a FII has no dividend records with paymentDate within the previous calendar month, THE Portfolio_Service SHALL return R$ 0,00 as the Last_Month_Dividend
3. IF a FII has multiple dividend records within the previous calendar month, THEN THE Portfolio_Service SHALL include all records in the sum calculation, using each record's dividendPerShare multiplied by the user's current shares count
4. THE Portfolio_Service SHALL determine the previous calendar month as the full month immediately before the current server date (e.g., if today is 2026-06-17, previous month is 2026-05-01 through 2026-05-31 inclusive)

### Requirement 3: Calcular Rendimento Mensal Projetado

**User Story:** Como investidor, eu quero ver a projeção de rendimento mensal de cada FII, para que eu possa planejar minha renda passiva.

#### Acceptance Criteria

1. THE Portfolio_Service SHALL calculate the Projected_Monthly_Yield for each FII as the most recent dividendPerShare (ordered by paymentDate descending) multiplied by the current number of shares, rounded to 2 decimal places
2. IF a FII has no FIIDividend records, THEN THE Portfolio_Service SHALL return R$ 0,00 as the Projected_Monthly_Yield for that FII
3. THE Portfolio_Service SHALL use the most recent FIIDividend record ordered by paymentDate descending, regardless of the payment month, for the projected yield calculation
4. IF the FII shares value is zero, THEN THE Portfolio_Service SHALL return R$ 0,00 as the Projected_Monthly_Yield for that FII

### Requirement 4: Exibir Preço Médio

**User Story:** Como investidor, eu quero ver o preço médio de compra de cada FII, para que eu possa comparar com o preço atual e avaliar minha posição.

#### Acceptance Criteria

1. THE FII_Portfolio_Table SHALL display the Average_Price stored in the FII record, formatted as Brazilian Real using the pt-BR locale (e.g., R$ 1.234,56) with exactly 2 decimal places
2. WHEN a new aporte is registered for an existing FII, THE API_Backend SHALL recalculate the Average_Price using the weighted average formula: (currentShares × currentAvgPrice + newShares × newPricePerShare) / (currentShares + newShares), rounding the result to 2 decimal places
3. WHEN a new FII position is created via aporte, THE API_Backend SHALL set the Average_Price equal to the pricePerShare of that first aporte
4. WHEN an aporte for an existing FII is deleted, THE API_Backend SHALL reverse the weighted average by recalculating: newAvgPrice = (currentShares × currentAvgPrice − deletedShares × deletedPricePerShare) / (currentShares − deletedShares), and IF the resulting shares equal 0, THEN THE API_Backend SHALL set Average_Price to 0

### Requirement 5: Atualizar Tabela com Novos FIIs

**User Story:** Como investidor, eu quero que novos FIIs criados via aporte apareçam automaticamente na tabela, para que eu não precise atualizar manualmente a tela.

#### Acceptance Criteria

1. WHEN the Usuário navigates to the FII_Portfolio_Table view (including initial mount and route navigation), THE FII_Portfolio_Table SHALL fetch the current list of FIIs from the backend and display all FII records associated with the authenticated Usuário, including any FII created through the aporte flow (NEW_POSITION operation)
2. WHEN a new aporte is registered for an existing FII (EXISTING_POSITION operation) and the Usuário subsequently navigates to the FII_Portfolio_Table view, THE FII_Portfolio_Table SHALL display the updated share count and the recalculated Preço_Médio for that FII
3. IF the data fetch to populate the FII_Portfolio_Table fails or does not respond within 10 seconds, THEN THE FII_Portfolio_Table SHALL display an error message indicating that the data could not be loaded and offer the Usuário an option to retry the fetch

### Requirement 6: Endpoint de Portfólio de FIIs

**User Story:** Como desenvolvedor frontend, eu quero um endpoint dedicado que retorne os dados consolidados do portfólio de FIIs, para que a tabela possa ser populada com uma única requisição.

#### Acceptance Criteria

1. WHEN an authenticated GET request is made to the portfolio endpoint, THE API_Backend SHALL return a JSON array where each item contains: ticker (string, max 6 characters), shares (integer, minimum 1), averagePrice (number, rounded to 2 decimal places), lastMonthDividend (number, rounded to 2 decimal places, or 0 if no dividend data is available), and projectedMonthlyYield (number, rounded to 2 decimal places, or 0 if no dividend data is available)
2. WHEN an unauthenticated request is made to the portfolio endpoint, THE API_Backend SHALL return HTTP status 401 with a JSON body containing an error message indicating that authentication is required
3. THE API_Backend SHALL return only FIIs belonging to the authenticated user, filtered by the userId extracted from the JWT token
4. IF an error occurs while fetching FII data from the database or computing derived fields, THEN THE API_Backend SHALL return HTTP status 500 with a JSON body containing an error code and a message indicating an internal failure, without exposing internal details
5. WHEN an authenticated GET request is made to the portfolio endpoint and the user has no FII positions, THE API_Backend SHALL return HTTP status 200 with an empty JSON array
6. WHEN an authenticated GET request is made to the portfolio endpoint, THE API_Backend SHALL respond within 2000 milliseconds under normal database load

### Requirement 7: Tabela Somente-Leitura

**User Story:** Como investidor, eu quero que a tabela de FIIs seja apenas para visualização, para que eu não altere dados acidentalmente a partir dessa tela.

#### Acceptance Criteria

1. THE FII_Portfolio_Table SHALL NOT provide edit, delete, or inline modification controls for any FII record, including action buttons, icon buttons, or links that navigate to edit forms
2. THE FII_Portfolio_Table SHALL display all FII data in read-only text format without editable input fields
3. WHEN the user clicks or interacts via keyboard with any cell or row of the FII_Portfolio_Table, THE FII_Portfolio_Table SHALL NOT open an edit form, activate inline edit mode, or allow modification of any displayed value
