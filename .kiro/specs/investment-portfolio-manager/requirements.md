# Requirements Document

## Introduction

O Investment Portfolio Manager é uma aplicação web construída com TypeScript, React, princípios SOLID e arquitetura MVVM, destinada a gerenciar uma carteira de investimentos pessoal. O sistema permite o cadastro e acompanhamento de ativos de Renda Fixa e Fundos Imobiliários (FIIs), com atualização automática de cotações via API externa, cálculo de projeções de dividendos e rentabilidade, e visualização gráfica da evolução patrimonial.

## Glossary

- **Sistema**: A aplicação Investment Portfolio Manager como um todo
- **Módulo_de_Ativos**: Componente responsável pelo cadastro e gestão de ativos e aportes
- **Motor_de_Integração**: Componente responsável pela automação, consumo de APIs externas e cálculos financeiros
- **Dashboard**: Módulo de visualização e exibição de dados consolidados da carteira
- **Renda_Fixa**: Títulos de renda fixa cadastrados na carteira (CDB, LCI, LCA, Tesouro Direto, etc.)
- **FII**: Fundo de Investimento Imobiliário listado na bolsa de valores
- **Ticker**: Código de negociação de um FII na bolsa (ex: MXRF11)
- **CDI**: Certificado de Depósito Interbancário, índice de referência para investimentos de renda fixa
- **IPCA**: Índice Nacional de Preços ao Consumidor Amplo, indicador oficial de inflação
- **Dividend_Yield**: Indicador que expressa o rendimento de dividendos em relação ao preço da cota
- **Aporte**: Novo investimento ou adição de saldo a uma posição existente
- **Cota**: Unidade de participação em um fundo imobiliário
- **Preço_Médio**: Média ponderada do preço de aquisição das cotas de um FII
- **Provento**: Rendimento distribuído por um FII aos seus cotistas
- **Usuário**: Pessoa autenticada que utiliza o sistema para gerenciar sua carteira
- **API_de_Mercado**: Yahoo Finance API (gratuita, sem token), serviço externo que fornece cotações e dados de dividendos de FIIs brasileiros em tempo real via endpoint chart (tickers com sufixo .SA)
- **Cron_Job**: Tarefa agendada que executa automaticamente em intervalos definidos

## Requirements

### Requirement 1: Cadastro de Renda Fixa

**User Story:** Como um Usuário, eu quero cadastrar títulos de renda fixa na minha carteira, para que eu possa acompanhar meus investimentos de forma centralizada.

#### Acceptance Criteria

1. WHEN o Usuário submete o formulário de cadastro de Renda_Fixa com todos os campos preenchidos, THE Módulo_de_Ativos SHALL criar um novo registro contendo nome da instituição (máximo 100 caracteres), valor aportado (entre R$0,01 e R$999.999.999,99), data de vencimento e taxa atrelada
2. THE Módulo_de_Ativos SHALL aceitar taxas no formato percentual do CDI (entre 1% e 999%, ex: 100%, 110%) e no formato IPCA + taxa fixa (entre 0,01% e 99,99%, ex: IPCA + 5%)
3. IF o Usuário submeter o formulário com campos obrigatórios vazios, THEN THE Módulo_de_Ativos SHALL exibir mensagens de validação indicando os campos pendentes sem submeter o registro
4. WHEN o cadastro de Renda_Fixa é concluído com sucesso, THE Módulo_de_Ativos SHALL exibir o novo título na listagem de ativos da carteira
5. IF o Usuário informar um valor aportado menor ou igual a zero, THEN THE Módulo_de_Ativos SHALL rejeitar o cadastro e exibir mensagem de erro indicando que o valor deve ser positivo
6. IF o Usuário informar uma data de vencimento igual ou anterior à data atual, THEN THE Módulo_de_Ativos SHALL rejeitar o cadastro e exibir mensagem de erro indicando que a data de vencimento deve ser futura
7. IF o Usuário informar uma taxa em formato diferente dos formatos aceitos (percentual do CDI ou IPCA + taxa fixa), THEN THE Módulo_de_Ativos SHALL rejeitar o cadastro e exibir mensagem de erro indicando o formato esperado

