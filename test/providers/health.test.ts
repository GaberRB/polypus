import { testConnection } from '../../src/core/providers/health';
import { AgentConfig } from '../../src/core/config/schema';
import { mockProvider } from '../mocks/provider';
import { describe, it, expect, vi } from 'vitest';
import * as registry from '../../src/core/providers/registry';

describe('testConnection', () => {
  it('should return ok: true for a successful connection', async () => {
    const mockAgent: AgentConfig = {
      provider: 'mock',
      model: 'mock-model',
      baseUrl: 'http://mock.url'
    };
    
    // Mock the createProvider function to return our mock provider
    vi.spyOn(registry, 'createProvider').mockReturnValue({
      config: mockAgent,
      provider: mockProvider,
      toolMode: 'native'
    });
    
    // Mock successful connection with the expected response structure
    vi.spyOn(mockProvider, 'chat').mockResolvedValue({
      content: 'health check response',
      toolCalls: [],
      finishReason: 'stop'
    });
    
    const result = await testConnection(mockAgent);
    expect(result.ok).toBe(true);
    expect(result.message).toBe('Connection successful');
  });

  it('should return ok: false with error message for a failed connection', async () => {
    const mockAgent: AgentConfig = {
      provider: 'mock',
      model: 'mock-model',
      baseUrl: 'http://mock.url'
    };
    
    // Mock the createProvider function to return our mock provider
    vi.spyOn(registry, 'createProvider').mockReturnValue({
      config: mockAgent,
      provider: mockProvider,
      toolMode: 'native'
    });
    
    // Mock a provider that throws an error
    vi.spyOn(mockProvider, 'chat').mockRejectedValue(new Error('Connection failed'));
    
    const result = await testConnection(mockAgent);
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Connection failed');
  });
});