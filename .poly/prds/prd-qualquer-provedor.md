📄 Product Requirement Document (PRD)Integração Genérica de APIs Externas e LLMs no Pólipos1. Visão Geral e ObjetivosO objetivo desta funcionalidade é permitir que o Pólipos se conecte a qualquer API externa de Inteligência Artificial (com ou sem suporte nativo a ferramentas/tools), automatizando o fluxo de autenticação e troca de mensagens. O sistema deve ser flexível o suficiente para que o usuário configure de forma simples os contratos de entrada e saída, a URL de autenticação (geração de token por duas requisições encadeadas) e o endpoint final do Chat através do CLI ou da extensão do VS Code.2. Personas e Casos de UsoDesenvolvedor / Usuário do Pólipos: Deseja integrar um novo provedor de IA ou API de chat customizada que exige autenticação prévia por token (via client_credentials ou similar). Ele precisa de uma interface guiada que configure o comportamento da requisição sem a necessidade de alterar o código-fonte do ecossistema.3. Requisitos Funcionais3.1. Módulo de Autenticação (Auth Manager)O sistema deve gerenciar de forma transparente o ciclo de autenticação para APIs que exigem validação antes do consumo do endpoint principal.Tipo de Grant: Focado em fluxos que exigem duas requisições encadeadas (ex: client_credentials).Inputs de Configuração:auth_url: Endpoint para obter o token de acesso.client_id e client_secret: Credenciais enviadas no corpo ou cabeçalho.grant_type: Parâmetro de identificação do tipo de concessão.3.2. Definição Genérica de Contratos (Request/Response Mapping)O usuário deve mapear como o payload da requisição final será montado e como a resposta será interpretada pela engine do Pólipos.Mapeamento da Requisição (Payload Builder): Substituição dinâmica da tag {{prompt}} pelo texto digitado pelo usuário no terminal ou chat.Mapeamento da Resposta (Response Parser): Uso de seletores (como JSON Path) para extrair o conteúdo textual retornado pelo modelo de IA.3.3. Menu de Configuração Dinâmica (Custom Provider CLI)Para evitar a manipulação manual de arquivos de configuração complexos, o CLI do Pólipos e a extensão do VS Code passarão a disponibilizar o comando polipos provider add. Esse menu guiará o usuário passo a passo através de um terminal interativo.Fluxo do Menu Interativo (Passo a Passo):🤖 [Pólipos] Configuração de Novo Provedor de IA
--------------------------------------------------
1. Nome do Provedor: Custom

2. Tipo de Autenticação:
   ( ) Sem Autenticação
   ( ) API Key (Header)
   (•) OAuth2 (Client Credentials - 2 Requests)

3. [Auth] URL do Endpoint de Token: https://api.custom-ia.com/v1/oauth/token
4. [Auth] Client ID: ************
5. [Auth] Client Secret: ************

6. [Chat] URL do Endpoint da LLM: https://api.custom-ia.com/v1/chat/completions

7. [Chat] Mapeamento do Request Body (JSON):
   Insira o template do JSON. Use {{prompt}} onde a mensagem do usuário deve entrar:
   --------------------------------------------------
   {
     "streaming": false,
     "user_prompt": "{{prompt}}",
     "return_is_response": false
   }
   --------------------------------------------------

8. [Chat] Mapeamento do Response (JSON Path):
   Onde está a resposta de texto da IA? (Ex: $.message): $.message

9. [Opcional] ID de Sessão/Contexto (JSON Path):
   Se a API exige um ID para manter o histórico, onde ele vem na resposta? $.message_id