### Requirement 2: Cadastro de FIIs

**User Story:** Como um Usuário, eu quero incluir Fundos Imobiliários na minha carteira, para que eu possa monitorar minhas cotas e rentabilidade.

#### Acceptance Criteria

1. WHEN o Usuário submete o formulário de cadastro de FII com todos os campos preenchidos, THE Módulo_de_Ativos SHALL criar um novo registro contendo ticker, quantidade de cotas, preço médio pago e data da compra
2. THE Módulo_de_Ativos SHALL validar que o ticker informado segue o formato padrão de FIIs (4 letras maiúsculas seguidas de 2 dígitos numéricos, ex: MXRF11)
3. IF o Usuário informar uma quantidade de cotas menor ou igual a zero, THEN THE Módulo_de_Ativos SHALL rejeitar o cadastro e exibir mensagem de erro
4. IF o Usuário informar um preço médio menor ou igual a zero, THEN THE Módulo_de_Ativos SHALL rejeitar o cadastro e exibir mensagem de erro
5. WHEN o cadastro de FII é concluído com sucesso, THE Módulo_de_Ativos SHALL exibir o fundo na listagem de ativos da carteira

### Requirement 3: Registro de Aportes Mensais

**User Story:** Como um Usuário, eu quero registrar novos aportes mensais, para que eu possa adicionar saldo a investimentos existentes ou criar novas posições mantendo o histórico completo.

#### Acceptance Criteria

1. WHEN o Usuário registra um aporte para um investimento de Renda_Fixa existente informando valor (entre 0,01 e 999.999.999,99 BRL) e data do aporte, THE Módulo_de_Ativos SHALL somar o valor aportado ao saldo atual do título e registrar a operação no histórico de compras
2. WHEN o Usuário registra um aporte para um FII existente informando quantidade de cotas (mínimo 1) e preço por cota (maior que zero), THE Módulo_de_Ativos SHALL adicionar as cotas à quantidade existente e recalcular o Preço_Médio utilizando a fórmula: novoPreçoMédio = (qtdAnterior * preçoMédioAnterior + qtdNova * preçoNovo) / (qtdAnterior + qtdNova)
3. WHEN o Usuário registra um aporte para um ativo não existente na carteira, THE Módulo_de_Ativos SHALL criar uma nova posição seguindo as mesmas regras de validação do cadastro inicial do tipo correspondente (Renda_Fixa ou FII) conforme definido nos Requisitos 1 e 2
4. THE Módulo_de_Ativos SHALL manter um histórico de todos os aportes realizados, registrando para cada entrada: data do aporte, valor investido em BRL, identificação do ativo associado e tipo de operação (aporte em posição existente ou criação de nova posição)
5. IF o Usuário submeter um aporte com valor menor ou igual a zero, quantidade de cotas menor ou igual a zero, ou campos obrigatórios vazios, THEN THE Módulo_de_Ativos SHALL rejeitar a operação e exibir mensagem de validação indicando os campos inválidos sem alterar o saldo ou histórico do ativo
6. IF ocorrer uma falha durante o registro do aporte após a validação, THEN THE Módulo_de_Ativos SHALL preservar o saldo e histórico anteriores do ativo sem alteração e exibir mensagem de erro indicando que a operação não foi concluída

### Requirement 4: Atualização Automática de Cotações de FIIs

**User Story:** Como um Usuário, eu quero que as cotações dos meus FIIs sejam atualizadas automaticamente, para que eu veja o valor real da minha carteira sem intervenção manual.

#### Acceptance Criteria

