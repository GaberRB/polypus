Product Requirement Document (PRD) — Polypus Co-Work
1. Visão Geral do Produto
O Polypus é um assistente de desenvolvimento e "Vibe Coding" de código aberto baseado em Electron e TypeScript. O objetivo é replicar a fluidez visual e o poder funcional do Cloud Code, oferecendo uma experiência focada em Spec-Driven Development (SDD), autonomia de agentes e flexibilidade na escolha de LLMs (locais ou via OpenRouter).

2. Escopo do Projeto & Funcionalidades Principais
2.1. Gerenciamento de Espaço de Trabalho (Workspace & Contexto)
Seleção de Pasta Local: O usuário deve ser capaz de selecionar uma pasta raiz do projeto. O Polypus precisa ler e indexar a árvore de arquivos.

Indexação e Registro (Index / Reg):

Funcionalidade: Sistema de gerenciamento de arquivos em memória ou banco leve (ex: SQLite embutido no Electron).

Interface: Exibir quais arquivos estão indexados na sessão de contexto atual. Botões para "Forçar Reindexação" ou "Limpar Cache".

Modo Co-Work (Agente Autônomo): * Implementação do loop de execução onde o agente recebe uma especificação técnica, analisa o projeto local, cria planos de ação, edita arquivos e roda testes de forma autônoma.

2.2. Interface Principal e Painéis Laterais (Sidebar)
Comportamento Dinâmico: Correção do bug atual. As sessões/pastas laterais devem ser clicáveis, expansíveis e permitir interações (botão direito para excluir, renomear ou criar novos arquivos/pastas).

Divisão de Modos de Visualização:

Modo Code: Focado no gerenciamento de rotinas, histórico de alterações propostas pela IA e árvore de arquivos.

Modo Chat: Uma interface limpa, conversacional (estilo ChatGPT/Claude), para dúvidas rápidas e iterações diretas que não alteram o código imediatamente.

2.3. Gestão de Configurações e Modelos
Seleção de Modelo Padrão (Default Model): Correção do bug onde o modelo fica travado. A tela de configurações deve permitir salvar uma API Key global (ou por provedor) e um Dropdown funcional para escolher qual LLM será a ativa/padrão por sessão.

Suporte a Conectores MCP (Model Context Protocol):

Interface para configurar e gerenciar servidores MCP locais ou remotos, permitindo que a LLM use ferramentas externas (ex: consultas a bancos de dados, APIs de terceiros).

Painel de Uso e Telemetria de Consumo:

Como o Polypus usa chaves do próprio usuário (OpenRouter, OpenAI ou modelos locais), o painel de "Uso" deve rastrear e exibir o consumo de tokens (Input/Output) e uma estimativa de custos por modelo/sessão.

3. Arquitetura Técnica e Experiência do Usuário (UX/UI)
3.1. Requisitos de UI/UX (Inspirados no Cloud Code)
Minimalismo Guiado: A tela inicial do chat ou do co-work deve exibir placeholders com instruções claras e exemplos de prompts para o usuário (ex: "Como posso te ajudar a codar hoje? Escolha uma pasta para começar").

Consistência Visual: Layout escuro, limpo, utilizando componentes de interface modernos (Tailwind CSS ou similar acoplado ao Electron).

3.2. Fluxo de Trabalho do Usuário
[Abrir Polypus] ➔ [Configurar API/Modelo Padrão] ➔ [Selecionar Pasta Local]
                                                             │
                    ┌────────────────────────────────────────┴────────────────────────────────────────┐
                    ▼                                                                                 ▼
             [Modo Chat]                                                                       [Modo Co-Work / Code]
  (Conversas conceituais e dúvidas)                                                 (Leitura de arquivos e geração de código)
4. Requisitos Não-Funcionais
Performance: A indexação de projetos com mais de 1.000 arquivos não deve travar a thread principal do Electron (usar Worker Threads ou processos em background do Node.js).

Privacidade e Segurança: Como um projeto Open Source, as chaves de API devem ser armazenadas localmente de forma segura (usando o keytar do Electron ou criptografia local). Nenhum dado de código deve ser enviado a servidores centrais do Polypus.

Extensibilidade: O código de integração de modelos deve ser modular para aceitar novos provedores facilmente além do OpenRouter e Ollama.

5. Roteiro de Implementação (Roadmap Sugerido)
🚀 Fase 1: Correções de UI e MVP Estável (Foco Atual)
Destravar a barra lateral (tornar sessões clicáveis e deletáveis).

Corrigir o seletor de modelos na tela de configurações (permitindo alterar e salvar o modelo padrão).

Implementar o fluxo básico de "Escolher Pasta" e renderizar a árvore de arquivos.

⚙️ Fase 2: Inteligência e Integração
Ativar a lógica do Index/Reg (passar os arquivos selecionados como contexto no prompt da LLM).

Estruturar o layout do Modo Co-Work para receber especificações de tarefas.

Implementar o contador de tokens/uso com base nas respostas das APIs.

🔌 Fase 3: Recursos Avançados
Integração com o ecossistema de servidores MCP.

Criação de rotinas automatizadas e personalização profunda de prompts do sistema (System Prompts).