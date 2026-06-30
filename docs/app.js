// ---------------------------------------------------------------------------
// i18n dictionary (pt-BR default + en). Values may contain inline HTML.
// ---------------------------------------------------------------------------
const I18N = {
  pt: {
    "nav.how": "Como funciona",
    "nav.demo": "Demo",
    "nav.quickstart": "Começar",
    "hero.tag": 'Harness agêntico que faz <b>qualquer</b> IA escrever e aplicar código — inclusive modelos <b>sem function-calling</b>.',
    "hero.ctaHow": "Ver como funciona",
    "hero.ctaDemo": "Assistir demo",
    "origin.title": "De onde vem o nome",
    "origin.p1": "<b>Polypus</b> é “polvo” em <b>latim</b> — do grego <i>polýpous</i>, “muitos pés”.",
    "origin.p2": "A metáfora é o coração do projeto: assim como o polvo tem muitos tentáculos agindo ao mesmo tempo, o Polypus coordena <b>vários agentes de IA em paralelo</b>, cada um numa <i>git worktree</i> isolada, para resolver partes diferentes da mesma tarefa.",
    "how.title": "Do prompt ao código",
    "how.sub": "Clique em cada etapa do fluxo para entender o que acontece por baixo.",
    "how.hint": "Selecione uma etapa",
    "how.hintBody": "As explicações de cada etapa aparecem aqui.",
    "st.prompt": "Prompt",
    "st.context": "Contexto",
    "st.parser": "Parser",
    "st.permissions": "Permissões",
    "st.tools": "Tools",
    "st.loop": "Loop ReAct",
    "st.code": "Código",
    "st.orchestrator": "Orquestrador",
    "st.workers": "Workers (worktrees)",
    "st.merge": "Merge",
    "swarm.miniTitle": "… e em paralelo: o Swarm",
    "trick.title": "O truque: fazer qualquer modelo “codar”",
    "trick.sub": "Modelos com function-calling usam tools nativas. Os <b>sem</b> tools recebem um protocolo XML no prompt e o Polypus parseia a saída — então até modelos locais escrevem arquivos.",
    "trick.note": 'Se o modelo enrola (“não posso criar arquivos”), o harness reforça: “SIM, você pode — aja agora”. Mas uma simples conversa não dispara isso; e <kbd>ESC</kbd> cancela quando quiser.',
    "perm.title": "Você no controle: 3 modos",
    "perm.plan": "Somente leitura: investiga e propõe, sem tocar em arquivos.",
    "perm.review": "Confirma cada escrita/comando antes de executar.",
    "perm.bypass": "Aprova tudo automaticamente — para quando você confia.",
    "perm.allow": "Em todos os modos, o acesso é restrito por uma <b>allow-list</b> de caminhos (globs).",
    "demo.title": "Demo",
    "demo.sub": "Veja o Polypus em ação no terminal.",
    "feat.title": "O que vem na caixa",
    "feat.f1t": "Multi-provider", "feat.f1": "OpenRouter, Ollama e qualquer endpoint OpenAI-compatible + Anthropic nativo.",
    "feat.f2t": "Tools p/ todos", "feat.f2": "Nativo quando há function-calling; protocolo XML emulado quando não há.",
    "feat.f3t": "Swarm paralelo", "feat.f3": "Decompõe a tarefa e roda agentes em git worktrees isoladas.",
    "feat.f4t": "Bilíngue", "feat.f4": "Interface em português (padrão) e inglês.",
    "feat.f5t": "Descoberta de modelos", "feat.f5": "Detecta modelos do Ollama e navega o catálogo do OpenRouter por preço/tools.",
    "feat.f6t": "Tokens & ESC", "feat.f6": "Mostra tokens gastos ao vivo e cancela o “pensando” com ESC.",
    "feat.f7t": "Permissões", "feat.f7": "Modos plan/review/bypass + allow-list de caminhos.",
    "feat.f8t": "Wizard", "feat.f8": "Onboarding interativo de chaves, modelos e permissões.",
    "qs.title": "Comece em 1 minuto",
    "qs.s1": "Instale", "qs.s2": "Configure", "qs.sInit": "Modele o projeto", "qs.s3": "Use",
    "chrome.title": "Polypus Web Agent",
    "chrome.sub": "Seu agente de IA age <strong>dentro do navegador</strong>. Pesquisa docs, preenche formulários, cria issues, gerencia PRs — com o modelo que você escolher, sem assinatura.",
    "chrome.installBtn": "Instalar extensão",
    "chrome.how.title": "Como funciona",
    "chrome.how.desc": "O Polypus CLI se conecta via WebSocket com a extensão. O agente \"vê\" a página, decide ações, e a extensão as executa no navegador.",
    "chrome.use.title": "O que o agente pode fazer na web",
    "chrome.use.issues": "Gerenciar Issues/PRs",
    "chrome.use.issuesDesc": "\"Crie uma issue no repositório X descrevendo o bug Y com os logs Z\" — o agente navega, preenche título/corpo e submete.",
    "chrome.use.docs": "Pesquisar documentação",
    "chrome.use.docsDesc": "\"Encontre como usar a API tal e adapte pro nosso código\" — o agente navega, extrai e adapta.",
    "chrome.use.test": "Testar funcionalidades",
    "chrome.use.testDesc": "\"Entre no admin panel, crie um usuário teste e verifique se aparece na listagem\" — preenche login, navega, preenche formulários.",
    "chrome.use.scrape": "Web scraping inteligente",
    "chrome.use.scrapeDesc": "\"Extraia todos os preços dessa página de produtos e salve num CSV\" — extrai, estrutura e salva.",
    "chrome.install.title": "Instalação",
    "chrome.install.step1": "Instale o CLI Polypus",
    "chrome.install.step2": "Inicie o servidor WebSocket",
    "chrome.install.step2note": "Deixe rodando em segundo plano. Use um terminal separado ou um gerenciador de processos.",
    "chrome.install.step3": "Instale a extensão",
    "chrome.install.step3desc": "Carregue a extensão no Chrome:",
    "chrome.install.step3a": "Abra <code>chrome://extensions</code>",
    "chrome.install.step3b": "Ative \"Modo do desenvolvedor\"",
    "chrome.install.step3c": "Clique \"Carregar sem compactação\" e selecione a pasta <code>apps/chrome/</code>",
    "chrome.install.step4": "Conecte e use!",
    "chrome.install.step4desc": "Abra uma página, clique no 🐙 na barra de ferramentas e digite sua tarefa.",
    "chrome.install.note": "⚡ A extensão se conecta automaticamente ao WebSocket. O status \"🟢 Conectado\" aparece no popup quando tudo está funcionando.",
    "chrome.modes.title": "Modos de permissão",
    "chrome.modes.plan": "Somente leitura. O agente navega e extrai conteúdo, mas nunca clica, digita ou modifica nada. Ideal para pesquisas.",
    "chrome.modes.review": "Cada ação do agente (clicar, digitar, navegar) é exibida no side panel para você aprovar ou rejeitar antes de executar.",
    "chrome.modes.bypass": "Ações são executadas automaticamente. Use com allow-list de domínios para segurança.",
    "chrome.architecture.title": "Arquitetura",
    "chrome.architecture.desc": "A extensão Chrome se comunica com o CLI Polypus via WebSocket local (porta 9876). O service worker gerencia a conexão, o side panel exibe o chat com streaming, e o content script executa as ações na página ativa.",
    "chrome.architecture.privacy": "🔒 Tudo roda localmente. Nenhum dado sai da sua máquina além da chamada ao provedor de IA que você escolheu. A extensão não exfiltra informações das páginas que você visita.",
  "chrome.trouble.title": "Solução de problemas",
  "chrome.trouble.ws.title": "WebSocket não conecta",
  "chrome.trouble.ws.body": "O popup mostra \"Desconectado\" ou \"Erro de conexão\"? Verifique: (1) o `polypus web-server` está rodando? Rode `polypus web-server --port 9876`. (2) A porta 9876 está livre? Teste com `curl http://localhost:9876`. (3) Algum firewall está bloqueando conexões locais?",
  "chrome.trouble.inst.title": "Extensão não carrega",
  "chrome.trouble.inst.body": "Se o Chrome recusar carregar a extensão: (1) Confirme que está em \"Modo do desenvolvedor\" em <code>chrome://extensions</code>. (2) Selecione a pasta <code>apps/chrome/</code> inteira, não a subpasta <code>dist/</code>. (3) Se houver erro de manifest, leia a mensagem — geralmente é uma permissão faltando.",
  "chrome.trouble.action.title": "Ação web não executa",
  "chrome.trouble.action.body": "O agente chama <code>web_click</code> ou <code>web_type</code> mas nada acontece? (1) O seletor CSS pode estar errado. Tente \"extraia todos os elementos interativos\" para ver os seletores disponíveis. (2) Confirme que a página terminou de carregar. (3) Use o modo <code>review</code> para ver qual ação exata o agente está tentando.",
  "chrome.faq.title": "FAQ",
  "chrome.faq.q1": "Preciso pagar alguma assinatura?",
  "chrome.faq.a1": "Não. Você usa sua própria chave de API (OpenRouter, OpenAI, Anthropic, Ollama local). A extensão é open source e gratuita. Você paga apenas o consumo dos modelos de IA que escolher.",
  "chrome.faq.q2": "A extensão consegue ver minhas senhas?",
  "chrome.faq.a2": "A extensão só vê o que está visível na página. Ela nunca acessa campos de senha de forma diferente de um humano — e no modo <code>review</code>, cada ação precisa da sua aprovação. Em modo <code>plan</code>, ela não clica nem digita. O código é open source e auditável.",
  "chrome.faq.q3": "Funciona com qualquer modelo de IA?",
  "chrome.faq.a3": "Sim. O Polypus funciona com qualquer modelo via OpenRouter, Ollama (local) ou qualquer API compatível com OpenAI. Modelos com visão (GPT-4 Vision, Claude 3.5 Sonnet, Gemini) podem usar screenshots como contexto.",
  "chrome.faq.q4": "Os dados saem da minha máquina?",
  "chrome.faq.a4": "Apenas as chamadas para o provedor de IA que você configurou. Nada mais. O WebSocket entre a extensão e o CLI é local (localhost:9876). Nenhum dado é enviado para servidores do Polypus.",
  "chrome.faq.q5": "Como atualizar a extensão?",
  "chrome.faq.a5": "Puxe as mudanças do repositório (<code>git pull</code>), rode <code>npm run build</code> dentro de <code>apps/chrome/</code>, e clique em \"Atualizar\" em <code>chrome://extensions</code>. O service worker recarrega automaticamente.",
  "chrome.examples.title": "Guias de uso avançado",
  "chrome.examples.createIssue": "Criar uma issue no GitHub",
  "chrome.examples.createIssueBody": "1. Configure permissão: modo <b>review</b>, allow-list com <code>github.com</code>.<br>2. Navegue até o repositório: \"Vá para github.com/GaberRB/polypus\".<br>3. Peça: \"Crie uma issue com título 'Bug no parse de XML' e corpo 'Quando o modelo devolve XML malformado, o parser falha silenciosamente'\".<br>4. O agente clica em \"New Issue\", preenche título e corpo, e submete. Cada ação aparece para aprovação.",
  "chrome.examples.extractData": "Extrair dados estruturados",
  "chrome.examples.extractDataBody": "1. Navegue até a página com os dados.<br>2. Peça: \"Extraia todos os produtos desta página e salve num arquivo CSV com as colunas: nome, preço, link\".<br>3. O agente extrai o texto, estrutura os dados e chama <code>write_file</code> para salvar.<br>4. O CSV estará no diretório onde o <code>polypus web-server</code> foi iniciado.",
  "chrome.examples.autoForm": "Preencher formulário automaticamente",
  "chrome.examples.autoFormBody": "1. Permita o domínio do site na allow-list.<br>2. Modo <b>review</b> (padrão) para conferir cada campo.<br>3. Peça: \"Preencha o formulário de cadastro com nome 'Teste', email 'teste@example.com', e selecione a opção 'Plano Pro'\".<br>4. O agente preenche campo por campo. Você aprova antes de cada envio.",
    "footer.by": "Feito por",
  },
  en: {
    "chrome.title": "Polypus Web Agent",
    "chrome.sub": "Your AI agent acts <strong>inside the browser</strong>. Research docs, fill out forms, create issues, manage PRs — with the model you choose, no subscription.",
    "chrome.installBtn": "Install extension",
    "chrome.how.title": "How it works",
    "chrome.how.desc": "Polypus CLI connects via WebSocket with the extension. The agent \"sees\" the page, decides actions, and the extension executes them in the browser.",
    "chrome.use.title": "What the agent can do on the web",
    "chrome.use.issues": "Manage Issues/PRs",
    "chrome.use.issuesDesc": "\"Create an issue in repo X describing bug Y with logs Z\" — the agent navigates, fills title/body, and submits.",
    "chrome.use.docs": "Research documentation",
    "chrome.use.docsDesc": "\"Find how to use API X and adapt it to our code\" — the agent navigates, extracts, and adapts.",
    "chrome.use.test": "Test functionality",
    "chrome.use.testDesc": "\"Log into the admin panel, create a test user, and verify it appears in the listing\" — fills login, navigates, fills forms.",
    "chrome.use.scrape": "Intelligent web scraping",
    "chrome.use.scrapeDesc": "\"Extract all prices from this product page and save as CSV\" — extracts, structures, and saves.",
    "chrome.install.title": "Installation",
    "chrome.install.step1": "Install the Polypus CLI",
    "chrome.install.step2": "Start the WebSocket server",
    "chrome.install.step2note": "Keep it running in the background. Use a separate terminal or a process manager.",
    "chrome.install.step3": "Install the extension",
    "chrome.install.step3desc": "Load the extension in Chrome:",
    "chrome.install.step3a": "Open <code>chrome://extensions</code>",
    "chrome.install.step3b": "Enable \"Developer mode\"",
    "chrome.install.step3c": "Click \"Load unpacked\" and select the <code>apps/chrome/</code> folder",
    "chrome.install.step4": "Connect and use!",
    "chrome.install.step4desc": "Open a page, click the 🐙 in the toolbar, and type your task.",
    "chrome.install.note": "⚡ The extension connects automatically to the WebSocket. The \"🟢 Connected\" status appears in the popup when everything is running.",
    "chrome.modes.title": "Permission modes",
    "chrome.modes.plan": "Read-only. The agent navigates and extracts content, but never clicks, types, or modifies anything. Great for research.",
    "chrome.modes.review": "Each agent action (click, type, navigate) is shown in the side panel for you to approve or reject before execution.",
    "chrome.modes.bypass": "Actions run automatically. Use with a domain allow-list for safety.",
    "chrome.architecture.title": "Architecture",
    "chrome.architecture.desc": "The Chrome extension communicates with the Polypus CLI over a local WebSocket (port 9876). The service worker manages the connection, the side panel streams agent chat, and the content script executes actions on the active page.",
    "chrome.architecture.privacy": "🔒 Everything runs locally. No data leaves your machine beyond the call to the AI provider you chose. The extension does not exfiltrate page content.",
  "chrome.trouble.title": "Troubleshooting",
  "chrome.trouble.ws.title": "WebSocket won't connect",
  "chrome.trouble.ws.body": "The popup shows \"Disconnected\" or \"Connection error\"? Check: (1) Is `polypus web-server` running? Run `polypus web-server --port 9876`. (2) Is port 9876 available? Test with `curl http://localhost:9876`. (3) Is a firewall blocking local connections?",
  "chrome.trouble.inst.title": "Extension won't load",
  "chrome.trouble.inst.body": "If Chrome refuses to load the extension: (1) Confirm \"Developer mode\" is on in <code>chrome://extensions</code>. (2) Select the entire <code>apps/chrome/</code> folder, not the <code>dist/</code> subfolder. (3) If there's a manifest error, read the message — it's usually a missing permission.",
  "chrome.trouble.action.title": "Web action doesn't run",
  "chrome.trouble.action.body": "The agent calls <code>web_click</code> or <web_type`> but nothing happens? (1) The CSS selector might be wrong. Try \"extract all interactive elements\" to see available selectors. (2) Confirm the page finished loading. (3) Use <code>review</code> mode to see the exact action the agent is trying.",
  "chrome.faq.title": "FAQ",
  "chrome.faq.q1": "Do I need a subscription?",
  "chrome.faq.a1": "No. You use your own API key (OpenRouter, OpenAI, Anthropic, local Ollama). The extension is open source and free. You only pay for the AI models you choose.",
  "chrome.faq.q2": "Can the extension see my passwords?",
  "chrome.faq.a2": "The extension only sees what's visible on the page. It never accesses password fields differently from a human — and in <code>review</code> mode, each action needs your approval. In <code>plan</code> mode, it doesn't click or type. The code is open source and auditable.",
  "chrome.faq.q3": "Does it work with any AI model?",
  "chrome.faq.a3": "Yes. Polypus works with any model via OpenRouter, Ollama (local), or any OpenAI-compatible API. Vision models (GPT-4 Vision, Claude 3.5 Sonnet, Gemini) can use screenshots as context.",
  "chrome.faq.q4": "Does data leave my machine?",
  "chrome.faq.a4": "Only the calls to the AI provider you configured. Nothing else. The WebSocket between the extension and the CLI is local (localhost:9876). No data is sent to Polypus servers.",
  "chrome.faq.q5": "How to update the extension?",
  "chrome.faq.a5": "Pull changes from the repo (<code>git pull</code>), run <code>npm run build</code> inside <code>apps/chrome/</code>, and click \"Update\" in <code>chrome://extensions</code>. The service worker reloads automatically.",
  "chrome.examples.title": "Advanced usage guides",
  "chrome.examples.createIssue": "Create a GitHub issue",
  "chrome.examples.createIssueBody": "1. Set permission: <b>review</b> mode, allow-list with <code>github.com</code>.<br>2. Navigate to the repo: \"Go to github.com/GaberRB/polypus\".<br>3. Ask: \"Create an issue titled 'XML parse bug' with body 'When the model returns malformed XML, the parser fails silently'\".<br>4. The agent clicks \"New Issue\", fills title and body, and submits. Each action shows for approval.",
  "chrome.examples.extractData": "Extract structured data",
  "chrome.examples.extractDataBody": "1. Navigate to the page with data.<br>2. Ask: \"Extract all products from this page and save as CSV with columns: name, price, link\".<br>3. The agent extracts text, structures the data, and calls <code>write_file</code> to save.<br>4. The CSV will be in the directory where <code>polypus web-server</code> was started.",
  "chrome.examples.autoForm": "Auto-fill a form",
  "chrome.examples.autoFormBody": "1. Allow the site's domain in the allow-list.<br>2. <b>Review</b> mode (default) to check each field.<br>3. Ask: \"Fill the registration form with name 'Test', email 'test@example.com', and select the 'Pro Plan' option\".<br>4. The agent fills field by field. You approve each one.",
    "nav.how": "How it works",
    "nav.demo": "Demo",
    "nav.quickstart": "Get started",
    "hero.tag": 'Agentic coding harness that makes <b>any</b> AI write and apply code — even models <b>without function-calling</b>.',
    "hero.ctaHow": "See how it works",
    "hero.ctaDemo": "Watch the demo",
    "origin.title": "Where the name comes from",
    "origin.p1": "<b>Polypus</b> is Latin for “octopus” — from the Greek <i>polýpous</i>, “many-footed”.",
    "origin.p2": "That metaphor is the heart of the project: just like an octopus moves many tentacles at once, Polypus coordinates <b>several AI agents in parallel</b>, each in an isolated <i>git worktree</i>, to tackle different parts of the same task.",
    "how.title": "From prompt to code",
    "how.sub": "Click each step of the flow to see what happens under the hood.",
    "how.hint": "Pick a step",
    "how.hintBody": "Each step's explanation shows up here.",
    "st.prompt": "Prompt",
    "st.context": "Context",
    "st.parser": "Parser",
    "st.permissions": "Permissions",
    "st.tools": "Tools",
    "st.loop": "ReAct loop",
    "st.code": "Code",
    "st.orchestrator": "Orchestrator",
    "st.workers": "Workers (worktrees)",
    "st.merge": "Merge",
    "swarm.miniTitle": "… and in parallel: the Swarm",
    "trick.title": "The trick: making any model “code”",
    "trick.sub": "Models with function-calling use native tools. Those <b>without</b> tools get an XML protocol injected into the prompt, and Polypus parses the output — so even local models write files.",
    "trick.note": 'If the model stalls (“I can\'t create files”), the harness reinforces: “YES you can — act now”. But plain conversation won\'t trigger that, and <kbd>ESC</kbd> cancels anytime.',
    "perm.title": "You're in control: 3 modes",
    "perm.plan": "Read-only: investigates and proposes, never touches files.",
    "perm.review": "Confirms each write/command before running it.",
    "perm.bypass": "Auto-approves everything — for when you trust it.",
    "perm.allow": "In every mode, access is restricted by a <b>path allow-list</b> (globs).",
    "demo.title": "Demo",
    "demo.sub": "See Polypus in action in the terminal.",
    "feat.title": "What's in the box",
    "feat.f1t": "Multi-provider", "feat.f1": "OpenRouter, Ollama and any OpenAI-compatible endpoint + native Anthropic.",
    "feat.f2t": "Tools for everyone", "feat.f2": "Native when function-calling exists; emulated XML protocol when it doesn't.",
    "feat.f3t": "Parallel swarm", "feat.f3": "Splits the task and runs agents in isolated git worktrees.",
    "feat.f4t": "Bilingual", "feat.f4": "Interface in Portuguese (default) and English.",
    "feat.f5t": "Model discovery", "feat.f5": "Detects local Ollama models and browses the OpenRouter catalog by price/tools.",
    "feat.f6t": "Tokens & ESC", "feat.f6": "Shows tokens spent live and cancels the “thinking” with ESC.",
    "feat.f7t": "Permissions", "feat.f7": "plan/review/bypass modes + path allow-list.",
    "feat.f8t": "Wizard", "feat.f8": "Interactive onboarding for keys, models and permissions.",
    "qs.title": "Start in 1 minute",
    "qs.s1": "Install", "qs.s2": "Configure", "qs.sInit": "Scaffold the project", "qs.s3": "Use",
    "footer.by": "Made by",
  },
};

