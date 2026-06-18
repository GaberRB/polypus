import type { Locale } from "../i18n/index.js";

/**
 * The files written by `polypus init`, keyed by their path relative to `.poly/`.
 * Content is locale-aware so a scaffolded workspace reads naturally in the user's
 * language. Keep these lean — they are starting points, not exhaustive docs.
 */
export function polyTemplates(locale: Locale): Record<string, string> {
  return locale === "pt-BR" ? PT : EN;
}

const EN: Record<string, string> = {
  "agents.md": `# agents.md — how an AI agent operates this repo

> Local workspace under \`.poly/\`. Conditions any AI agent (Polypus, Claude, …)
> to work the way this project expects. **Polypus loads this file automatically**
> into the agent's system prompt on every run, so keep it accurate and lean.

## Role

You implement changes end to end — from understanding the task to a reviewable
result — respecting the rules below.

## Golden rules

1. Green before a PR: the project builds, type-checks and tests pass.
2. Keep docs/changelog in sync with behavior changes.
3. Confirm before irreversible actions (publishing, deleting, force-pushing).
4. Small, targeted changes over broad rewrites.

## Skills index

| Skill | When to use |
|-------|-------------|
| [skills/coding.md](skills/coding.md) | Technical standards for any code change |
| [skills/spec-driven.md](skills/spec-driven.md) | Write a spec before non-trivial work |

## Environment

- Describe the OS, shell, package manager and any tooling the agent needs.
- Note where credentials/CLIs live and how commands are run.
`,

  "README.md": `# .poly — your project's AI operating manual

\`.poly/\` is a small, local workspace that teaches AI agents how to work in THIS
repository. Gitignore it to keep it personal, or commit it to standardize the
workflow across your team.

## What's inside

- **\`agents.md\`** — the entry point: role, golden rules and an index of skills.
  Polypus loads it automatically into the agent's system prompt on every run.
- **\`skills/\`** — focused how-to guides the agent reads when relevant.
- **\`templates/spec.md\`** — a lean Spec-Driven Development (SDD) template.

## How it works

1. You describe a task to the agent.
2. The agent reads \`agents.md\`, follows the golden rules and opens the skills it needs.
3. For non-trivial work, it writes a spec first from \`templates/spec.md\`.

## Extend it

- Edit \`agents.md\` to encode your conventions.
- Add one skill file per recurring workflow (releases, reviews, migrations…).
- Reference new skills from \`agents.md\` so the agent can discover them.

Regenerate any missing files with \`polypus init\` (existing files are preserved;
use \`--force\` to overwrite).
`,

  "skills/coding.md": `# skill: coding

Technical standards for changes in this repo.

## Principles

- Match the style, naming and structure of the surrounding code.
- Prefer small, targeted edits over broad rewrites.
- Add or update tests with every behavior change.

## Checklist before opening a PR

- [ ] Builds and type-checks
- [ ] Tests pass
- [ ] Docs / changelog updated when behavior changed
`,

  "skills/spec-driven.md": `# skill: spec-driven development

For anything non-trivial, write a short spec BEFORE coding.

## Flow

1. Copy \`templates/spec.md\` into your issue (or \`specs/<slug>.md\`).
2. Fill **Why / What / Acceptance criteria / Out of scope**.
3. Get a thumbs-up, then implement to the acceptance criteria.
4. Keep the spec updated if scope changes.

Lean by design: if a section is empty, delete it.
`,

  "templates/spec.md": `# Spec: <title>

> Status: draft · Owner: <name> · Updated: <yyyy-mm-dd>

## Why

What problem are we solving, and for whom? Why now?

## What

The change in plain terms — the behavior a user will actually see.

## Acceptance criteria

- [ ] Observable outcome 1
- [ ] Observable outcome 2

## Out of scope

- Things we are explicitly NOT doing here.

## Notes / open questions

- …
`,
};

