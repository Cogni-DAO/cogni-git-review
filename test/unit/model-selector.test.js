/**
 * Model Selector Tests
 * 
 * Tests environment-based model selection behavior
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { selectModel } from '../../src/ai/model-selector.js';

describe('Model Selector', () => {
  
  describe('Environment Detection', () => {
    
    it('should select gpt-4o-mini for dev environment (default)', () => {
      const context = {
        env: {} // No APP_ENV configured
      };
      
      const result = selectModel(context);
      
      assert.strictEqual(result.environment, 'dev');
      assert.strictEqual(result.model, 'gpt-4o-mini');
      assert.strictEqual(result.provider, 'openai');
      assert.strictEqual(result.audit.source, 'built-in-defaults');
    });
    
    it('should select gpt-5-2025-08-07 for preview environment', () => {
      const context = {
        env: { APP_ENV: 'preview' }
      };
      
      const result = selectModel(context);
      
      assert.strictEqual(result.environment, 'preview');
      assert.strictEqual(result.model, 'gpt-5-2025-08-07');
      assert.strictEqual(result.provider, 'openai');
      assert.strictEqual(result.audit.context.appEnv, 'preview');
    });
    
    it('should select gpt-5-2025-08-07 for prod environment', () => {
      const context = {
        env: { APP_ENV: 'prod' }
      };
      
      const result = selectModel(context);
      
      assert.strictEqual(result.environment, 'prod');
      assert.strictEqual(result.model, 'gpt-5-2025-08-07');
      assert.strictEqual(result.provider, 'openai');
      assert.strictEqual(result.audit.context.appEnv, 'prod');
    });
    
    it('should select gpt-5-2025-08-07 for production environment (alias)', () => {
      const context = {
        env: { APP_ENV: 'production' }
      };
      
      const result = selectModel(context);
      
      assert.strictEqual(result.environment, 'prod');
      assert.strictEqual(result.model, 'gpt-5-2025-08-07');
      assert.strictEqual(result.provider, 'openai');
      assert.strictEqual(result.audit.context.appEnv, 'production');
    });
    
    it('should default to dev for unknown APP_ENV values', () => {
      const context = {
        env: { APP_ENV: 'staging' }
      };
      
      const result = selectModel(context);
      
      assert.strictEqual(result.environment, 'dev');
      assert.strictEqual(result.model, 'gpt-4o-mini');
      assert.strictEqual(result.provider, 'openai');
    });
    
  });
  
  describe('Error Handling', () => {
    
    it('should fallback to dev on invalid context', () => {
      const context = null;
      
      const result = selectModel(context);
      
      assert.strictEqual(result.environment, 'dev');
      assert.strictEqual(result.model, 'gpt-4o-mini');
      assert.strictEqual(result.provider, 'openai');
      assert.strictEqual(result.audit.source, 'fallback-on-error');
      assert(result.audit.error);
    });
    
    it('should include timing information in audit', () => {
      const context = {
        env: { APP_ENV: 'preview' }
      };
      
      const result = selectModel(context);
      
      assert(typeof result.audit.detectionMs === 'number');
      assert(result.audit.detectionMs >= 0);
    });
    
  });
  
});