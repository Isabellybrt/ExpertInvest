# ExpertInvest — Tutorial de Uso

Guia completo de como usar o ExpertInvest para gerenciar sua carteira de investimentos pessoal.

---

## Visão Geral

O ExpertInvest permite que você registre e acompanhe dois tipos de investimentos:

- **Renda Fixa** — CDBs, LCIs, LCAs, Tesouro Direto (taxas CDI% ou IPCA+)
- **Fundos Imobiliários (FIIs)** — com cotações atualizadas automaticamente

O sistema calcula seu patrimônio total, mostra a alocação entre classes de ativos, projeta dividendos mensais e permite exportar todos os dados.

---

## 1. Tela de Cadastro (Criar Conta)

**Rota:** `/register`

Ao acessar o sistema pela primeira vez, crie sua conta:

1. Preencha seu **nome** (opcional)
2. Informe seu **e-mail**
3. Crie uma **senha** com no mínimo 8 caracteres, contendo letra maiúscula, minúscula e número
4. Clique em **"Criar Conta"**

Alternativamente, clique em **"Criar conta com Google"** para usar sua conta Google.

Já tem uma conta? Clique em "Entrar" para ir à tela de login.

---

## 2. Tela de Login (Entrar)

**Rota:** `/login`

Para acessar o sistema:

1. Informe seu **e-mail** e **senha**
2. Clique em **"Entrar"**

Ou use o botão **"Entrar com Google"** para login rápido via Google.

Após o login, você será redirecionado ao Dashboard. A sessão expira após 30 minutos de inatividade.

---

## 3. Navegação

O sistema possui um menu de navegação com 5 seções:

| Seção | Função |
|-------|--------|
| **Dashboard** | Visão geral do patrimônio e gráficos |
| **Renda Fixa** | Cadastrar e gerenciar títulos de renda fixa |
| **FIIs** | Cadastrar e gerenciar fundos imobiliários |
| **Aportes** | Registrar novos aportes em posições existentes ou novas |
| **Exportar** | Baixar dados em CSV ou Excel |

- **No desktop:** o menu aparece como barra lateral fixa à esquerda
- **No celular:** o menu aparece como barra de navegação fixa na parte inferior da tela

Para sair do sistema, clique no botão **"Sair"** (vermelho) no final do menu.

---

## 4. Tela de Dashboard

**Rota:** `/`

Esta é a tela principal. Ela mostra um panorama completo da sua carteira:

### Resumo do Patrimônio

Um card com os seguintes valores:

- **Patrimônio Total** — soma de todos os seus investimentos
- **Renda Fixa** — valor total investido em títulos de renda fixa
- **FIIs** — valor total das suas cotas de fundos imobiliários (preço médio × cotas)
- **Dividendos Estimados/Mês** — projeção mensal de dividendos dos FIIs

Se as cotações estiverem desatualizadas (mais de 48h), aparece um badge amarelo "Desatualizado".

### Gráfico de Alocação

Um gráfico de pizza mostrando a distribuição percentual entre Renda Fixa e FIIs.

### Botão Atualizar

Clique em **"Atualizar"** para recarregar os dados do servidor.

---

## 5. Tela de Renda Fixa

**Rota:** `/renda-fixa`

Aqui você cadastra títulos de renda fixa (CDB, LCI, LCA, Tesouro, etc.).

### Como cadastrar um título

Preencha o formulário:

1. **Instituição** — nome do banco ou corretora (ex: "Banco Inter", "Nubank")
2. **Valor Investido (R$)** — quanto você aplicou nesse título (ex: 10000.00)
3. **Data de Vencimento** — quando o título vence
4. **Tipo de Taxa** — escolha entre:
   - **% do CDI** — para títulos pós-fixados atrelados ao CDI (ex: CDB 110% do CDI)
   - **IPCA + Taxa Fixa** — para títulos indexados à inflação (ex: Tesouro IPCA+ 5,50%)
5. **Taxa** — o valor numérico da taxa:
   - Para CDI: entre 1 e 999 (ex: 110 = 110% do CDI)
   - Para IPCA+: entre 0,01 e 99,99 (ex: 5.50 = IPCA + 5,50% ao ano)
6. Clique em **"Cadastrar Título"**

### Lista de títulos cadastrados

Abaixo do formulário, aparecem todos os seus títulos com:
- Nome da instituição
- Valor investido
- Taxa (ex: "110% CDI" ou "IPCA + 5.50%")
- Botão de **excluir** (ícone de lixeira vermelho)

Ao excluir, um modal de confirmação aparece pedindo que confirme a ação.

---

## 6. Tela de FIIs (Fundos Imobiliários)

