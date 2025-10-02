/**
 * Model Selector Tests
 * 
 * Tests environment-based model selection behavior
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { selectModel } from '../../src/ai/model-selector.js';

describe('Model Selector', () => {
  
  describe('Current Environment', () => {
    
    it('should return valid model configuration', () => {
      const result = selectModel();
      
      // Verify structure
      assert(typeof result === 'object');
      assert(typeof result.environment === 'string');
      assert(typeof result.model === 'string');
      assert(typeof result.provider === 'string');
      assert(typeof result.audit === 'object');
      
      // Verify valid environment
      assert(['dev', 'preview', 'prod'].includes(result.environment));
      
      // Verify provider
      assert.strictEqual(result.provider, 'openai');
      
      // Verify audit structure
      assert(typeof result.audit.source === 'string');
      assert(typeof result.audit.detectionMs === 'number');
      assert(result.audit.detectionMs >= 0);
    });
    
    it('should select appropriate model for environment', () => {
      const result = selectModel();
      
      if (result.environment === 'dev') {
        assert.strictEqual(result.model, 'gpt-4o-mini');
      } else if (result.environment === 'preview' || result.environment === 'prod') {
        assert.strictEqual(result.model, 'gpt-5-2025-08-07');
      }
    });
    
    it('should include timing information', () => {
      const result = selectModel();
      
      assert(typeof result.audit.detectionMs === 'number');
      assert(result.audit.detectionMs >= 0);
      assert(result.audit.detectionMs < 1000); // Should be fast
    });
    
    it('should have built-in-defaults audit source', () => {
      const result = selectModel();
      
      assert.strictEqual(result.audit.source, 'built-in-defaults');
    });
    
  });
  
});