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
    "qs.s1": "Instale", "qs.s2": "Configure", "qs.s3": "Use",
    "footer.by": "Feito por",
  },
  en: {
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
    "qs.s1": "Install", "qs.s2": "Configure", "qs.s3": "Use",
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
