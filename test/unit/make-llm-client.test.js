/**
 * Unit tests for makeLLMClient function
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { makeLLMClient } from '../../src/ai/provider.js';

// Helper function to reduce duplication
function assertValidClient(result, expectedModel, expectedTempPolicy) {
  assert(typeof result === 'object');
  assert('client' in result);
  assert('meta' in result);
  
  // Verify meta
  assert.strictEqual(result.meta.model, expectedModel);
  assert.strictEqual(result.meta.tempPolicy, expectedTempPolicy);
  
  // Verify client is created
  assert(result.client);
  assert.strictEqual(typeof result.client.call, 'function');
}

describe('makeLLMClient', () => {
  
  describe('Temperature Policy', () => {
    it('applies temperature=0 for whitelisted models', () => {
      const deterministicModels = [
        'openai/gpt-4o-mini',
        'openai/gpt-4.1-mini'
      ];
      
      for (const model of deterministicModels) {
        const result = makeLLMClient({ model });
        assertValidClient(result, model, '0');
      }
    });

    it('omits temperature for non-whitelisted models', () => {
      const nonDeterministicModels = [
        'openai/gpt-5-2025-08-07',
        'o1-preview',
        'o3-mini'
      ];
      
      for (const model of nonDeterministicModels) {
        const result = makeLLMClient({ model });
        assertValidClient(result, model, 'default(omitted)');
      }
    });
  });

  describe('Error Handling', () => {
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
  });

  it('returns correct structure', () => {
    const result = makeLLMClient({ model: 'openai/gpt-4o-mini' });
    
    // Verify top-level structure
    assert(typeof result === 'object');
    assert('client' in result);
    assert('meta' in result);
    
    // Verify meta structure
    assert(typeof result.meta === 'object');
    assert('model' in result.meta);
    assert('tempPolicy' in result.meta);
    
    // Verify client type
    assert.strictEqual(typeof result.client, 'object');
  });
});