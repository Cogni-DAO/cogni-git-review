/**
 * AI Rules Fixtures for Testing
 * 
 * Based on the actual .cogni/rules/*.yaml structures
 */

// Valid rule fixture with threshold)
export const VALID_RULE_WITH_THRESHOLD = {
  id: 'dont-rebuild-oss',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'single-statement-evaluation',
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
  id: 'dont-rebuild-oss',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'single-statement-evaluation',
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
  id: 'dont-rebuild-oss',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'single-statement-evaluation',
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
  workflow_id: 'single-statement-evaluation',
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
  id: 'dont-rebuild-oss',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'single-statement-evaluation',
  'evaluation-statement': 'Does NOT Re-implement mature OSS tools or libraries.',
  'rule-schema-id': 'statement-alignment-evaluation',
  variables: ['pr_title', 'pr_body', 'diff_summary'],
  success_criteria: {
    metric: 'score',
    threshold: 0.95  // High threshold for testing fail conditions
  }
};

// Mock rule for dont-rebuild-oss.yaml
export const DONT_REBUILD_OSS_RULE = {
  id: 'dont-rebuild-oss',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'single-statement-evaluation',
  'evaluation-statement': 'Does NOT Re-implement mature OSS tools or libraries.',
  'rule-schema-id': 'statement-alignment-evaluation',
  variables: ['pr_title', 'pr_body', 'diff_summary'],
  success_criteria: {
    metric: 'score',
    threshold: 0.8
  }
};

// Mock rule for single-check-pr-verdict.yaml
export const SINGLE_CHECK_PR_VERDICT_RULE = {
  id: 'single-check-pr-verdict',
  schema_version: '0.2',
  blocking: true,
  workflow_id: 'single-statement-evaluation',
  'evaluation-statement': "The repo does not deviate from its goal: a single AI-powered Pass/Fail/Neutral verdict on each pull request, derived from potentially multiple rule gates.",
  variables: ['pr_title', 'pr_body', 'diff_summary'],
  success_criteria: {
    metric: 'score',
    threshold: 0.9
  }
};