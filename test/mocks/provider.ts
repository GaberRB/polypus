import { Provider } from '../../src/core/providers/types';
import { vi } from 'vitest';

export const mockProvider: Provider = {
  chat: vi.fn().mockResolvedValue({
    content: 'health check response',
    toolCalls: [],
    finishReason: 'stop',
  }),
};