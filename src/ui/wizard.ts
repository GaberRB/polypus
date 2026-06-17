import * as p from "@clack/prompts";
import pc from "picocolors";
import { AgentConfig, Locale, PermissionMode, ProviderKind, ToolMode } from "../core/config/schema.js";
import { configPath, loadConfig, saveConfig } from "../core/config/store.js";
import {
  DEFAULT_BASE_URL,
  REQUIRES_API_KEY,
  SUGGESTED_KEY_ENV,
} from "../core/providers/defaults.js";
import { listOllamaModels } from "../core/providers/ollama.js";
import {
  filterModels,
  fmtContext,
  fmtPrice,
  listOpenRouterModels,
  type ModelSort,
} from "../core/providers/openrouter.js";
import { LOCALE_NAMES, LOCALES, setLocale, t } from "../core/i18n/index.js";

function bail(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel(t("wizard.cancelled"));
    process.exit(0);
  }
}

/** Interactive onboarding: pick a language, configure agents, permissions, and a default. */
export async function runWizard(): Promise<void> {
  const config = await loadConfig();

  // Language first, so the rest of the wizard speaks the user's language.
  const locale = await p.select({
    message: "Interface language / Idioma da interface",
    options: LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] })),
    initialValue: config.locale,
  });
  bail(locale);
  config.locale = Locale.parse(locale);
  setLocale(config.locale);

  p.intro(pc.bgCyan(pc.black(t("wizard.title"))));
  p.note(t("wizard.intro"), t("wizard.welcome"));

  for (;;) {
    const agent = await promptAgent(config.agents.map((a) => a.name));
    config.agents.push(agent);

    const again = await p.confirm({ message: t("wizard.addAnother"), initialValue: false });
    bail(again);
    if (!again) break;
  }

  if (config.agents.length > 1) {
    const def = await p.select({
      message: t("wizard.defaultAgent"),
      options: config.agents.map((a) => ({ value: a.name, label: a.name })),
    });
    bail(def);
    config.defaultAgent = def as string;
  } else {
    config.defaultAgent = config.agents[0]?.name;
  }

  const mode = await p.select({
    message: t("wizard.permMode"),
    options: [
      { value: "review", label: t("wizard.permReview") },
      { value: "plan", label: t("wizard.permPlan") },
      { value: "bypass", label: t("wizard.permBypass") },
    ],
    initialValue: "review",
  });
  bail(mode);
  config.permissions.mode = PermissionMode.parse(mode);

  const allow = await p.text({
    message: t("wizard.allowPaths"),
    initialValue: config.permissions.allow.join(", "),
    placeholder: "**/*",
  });
  bail(allow);
  config.permissions.allow = String(allow)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await saveConfig(config);
  p.outro(pc.green(t("wizard.saved", { n: config.agents.length, path: configPath() })));
  console.log(pc.dim(t("wizard.next")));
}

/**
 * Interactively add a single agent and persist it (used by the REPL `/add`).
 * Returns the new agent's name, or undefined if cancelled.
 */
export async function addAgentInteractive(): Promise<string | undefined> {
  const config = await loadConfig();
  const agent = await promptAgent(config.agents.map((a) => a.name));
  config.agents.push(agent);
  if (!config.defaultAgent) config.defaultAgent = agent.name;
  await saveConfig(config);
  return agent.name;
}

async function promptAgent(existingNames: string[]): Promise<AgentConfig> {
  const provider = await p.select({
    message: t("wizard.provider"),
    options: [
      { value: "openrouter", label: t("wizard.providerOpenrouter") },
      { value: "ollama", label: t("wizard.providerOllama") },
      { value: "openai-compatible", label: t("wizard.providerCompatible") },
      { value: "anthropic", label: t("wizard.providerAnthropic") },
    ],
  });
  bail(provider);
  const providerKind = ProviderKind.parse(provider);

  const name = await p.text({
    message: t("wizard.agentName"),
    placeholder: providerKind,
    validate: (v) => {
      if (!v.trim()) return t("wizard.required");
      if (existingNames.includes(v.trim())) return t("wizard.nameTaken");
      return undefined;
    },
  });
  bail(name);

  const model = await promptModel(providerKind);

  let baseUrl = DEFAULT_BASE_URL[providerKind];
  if (providerKind === "openai-compatible") {
    const b = await p.text({
      message: t("wizard.baseUrl"),
      placeholder: "https://my-gateway.example.com/v1",
      validate: (v) => (v.trim() ? undefined : t("wizard.baseUrlRequired")),
    });
    bail(b);
    baseUrl = String(b).trim();
  }

  const apiKey = await promptApiKey(providerKind);

  const toolMode = await p.select({
    message: t("wizard.toolMode"),
    options: [
      { value: "auto", label: t("wizard.toolAuto") },
      { value: "native", label: t("wizard.toolNative") },
      { value: "emulated", label: t("wizard.toolEmulated") },
    ],
    initialValue: "auto",
  });
  bail(toolMode);

  return AgentConfig.parse({
    name: String(name).trim(),
    provider: providerKind,
    model: String(model).trim(),
    baseUrl,
    apiKey,
    toolMode: ToolMode.parse(toolMode),
  });
}