1. THE Motor_de_Integração SHALL consumir a API_de_Mercado no máximo 2 vezes ao dia, via Cron_Job agendado, para buscar a cotação atualizada de cada FII presente na carteira do Usuário
2. WHEN a API_de_Mercado retorna a cotação atualizada de um FII, THE Motor_de_Integração SHALL persistir no banco de dados local o preço unitário da cota, a data/hora da cotação na fonte e a data/hora da última atualização bem-sucedida
3. IF a API_de_Mercado retornar erro ou não responder dentro de 30 segundos por requisição, THEN THE Motor_de_Integração SHALL manter a última cotação válida armazenada, registrar o erro em log e prosseguir com a atualização dos demais FIIs da carteira
4. IF a última atualização bem-sucedida de um FII tiver ocorrido há mais de 48 horas, THEN THE Sistema SHALL exibir uma indicação visual junto à cotação informando que o dado pode estar desatualizado
5. WHEN o Cron_Job conclui a execução de atualização de cotações, THE Motor_de_Integração SHALL registrar em log a quantidade de FIIs atualizados com sucesso e a quantidade de falhas ocorridas

### Requirement 5: Captura de Indicadores de FIIs

**User Story:** Como um Usuário, eu quero visualizar os últimos dividendos pagos pelos meus FIIs, para que eu possa avaliar a renda passiva gerada pela carteira.

#### Acceptance Criteria

1. THE Motor_de_Integração SHALL buscar na API_de_Mercado o valor do último Provento pago por cota para cada FII cadastrado na carteira, executando essa busca no mesmo Cron_Job de atualização de cotações (no máximo 2 vezes ao dia)
2. WHEN a API_de_Mercado retorna os dados de Provento atualizados, THE Motor_de_Integração SHALL persistir o Dividend_Yield em formato percentual com até 2 casas decimais e o valor do Provento em reais por cota com 2 casas decimais no banco de dados local, juntamente com a data de referência do pagamento
3. IF a API_de_Mercado não retornar dados de Provento para um FII, THEN THE Motor_de_Integração SHALL manter o último Provento registrado, preservar a data da última atualização bem-sucedida e registrar o evento em log
4. WHEN o Usuário visualiza os indicadores de um FII no Dashboard, THE Sistema SHALL exibir a data da última atualização do Provento junto aos valores de Dividend_Yield e valor por cota
5. IF os dados de Provento de um FII não forem atualizados por mais de 60 dias, THEN THE Dashboard SHALL exibir um indicador visual informando que os dados podem estar desatualizados

### Requirement 6: Cálculo de Estimativa de Dividendos

**User Story:** Como um Usuário, eu quero ver uma projeção dos dividendos a receber no mês atual, para que eu possa planejar minha renda passiva.

#### Acceptance Criteria

1. THE Motor_de_Integração SHALL calcular a projeção de dividendos do mês atual somando, para cada FII na carteira, o resultado da multiplicação da quantidade de cotas pelo valor do último Provento pago por cota, apresentando o resultado com precisão de 2 casas decimais
2. WHEN o Dashboard exibe a projeção de dividendos, THE Sistema SHALL apresentar o valor total estimado e o detalhamento por FII contendo: ticker, quantidade de cotas, valor do último Provento por cota e valor projetado individual
3. WHEN um novo Provento é capturado da API_de_Mercado, THE Motor_de_Integração SHALL recalcular a projeção utilizando o valor atualizado
4. IF um FII cadastrado na carteira não possuir histórico de Provento registrado, THEN THE Motor_de_Integração SHALL considerar o valor de Provento como zero para esse FII e o Dashboard SHALL indicar que a projeção está indisponível para o ativo em questão

### Requirement 7: Cálculo de Rentabilidade da Renda Fixa

**User Story:** Como um Usuário, eu quero ver a estimativa de evolução dos meus investimentos em renda fixa, para que eu possa acompanhar o rendimento bruto projetado.

#### Acceptance Criteria