// ---------------------------------------------------------------------------
// Interactive diagram stages (bilingual + optional code snippet).
// ---------------------------------------------------------------------------
const STAGES = {
  prompt: {
    pt: { title: "1 · Prompt", body: "Você digita uma tarefa no REPL (ou passa uma de uma vez). É o ponto de partida — em linguagem natural, do jeito que você pensaria." },
    en: { title: "1 · Prompt", body: "You type a task in the REPL (or pass one in one shot). It's the starting point — plain natural language, the way you'd think it." },
  },
  context: {
    pt: { title: "2 · Contexto", body: "O harness monta o contexto: um <b>system prompt</b> que diz quem o agente é, a pasta de trabalho, os modos de permissão, o idioma e o histórico da conversa." },
    en: { title: "2 · Context", body: "The harness assembles the context: a <b>system prompt</b> stating who the agent is, the workspace, permission modes, language and the conversation history." },
  },
  native: {
    pt: { title: "3a · Caminho nativo", body: "Se o modelo tem <b>function-calling</b> (a maioria dos hospedados), as tools são passadas pela API e o modelo devolve chamadas estruturadas." },
    en: { title: "3a · Native path", body: "If the model has <b>function-calling</b> (most hosted ones), tools are passed via the API and the model returns structured calls." },
  },
  emulated: {
    pt: { title: "3b · Caminho emulado", body: "Sem function-calling? O Polypus injeta um protocolo de <b>tags XML</b> no prompt. O modelo escreve as chamadas como texto — e até modelos locais conseguem agir." },
    en: { title: "3b · Emulated path", body: "No function-calling? Polypus injects an <b>XML tag</b> protocol into the prompt. The model writes calls as text — so even local models can act." },
    code: '<polypus:tool name="write_file">\n<arg name="path">src/index.ts</arg>\n<arg name="content">…</arg>\n</polypus:tool>',
  },
  parser: {
    pt: { title: "4 · Parser", body: "Um parser tolerante extrai as tool calls da resposta (nativas ou XML). Ele aguenta variações que modelos fracos cometem e recupera <code>path</code>/<code>content</code> mesmo de JSON malformado." },
    en: { title: "4 · Parser", body: "A tolerant parser extracts tool calls from the response (native or XML). It survives the quirks weak models produce and recovers <code>path</code>/<code>content</code> even from malformed JSON." },
  },
  permissions: {
    pt: { title: "5 · Permissões", body: "Antes de executar, cada ação passa pelo modo (<b>plan</b> / <b>review</b> / <b>bypass</b>) e pela <b>allow-list</b> de caminhos. Em review, você confirma cada escrita." },
    en: { title: "5 · Permissions", body: "Before running, every action passes through the mode (<b>plan</b> / <b>review</b> / <b>bypass</b>) and the path <b>allow-list</b>. In review, you confirm each write." },
  },
  tools: {
    pt: { title: "6 · Tools", body: "As tools executam: <code>write_file</code>, <code>edit_file</code> (busca/substitui), <code>read_file</code>, <code>list_dir</code> e <code>run_command</code>. O resultado vira texto pro modelo." },
    en: { title: "6 · Tools", body: "Tools run: <code>write_file</code>, <code>edit_file</code> (search/replace), <code>read_file</code>, <code>list_dir</code> and <code>run_command</code>. The result is fed back to the model as text." },
  },
  loop: {
    pt: { title: "7 · Loop ReAct", body: "O resultado realimenta o modelo, que decide o próximo passo. O laço repete até <code>finish</code>. Modelos que enrolam levam um reforço; falhas idênticas param sozinhas; <kbd>ESC</kbd> cancela; tokens são contados ao vivo." },
    en: { title: "7 · ReAct loop", body: "The result feeds back, and the model decides the next step. The loop repeats until <code>finish</code>. Stalling models get a nudge; identical failures stop themselves; <kbd>ESC</kbd> cancels; tokens are counted live." },
  },
  code: {
    pt: { title: "8 · ✓ Código", body: "Os arquivos foram criados/editados no disco e os comandos rodaram. O agente chama <code>finish</code> com um resumo — e você tem o código pronto." },
    en: { title: "8 · ✓ Code", body: "Files were created/edited on disk and commands ran. The agent calls <code>finish</code> with a summary — and you have working code." },
  },
  orchestrator: {
    pt: { title: "Swarm · Orquestrador", body: "Um agente líder decompõe a tarefa em subtarefas independentes, projetadas para tocar arquivos/áreas diferentes e minimizar conflitos." },
    en: { title: "Swarm · Orchestrator", body: "A lead agent splits the task into independent subtasks, designed to touch different files/areas and minimize conflicts." },
  },
  workers: {
    pt: { title: "Swarm · Workers", body: "Cada subtarefa roda num <b>worker em paralelo</b>, dentro de uma <i>git worktree</i> isolada (modo bypass, descartável). Eles não pisam no trabalho um do outro." },
    en: { title: "Swarm · Workers", body: "Each subtask runs in a <b>parallel worker</b>, inside an isolated <i>git worktree</i> (bypass mode, throwaway). They never step on each other's work." },
  },
  merge: {
    pt: { title: "Swarm · Merge", body: "Ao final, os branches dos workers são mesclados em sequência. Conflitos são <b>reportados</b> (não forçados) e o branch fica para inspeção." },
    en: { title: "Swarm · Merge", body: "At the end, the workers' branches are merged sequentially. Conflicts are <b>reported</b> (not forced) and the branch is kept for inspection." },
  },
};

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
let currentLang = localStorage.getItem("polypus-lang") || "pt";
let currentStage = null;

