import type { AgentConfig } from '../config/schema.js';
import { createProvider } from './registry.js';


export async function testConnection(
  agent: AgentConfig
): Promise<{ ok: boolean; message: string }> {
  try {
    const provider = await createProvider(agent);
    // Make a minimal call to test the connection
    await provider.provider.chat({
      messages: [{ role: 'user', content: 'health check' }],
      params: { maxTokens: 1 },
    });
    return { ok: true, message: 'Connection successful' };
  } catch (error) {
    return {
      ok: false,
      message: 'Connection failed',
    };
  }
}
