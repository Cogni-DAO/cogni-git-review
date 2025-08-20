/**
 * AI Rules Fixtures for Testing
 * 
 * Based on the actual .cogni/rules/goal-alignment.yaml structure
 */

// Valid rule fixture with threshold (matches actual goal-alignment.yaml)
export const VALID_RULE_WITH_THRESHOLD = {
  id: 'goal-alignment',
  schema_version: '0.1',
  blocking: true,
  'evaluation-statement': 'Does NOT Re-implement mature OSS tools or libraries.',
  'rule-schema-id': 'statement-alignment-evaluation',
  variables: ['pr_title', 'pr_body', 'diff_summary'],
  success_criteria: {
    metric: 'score',
    threshold: 0.85
  }
};

// Test rule fixture missing threshold field
export const RULE_MISSING_THRESHOLD = {
  id: 'goal-alignment',
  schema_version: '0.1',
  blocking: true,
  'evaluation-statement': 'Does NOT Re-implement mature OSS tools or libraries.',
  'rule-schema-id': 'statement-alignment-evaluation',
  variables: ['pr_title', 'pr_body', 'diff_summary'],
  success_criteria: {
    metric: 'score'
    // Missing threshold field
  }
};

// Test rule fixture missing entire success_criteria section
export const RULE_MISSING_SUCCESS_CRITERIA = {
  id: 'goal-alignment',
  schema_version: '0.1',
  blocking: true,
  'evaluation-statement': 'Does NOT Re-implement mature OSS tools or libraries.',
  'rule-schema-id': 'statement-alignment-evaluation',
  variables: ['pr_title', 'pr_body', 'diff_summary']
  // Missing success_criteria section entirely
};

// Test rule with different threshold for edge case testing
export const RULE_LOW_THRESHOLD = {
  id: 'goal-alignment',
  schema_version: '0.1',
  blocking: true,
  'evaluation-statement': 'Does NOT Re-implement mature OSS tools or libraries.',
  'rule-schema-id': 'statement-alignment-evaluation',
  variables: ['pr_title', 'pr_body', 'diff_summary'],
  success_criteria: {
    metric: 'score',
    threshold: 0.3  // Low threshold for testing pass conditions
  }
};

// Test rule with high threshold for edge case testing
export const RULE_HIGH_THRESHOLD = {
  id: 'goal-alignment',
  schema_version: '0.1',
  blocking: true,
  'evaluation-statement': 'Does NOT Re-implement mature OSS tools or libraries.',
  'rule-schema-id': 'statement-alignment-evaluation',
  variables: ['pr_title', 'pr_body', 'diff_summary'],
  success_criteria: {
    metric: 'score',
    threshold: 0.95  // High threshold for testing fail conditions
  }
};