function applyLang(lang) {
  document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const v = I18N[lang][el.getAttribute("data-i18n")];
    if (v != null) el.innerHTML = v;
  });
  document.querySelectorAll(".lang-toggle button").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });
}

function renderStage(stage, lang) {
  const s = STAGES[stage];
  if (!s) return;
  const titleEl = document.getElementById("stageTitle");
  const bodyEl = document.getElementById("stageBody");
  const codeWrap = document.getElementById("stageCode");
  titleEl.innerHTML = s[lang].title;
  bodyEl.innerHTML = s[lang].body;
  if (s.code) {
    codeWrap.querySelector("code").textContent = s.code;
    codeWrap.classList.remove("hidden");
  } else {
    codeWrap.classList.add("hidden");
  }
  document.querySelectorAll(".node[data-stage]").forEach((n) => {
    n.classList.toggle("active", n.dataset.stage === stage);
  });
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem("polypus-lang", lang);
  applyLang(lang);
  if (currentStage) renderStage(currentStage, lang); // re-render selected stage
}

document.addEventListener("DOMContentLoaded", () => {
  applyLang(currentLang);

  // language toggle
  document.querySelectorAll(".lang-toggle button").forEach((b) => {
    b.addEventListener("click", () => setLang(b.dataset.lang));
  });

  // diagram nodes (main + swarm)
  document.querySelectorAll(".node[data-stage]").forEach((n) => {
    n.addEventListener("click", () => {
      currentStage = n.dataset.stage;
      renderStage(currentStage, currentLang);
      document.getElementById("stageDetail").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });

  // copy buttons
  document.querySelectorAll(".copy[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        const old = btn.textContent;
        btn.textContent = "✓";
        setTimeout(() => (btn.textContent = old), 1200);
      } catch { /* clipboard unavailable */ }
    });
  });

  // quickstart tabs
  document.querySelectorAll(".tab[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".tab-panel").forEach((p) => {
        p.classList.toggle("hidden", p.dataset.panel !== name);
      });
    });
  });
});