--------------------------------------------------
✅ Configuração salva com sucesso! 
Para usar este provedor, execute: polipos chat --provider Custom
3.4. Validação e Resiliência (Orientação ao Usuário)Para garantir que o fluxo seja autoexplicativo e não quebre em execução, o menu aplicará validações em tempo real:Validação de JSON de Entrada: O terminal validará se o payload inserido no passo 7 é um JSON válido e se a tag {{prompt}} está presente. Caso falhe, exibirá o aviso: "A tag {{prompt}} é obrigatória para sabermos onde injetar a sua pergunta."Teste de Conectividade Automático: Antes de salvar o provedor, o Pólipos realizará uma chamada de teste real de ponta a ponta:Realiza o disparo para o endpoint de Token com as credenciais fornecidas. Se falhar (ex: 401 Unauthorized), avisa imediatamente: ❌ Falha ao gerar o token. Verifique suas credenciais.Se o token for gerado com sucesso, faz uma chamada de teste na LLM com um prompt genérico ("Oi"). Se o JSON Path de retorno configurado (ex: $.message) conseguir extrair o texto com sucesso, a configuração é consolidada.3.5. Modelo de Abstração (Estilo OpenAPI/Swagger)Por trás da interface, o Pólipos salvará essa configuração em um formato declarativo simplificado (semelhante ao OpenAPI) dentro do diretório do usuário (ex: ~/.polipos/providers.yaml). A engine lerá esse arquivo e executará os passos de forma sequencial:Request 1: Executa o fluxo de autenticação e armazena o token.Request 2: Monta o payload do chat com o token injetado no Header e o input do usuário substituindo a tag {{prompt}}.3.6. Gerenciamento e Cache de TokensEstratégia de Caching: O token obtido no Request 1 deve ser armazenado localmente em memória volátil ou em arquivo de sessão temporário (~/.polipos/.session.json).Validação de Expiração (TTL): O sistema deve ler o campo expires_in do payload de autenticação. Antes de cada chamada ao chat, o Pólipos verificará a validade do token. Se estiver expirado (ou a menos de 30 segundos de expirar), o sistema executará o Request 1 automaticamente em background antes de enviar o prompt do usuário.3.7. Governança e Camisas de Segurança (CLI Safety Modes)O CLI do Pólipos respeitará três modos distintos de execução para garantir a segurança nas interações com endpoints externos:Modo Bypass: Permite o envio direto dos comandos e prompts para a API mapeada, sem travas ou interceptações intermediárias.Modo Read-Only (Só Leitura): Permite apenas chamadas de consulta que não alterem estados locais do projeto ou do repositório de código.Modo Review/Aprovação: Intercepta as respostas da LLM sempre que sugerirem alterações em arquivos locais ou execução de comandos de terminal, exigindo uma confirmação explícita (y/n) do usuário para prosseguir.3.8. Sincronização com a Extensão do VS CodeA extensão oficial do VS Code refletirá a mesma dinamicidade do CLI:Sincronização de State: A extensão lerá de forma reativa o arquivo ~/.polipos/providers.yaml.Seletor na Interface: Um componente visual de Dropdown na barra lateral listará dinamicamente todos os provedores customizados adicionados.Interface Webview: A extensão oferecerá um formulário visual amigável com os mesmos campos do CLI para o cadastro de novos provedores, incluindo suporte a realce de sintaxe (syntax highlighting) para os blocos de código JSON.4. Requisitos Não-FuncionaisSegurança de Dados: Credenciais sensíveis como client_secret devem ser manipuladas de forma segura e jamais exibidas em logs abertos do terminal ou em modo debug.Performance: O tempo de processamento local para a montagem de payloads e parseamento de JSON Paths deve ser insignificante (inferior a $5\text{ms}$), garantindo que o gargalo seja apenas o tempo de resposta da própria API externa.

Fluxo do Menu Interativo (Passo a Passo):
🤖 [Pólipos] Configuração de Novo Provedor de IA
--------------------------------------------------
1. Nome do Provedor: xxxxxx

2. Tipo de Autenticação:
   ( ) Sem Autenticação
   ( ) API Key (Header)
   (•) OAuth2 (Client Credentials - 2 Requests)

3. [Auth] URL do Endpoint de Token: https://xxx.xxxxxx.com/v1/oauth/token
4. [Auth] Client ID: ************
5. [Auth] Client Secret: ************

6. [Chat] URL do Endpoint da LLM: https://api.xxxxxx.com/v1/agents/{agent_id}/chat
   👉 Dica: Use chaves {} para parâmetros dinâmicos.

7. [Chat] Mapeamento do Request Body (JSON):
   Insira o template do JSON. Use {{prompt}} onde a mensagem do usuário deve entrar:
   --------------------------------------------------
   {
     "streaming": false,
     "user_prompt": "{{prompt}}",
     "return_is_response": false
   }
   --------------------------------------------------

8. [Chat] Mapeamento do Response (JSON Path):
   Onde está a resposta de texto da IA? (Ex: $.message): $.message

9. [Opcional] ID de Sessão/Contexto (JSON Path):
   Se a API exige um ID para manter o histórico, onde ele vem na resposta? $.message_id

--------------------------------------------------
✅ Configuração salva com sucesso! 
Para usar este provedor, execute: polipos chat --provider X
3.4. Validação e Resiliência (A "Orientação" para não quebrar)
Para garantir que o usuário consiga se orientar sozinho e o Pólipos não quebre na primeira execução, o menu terá validações em tempo real:

Validação de JSON de Entrada: O terminal validará se o payload inserido no passo 7 é um JSON válido e se a tag {{prompt}} está presente. Se não estiver, ele exibe um aviso: "A tag {{prompt}} é obrigatória para sabermos onde injetar a sua pergunta."

Teste de Conectividade Automático: Antes de salvar definitivamente o provedor, o Pólipos fará uma chamada de teste real:

Tenta bater no endpoint do Token com o client_id e client_secret.

Se falhar (ex: 401 Unauthorized), avisa o usuário na hora: ❌ Falha ao gerar o token. Verifique suas credenciais.

Se passar, faz uma chamada de teste na LLM com um prompt genérico ("Oi"). Se o JSON Path de retorno ($.message) conseguir extrair o texto com sucesso, ele salva.

3.5. Modelo de Abstração estilo OpenAPI/Swagger
Por trás dos panos, o Pólipos vai salvar essa configuração em um formato simplificado de OpenAPI dentro do diretório do usuário (ex: ~/.polipos/providers.yaml). Sempre que o usuário iniciar o chat, a engine do Pólipos lerá esse arquivo e saberá exatamente que:

Request 1: Executa o fluxo de autenticação e guarda o token em memória.

Request 2: Monta o payload do chat com o token injetado no Header e o input do terminal substituindo o {{prompt}}.

Com essa abordagem de duas requests encadeadas automáticas, o Pólipos fica 100% aberto para qualquer API de mercado.