const OTHER = "__other__";
const REFILTER = "__refilter__";
const MANUAL = "__manual__";

/** Prompt for a model id. For Ollama, detect installed models and offer a picker. */
async function promptModel(provider: ProviderKind): Promise<string> {
  if (provider === "openrouter") {
    const picked = await browseOpenRouter();
    if (picked) return picked;
  }

  if (provider === "ollama") {
    const spin = p.spinner();
    spin.start(t("wizard.ollamaDetecting"));
    const models = await listOllamaModels();
    spin.stop(models.length ? t("wizard.ollamaFound", { n: models.length }) : t("wizard.ollamaNone"));

    if (models.length > 0) {
      const choice = await p.select({
        message: t("wizard.ollamaPick"),
        options: [
          ...models.map((m) => ({ value: m, label: m })),
          { value: OTHER, label: t("wizard.ollamaOther") },
        ],
      });
      bail(choice);
      if (choice !== OTHER) return choice as string;
    }
  }

  const placeholder =
    provider === "openrouter"
      ? "anthropic/claude-3.5-sonnet"
      : provider === "ollama"
        ? "llama3.1:8b"
        : provider === "anthropic"
          ? "claude-3-5-sonnet-latest"
          : "gpt-4o-mini";

  const model = await p.text({
    message: t("wizard.modelId"),
    placeholder,
    validate: (v) => (v.trim() ? undefined : t("wizard.required")),
  });
  bail(model);
  return String(model).trim();
}

/**
 * Interactive OpenRouter model browser: fetch the catalog, then loop over
 * search + filters + sort, showing a rich picker. Returns the chosen id, or
 * undefined to fall back to manual text entry.
 */
async function browseOpenRouter(): Promise<string | undefined> {
  const spin = p.spinner();
  spin.start(t("models.fetching"));
  let all;
  try {
    all = await listOpenRouterModels(process.env.OPENROUTER_API_KEY);
    spin.stop(t("models.shown", { shown: all.length, total: all.length }));
  } catch {
    spin.stop(t("wizard.orError"));
    return undefined;
  }

  for (;;) {
    const search = await p.text({ message: t("wizard.orSearch"), placeholder: "claude, qwen, gpt…" });
    bail(search);

    const flags = await p.multiselect({
      message: t("wizard.orFilters"),
      options: [
        { value: "tools", label: t("wizard.orToolsOnly") },
        { value: "free", label: t("wizard.orFreeOnly") },
      ],
      initialValues: ["tools"],
      required: false,
    });
    bail(flags);

    const sort = await p.select({
      message: t("wizard.orSort"),
      initialValue: "price",
      options: [
        { value: "price", label: t("wizard.orSortPrice") },
        { value: "price-desc", label: t("wizard.orSortPriceDesc") },
        { value: "context", label: t("wizard.orSortContext") },
        { value: "name", label: t("wizard.orSortName") },
      ],
    });
    bail(sort);

    const flagList = flags as string[];
    const results = filterModels(all, {
      search: String(search ?? ""),
      tools: flagList.includes("tools") ? "tools" : "any",
      freeOnly: flagList.includes("free"),
      sort: sort as ModelSort,
    });

    if (results.length === 0) {
      p.note(t("wizard.orNone"));
      continue;
    }

    const choice = await p.select({
      message: t("wizard.orPick", { n: results.length }),
      maxItems: 12,
      options: [
        ...results.slice(0, 40).map((m) => ({
          value: m.id,
          label: m.id,
          hint: `${fmtPrice(m.promptPrice)}/${fmtPrice(m.completionPrice)}${m.supportsTools ? " · 🛠" : ""} · ${fmtContext(m.contextLength)}`,
        })),
        { value: REFILTER, label: t("wizard.orRefilter") },
        { value: MANUAL, label: t("wizard.orManual") },
      ],
    });
    bail(choice);

    if (choice === REFILTER) continue;
    if (choice === MANUAL) return undefined;
    return choice as string;
  }
}

async function promptApiKey(provider: ProviderKind): Promise<string | undefined> {
  if (!REQUIRES_API_KEY[provider]) {
    const need = await p.confirm({
      message: t("wizard.keyNotNeeded", { provider }),
      initialValue: false,
    });
    bail(need);
    if (!need) return undefined;
  }

  const method = await p.select({
    message: t("wizard.apiKey"),
    options: [
      { value: "env", label: t("wizard.keyEnv") },
      { value: "inline", label: t("wizard.keyInline") },
      { value: "none", label: t("wizard.keySkip") },
    ],
    initialValue: "env",
  });
  bail(method);

  if (method === "none") return undefined;

  if (method === "env") {
    const envName = await p.text({
      message: t("wizard.envName"),
      initialValue: SUGGESTED_KEY_ENV[provider] ?? "OPENAI_API_KEY",
      validate: (v) => (/^[A-Z0-9_]+$/i.test(v.trim()) ? undefined : t("wizard.envInvalid")),
    });
    bail(envName);
    return `\${${String(envName).trim()}}`;
  }

  const key = await p.password({
    message: t("wizard.keyPrompt"),
    validate: (v) => (v.trim() ? undefined : t("wizard.required")),
  });
  bail(key);
  return String(key).trim();
}