// ===========================================================================
// Deep-dive page (fluxo.html): tools vs no-tools step-by-step simulator.
// ===========================================================================
Object.assign(I18N.pt, {
  "footer.pix": "💜 Apoie via PIX: gabrielriosbelmiro@gmail.com",
  "how.deepCta": "🔬 Tools vs. sem tools — simulação passo a passo",
  "deep.back": "← voltar",
  "deep.title": "Tools vs. sem tools — passo a passo",
  "deep.intro": "Veja, etapa por etapa, o que acontece quando você manda um prompt. 👤 é você; 🐙 é o Polypus nos bastidores. Escolha o modo e avance.",
  "deep.modeNative": "🔧 Com tools (nativo)",
  "deep.modeEmulated": "📝 Sem tools (emulado)",
  "deep.empty": "Clique em “Próximo” para começar a simulação.",
  "deep.next": "Próximo ⏭",
  "deep.all": "▶ Tudo",
  "deep.reset": "↻ Reiniciar",
  "deep.cmpTitle": "Lado a lado",
  "deep.cmpNativeT": "🔧 Nativo (com tools)",
  "deep.cmpEmulatedT": "📝 Emulado (sem tools)",
  "deep.cmpNative": "<li><b>Como as ações nascem:</b> pelo campo <code>tools</code> da API → o modelo devolve uma <i>tool_call</i> estruturada.</li><li><b>Resultado de volta:</b> por uma mensagem estruturada (<code>role: tool</code>).</li><li><b>Formato:</b> garantido pela API.</li><li><b>Funciona com:</b> modelos que têm function-calling.</li>",
  "deep.cmpEmulated": "<li><b>Como as ações nascem:</b> por um protocolo de tags XML no prompt → o modelo escreve texto e o Polypus parseia.</li><li><b>Resultado de volta:</b> como texto de usuário (<code>&lt;polypus:tool_result&gt;</code>).</li><li><b>Formato:</b> depende do modelo — com redes de segurança (re-prompt, parser tolerante).</li><li><b>Funciona com:</b> qualquer modelo, inclusive locais/base.</li>",
  "deep.cmpNote": "Em ambos, o <b>loop do agente</b> é idêntico — só muda <i>como</i> as tool calls nascem e voltam.",
});
Object.assign(I18N.en, {
  "footer.pix": "💜 Support via PIX: gabrielriosbelmiro@gmail.com",
  "how.deepCta": "🔬 Tools vs. no-tools — step-by-step simulation",
  "deep.back": "← back",
  "deep.title": "Tools vs. no-tools — step by step",
  "deep.intro": "See, step by step, what happens when you send a prompt. 👤 is you; 🐙 is Polypus behind the scenes. Pick a mode and advance.",
  "deep.modeNative": "🔧 With tools (native)",
  "deep.modeEmulated": "📝 Without tools (emulated)",
  "deep.empty": "Click “Next” to start the simulation.",
  "deep.next": "Next ⏭",
  "deep.all": "▶ All",
  "deep.reset": "↻ Reset",
  "deep.cmpTitle": "Side by side",
  "deep.cmpNativeT": "🔧 Native (with tools)",
  "deep.cmpEmulatedT": "📝 Emulated (no tools)",
  "deep.cmpNative": "<li><b>How actions are born:</b> via the API's <code>tools</code> field → the model returns a structured <i>tool_call</i>.</li><li><b>Result back:</b> through a structured message (<code>role: tool</code>).</li><li><b>Format:</b> guaranteed by the API.</li><li><b>Works with:</b> models that have function-calling.</li>",
  "deep.cmpEmulated": "<li><b>How actions are born:</b> via an XML tag protocol in the prompt → the model writes text and Polypus parses it.</li><li><b>Result back:</b> as a user message (<code>&lt;polypus:tool_result&gt;</code>).</li><li><b>Format:</b> depends on the model — with safety nets (re-prompt, tolerant parser).</li><li><b>Works with:</b> any model, including local/base ones.</li>",
  "deep.cmpNote": "In both, the <b>agent loop</b> is identical — only <i>how</i> tool calls are born and returned changes.",
});

