/**
 * P0 Tests for AI Rules Aggregator - Tri-state Logic Validation
 * 
 * Tests the critical aggregation logic: FAIL > NEUTRAL > PASS
 * This determines the final gate result from multiple rule evaluations.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';

// Mock the dependencies to isolate aggregation logic
const mockLoadRules = (rules) => ({ rules, diagnostics: [] });
const mockSelectApplicableRules = (rules) => rules;
const mockBuildEvidence = async () => ({ diff_summary: 'test diff', file_snippets: [] });
const mockEvaluateSingleRule = async (rule, verdict) => ({
  rule_key: rule.rule_key,
  verdict,
  violations: verdict === 'failure' ? [{ code: 'test_violation', message: 'Test failure' }] : [],
  observations: [],
  duration_ms: 100,
  blocking: rule.blocking,
  alignment_score: verdict === 'success' ? 0.8 : (verdict === 'failure' ? 0.2 : 0.5)
});

describe('AI Rules Aggregator - P0 Critical Tests', () => {

  // Helper to simulate the aggregation logic from ai-rules.js
  function aggregateRuleResults(ruleResults, loadDiagnostics = [], startTime = Date.now() - 1000) {
    let overallConclusion = 'success';
    const allViolations = [];
    const allObservations = [];
    const ruleSummaries = [];
    
    // Process each rule result
    for (const result of ruleResults) {
      // Collect violations and observations
      allViolations.push(...result.violations);
      allObservations.push(...result.observations);
      
      // Rule-level summary
      ruleSummaries.push(`${result.rule_key}: ${result.verdict.toUpperCase()} (${result.duration_ms}ms)`);
      
      // Apply tri-state aggregation logic
      if (result.verdict === 'failure' && result.blocking) {
        overallConclusion = 'failure'; // Blocking failure overrides everything
      } else if (result.verdict === 'failure' && overallConclusion === 'success') {
        overallConclusion = 'neutral'; // Non-blocking failure → neutral
      } else if (result.verdict === 'neutral' && overallConclusion === 'success') {
        overallConclusion = 'neutral'; // Neutral overrides success
      }
    }
    
    // Build summary text
    const passCount = ruleResults.filter(r => r.verdict === 'success').length;
    const failCount = ruleResults.filter(r => r.verdict === 'failure').length;
    const neutralCount = ruleResults.filter(r => r.verdict === 'neutral').length;
    
    let summary = `AI Rules: ${passCount} pass, ${failCount} fail, ${neutralCount} neutral`;
    
    return {
      id: 'ai_rules',
      conclusion: overallConclusion,
      title: 'AI Rules',
      summary,
      text: ruleSummaries.join('\n'),
      observations: allObservations.slice(0, 50), // Hard cap for GitHub
      duration_ms: Date.now() - startTime
    };
  }

  test('aggregator_tristate_precedence - FAIL > NEUTRAL > PASS logic works', async () => {
    // Test Case 1: All pass → SUCCESS
    const allPassResults = [
      await mockEvaluateSingleRule({ rule_key: 'rule1', blocking: true }, 'success'),
      await mockEvaluateSingleRule({ rule_key: 'rule2', blocking: false }, 'success')
    ];
    
    let aggregated = aggregateRuleResults(allPassResults);
    assert.strictEqual(aggregated.conclusion, 'success', 'All pass should result in SUCCESS');
    assert.ok(aggregated.summary.includes('2 pass, 0 fail, 0 neutral'), 'Summary should show pass counts');

    // Test Case 2: Blocking failure → FAILURE (overrides everything)
    const blockingFailResults = [
      await mockEvaluateSingleRule({ rule_key: 'rule1', blocking: true }, 'success'),
      await mockEvaluateSingleRule({ rule_key: 'rule2', blocking: true }, 'failure'), // Blocking failure
      await mockEvaluateSingleRule({ rule_key: 'rule3', blocking: false }, 'success')
    ];
    
    aggregated = aggregateRuleResults(blockingFailResults);
    assert.strictEqual(aggregated.conclusion, 'failure', 'Blocking failure should override success');
    assert.ok(aggregated.summary.includes('2 pass, 1 fail'), 'Summary should show failure count');

    // Test Case 3: Non-blocking failure → NEUTRAL  
    const nonBlockingFailResults = [
      await mockEvaluateSingleRule({ rule_key: 'rule1', blocking: false }, 'success'),
      await mockEvaluateSingleRule({ rule_key: 'rule2', blocking: false }, 'failure') // Non-blocking failure
    ];
    
    aggregated = aggregateRuleResults(nonBlockingFailResults);
    assert.strictEqual(aggregated.conclusion, 'neutral', 'Non-blocking failure should result in NEUTRAL');

    // Test Case 4: Neutral overrides success
    const neutralResults = [
      await mockEvaluateSingleRule({ rule_key: 'rule1', blocking: false }, 'success'),
      await mockEvaluateSingleRule({ rule_key: 'rule2', blocking: false }, 'neutral')
    ];
    
    aggregated = aggregateRuleResults(neutralResults);
    assert.strictEqual(aggregated.conclusion, 'neutral', 'Neutral should override success');
    assert.ok(aggregated.summary.includes('1 pass, 0 fail, 1 neutral'), 'Summary should show neutral count');
  });

  test('aggregator_blocking_vs_nonblocking - Blocking behavior works correctly', async () => {
    // Test Case: Multiple failures, blocking wins
    const mixedFailureResults = [
      await mockEvaluateSingleRule({ rule_key: 'non-blocking-fail', blocking: false }, 'failure'),
      await mockEvaluateSingleRule({ rule_key: 'blocking-fail', blocking: true }, 'failure'),
      await mockEvaluateSingleRule({ rule_key: 'success', blocking: true }, 'success')
    ];
    
    const aggregated = aggregateRuleResults(mixedFailureResults);
    assert.strictEqual(aggregated.conclusion, 'failure', 'Blocking failure should dominate');
    
    // Test Case: Only non-blocking failures → NEUTRAL
    const onlyNonBlockingResults = [
      await mockEvaluateSingleRule({ rule_key: 'fail1', blocking: false }, 'failure'),
      await mockEvaluateSingleRule({ rule_key: 'fail2', blocking: false }, 'failure'),
      await mockEvaluateSingleRule({ rule_key: 'success', blocking: false }, 'success')
    ];
    
    const aggregated2 = aggregateRuleResults(onlyNonBlockingResults);
    assert.strictEqual(aggregated2.conclusion, 'neutral', 'Multiple non-blocking failures should be NEUTRAL');
  });

  test('aggregator_complex_combinations - Real-world scenarios', async () => {
    // Scenario: Mix of all verdict types with different blocking settings
    const complexResults = [
      await mockEvaluateSingleRule({ rule_key: 'goal-check', blocking: true }, 'success'),      
      await mockEvaluateSingleRule({ rule_key: 'style-check', blocking: false }, 'failure'),     // Non-blocking fail
      await mockEvaluateSingleRule({ rule_key: 'security-check', blocking: true }, 'neutral'),   
      await mockEvaluateSingleRule({ rule_key: 'docs-check', blocking: false }, 'success'),      
      await mockEvaluateSingleRule({ rule_key: 'test-check', blocking: false }, 'neutral')       
    ];
    
    const aggregated = aggregateRuleResults(complexResults);
    
    // With non-blocking failure and neutrals, should be NEUTRAL (no blocking failures)
    assert.strictEqual(aggregated.conclusion, 'neutral', 'Complex mix should resolve correctly');
    assert.ok(aggregated.summary.includes('2 pass, 1 fail, 2 neutral'), 'Summary should have correct counts');
    
    // Verify rule summaries are included
    assert.ok(aggregated.text.includes('goal-check: SUCCESS'), 'Should include individual rule results');
    assert.ok(aggregated.text.includes('style-check: FAILURE'), 'Should include failure details');
  });

  test('aggregator_empty_results - Handle edge cases gracefully', async () => {
    // Empty results array
    const emptyResults = aggregateRuleResults([]);
    assert.strictEqual(emptyResults.conclusion, 'success', 'Empty results should default to SUCCESS');
    assert.ok(emptyResults.summary.includes('0 pass, 0 fail, 0 neutral'), 'Empty should show zero counts');
    
    // Single result cases
    const singleSuccess = aggregateRuleResults([
      await mockEvaluateSingleRule({ rule_key: 'only-rule', blocking: true }, 'success')
    ]);
    assert.strictEqual(singleSuccess.conclusion, 'success', 'Single success should be SUCCESS');
    
    const singleFailure = aggregateRuleResults([
      await mockEvaluateSingleRule({ rule_key: 'only-rule', blocking: true }, 'failure')
    ]);
    assert.strictEqual(singleFailure.conclusion, 'failure', 'Single blocking failure should be FAILURE');
  });
});