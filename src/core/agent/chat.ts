import type { AgentConfig } from "../config/schema.js";
import { createProvider } from "../providers/registry.js";
import type { Message } from "../providers/types.js";

/**
 * One-shot chat with an agent's model and no tools — for plain conversation
 * surfaces (e.g. the Cowork "Chat" tab, where nothing touches the filesystem).
 * Returns the assistant's text. Streaming and tools are intentionally omitted.
 */
export async function chatOnce(
  agent: AgentConfig,
  messages: Message[],
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const { provider } = createProvider(agent);
  const res = await provider.chat({
    messages,
    params: { temperature: opts.temperature, maxTokens: opts.maxTokens },
    signal: opts.signal,
  });
  return res.content;
}