const PROMPT_PT = "crie um arquivo hello.txt com a palavra olá";
const PROMPT_EN = "create a file hello.txt with the word hi";

// Each step: who ('user'|'octo'), bilingual tag + text, optional code block.
const SIM = {
  emulated: [
    { who: "user", tagPt: "", tagEn: "", pt: PROMPT_PT, en: PROMPT_EN },
    {
      who: "octo", tagPt: "Contexto", tagEn: "Context",
      pt: "Monto o system prompt e — atenção — <b>não envio tools pela API</b> (o modelo não tem). Em vez disso, ensino o protocolo dentro do texto:",
      en: "I build the system prompt and — note — <b>send no tools via the API</b> (the model has none). Instead, I teach the protocol inside the text:",
      code: 'Você está em C:\\projeto. SIM, você PODE criar arquivos.\nPara agir, escreva blocos:\n<polypus:tool name="write_file">\n  <arg name="path">…</arg>\n  <arg name="content">…</arg>\n</polypus:tool>\nAo terminar, chame finish.',
    },
    {
      who: "octo", tagPt: "Modelo responde", tagEn: "Model replies",
      pt: "O modelo devolve <b>texto puro</b> — sem nenhum canal estruturado:",
      en: "The model returns <b>plain text</b> — no structured channel:",
      code: 'Vou criar o arquivo.\n<polypus:tool name="write_file">\n<arg name="path">hello.txt</arg>\n<arg name="content">olá</arg>\n</polypus:tool>',
    },
    {
      who: "octo", tagPt: "Parser", tagEn: "Parser",
      pt: "Eu <b>varro o texto</b> e extraio a chamada: <code>write_file(path=\"hello.txt\", content=\"olá\")</code>. É leitura de string — nada de API.",
      en: "I <b>scan the text</b> and extract the call: <code>write_file(path=\"hello.txt\", content=\"hi\")</code>. It's string parsing — no API involved.",
    },
    {
      who: "octo", tagPt: "Permissões", tagEn: "Permissions",
      pt: "Checo: <code>hello.txt</code> está na allow-list? O modo permite escrever? (em <i>review</i>, eu te pergunto antes.)",
      en: "I check: is <code>hello.txt</code> in the allow-list? Does the mode allow writing? (in <i>review</i>, I ask you first.)",
    },
    {
      who: "octo", tagPt: "Executa", tagEn: "Execute",
      pt: "Escrevo o arquivo no disco e devolvo o resultado como <b>texto de usuário</b> (o modelo emulado não entende <code>role: tool</code>):",
      en: "I write the file to disk and feed the result back as <b>user text</b> (the emulated model doesn't understand <code>role: tool</code>):",
      code: "<polypus:tool_result name=\"write_file\">\nWrote hello.txt (1 linha)\n</polypus:tool_result>",
    },
    {
      who: "octo", tagPt: "Modelo responde", tagEn: "Model replies",
      pt: "O modelo vê que deu certo e sinaliza o fim:",
      en: "The model sees it worked and signals completion:",
      code: '<polypus:tool name="finish">\n<arg name="summary">criei hello.txt</arg>\n</polypus:tool>',
    },
    {
      who: "octo", tagPt: "✓ Fim", tagEn: "✓ Done",
      pt: "Vejo o <code>finish</code> → encerro. Arquivo criado. <b>Em nenhum momento a API soube que existiam tools.</b>",
      en: "I see <code>finish</code> → stop. File created. <b>The API never knew tools existed.</b>",
    },
  ],
  native: [
    { who: "user", tagPt: "", tagEn: "", pt: PROMPT_PT, en: PROMPT_EN },
    {
      who: "octo", tagPt: "Contexto", tagEn: "Context",
      pt: "Monto o contexto e <b>envio as tools pela própria API</b>, num campo estruturado:",
      en: "I build the context and <b>send the tools via the API itself</b>, in a structured field:",
      code: 'tools: [\n  { name: "write_file", parameters: { path, content } },\n  { name: "run_command", … }, …\n]',
    },
    {
      who: "octo", tagPt: "Modelo responde", tagEn: "Model replies",
      pt: "O modelo <b>não escreve texto livre</b> — ele retorna uma <i>tool_call</i> estruturada (a API garante o formato):",
      en: "The model <b>doesn't write free text</b> — it returns a structured <i>tool_call</i> (the API guarantees the format):",
      code: 'tool_call: write_file\narguments: { "path": "hello.txt", "content": "olá" }',
    },
    {
      who: "octo", tagPt: "Sem parser", tagEn: "No parsing",
      pt: "Já vem estruturado — <b>não preciso varrer texto</b>. Só valido os argumentos e checo permissão.",
      en: "It's already structured — <b>no text to scan</b>. I just validate the arguments and check permissions.",
    },
    {
      who: "octo", tagPt: "Executa", tagEn: "Execute",
      pt: "Escrevo o arquivo e devolvo o resultado pelo <b>canal estruturado</b> da API:",
      en: "I write the file and return the result through the API's <b>structured channel</b>:",
      code: 'role: tool\ntool_call_id: call_1\ncontent: "Wrote hello.txt"',
    },
    {
      who: "octo", tagPt: "Modelo responde", tagEn: "Model replies",
      pt: "O modelo chama <code>finish</code> (também estruturado, pela API).",
      en: "The model calls <code>finish</code> (also structured, via the API).",
    },
    {
      who: "octo", tagPt: "✓ Fim", tagEn: "✓ Done",
      pt: "Encerro. <b>Mesmo resultado</b> — mas o roteamento foi feito pela API, não pelo texto.",
      en: "I stop. <b>Same result</b> — but the routing was done by the API, not by parsing text.",
    },
  ],
};

