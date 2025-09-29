/**
 * Registry Testing Design
 * 
 * Tests the workflow registry functionality to ensure proper dispatch
 * and error handling without relying on backward compatibility.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getWorkflow, WORKFLOWS } from '../../src/ai/workflows/registry.js';

describe('Workflow Registry Unit Tests', () => {

  test('registry routes to correct workflow functions', () => {
    // Test that registry returns the stub workflow function
    const evalFunc = getWorkflow('stub-repo-goal-alignment');
    assert(typeof evalFunc === 'function', 'Should return a function');
    
    // Don't call it - just verify the registry returns the correct function
    // The actual workflow execution is tested elsewhere with proper fixtures
  });

  test('registry discovery returns single-statement-evaluation workflow', () => {
    const evalFunc = getWorkflow('single-statement-evaluation');
    assert(typeof evalFunc === 'function', 'Should return a function for single-statement-evaluation');
  });

  test('multi-workflow support returns different workflows', () => {
    const stubFunc = getWorkflow('stub-repo-goal-alignment');
    const singleFunc = getWorkflow('single-statement-evaluation');
    
    // Both should be functions but different implementations
    assert(typeof stubFunc === 'function', 'Stub should be function');
    assert(typeof singleFunc === 'function', 'Single should be function');
    assert(stubFunc !== singleFunc, 'Should return different workflow functions');
  });

  test('error handling for nonexistent workflow throws proper error', () => {
    assert.throws(
      () => getWorkflow('nonexistent-workflow'),
      /Unknown workflowId: nonexistent-workflow/,
      'Should throw error with workflowId in message'
    );
  });

  test('error handling includes workflowId in error message', () => {
    try {
      getWorkflow('invalid-test-workflow');
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert(error.message.includes('invalid-test-workflow'), 'Error message should include the workflowId');
      assert(error.message.includes('Unknown workflowId'), 'Error message should indicate unknown workflow');
    }
  });

  test('WORKFLOWS object immutability prevents modification', () => {
    // Verify object is frozen
    assert(Object.isFrozen(WORKFLOWS), 'WORKFLOWS object should be frozen');
    
    // Attempt to modify should fail silently or throw in strict mode
    const originalLength = Object.keys(WORKFLOWS).length;
    
    try {
      WORKFLOWS.newWorkflow = () => {};
      // In non-strict mode, this fails silently
      assert.strictEqual(
        Object.keys(WORKFLOWS).length, 
        originalLength, 
        'Should not be able to add new workflows'
      );
    } catch (error) {
      // In strict mode, this throws - both outcomes are acceptable
      assert(error instanceof TypeError, 'Should throw TypeError when trying to modify frozen object');
    }
  });

  test('registry contains expected workflow IDs', () => {
    const workflowIds = Object.keys(WORKFLOWS);
    
    // Verify expected workflows are present
    assert(workflowIds.includes('single-statement-evaluation'), 'Should contain single-statement-evaluation');
    assert(workflowIds.includes('stub-repo-goal-alignment'), 'Should contain stub-repo-goal-alignment');
    
    // Verify it's not empty
    assert(workflowIds.length > 0, 'Should contain at least one workflow');
  });

  test('provider integration routes through registry correctly', () => {
    // Test that provider can get workflow from registry
    // Don't actually call the provider - just verify registry lookup works
    
    // Test with known workflow IDs that should exist
    const stubFunc = getWorkflow('stub-repo-goal-alignment');
    const singleFunc = getWorkflow('single-statement-evaluation');
    
    assert(typeof stubFunc === 'function', 'Provider should be able to get stub workflow from registry');
    assert(typeof singleFunc === 'function', 'Provider should be able to get single-statement workflow from registry');
  });

});