# ExpertInvest — Gerenciador de Carteira de Investimentos

Aplicação web completa para gerenciamento de carteira de investimentos pessoal, com suporte a **Renda Fixa** (CDB, LCI, LCA, Tesouro Direto) e **Fundos Imobiliários (FIIs)**.

## Funcionalidades

- **Cadastro de ativos** — Renda Fixa com taxa CDI% ou IPCA+, e FIIs com ticker, cotas e preço médio
- **Registro de aportes** — Adição a posições existentes com recálculo automático de preço médio
- **Atualização automática de cotações** — Cron job 2x/dia via Yahoo Finance API (gratuita, sem token) com retry e cache
- **Cálculos financeiros** — Rentabilidade CDI (juros compostos), IPCA+, projeção de dividendos
- **Dashboard interativo** — Patrimônio total, alocação (gráfico de pizza), evolução patrimonial (linha), dividendos (barras)
- **Exportação de dados** — CSV e Excel com histórico completo de aportes e saldos
- **Autenticação** — Login com email/senha ou Google OAuth, sessão com timeout de 30 min
- **Responsividade** — Mobile First, funciona de 320px a 1920px sem scroll horizontal

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, Recharts, React Router |
| Backend | Node.js, Fastify, TypeScript, Prisma ORM |
| Banco de Dados | PostgreSQL |
| Autenticação | JWT + Google OAuth 2.0 |
| Testes | Vitest, fast-check (property-based testing), Testing Library |
| Cron | node-cron |
| Exportação | ExcelJS, csv-writer |

## Estrutura do Projeto

```
ExpertInvest/
├── frontend/          # React SPA (Vite + TypeScript)
│   ├── src/
│   │   ├── views/         # Componentes de tela (MVVM - View)
│   │   ├── viewmodels/    # Hooks com lógica (MVVM - ViewModel)
│   │   ├── services/      # Camada de API
│   │   ├── stores/        # Zustand stores
│   │   └── components/    # Componentes reutilizáveis (Toast, Modal, Layout)
│   └── package.json
├── backend/           # API REST (Fastify + TypeScript)
│   ├── src/
│   │   ├── routes/        # Endpoints REST
│   │   ├── services/      # Lógica de negócio
│   │   ├── repositories/  # Acesso a dados (Prisma)
│   │   ├── middleware/    # Auth middleware
│   │   └── lib/           # Utilitários (Prisma client)
│   ├── prisma/
│   │   └── schema.prisma  # Schema do banco de dados
│   └── package.json
├── shared/            # Tipos, schemas Zod e validadores compartilhados
│   └── src/
│       ├── types.ts
│       ├── schemas.ts
│       └── validators.ts
└── package.json       # Monorepo root (workspaces)
```

## Pré-requisitos

- **Node.js** 18+ (recomendado 20+)
- **npm** 9+
- **PostgreSQL** 14+ (rodando localmente ou via Docker)

## Instalação

### 1. Clonar o repositório

```bash
git clone <url-do-repositorio>
cd ExpertInvest
```

### 2. Instalar dependências

```bash
npm install
```

Isso instala as dependências de todos os workspaces (frontend, backend, shared) e gera o Prisma Client automaticamente.

### 3. Configurar variáveis de ambiente

Copie o arquivo de exemplo e preencha com suas credenciais:

```bash
cp backend/.env.example backend/.env
```

Edite o `backend/.env`:

```env
# Conexão com PostgreSQL
DATABASE_URL="postgresql://postgres:sua_senha@localhost:5432/expertinvest?schema=public"

# Chaves JWT (gere strings aleatórias seguras)
JWT_SECRET="sua-chave-secreta-jwt-aqui"
JWT_REFRESH_SECRET="sua-chave-refresh-jwt-aqui"

# Google OAuth (opcional - necessário para login com Google)
GOOGLE_CLIENT_ID="seu-google-client-id.apps.googleusercontent.com"
```

### 4. Criar o banco de dados

Certifique-se que o PostgreSQL está rodando, depois execute:

```bash
cd backend
npx prisma migrate dev --name init
```

Isso cria o banco de dados e aplica todas as tabelas definidas no schema.

### 5. (Opcional) Visualizar o banco