1. THE Motor_de_Integração SHALL calcular a evolução do saldo de cada título de Renda_Fixa atrelado ao CDI aplicando juros compostos diários com a fórmula: saldoProjetado = valorInvestido * (1 + taxaCDI * percentualContratado/100) ^ diasCorridos, onde taxaCDI é a taxa diária vigente e diasCorridos é o número de dias úteis desde a data do aporte até a data atual
2. WHEN o Usuário visualiza um título de Renda_Fixa, THE Sistema SHALL exibir o rendimento bruto projetado com precisão de 2 casas decimais, calculando cada aporte individualmente desde sua respectiva data de aplicação até a data atual e somando os resultados
3. IF a taxa atrelada for do tipo IPCA + taxa fixa, THEN THE Motor_de_Integração SHALL calcular a projeção aplicando juros compostos com a fórmula: saldoProjetado = valorInvestido * (1 + ultimoIPCAAnual + taxaFixa/100) ^ (diasUteis/252), onde ultimoIPCAAnual é o último valor acumulado de 12 meses do IPCA disponível no sistema
4. IF a taxa CDI ou o índice IPCA não estiver disponível no momento do cálculo, THEN THE Motor_de_Integração SHALL utilizar o último valor válido armazenado e exibir a data de referência do índice utilizado junto ao rendimento projetado

### Requirement 8: Resumo do Patrimônio

**User Story:** Como um Usuário, eu quero visualizar um resumo do meu patrimônio total, para que eu entenda a distribuição dos meus investimentos entre Renda Fixa e FIIs.

#### Acceptance Criteria

1. WHEN o Usuário acessa o Dashboard, THE Dashboard SHALL exibir o patrimônio total calculado pela fórmula: soma dos saldos projetados de todos os títulos de Renda_Fixa + soma de (quantidade de cotas × cotação atual) de cada FII, formatado em reais com 2 casas decimais
2. THE Dashboard SHALL apresentar um gráfico de pizza ou rosca exibindo o percentual alocado em Renda_Fixa e o percentual alocado em FIIs, com os valores percentuais arredondados a 2 casas decimais e totalizando 100%
3. IF o Usuário possuir ativos em apenas uma classe (somente Renda_Fixa ou somente FIIs), THEN THE Dashboard SHALL exibir o gráfico com 100% alocado na classe existente
4. WHEN o valor de mercado de um FII (quantidade × cotação atual) é superior ao valor de aquisição (quantidade × Preço_Médio), THE Dashboard SHALL exibir a variação percentual com texto na cor verde
5. WHEN o valor de mercado de um FII (quantidade × cotação atual) é inferior ao valor de aquisição (quantidade × Preço_Médio), THE Dashboard SHALL exibir a variação percentual com texto na cor vermelha
6. IF o valor de mercado de um FII for igual ao valor de aquisição (variação de 0%), THEN THE Dashboard SHALL exibir a variação percentual sem destaque de cor (cor neutra padrão do texto)

### Requirement 9: Gráfico de Evolução Patrimonial

**User Story:** Como um Usuário, eu quero visualizar um gráfico mostrando o crescimento do meu patrimônio ao longo do tempo, para que eu possa acompanhar a evolução somando aportes e valorização.

#### Acceptance Criteria

1. THE Dashboard SHALL gerar um gráfico de linha ou barras exibindo o patrimônio total com granularidade mensal, onde cada ponto no eixo X representa um mês e o eixo Y representa o valor patrimonial em reais, exibindo no mínimo 1 mês e no máximo 60 meses de histórico
2. THE Dashboard SHALL calcular cada ponto do gráfico somando o saldo projetado de todos os títulos de Renda_Fixa com o valor de mercado de todos os FIIs (quantidade de cotas multiplicada pela cotação vigente na data correspondente) mais os aportes acumulados até aquela data
3. WHEN o Usuário acessa o gráfico de evolução patrimonial, THE Dashboard SHALL renderizar os dados em no máximo 3 segundos
4. IF o Usuário possuir histórico de aportes inferior a 2 meses, THEN THE Dashboard SHALL exibir o gráfico com os pontos disponíveis e uma mensagem indicando que dados adicionais serão exibidos conforme novos meses forem registrados

### Requirement 10: Gráfico de Evolução de Dividendos

**User Story:** Como um Usuário, eu quero visualizar um gráfico de barras com o histórico de dividendos recebidos e projeção futura, para que eu possa acompanhar a evolução da minha renda passiva.

#### Acceptance Criteria