function initSimulator() {
  const feed = document.getElementById("simFeed");
  if (!feed) return; // not on the deep-dive page

  let mode = "emulated";
  let shown = 0;

  const steps = () => SIM[mode];
  const progress = document.getElementById("simProgress");
  const btnNext = document.getElementById("simNext");

  function bubble(step) {
    const lang = currentLang;
    const wrap = document.createElement("div");
    wrap.className = "bubble " + step.who;
    const tag = (lang === "pt" ? step.tagPt : step.tagEn);
    const text = (lang === "pt" ? step.pt : step.en);
    const code = step.code
      ? `<pre><code>${step.code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`
      : "";
    wrap.innerHTML =
      `<div class="avatar">${step.who === "user" ? "👤" : "🐙"}</div>` +
      `<div class="body">${tag ? `<span class="tag">${tag}</span>` : ""}<p class="txt">${text}</p>${code}</div>`;
    return wrap;
  }

  function render() {
    feed.innerHTML = "";
    if (shown === 0) {
      const e = document.createElement("p");
      e.className = "sim-empty";
      e.textContent = I18N[currentLang]["deep.empty"];
      feed.appendChild(e);
    }
    steps().slice(0, shown).forEach((s) => feed.appendChild(bubble(s)));
    progress.textContent = `${shown} / ${steps().length}`;
    btnNext.disabled = shown >= steps().length;
  }

  function setMode(m) {
    mode = m;
    shown = 0;
    document.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === m));
    render();
  }

  document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  btnNext.addEventListener("click", () => { if (shown < steps().length) { shown++; render(); } });
  document.getElementById("simReset").addEventListener("click", () => { shown = 0; render(); });
  document.getElementById("simAll").addEventListener("click", () => {
    shown = 0; render();
    const tick = () => { if (shown < steps().length) { shown++; render(); setTimeout(tick, 650); } };
    tick();
  });

  // Re-render bubbles when the language changes.
  document.querySelectorAll(".lang-toggle button").forEach((b) =>
    b.addEventListener("click", () => render()),
  );

  setMode("emulated");
}

