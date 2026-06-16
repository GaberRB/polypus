import * as p from "@clack/prompts";
import pc from "picocolors";
import { AgentConfig, PermissionMode, ProviderKind, ToolMode } from "../core/config/schema.js";
import { configPath, loadConfig, saveConfig } from "../core/config/store.js";
import {
  DEFAULT_BASE_URL,
  REQUIRES_API_KEY,
  SUGGESTED_KEY_ENV,
} from "../core/providers/defaults.js";

function bail(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
}

/** Interactive onboarding: configure one or more agents, permissions, and a default. */
export async function runWizard(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(" polypus setup ")));
  p.note(
    [
      "Polypus drives any AI API to read and write code in this kind of project.",
      "You can add several agents (different keys/models) and they can work in parallel.",
      "Tip: reference API keys via environment variables instead of pasting them here.",
    ].join("\n"),
    "Welcome",
  );

  const config = await loadConfig();

  for (;;) {
    const agent = await promptAgent(config.agents.map((a) => a.name));
    config.agents.push(agent);

    const again = await p.confirm({ message: "Add another agent?", initialValue: false });
    bail(again);
    if (!again) break;
  }

  // Choose a default when more than one agent exists.
  if (config.agents.length > 1) {
    const def = await p.select({
      message: "Default agent",
      options: config.agents.map((a) => ({ value: a.name, label: a.name })),
    });
    bail(def);
    config.defaultAgent = def as string;
  } else {
    config.defaultAgent = config.agents[0]?.name;
  }

  const mode = await p.select({
    message: "Default permission mode",
    options: [
      { value: "review", label: "review — confirm each file write / command (safe default)" },
      { value: "plan", label: "plan — read-only, propose changes" },
      { value: "bypass", label: "bypass — auto-approve everything (use with care)" },
    ],
    initialValue: "review",
  });
  bail(mode);
  config.permissions.mode = PermissionMode.parse(mode);

  const allow = await p.text({
    message: "Editable paths (comma-separated globs)",
    initialValue: config.permissions.allow.join(", "),
    placeholder: "**/*",
  });
  bail(allow);
  config.permissions.allow = String(allow)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await saveConfig(config);
  p.outro(pc.green(`Saved ${config.agents.length} agent(s) to ${configPath()}`));
  console.log(pc.dim("Run `polypus run \"your task\"` to start, or `polypus run` for an interactive session."));
}

async function promptAgent(existingNames: string[]): Promise<AgentConfig> {
  const provider = await p.select({
    message: "Provider",
    options: [
      { value: "openrouter", label: "OpenRouter (hosted, many models)" },
      { value: "ollama", label: "Ollama (local models)" },
      { value: "openai-compatible", label: "OpenAI-compatible (custom base URL)" },
      { value: "anthropic", label: "Anthropic (Claude)" },
    ],
  });
  bail(provider);
  const providerKind = ProviderKind.parse(provider);

  const name = await p.text({
    message: "Agent name",
    placeholder: providerKind,
    validate: (v) => {
      if (!v.trim()) return "Required";
      if (existingNames.includes(v.trim())) return "An agent with this name already exists";
      return undefined;
    },
  });
  bail(name);

  const model = await p.text({
    message: "Model id",
    placeholder:
      providerKind === "openrouter"
        ? "anthropic/claude-3.5-sonnet"
        : providerKind === "ollama"
          ? "llama3.1"
          : providerKind === "anthropic"
            ? "claude-3-5-sonnet-latest"
            : "gpt-4o-mini",
    validate: (v) => (v.trim() ? undefined : "Required"),
  });
  bail(model);

  // Base URL: required for openai-compatible, defaulted (overridable) otherwise.
  let baseUrl = DEFAULT_BASE_URL[providerKind];
  if (providerKind === "openai-compatible") {
    const b = await p.text({
      message: "Base URL",
      placeholder: "https://my-gateway.example.com/v1",
      validate: (v) => (v.trim() ? undefined : "Required for openai-compatible"),
    });
    bail(b);
    baseUrl = String(b).trim();
  }

  const apiKey = await promptApiKey(providerKind);

  const toolMode = await p.select({
    message: "Tool-calling mode",
    options: [
      { value: "auto", label: "auto — native for hosted, emulated for local (recommended)" },
      { value: "native", label: "native — provider function-calling" },
      { value: "emulated", label: "emulated — XML tool protocol in the prompt (works without tool support)" },
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

async function promptApiKey(provider: ProviderKind): Promise<string | undefined> {
  if (!REQUIRES_API_KEY[provider]) {
    const need = await p.confirm({
      message: `${provider} usually needs no API key. Add one anyway?`,
      initialValue: false,
    });
    bail(need);
    if (!need) return undefined;
  }

  const method = await p.select({
    message: "API key",
    options: [
      { value: "env", label: "Reference an environment variable (recommended)" },
      { value: "inline", label: "Enter it now (stored in the config file)" },
      { value: "none", label: "Skip for now" },
    ],
    initialValue: "env",
  });
  bail(method);

  if (method === "none") return undefined;

  if (method === "env") {
    const envName = await p.text({
      message: "Environment variable name",
      initialValue: SUGGESTED_KEY_ENV[provider] ?? "OPENAI_API_KEY",
      validate: (v) => (/^[A-Z0-9_]+$/i.test(v.trim()) ? undefined : "Use letters, digits, underscores"),
    });
    bail(envName);
    return `\${${String(envName).trim()}}`;
  }

  const key = await p.password({
    message: "API key (stored in plain text in the config file)",
    validate: (v) => (v.trim() ? undefined : "Required"),
  });
  bail(key);
  return String(key).trim();
}