1. THE Dashboard SHALL apresentar um gráfico de barras exibindo o histórico de dividendos recebidos mês a mês, contemplando os últimos 12 meses de dados registrados
2. THE Dashboard SHALL incluir no gráfico a projeção de dividendos para os próximos 6 meses, utilizando barras com opacidade reduzida ou padrão visual distinto (cor diferente ou hachurado) para diferenciar dados reais de projeções
3. WHEN novos Proventos são registrados, THE Dashboard SHALL atualizar o gráfico sem necessidade de recarregamento manual da página
4. IF o Usuário não possuir nenhum Provento registrado no histórico, THEN THE Dashboard SHALL exibir o gráfico em estado vazio com uma mensagem indicando que não há dados de dividendos disponíveis
5. THE Dashboard SHALL exibir no eixo vertical o valor total de dividendos em reais (R$) e no eixo horizontal os meses correspondentes no formato mês/ano

### Requirement 11: Otimização de Requisições à API Externa

**User Story:** Como um Usuário, eu quero que o consumo da API externa seja otimizado, para que o sistema funcione de forma estável sem ser bloqueado por excesso de requisições.

#### Acceptance Criteria

1. THE Motor_de_Integração SHALL executar a atualização de cotações via Cron_Job agendado para no máximo 2 vezes ao dia, com intervalo mínimo de 8 horas entre execuções
2. THE Motor_de_Integração SHALL armazenar os dados obtidos da API_de_Mercado em cache local com validade até a próxima execução do Cron_Job, servindo requisições do Dashboard a partir do cache sem consultar a API_de_Mercado entre execuções agendadas
3. IF o limite de requisições da API_de_Mercado for atingido, THEN THE Motor_de_Integração SHALL aguardar no mínimo 60 segundos antes de realizar nova tentativa, limitando-se a no máximo 3 tentativas por execução do Cron_Job
4. IF todas as tentativas de requisição à API_de_Mercado falharem após as 3 tentativas, THEN THE Motor_de_Integração SHALL manter os dados em cache da última execução bem-sucedida e registrar o erro em log com a data e hora da falha

### Requirement 12: Responsividade e Design Mobile First

**User Story:** Como um Usuário, eu quero acessar o sistema de qualquer dispositivo, para que eu possa acompanhar meus investimentos tanto no computador quanto no celular.

#### Acceptance Criteria

1. THE Sistema SHALL renderizar a interface seguindo a abordagem Mobile First, suportando viewports de 320px até 1920px de largura sem exibir barra de rolagem horizontal
2. WHILE o viewport do dispositivo possuir largura menor que 768px, THE Dashboard SHALL reorganizar os gráficos e componentes em layout de coluna única, empilhando os elementos verticalmente
3. WHILE o viewport do dispositivo possuir largura menor que 768px, THE Sistema SHALL manter todos os elementos interativos com área de toque mínima de 44x44 pixels
4. WHILE o viewport do dispositivo possuir largura menor que 768px, THE Sistema SHALL renderizar o texto do conteúdo com tamanho mínimo de 16px para garantir legibilidade sem necessidade de zoom

### Requirement 13: Feedbacks Visuais e Paleta de Cores

**User Story:** Como um Usuário, eu quero receber feedbacks visuais intuitivos, para que eu entenda rapidamente o estado dos meus investimentos.

#### Acceptance Criteria

1. THE Sistema SHALL utilizar a cor verde para indicar valorização de ativos e a cor vermelha para indicar desvalorização, acompanhadas de um indicador não cromático (ícone de seta para cima ou para baixo) para garantir distinção sem depender exclusivamente de cor
2. WHEN o Usuário realiza uma ação destrutiva (exclusão de ativo ou aporte), THE Sistema SHALL exibir um modal de confirmação contendo a descrição da ação, um botão para confirmar e um botão para cancelar, antes de executar a operação
3. IF o Usuário seleciona cancelar no modal de confirmação de ação destrutiva, THEN THE Sistema SHALL fechar o modal sem executar a operação e preservar o estado atual dos dados
4. WHEN uma operação é concluída com sucesso, THE Sistema SHALL exibir uma notificação visual temporária confirmando a ação, visível por 5 segundos antes de ser automaticamente removida da tela
5. IF uma operação falha, THEN THE Sistema SHALL exibir uma notificação visual de erro indicando que a ação não foi concluída, visível até que o Usuário a descarte manualmente