document.addEventListener("DOMContentLoaded", initSimulator);

// ===========================================================================
// Shared strings for the new landing sections + CI/CD page.
// ===========================================================================
Object.assign(I18N.pt, {
  "nav.cicd": "CI/CD",
  "nav.contribute": "Contribuir",
  "nav.changelog": "Changelog",
  // landing — novos cards
  "feat.f9t": "Autocorreção",
  "feat.f9": "Quando uma tool falha, o erro volta enriquecido com a causa e o contexto — o modelo se conserta sozinho em vez de entrar em loop.",
  "feat.f10t": "PRD bot",
  "feat.f10": "Rotule uma issue como <code>accepted</code> e um agente gera um PRD estruturado, comentado na própria issue.",
  "feat.f11t": "Review bot",
  "feat.f11": "Todo PR aberto recebe uma primeira camada de code review automática, com modelo gratuito do OpenRouter.",
  "feat.f12t": "CI/CD robusto",
  "feat.f12": "Build/test, PRs vinculados a issue, review automático e publish no npm — tudo no GitHub Actions.",
  // landing — contribuição
  "contrib.title": "Como contribuir",
  "contrib.sub": "O fluxo é <b>issue-gated</b>: nada de PR sem uma issue triada.",
  "contrib.s1": "Abra uma issue",
  "contrib.s1b": "Descreva o bug ou a ideia — há templates de bug e feature.",
  "contrib.s2": "Espere o <code>accepted</code>",
  "contrib.s2b": "O mantenedor tria e aplica a label <code>accepted</code> — o sinal verde.",
  "contrib.s3": "Branch + PR",
  "contrib.s3b": "Crie a branch e abra o PR referenciando a issue com <code>Closes #N</code>.",
  "contrib.s4": "CI + review",
  "contrib.s4b": "O CI roda build/test, o <i>require-issue</i> confere a label e o bot comenta um review.",
  "contrib.s5": "Merge",
  "contrib.s5b": "Com tudo verde, o merge entra na <code>main</code> — e a issue fecha sozinha.",
  "contrib.cta": "⚙️ Ver o pipeline de CI/CD em detalhe",
  "contrib.filesT": "Arquivos essenciais (leia antes)",
  "contrib.filesB": 'Principalmente se você usa <b>IA para codar</b>: leia o <a href="https://github.com/GaberRB/polypus/blob/main/context.md" target="_blank" rel="noopener"><code>context.md</code></a> (resumo do projeto, sempre atualizado) e o <a href="https://github.com/GaberRB/polypus/blob/main/rules.md" target="_blank" rel="noopener"><code>rules.md</code></a> (padrões e o que é/não é esperado). Eles são a fonte de verdade — e também alimentam os bots de PRD e de review.',
  // landing — changelog
  "chg.title": "Changelog",
  "chg.sub": "Todas as mudanças relevantes, versão a versão.",
  "chg.body": "Seguimos o formato <b>Keep a Changelog</b> + SemVer. As adições mais recentes (autocorreção, agentes de PRD e review, hardening) estão na seção <i>Unreleased</i>.",
  "chg.cta": "📝 Ler o CHANGELOG.md",
  // página cicd
  "cicd.back": "← voltar",
  "cicd.title": "CI/CD do Polypus",
  "cicd.intro": "O projeto roda inteiramente no GitHub Actions: build e testes, governança de PRs vinculados a issue, dois agentes de IA (PRD e review) e publish no npm. Clique em cada peça do pipeline.",
  "cicd.hint": "Selecione uma etapa do pipeline",
  "cicd.hintBody": "Os detalhes e o YAML de cada workflow aparecem aqui.",
  "cicd.lifeTitle": "Ciclo de vida de uma mudança",
  "cicd.secretsTitle": "Segredos usados",
  "cicd.secrets": "<li><code>OPENROUTER_API_KEY</code> — modelos gratuitos para o PRD bot e o review bot.</li><li><code>NPM_TOKEN</code> — publish no npm (com provenance) ao publicar um Release.</li><li><code>GITHUB_TOKEN</code> — automático; comenta em issues/PRs.</li>",
});
Object.assign(I18N.en, {
  "nav.cicd": "CI/CD",
  "nav.contribute": "Contribute",
  "nav.changelog": "Changelog",
  "feat.f9t": "Auto-correction",
  "feat.f9": "When a tool fails, the error is fed back enriched with its cause and context — the model self-heals instead of looping.",
  "feat.f10t": "PRD bot",
  "feat.f10": "Label an issue <code>accepted</code> and an agent generates a structured PRD, posted as a comment on the issue.",
  "feat.f11t": "Review bot",
  "feat.f11": "Every opened PR gets a first-pass automated code review, powered by a free OpenRouter model.",
  "feat.f12t": "Solid CI/CD",
  "feat.f12": "Build/test, issue-gated PRs, automated review and npm publish — all on GitHub Actions.",
  "contrib.title": "How to contribute",
  "contrib.sub": "The flow is <b>issue-gated</b>: no PR without a triaged issue.",
  "contrib.s1": "Open an issue",
  "contrib.s1b": "Describe the bug or idea — there are bug and feature templates.",
  "contrib.s2": "Wait for <code>accepted</code>",
  "contrib.s2b": "The maintainer triages and applies the <code>accepted</code> label — the green light.",
  "contrib.s3": "Branch + PR",
  "contrib.s3b": "Create the branch and open the PR referencing the issue with <code>Closes #N</code>.",
  "contrib.s4": "CI + review",
  "contrib.s4b": "CI runs build/test, <i>require-issue</i> checks the label, and the bot comments a review.",
  "contrib.s5": "Merge",
  "contrib.s5b": "Once everything is green, it merges into <code>main</code> — and the issue closes itself.",
  "contrib.cta": "⚙️ See the CI/CD pipeline in detail",
  "contrib.filesT": "Essential files (read first)",
  "contrib.filesB": 'Especially if you <b>code with AI</b>: read <a href="https://github.com/GaberRB/polypus/blob/main/context.md" target="_blank" rel="noopener"><code>context.md</code></a> (the always-updated project summary) and <a href="https://github.com/GaberRB/polypus/blob/main/rules.md" target="_blank" rel="noopener"><code>rules.md</code></a> (conventions and what is/ isn\'t expected). They are the source of truth — and also feed the PRD and review bots.',
  "chg.title": "Changelog",
  "chg.sub": "Every notable change, version by version.",
  "chg.body": "We follow the <b>Keep a Changelog</b> format + SemVer. The most recent additions (auto-correction, PRD and review agents, hardening) live in the <i>Unreleased</i> section.",
  "chg.cta": "📝 Read the CHANGELOG.md",
  "cicd.back": "← back",
  "cicd.title": "Polypus CI/CD",
  "cicd.intro": "The project runs entirely on GitHub Actions: build and tests, issue-gated PR governance, two AI agents (PRD and review) and npm publishing. Click each piece of the pipeline.",
  "cicd.hint": "Pick a pipeline stage",
  "cicd.hintBody": "Each workflow's details and YAML show up here.",
  "cicd.lifeTitle": "Lifecycle of a change",
  "cicd.secretsTitle": "Secrets used",
  "cicd.secrets": "<li><code>OPENROUTER_API_KEY</code> — free models for the PRD bot and the review bot.</li><li><code>NPM_TOKEN</code> — npm publish (with provenance) when a Release is published.</li><li><code>GITHUB_TOKEN</code> — automatic; comments on issues/PRs.</li>",
});

