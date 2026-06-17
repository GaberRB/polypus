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