### Requirement 14: Autenticação

**User Story:** Como um Usuário, eu quero acessar o sistema de forma segura com login, para que somente eu tenha acesso aos dados da minha carteira.

#### Acceptance Criteria

1. THE Sistema SHALL exigir autenticação via login com e-mail (formato válido conforme RFC 5322) e senha (mínimo 8 caracteres, máximo 128 caracteres, contendo ao menos uma letra maiúscula, uma minúscula e um dígito) ou via OAuth com Google antes de permitir acesso aos dados da carteira
2. IF o Usuário informar credenciais inválidas, THEN THE Sistema SHALL exibir mensagem de erro genérica sem revelar qual campo está incorreto e bloquear a conta por 15 minutos após 5 tentativas consecutivas de login com falha
3. WHEN o Usuário realiza login com sucesso, THE Sistema SHALL criar uma sessão autenticada e redirecionar para o Dashboard
4. THE Sistema SHALL encerrar a sessão do Usuário após 30 minutos de inatividade
5. IF um Usuário não autenticado tentar acessar qualquer rota protegida do Sistema, THEN THE Sistema SHALL redirecionar para a tela de login sem expor dados da carteira
6. WHEN o Usuário aciona a opção de logout, THE Sistema SHALL encerrar a sessão autenticada e redirecionar para a tela de login em no máximo 2 segundos

### Requirement 15: Exportação de Dados

**User Story:** Como um Usuário, eu quero exportar o histórico dos meus investimentos, para que eu possa fazer backup ou análises externas.

#### Acceptance Criteria

1. WHEN o Usuário solicita a exportação e seleciona o formato desejado (CSV ou Excel), THE Sistema SHALL gerar um arquivo contendo todos os aportes e posições registrados na carteira do Usuário autenticado
2. THE Sistema SHALL incluir no arquivo exportado as seguintes colunas: data do aporte (formato ISO 8601 AAAA-MM-DD), nome do ativo, tipo do ativo (Renda_Fixa ou FII), valor investido com duas casas decimais, quantidade de cotas (quando FII, caso contrário vazio) e saldo calculado no momento da geração do arquivo
3. WHEN a geração do arquivo de exportação é concluída, THE Sistema SHALL disponibilizar o arquivo para download em no máximo 5 segundos após a solicitação para carteiras com até 5.000 registros de aportes
4. IF a geração do arquivo de exportação falhar ou exceder 30 segundos de processamento, THEN THE Sistema SHALL cancelar a operação e exibir uma mensagem de erro indicando que a exportação não pôde ser concluída, sem perda de dados na carteira

### Requirement 16: Desempenho de Renderização

**User Story:** Como um Usuário, eu quero que o dashboard carregue rapidamente, para que eu tenha uma experiência fluida ao consultar meus investimentos.

#### Acceptance Criteria

1. WHEN o Usuário acessa o Dashboard principal, THE Sistema SHALL exibir todos os componentes visíveis e interativos em no máximo 3 segundos, medidos a partir do início da navegação até o último elemento do viewport estar renderizado e responsivo a interação
2. WHEN o Usuário acessa o Dashboard principal, THE Sistema SHALL exibir o layout estrutural com os valores numéricos do patrimônio e listagem de ativos em no máximo 1 segundo, antes da renderização completa dos gráficos
3. IF a renderização dos gráficos exceder 3 segundos, THEN THE Sistema SHALL exibir um indicador de carregamento animado no local de cada gráfico pendente até que a renderização seja concluída
4. IF a renderização total do Dashboard exceder 10 segundos, THEN THE Sistema SHALL exibir uma mensagem informando que os dados não puderam ser carregados e oferecer ao Usuário a opção de tentar novamente