// CI/CD pipeline stages (bilingual + YAML excerpt). Mirrors the STAGES pattern.
const CICD = {
  trigger: {
    pt: { title: "Gatilhos", body: "Cada workflow reage a um evento do GitHub: <b>push</b> na main, <b>pull_request</b>, <b>issues</b> rotuladas, <b>release</b> publicado e um <b>cron</b> diário." },
    en: { title: "Triggers", body: "Each workflow reacts to a GitHub event: <b>push</b> to main, <b>pull_request</b>, labeled <b>issues</b>, published <b>release</b>, and a daily <b>cron</b>." },
    code: 'on:\n  push: { branches: [main] }\n  pull_request:\n  issues: { types: [labeled] }\n  release: { types: [published] }\n  schedule: [{ cron: "30 2 * * *" }]',
  },
  ci: {
    pt: { title: "ci.yml · build & test", body: "Em push na main e em todo PR: <b>typecheck</b>, <b>build</b> e <b>testes</b>, numa matriz de Node <b>20 e 22</b>. É o portão de qualidade." },
    en: { title: "ci.yml · build & test", body: "On push to main and every PR: <b>typecheck</b>, <b>build</b> and <b>tests</b>, across a Node <b>20 and 22</b> matrix. The quality gate." },
    code: '# ci.yml\nstrategy:\n  matrix: { node: [20, 22] }\nsteps:\n  - run: npm ci\n  - run: npm run typecheck\n  - run: npm run build\n  - run: npm test',
  },
  gate: {
    pt: { title: "require-issue.yml · governança", body: "Todo PR precisa referenciar uma issue (<code>Closes #N</code>) que tenha a label <b>accepted</b>. Bloqueia PRs sem triagem — com bypass para o mantenedor e o Dependabot." },
    en: { title: "require-issue.yml · governance", body: "Every PR must reference an issue (<code>Closes #N</code>) carrying the <b>accepted</b> label. It blocks untriaged PRs — with a bypass for the maintainer and Dependabot." },
    code: '# require-issue.yml\non: { pull_request: { types: [opened, edited, synchronize, reopened] } }\n# Falha se nenhuma issue citada tiver a label `accepted`.\n# Bypass: GaberRB, dependabot[bot].',
  },
  review: {
    pt: { title: "pr-review.yml · review por IA", body: "Em PR aberto/reaberto, um <b>modelo gratuito do OpenRouter</b> revisa o diff e posta um comentário-resumo. Primeira camada — não substitui a revisão humana." },
    en: { title: "pr-review.yml · AI review", body: "On opened/reopened PRs, a <b>free OpenRouter model</b> reviews the diff and posts a summary comment. First pass — it doesn't replace human review." },
    code: '# pr-review.yml\non: { pull_request: { types: [opened, reopened] } }\n- run: node dist/index.js review "$PR" --out review.md\n  env: { OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }} }\n# github-script posta review.md como comentário no PR',
  },
  prd: {
    pt: { title: "prd-bot.yml · PRD por IA", body: "Ao rotular uma issue como <b>accepted</b> (ou rodar manualmente), um agente gera um <b>PRD estruturado</b> e o comenta na própria issue." },
    en: { title: "prd-bot.yml · AI PRD", body: "When an issue is labeled <b>accepted</b> (or run manually), an agent generates a <b>structured PRD</b> and comments it on the issue." },
    code: '# prd-bot.yml\non:\n  issues: { types: [labeled] }      # if label == accepted\n  workflow_dispatch: { inputs: { issue } }\n- run: node dist/index.js prd "$ISSUE" --out prd.md\n# comenta o PRD na própria issue',
  },
  release: {
    pt: { title: "release.yml · publish no npm", body: "Ao publicar um Release no GitHub: confere que a versão do <code>package.json</code> bate com a tag, roda typecheck/test/build e faz <b>npm publish</b> com <i>provenance</i>." },
    en: { title: "release.yml · npm publish", body: "When a GitHub Release is published: it verifies the <code>package.json</code> version matches the tag, runs typecheck/test/build and does <b>npm publish</b> with <i>provenance</i>." },
    code: '# release.yml\non: { release: { types: [published] } }\n- run: npm run typecheck && npm test && npm run build\n- run: npm publish --provenance --access public\n  env: { NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }} }',
  },
  housekeeping: {
    pt: { title: "Dependabot + stale", body: "<b>Dependabot</b> abre PRs de atualização de dependências e actions. O <b>stale</b> marca e fecha issues/PRs inativos (30d → 7d), isentando os que têm <code>accepted</code>." },
    en: { title: "Dependabot + stale", body: "<b>Dependabot</b> opens dependency/action update PRs. <b>stale</b> flags and closes inactive issues/PRs (30d → 7d), exempting those labeled <code>accepted</code>." },
    code: '# stale.yml\nschedule: [{ cron: "30 2 * * *" }]\nwith:\n  days-before-stale: 30\n  days-before-close: 7\n  exempt-issue-labels: "accepted,pinned,security,help wanted"',
  },
};

function initCicd() {
  const detail = document.getElementById("cicdDetail");
  if (!detail) return; // not on the cicd page
  let stage = null;

  function render(st, lang) {
    const s = CICD[st];
    if (!s) return;
    document.getElementById("cicdTitle").innerHTML = s[lang].title;
    document.getElementById("cicdBody").innerHTML = s[lang].body;
    const codeWrap = document.getElementById("cicdCode");
    if (s.code) {
      codeWrap.querySelector("code").textContent = s.code;
      codeWrap.classList.remove("hidden");
    } else {
      codeWrap.classList.add("hidden");
    }
    document.querySelectorAll("#cicdFlow .node[data-cstage]").forEach((n) => {
      n.classList.toggle("active", n.dataset.cstage === st);
    });
  }

  document.querySelectorAll("#cicdFlow .node[data-cstage]").forEach((n) => {
    n.addEventListener("click", () => {
      stage = n.dataset.cstage;
      render(stage, currentLang);
      detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
  // Re-render the open stage when language changes (after setLang updates currentLang).
  document.querySelectorAll(".lang-toggle button").forEach((b) =>
    b.addEventListener("click", () => { if (stage) render(stage, currentLang); }),
  );
}

document.addEventListener("DOMContentLoaded", initCicd);
