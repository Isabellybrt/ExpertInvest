# Guia de Deploy — ExpertInvest no Neon + Vercel

Este guia cobre como configurar o projeto ExpertInvest com [Neon](https://neon.tech) (PostgreSQL serverless) e fazer deploy na [Vercel](https://vercel.com). Siga os passos em ordem para um deploy completo em produção.

---

## Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Criar um Projeto no Neon](#criar-um-projeto-no-neon)
3. [Obter as Strings de Conexão](#obter-as-strings-de-conexão)
4. [Configurar o Prisma Schema](#configurar-o-prisma-schema)
5. [Configurar Variáveis de Ambiente na Vercel](#configurar-variáveis-de-ambiente-na-vercel)
6. [Executar Migrations em Produção](#executar-migrations-em-produção)
7. [Usando Branches do Neon para Desenvolvimento](#usando-branches-do-neon-para-desenvolvimento)
8. [Solução de Problemas](#solução-de-problemas)

---

## Pré-requisitos

- Uma conta no [Neon](https://neon.tech) (plano gratuito disponível)
- Uma conta na [Vercel](https://vercel.com) com o projeto importado
- Node.js 18+ instalado localmente
- O repositório ExpertInvest clonado localmente

---

## Criar um Projeto no Neon

1. Acesse o [Neon Console](https://console.neon.tech) e faça login.

2. Clique em **"New Project"**.

3. Configure o projeto:
   - **Project name**: Use um nome descritivo, ex.: `expertinvest-production` ou `expertinvest-staging`.
   - **Region**: Selecione a região mais próxima da sua implantação na Vercel. Recomendado: `AWS sa-east-1` (São Paulo) para menor latência no Brasil, ou `AWS us-east-1` (Virginia) se suas funções Vercel estiverem em `iad1`.
   - **PostgreSQL version**: Selecione **PostgreSQL 16** (ou a versão estável mais recente disponível). O schema do ExpertInvest é compatível com PostgreSQL 14+.

4. Clique em **"Create Project"**.

5. O Neon criará:
   - Uma **branch** padrão chamada `main`
   - Um **banco de dados** padrão chamado `neondb`
   - Um **role** (usuário) padrão com credenciais

6. Após a criação, o dashboard exibe suas strings de conexão. Mantenha esta página aberta para o próximo passo.

> **Docs oficiais**: [Criando um projeto Neon](https://neon.tech/docs/manage/projects#create-a-project)

---

## Obter as Strings de Conexão

O Neon fornece dois tipos de endpoints de conexão. Você precisa de ambos para o deploy do ExpertInvest.

### String de Conexão Pooled (para queries da aplicação)

O endpoint **pooled** roteia conexões através do connection pooler PgBouncer embutido do Neon. Isso é necessário para ambientes serverless como a Vercel, onde muitas instâncias de funções de curta duração compartilham conexões com o banco.

**Como identificar**: O hostname contém o sufixo `-pooler`.

```
postgresql://USER:PASSWORD@ep-EXEMPLO-pooler.us-east-1.aws.neon.tech:5432/neondb?sslmode=require
                                     ^^^^^^^
                               sufixo "-pooler" presente
```

### String de Conexão Direta (para migrations)

O endpoint **direto** conecta diretamente à instância de computação PostgreSQL sem connection pooling. Isso é necessário para o Prisma Migrate porque operações DDL (CREATE TABLE, ALTER TABLE) são incompatíveis com o modo de transação do PgBouncer.

**Como identificar**: O hostname **NÃO** contém o sufixo `-pooler`.

```
postgresql://USER:PASSWORD@ep-EXEMPLO.us-east-1.aws.neon.tech:5432/neondb?sslmode=require
                                    ^
                          Sem sufixo "-pooler"
```

### Como Encontrar Ambas as Strings no Dashboard do Neon

1. Abra seu projeto no [Neon Console](https://console.neon.tech).
2. Navegue até o painel **"Connection Details"** no dashboard do projeto.
3. No dropdown **"Connection string"**, selecione o **role** e o **database**.
4. Alterne a checkbox **"Pooled connection"**:
   - **Marcada** → exibe a string de conexão pooled (use como `DATABASE_URL`)
   - **Desmarcada** → exibe a string de conexão direta (use como `DIRECT_URL`)
5. Copie cada string para uso nos próximos passos.

> **Docs oficiais**: [Connection pooling](https://neon.tech/docs/connect/connection-pooling)

---

## Configurar o Prisma Schema

O bloco datasource em `backend/prisma/schema.prisma` deve incluir tanto a URL pooled quanto a URL direta:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Como funciona**:
- `url` → Usado pelo Prisma Client em runtime para todas as queries ao banco. Aponta para o endpoint **pooled**.
- `directUrl` → Usado pelo Prisma Migrate para operações DDL (migrations). Aponta para o endpoint **direto**.
- Quando `DIRECT_URL` não está definida (ex.: desenvolvimento local com PostgreSQL localhost), o Prisma usa `DATABASE_URL` para migrations também.

Esta alteração já está aplicada no repositório ExpertInvest. Verifique se corresponde ao bloco acima.

> **Docs oficiais**: [Prisma com Neon](https://neon.tech/docs/guides/prisma)

---

## Configurar Variáveis de Ambiente na Vercel

Configure ambas as URLs de conexão ao banco nas configurações do seu projeto na Vercel para que a aplicação e os comandos de migration possam se conectar ao Neon.

### Passos

1. Abra seu projeto no [Vercel Dashboard](https://vercel.com/dashboard).

2. Vá em **Settings** → **Environment Variables**.

3. Adicione as seguintes variáveis:

   | Nome | Valor | Ambientes |
   |------|-------|-----------|
   | `DATABASE_URL` | Sua string de conexão **pooled** do Neon | Production, Preview, Development |
   | `DIRECT_URL` | Sua string de conexão **direta** do Neon | Production, Preview, Development |

4. Para o valor de `DATABASE_URL`, cole a string de conexão pooled (hostname com `-pooler`):
   ```
   postgresql://USER:PASSWORD@ep-EXEMPLO-pooler.us-east-1.aws.neon.tech:5432/neondb?sslmode=require
   ```

5. Para o valor de `DIRECT_URL`, cole a string de conexão direta (hostname sem `-pooler`):
   ```
   postgresql://USER:PASSWORD@ep-EXEMPLO.us-east-1.aws.neon.tech:5432/neondb?sslmode=require
   ```

6. Clique em **"Save"** para cada variável.

7. **Redeploy** seu projeto para que as novas variáveis de ambiente entrem em vigor.

### Notas Importantes

- Ambas as variáveis devem usar `sslmode=require` para conexões com o Neon.
- A senha é URL-encoded se contém caracteres especiais. O Neon fornece a string já corretamente codificada.
- Para ambientes Preview (deploys de branch), considere usar [branches do Neon](#usando-branches-do-neon-para-desenvolvimento) com strings de conexão separadas.

> **Docs oficiais**: [Variáveis de ambiente na Vercel](https://vercel.com/docs/environment-variables)

---

## Executar Migrations em Produção

Após configurar as variáveis de ambiente, aplique as migrations pendentes ao banco de dados Neon de produção.

### Usando o Script `prisma:deploy`

O `backend/package.json` inclui um script dedicado para deploy de migrations:

```json
{
  "scripts": {
    "prisma:deploy": "prisma migrate deploy"
  }
}
```

Este script executa `prisma migrate deploy`, que:
- Aplica todas as migrations pendentes de `backend/prisma/migrations/` ao banco
- Usa a conexão `DIRECT_URL` (via a propriedade `directUrl` no `schema.prisma`)
- Sai com código 0 em caso de sucesso
- Sai com código diferente de zero e mensagem de erro em caso de falha

### Executando Localmente Contra Produção

Para aplicar migrations ao banco Neon de produção a partir da sua máquina local:

```bash
# Navegue até o diretório backend
cd backend

# Defina a DIRECT_URL com sua string de conexão direta de produção
export DIRECT_URL="postgresql://USER:PASSWORD@ep-EXEMPLO.us-east-1.aws.neon.tech:5432/neondb?sslmode=require"

# Execute o comando de migration deploy
npx prisma migrate deploy
```

Ou usando o script npm:

```bash
cd backend
export DIRECT_URL="postgresql://USER:PASSWORD@ep-EXEMPLO.us-east-1.aws.neon.tech:5432/neondb?sslmode=require"
npm run prisma:deploy
```

### Executando no CI/CD

Adicione um passo de migration ao seu pipeline de deploy:

```bash
cd backend
npx prisma migrate deploy
```

Certifique-se de que `DIRECT_URL` está definida no ambiente de CI/CD. O comando irá:
- Aplicar migrations sequencialmente na ordem em que foram criadas
- Pular migrations que já foram aplicadas
- Falhar se houver conflitos de migration que necessitam resolução manual

### Verificando Migrations

Após executar as migrations, verifique o estado do banco:

```bash
cd backend
npx prisma migrate status
```

Isso mostra quais migrations foram aplicadas e quais estão pendentes.

> **Docs oficiais**: [Prisma Migrate deploy](https://www.prisma.io/docs/orm/prisma-migrate/workflows/deploy-migrations)

---

## Usando Branches do Neon para Desenvolvimento

Branches do Neon permitem criar cópias isoladas do banco para desenvolvimento ou testes sem afetar o banco de produção. Cada branch é um clone copy-on-write da branch pai — instantâneo para criar e sem custo até que os dados divirjam.

### Criando uma Branch de Desenvolvimento

1. Abra seu projeto no [Neon Console](https://console.neon.tech).

2. Vá até a seção **"Branches"** na barra lateral.

3. Clique em **"Create Branch"**.

4. Configure a branch:
   - **Branch name**: Use um nome descritivo, ex.: `dev/nome-da-feature` ou `dev/seu-nome`.
   - **Parent branch**: Selecione `main` (a branch de produção).
   - **Include data**: Escolha se deseja incluir os dados atuais da branch pai (recomendado para desenvolvimento).

5. Clique em **"Create Branch"**.

### Obtendo as Strings de Conexão da Branch

Após criar uma branch, obtenha suas strings de conexão:

1. Selecione a nova branch na lista de **"Branches"**.

2. Abra o painel **"Connection Details"**.

3. Copie ambas as strings de conexão da branch:
   - **Pooled** (para `DATABASE_URL`): hostname inclui o sufixo `-pooler`
   - **Direct** (para `DIRECT_URL`): hostname sem o sufixo `-pooler`

As strings de conexão da branch seguem o mesmo formato da branch principal, mas roteiam para os dados isolados da branch.

### Usando uma Branch Localmente

Configure as strings de conexão da branch no seu arquivo `.env` local:

```env
# Conexão da branch de desenvolvimento (pooled — para queries em runtime)
DATABASE_URL="postgresql://USER:PASSWORD@ep-BRANCH-pooler.us-east-1.aws.neon.tech:5432/neondb?sslmode=require"

# Conexão da branch de desenvolvimento (direta — para migrations)
DIRECT_URL="postgresql://USER:PASSWORD@ep-BRANCH.us-east-1.aws.neon.tech:5432/neondb?sslmode=require"
```

Depois execute seus comandos de desenvolvimento normalmente:

```bash
cd backend

# Execute migrations na branch
npx prisma migrate dev

# Inicie o servidor de desenvolvimento
npm run dev
```

### Fluxo de Trabalho com Branches

Um fluxo de trabalho recomendado com branches do Neon:

1. **Crie uma branch** a partir de `main` para seu trabalho na feature.
2. **Desenvolva** usando as strings de conexão da branch no seu `.env` local.
3. **Execute migrations** (`prisma migrate dev`) contra a branch — isso não afeta produção.
4. **Teste** suas alterações com dados reais (clonados).
5. **Faça merge do código** para `main` quando estiver pronto.
6. **Aplique migrations** em produção usando `npx prisma migrate deploy` com a `DIRECT_URL` de produção.
7. **Delete a branch** quando não for mais necessária (via Neon Console ou CLI).

### Alternativa: PostgreSQL Local

Para desenvolvimento offline ou quando você não precisa de dados semelhantes aos de produção, você ainda pode usar uma instância local de PostgreSQL:

```env
# PostgreSQL local (DIRECT_URL não é necessária — Prisma usa DATABASE_URL para migrations)
DATABASE_URL="postgresql://postgres:password@localhost:5432/expertinvest"
# DIRECT_URL é opcional para PostgreSQL local — deixe sem definir ou comente
```

Com PostgreSQL local, a propriedade `directUrl` no `schema.prisma` é seguramente ignorada quando `DIRECT_URL` não está definida.

> **Docs oficiais**: [Neon branching](https://neon.tech/docs/introduction/branching)

---

## Solução de Problemas

### Problemas Comuns

| Problema | Causa | Solução |
|----------|-------|---------|
| `P1001: Can't reach database server` | String de conexão errada ou compute do Neon suspenso | Verifique a string de conexão; abra o Neon console para acordar o compute |
| `P2024: Timed out fetching a new connection` | Connection pooler sobrecarregado ou cold start do compute | Tente novamente após alguns segundos; verifique as configurações de auto-suspend |
| Migration falha com "prepared statement already exists" | Usando URL pooled para migrations | Certifique-se de que `DIRECT_URL` está definida com o endpoint direto (sem `-pooler`) |
| `DIRECT_URL` não encontrada | Variável de ambiente não configurada | Adicione `DIRECT_URL` nas variáveis de ambiente da Vercel ou no `.env` local |
| Erro de validação do Prisma schema | Propriedade `directUrl` ausente | Certifique-se de que `directUrl = env("DIRECT_URL")` está no bloco datasource |
| Latência no cold start (~300-500ms) | Compute do Neon acordando da suspensão | Comportamento normal; requisições subsequentes são rápidas |

### Verificando a Configuração

Execute estes comandos a partir do diretório `backend` para validar seu setup:

```bash
# Validar sintaxe do schema
npx prisma validate

# Gerar Prisma Client
npx prisma generate

# Verificar status das migrations
npx prisma migrate status

# Testar conexão com o banco (abre o Prisma Studio)
npx prisma studio
```

### Auto-Suspend do Compute Neon

O Neon suspende automaticamente instâncias de compute ociosas após 5 minutos (configurável). A primeira conexão após a suspensão leva ~300-500ms. Para workloads de produção com tráfego consistente, considere:
- Aumentar o timeout de auto-suspend nas configurações do projeto Neon
- Usar um mecanismo de keep-alive se necessário

> **Docs oficiais**: [Neon auto-suspend](https://neon.tech/docs/introduction/auto-suspend)

---

## Resumo

| Passo | Ação | Ambiente |
|-------|------|----------|
| 1 | Criar projeto no Neon | Neon Console |
| 2 | Copiar strings de conexão pooled + direta | Neon Console |
| 3 | Verificar que `schema.prisma` tem `directUrl` | Local |
| 4 | Adicionar `DATABASE_URL` e `DIRECT_URL` na Vercel | Vercel Dashboard |
| 5 | Executar `npx prisma migrate deploy` a partir de `backend/` | Local ou CI/CD |
| 6 | Fazer deploy da aplicação na Vercel | Vercel |
| 7 | (Opcional) Criar branch do Neon para dev | Neon Console |

Após completar estes passos, sua aplicação ExpertInvest estará implantada na Vercel com o Neon como backend de banco de dados.