```bash
cd backend
npx prisma studio
```

Abre uma interface web para inspecionar os dados no banco.

## Executando o Projeto

### Desenvolvimento (com hot reload)

Abra dois terminais:

**Terminal 1 — Backend (porta 4000):**
```bash
npm run dev:backend
```

**Terminal 2 — Frontend (porta 5173):**
```bash
npm run dev:frontend
```

Acesse a aplicação em: **http://localhost:5173**

### Build de produção

```bash
# Compilar backend
npm run build:backend

# Compilar frontend
npm run build:frontend
```

Para rodar o backend em produção:
```bash
cd backend
node dist/server.js
```

## Testes

### Executar todos os testes

```bash
npm test
```

### Apenas backend

```bash
npm run test:backend
```

### Apenas frontend

```bash
npm run test:frontend
```

### Testes em modo watch (desenvolvimento)

```bash
cd backend && npx vitest
# ou
cd frontend && npx vitest
```

A suíte de testes inclui:
- **Testes unitários** para serviços, repositories, ViewModels e componentes
- **Property-based tests** (fast-check) para validações, cálculos financeiros e invariantes do sistema
- **Testes de integração** para fluxos end-to-end (login → dashboard → criação de ativo → exportação)

## API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Cadastrar novo usuário |
| POST | `/api/auth/login` | Login com email/senha |
| POST | `/api/auth/google` | Login com Google OAuth |
| POST | `/api/auth/logout` | Encerrar sessão |
| POST | `/api/auth/refresh` | Renovar token |
| GET/POST/PUT/DELETE | `/api/renda-fixa` | CRUD de títulos de Renda Fixa |
| GET/POST/PUT/DELETE | `/api/fiis` | CRUD de Fundos Imobiliários |
| GET/POST | `/api/aportes` | Registro e histórico de aportes |
| GET | `/api/dashboard/summary` | Resumo patrimonial |
| GET | `/api/dashboard/patrimony-history` | Evolução patrimonial mensal |
| GET | `/api/dashboard/dividends` | Histórico + projeção de dividendos |
| GET | `/api/dashboard/allocation` | Alocação por classe de ativo |
| POST | `/api/export/csv` | Exportar dados em CSV |
| POST | `/api/export/excel` | Exportar dados em Excel |

Todas as rotas (exceto auth) requerem autenticação via header `Authorization: Bearer <token>`.

## Arquitetura

### Frontend (MVVM)

```
View (React Components) → ViewModel (Hooks + Zustand) → Service → API
```

- **Views** — Componentes puros de renderização
- **ViewModels** — Custom hooks com lógica de estado e validação
- **Services** — Camada de comunicação HTTP
- **Stores** — Estado global com Zustand (auth, cache de dados)

### Backend (Layered)

```
Routes (Controllers) → Services (Business Logic) → Repositories (Data Access) → PostgreSQL
```

- **Routes** — Endpoints Fastify com validação e auth middleware
- **Services** — Regras de negócio, cálculos financeiros, transações
- **Repositories** — Operações de banco via Prisma (CRUD + transações)

### Cron Jobs

O sistema executa automaticamente (2x/dia) a atualização de cotações e dividendos de todos os FIIs cadastrados via **Yahoo Finance API** (gratuita, sem necessidade de token), com:
- Tickers brasileiros convertidos automaticamente para formato Yahoo (ex: MXRF11 → MXRF11.SA)
- Retry (máx. 3 tentativas com intervalo de 60s)
- Cache local válido até a próxima execução
- Log de execução (sucessos/falhas/duração)

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | String de conexão PostgreSQL |
| `JWT_SECRET` | Sim | Chave para assinatura de tokens JWT |
| `JWT_REFRESH_SECRET` | Sim | Chave para refresh tokens |
| `GOOGLE_CLIENT_ID` | Não | Client ID do Google OAuth 2.0 |

## Docker (Opcional)

Para rodar o PostgreSQL via Docker:

```bash
docker run -d \
  --name expertinvest-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=expertinvest \
  -p 5432:5432 \
  postgres:16-alpine
```

Depois ajuste o `DATABASE_URL` no `.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/expertinvest?schema=public"
```

## Licença

Projeto privado — todos os direitos reservados.
