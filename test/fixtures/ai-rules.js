/**
 * AI Rules Fixtures for Testing
 * 
 * Based on the actual .cogni/rules/*.yaml structures
 */

// Valid rule fixture with threshold)
export const VALID_RULE_WITH_THRESHOLD = {
  id: 'goal-alignment',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'goal-evaluations',
  'evaluation-statement': 'Does NOT Re-implement mature OSS tools or libraries.',
  'rule-schema-id': 'statement-alignment-evaluation',
  variables: ['pr_title', 'pr_body', 'diff_summary'],
  success_criteria: {
    require: [
      { metric: 'score', gte: 0.85 }
    ]
  }
};

// Test rule fixture with empty success_criteria (should fail schema validation)
export const RULE_MISSING_THRESHOLD = {
  id: 'dont-rebuild-oss',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'goal-evaluations',
  'evaluation-statement': 'Does NOT Re-implement mature OSS tools or libraries.',
  success_criteria: {
    // Empty criteria - violates anyOf requirement for require/any_of
  }
};

// Test rule fixture missing entire success_criteria section
export const RULE_MISSING_SUCCESS_CRITERIA = {
  id: 'dont-rebuild-oss',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'goal-evaluations',
  'evaluation-statement': 'Does NOT Re-implement mature OSS tools or libraries.',
  'rule-schema-id': 'statement-alignment-evaluation',
  variables: ['pr_title', 'pr_body', 'diff_summary']
  // Missing success_criteria section entirely
};

// Test rule with different threshold for edge case testing
export const RULE_LOW_THRESHOLD = {
  id: 'dont-rebuild-oss',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'goal-evaluations',
  'evaluation-statement': 'Does NOT Re-implement mature OSS tools or libraries.',
  'rule-schema-id': 'statement-alignment-evaluation',
  variables: ['pr_title', 'pr_body', 'diff_summary'],
  success_criteria: {
    require: [
      { metric: 'score', gte: 0.3 }  // Low threshold for testing pass conditions
    ]
  }
};

// Test rule with high threshold for edge case testing
export const RULE_HIGH_THRESHOLD = {
  id: 'dont-rebuild-oss',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'goal-evaluations',
  'evaluation-statement': 'Does NOT Re-implement mature OSS tools or libraries.',
  'rule-schema-id': 'statement-alignment-evaluation',
  variables: ['pr_title', 'pr_body', 'diff_summary'],
  success_criteria: {
    require: [
      { metric: 'score', gte: 0.95 }  // High threshold for testing fail conditions
    ]
  }
};

// Mock rule for dont-rebuild-oss.yaml
export const DONT_REBUILD_OSS_RULE = {
  id: 'dont-rebuild-oss',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'goal-evaluations',
  'evaluation-statement': 'Does NOT Re-implement mature OSS tools or libraries.',
  'rule-schema-id': 'statement-alignment-evaluation',
  variables: ['pr_title', 'pr_body', 'diff_summary'],
  success_criteria: {
    require: [
      { metric: 'score', gte: 0.8 }
    ]
  }
};

// Mock rule for single-check-pr-verdict.yaml
export const SINGLE_CHECK_PR_VERDICT_RULE = {
  id: 'single-check-pr-verdict',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'goal-evaluations',
  'evaluation-statement': "The repo does not deviate from its goal: a single AI-powered Pass/Fail/Neutral verdict on each pull request, derived from potentially multiple rule gates.",
  variables: ['pr_title', 'pr_body', 'diff_summary'],
  success_criteria: {
    require: [
      { metric: 'score', gte: 0.9 }
    ]
  }
};

// Matrix-format rule fixtures for new implementation
export const MATRIX_RULE_BASIC = {
  id: 'matrix-test-rule',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'goal-evaluations',
  'evaluation-statement': 'Test matrix evaluation',
  variables: ['pr_title', 'pr_body', 'diff_summary'],
  success_criteria: {
    neutral_on_missing_metrics: true,
    require: [
      { metric: 'score', gte: 0.8 }
    ]
  }
};

export const MATRIX_RULE_MULTI_METRIC = {
  id: 'matrix-multi-test',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'repo-goal-alignment',
  'evaluation-statement': 'Test multi-metric matrix evaluation',
  variables: ['pr_title', 'pr_body', 'diff_summary', 'goals', 'non_goals'],
  success_criteria: {
    neutral_on_missing_metrics: false,
    require: [
      { metric: 'goal_alignment', gte: 0.7 },
      { metric: 'non_goal_conflict', lte: 0.3 }
    ],
    any_of: [
      { metric: 'user_value', gte: 0.6 }
    ]
  }
};

// Mock AI Gate Result Fixtures for Testing
// These can be reused across tests that need structured AI gate results

/**
 * Create a mock AI gate result with structured format
 * @param {Object} options - Configuration options
 * @param {string} options.id - Gate ID (default: 'dont-rebuild-oss')
 * @param {string} options.status - Gate status (default: 'pass')
 * @param {number} options.score - Score value (default: 0.85)
 * @param {number} options.threshold - Threshold value (default: 0.8)
 * @param {string} options.model - Model name (default: 'gpt-4o-mini')
 * @param {string} options.provider - Provider name (default: 'openai')
 * @returns {Object} Mock gate result with structured format
 */
export function createMockAIGateResult({
  id = 'dont-rebuild-oss',
  status = 'pass',
  score = 0.85,
  threshold = 0.8,
  model = 'gpt-4o-mini',
  provider = 'openai',
  observations = ['Code looks good']
} = {}) {
  return {
    id,
    status,
    provenance: {
      runId: 'ai-12345-test',
      durationMs: 1500,
      providerVersion: '1.0.0',
      modelConfig: {
        provider,
        model,
        apiVersion: '2024-02-15-preview'
      }
    },
    providerResult: { 
      metrics: { 
        score: { 
          value: score, 
          observations: observations.slice(0, 3) 
        } 
      }
    },
    rule: { 
      success_criteria: { 
        require: [{ metric: 'score', gte: threshold }] 
      } 
    },
    observations,
    violations: []
  };
}

// Pre-configured mock results for common test scenarios
export const MOCK_AI_GATE_PASS = createMockAIGateResult();
export const MOCK_AI_GATE_FAIL = createMockAIGateResult({
  status: 'fail',
  score: 0.6,
  threshold: 0.7,
  observations: ['Issues found']
});
export const MOCK_AI_GATE_DIFFERENT_MODEL = createMockAIGateResult({
  model: 'gpt-5-2025-08-07',
  observations: ['Analysis complete']
});