const PT: Record<string, string> = {
  "agents.md": `# agents.md — como um agente de IA opera este repositório

> Workspace local em \`.poly/\`. Condiciona qualquer agente de IA (Polypus, Claude…)
> a trabalhar do jeito que este projeto espera. **O Polypus carrega este arquivo
> automaticamente** no system prompt do agente a cada execução — mantenha-o
> preciso e enxuto.

## Papel

Você implementa mudanças de ponta a ponta — do entendimento da tarefa a um
resultado revisável — respeitando as regras abaixo.

## Regras de ouro

1. Verde antes do PR: o projeto builda, passa no type-check e nos testes.
2. Mantenha docs/changelog em sincronia com mudanças de comportamento.
3. Confirme antes de ações irreversíveis (publicar, deletar, force-push).
4. Mudanças pequenas e focadas em vez de reescritas amplas.

## Índice de skills

| Skill | Quando usar |
|-------|-------------|
| [skills/coding.md](skills/coding.md) | Padrões técnicos para qualquer mudança de código |
| [skills/spec-driven.md](skills/spec-driven.md) | Escrever um spec antes de trabalho não-trivial |

## Ambiente

- Descreva SO, shell, gerenciador de pacotes e ferramentas que o agente precisa.
- Anote onde ficam credenciais/CLIs e como os comandos são executados.
`,

  "README.md": `# .poly — o manual de operação de IA do seu projeto

O \`.poly/\` é um workspace local e pequeno que ensina agentes de IA a trabalhar
NESTE repositório. Coloque no .gitignore para mantê-lo pessoal, ou commite para
padronizar o fluxo entre o time.

## O que tem dentro

- **\`agents.md\`** — o ponto de entrada: papel, regras de ouro e um índice de skills.
  O Polypus carrega ele automaticamente no system prompt do agente a cada execução.
- **\`skills/\`** — guias práticos e focados que o agente lê quando relevante.
- **\`templates/spec.md\`** — um template enxuto de Spec-Driven Development (SDD).

## Como funciona

1. Você descreve uma tarefa ao agente.
2. O agente lê o \`agents.md\`, segue as regras de ouro e abre as skills necessárias.
3. Para trabalho não-trivial, escreve um spec primeiro a partir de \`templates/spec.md\`.

## Como estender

- Edite o \`agents.md\` para codificar suas convenções.
- Adicione um arquivo de skill por fluxo recorrente (releases, reviews, migrações…).
- Referencie as novas skills no \`agents.md\` para o agente descobri-las.

Regenere arquivos que faltarem com \`polypus init\` (os existentes são preservados;
use \`--force\` para sobrescrever).
`,

  "skills/coding.md": `# skill: coding

Padrões técnicos para mudanças neste repositório.

## Princípios

- Siga o estilo, a nomenclatura e a estrutura do código ao redor.
- Prefira edições pequenas e focadas a reescritas amplas.
- Adicione ou atualize testes a cada mudança de comportamento.

## Checklist antes de abrir um PR

- [ ] Builda e passa no type-check
- [ ] Testes passam
- [ ] Docs / changelog atualizados quando o comportamento mudou
`,

  "skills/spec-driven.md": `# skill: spec-driven development

Para qualquer coisa não-trivial, escreva um spec curto ANTES de codar.

## Fluxo

1. Copie \`templates/spec.md\` para a issue (ou \`specs/<slug>.md\`).
2. Preencha **Por quê / O quê / Critérios de aceite / Fora de escopo**.
3. Valide com um "ok", então implemente até os critérios de aceite.
4. Mantenha o spec atualizado se o escopo mudar.

Enxuto por design: se uma seção ficar vazia, apague-a.
`,

  "templates/spec.md": `# Spec: <título>

> Status: rascunho · Dono: <nome> · Atualizado: <aaaa-mm-dd>

## Por quê

Que problema estamos resolvendo, e para quem? Por que agora?

## O quê

A mudança em termos simples — o comportamento que o usuário vai realmente ver.

## Critérios de aceite

- [ ] Resultado observável 1
- [ ] Resultado observável 2

## Fora de escopo

- Coisas que explicitamente NÃO faremos aqui.

## Notas / dúvidas em aberto

- …
`,
};
