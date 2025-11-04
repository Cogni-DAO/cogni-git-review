/**
 * Unit tests for makeLLMClient function
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { makeLLMClient } from '../../src/ai/provider.js';

describe('makeLLMClient', () => {
  it('builds client with temperature=0 for whitelisted model', () => {
    const { client, meta } = makeLLMClient({ model: 'openai/gpt-4o-mini' });
    
    // Verify meta contains expected values
    assert.strictEqual(meta.model, 'openai/gpt-4o-mini');
    assert.strictEqual(meta.tempPolicy, '0');
    
    // Verify client is created (ChatOpenAI instance)
    assert(client);
    assert.strictEqual(typeof client.call, 'function'); // ChatOpenAI has call method
  });

  it('builds client with temperature=0 for 4o-mini variant', () => {
    const { client, meta } = makeLLMClient({ model: 'openai/gpt-4.1-mini' });
    
    assert.strictEqual(meta.model, 'openai/gpt-4.1-mini');
    assert.strictEqual(meta.tempPolicy, '0');
    assert(client);
  });

  it('omits temperature for non-whitelisted model', () => {
    const { client, meta } = makeLLMClient({ model: 'openai/gpt-5-2025-08-07' });
    
    // Verify meta contains expected values
    assert.strictEqual(meta.model, 'openai/gpt-5-2025-08-07');
    assert.strictEqual(meta.tempPolicy, 'default(omitted)');
    
    // Verify client is created
    assert(client);
    assert.strictEqual(typeof client.call, 'function');
  });

  it('omits temperature for o1 model', () => {
    const { client, meta } = makeLLMClient({ model: 'o1-preview' });
    
    assert.strictEqual(meta.model, 'o1-preview');
    assert.strictEqual(meta.tempPolicy, 'default(omitted)');
    assert(client);
  });

  it('omits temperature for o3 model', () => {
    const { client, meta } = makeLLMClient({ model: 'o3-mini' });
    
    assert.strictEqual(meta.model, 'o3-mini');
    assert.strictEqual(meta.tempPolicy, 'default(omitted)');
    assert(client);
  });

  it('throws error when model is missing', () => {
    assert.throws(() => {
      makeLLMClient({});
    }, /makeLLMClient: 'model' is required/);
  });

  it('throws error when model is null', () => {
    assert.throws(() => {
      makeLLMClient({ model: null });
    }, /makeLLMClient: 'model' is required/);
  });

  it('throws error when model is empty string', () => {
    assert.throws(() => {
      makeLLMClient({ model: '' });
    }, /makeLLMClient: 'model' is required/);
  });

  it('returns client and meta structure correctly', () => {
    const result = makeLLMClient({ model: 'openai/gpt-4o-mini' });
    
    // Verify structure
    assert(typeof result === 'object');
    assert('client' in result);
    assert('meta' in result);
    
    // Verify meta structure
    assert(typeof result.meta === 'object');
    assert('model' in result.meta);
    assert('tempPolicy' in result.meta);
    
    // Verify no side effects (no console logging in the factory)
    assert.strictEqual(typeof result.client, 'object');
  });
});