**Rota:** `/fiis`

Aqui você cadastra seus fundos imobiliários.

### Como cadastrar um FII

Preencha o formulário:

1. **Ticker** — código do fundo na B3 com até 6 caracteres (ex: "MXRF11", "HGLG11")
2. **Quantidade de cotas** — número inteiro de cotas que você possui (ex: 100)
3. **Preço médio (R$)** — preço médio de compra por cota (ex: 10.50)
4. **Data de compra** — data em que realizou a compra
5. Clique em **"Cadastrar FII"**

O ticker é automaticamente convertido para letras maiúsculas.

### Lista de FIIs cadastrados

Abaixo do formulário aparecem seus FIIs com:
- Ticker
- Quantidade de cotas e preço médio
- Botão de **excluir**

As cotações são atualizadas automaticamente 2 vezes ao dia via Yahoo Finance (não precisa de nenhum token ou configuração extra).

---

## 7. Tela de Aportes

**Rota:** `/aportes`

Esta tela serve para registrar novos aportes — tanto adicionando valor a uma posição existente quanto criando uma nova posição.

### Como registrar um aporte

1. **Tipo de ativo** — selecione "Renda Fixa" ou "FII"
2. **Tipo de operação** — escolha entre:
   - **Posição existente** — adicionar valor/cotas a um ativo já cadastrado
   - **Nova posição** — criar um ativo novo junto com o aporte

3. **Se "Posição existente":**
   - Selecione o ativo no dropdown
   - Informe a data do aporte
   - Para Renda Fixa: informe o valor do aporte (R$)
   - Para FII: informe quantidade de cotas e preço por cota

4. **Se "Nova posição" + Renda Fixa:**
   - Informe: instituição, data de vencimento, tipo de taxa, valor da taxa, valor do aporte e data

5. **Se "Nova posição" + FII:**
   - Informe: ticker, quantidade de cotas, preço por cota e data

6. Clique em **"Registrar Aporte"**

Ao registrar um aporte em uma posição existente de FII, o preço médio é recalculado automaticamente.

### Histórico de Aportes

Abaixo do formulário, a lista mostra todos os aportes registrados com:
- Tipo (Renda Fixa ou FII)
- Se foi "Nova posição" ou "Posição existente"
- Data
- Detalhes (cotas, preço por cota)
- Valor total do aporte

---

## 8. Tela de Exportação

**Rota:** `/export`

Permite baixar um arquivo com o histórico completo da sua carteira.

### Como exportar

1. **Escolha o formato:**
   - **CSV** — arquivo de texto compatível com qualquer planilha (Google Sheets, LibreOffice, etc.)
   - **Excel** — arquivo .xlsx formatado
2. Clique em **"Exportar"**
3. O download começa automaticamente

O arquivo gerado contém o histórico de todos os seus aportes e saldos.

---

## 9. Dicas de Uso

### Fluxo recomendado para iniciantes

1. Crie sua conta
2. Cadastre seus títulos de Renda Fixa na tela "Renda Fixa"
3. Cadastre seus FIIs na tela "FIIs"
4. Acompanhe tudo no Dashboard
5. Quando fizer novos aportes, use a tela "Aportes" para manter o histórico atualizado

### Quando usar "Aportes" vs "Renda Fixa"/"FIIs"

- Use a tela **Renda Fixa** ou **FIIs** para cadastrar a posição inicial
- Use a tela **Aportes** quando quiser adicionar mais dinheiro a uma posição existente (comprar mais cotas, reinvestir, etc.) ou criar uma nova posição com registro de data de aporte

### Sobre as cotações automáticas

O sistema atualiza as cotações dos FIIs automaticamente 2 vezes por dia usando dados do Yahoo Finance. Não é necessária nenhuma configuração. Se a cotação estiver com mais de 48 horas de atraso (fim de semana, feriados), um aviso amarelo "Desatualizado" aparece no Dashboard.

### Exportar para controle externo

Use a tela de Exportação periodicamente para manter um backup dos seus dados em planilha. O formato Excel já vem formatado e pronto para análise.

---

## 10. Requisitos Técnicos

- Funciona em qualquer navegador moderno (Chrome, Firefox, Safari, Edge)
- Responsivo: funciona em celulares (a partir de 320px de largura), tablets e desktops
- Não requer instalação de aplicativo — acesse pelo navegador

---

## 11. Segurança

- Senhas são criptografadas (bcrypt)
- Autenticação via token JWT
- Sessão expira após 30 minutos de inatividade
- Proteção contra tentativas de login excessivas (bloqueio temporário da conta)
- Todas as requisições de dados exigem autenticação
