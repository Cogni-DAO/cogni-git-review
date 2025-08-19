// Test fixtures for repository specifications

export const SPEC_FIXTURES = {
  // Valid minimal spec - list-of-gates format
  minimal: `schema_version: '0.2.1'

intent:
  name: minimal-project
  goals:
    - Basic project functionality
  non_goals:
    - Complex features

gates:
  - id: review_limits
    with:
      max_changed_files: 100
      max_total_diff_kb: 500`,

  // Valid full spec with all gates enabled
  full: `schema_version: '0.2.1'

intent:
  name: full-project
  goals:
    - Primary goal of the project
    - Secondary goal
  non_goals:
    - What this project does not do

gates:
  - id: review_limits
    with:
      max_changed_files: 50
      max_total_diff_kb: 200
  - id: goal_declaration
  - id: forbidden_scopes`,


  // Bootstrap mode spec - for gradual rollout
  bootstrap: `schema_version: '0.2.1'

intent:
  name: bootstrap-project
  goals:
    - Project in bootstrap mode for safe rollout
  non_goals:
    - Heavy validation during initial rollout

gates:
  review_limits:
    max_changed_files: 100
    max_total_diff_kb: 500`,

  // Advisory mode spec - for testing
  advisory: `schema_version: '0.2.1'

intent:
  name: advisory-project
  goals:
    - Project in advisory mode for evaluation
  non_goals:
    - Blocking enforcement during testing

gates:
  review_limits:
    max_changed_files: 100
    max_total_diff_kb: 500`,

  // Custom check name spec
  customName: `schema_version: '0.2.1'

intent:
  name: custom-check-project
  goals:
    - Project with custom check name
  non_goals:
    - Default naming conventions

gates:
  review_limits:
    max_changed_files: 100
    max_total_diff_kb: 500`,

  // Invalid YAML - malformed syntax
  invalidYaml: `intent:
  name: broken
  invalid: [unclosed array
gates:
  mode: invalid`,

  // Invalid structure - missing required sections  
  invalidStructure: `name: project-without-required-sections
description: This is missing intent and gates sections
random_field: value`,

  // Empty file
  empty: ``,

  // Only intent, missing gates
  missingGates: `schema_version: '0.2.1'

intent:
  name: incomplete-project
  goals:
    - Missing gates section`,

  // Only gates, missing intent
  missingIntent: `schema_version: '0.2.1'

gates:
  review_limits:
    max_changed_files: 100
    max_total_diff_kb: 500`,

  // Behavior contract test fixtures
  behaviorTest30_100: `schema_version: '0.2.1'

intent:
  name: behavior-test-project
  goals:
    - Test behavior contract
  non_goals:
    - Complex features

gates:
  - id: review_limits
    with:
      max_changed_files: 30
      max_total_diff_kb: 100
  - id: goal_declaration
  - id: forbidden_scopes`,

  behaviorTest10_50: `schema_version: '0.2.1'

intent:
  name: behavior-test-project
  goals:
    - Test behavior contract with lower limits
  non_goals:
    - Complex features

gates:
  - id: review_limits
    with:
      max_changed_files: 10
      max_total_diff_kb: 50`,

  // Gate consistency test fixtures - for testing "presence = enabled" semantics
  gateConsistency1Gate: `schema_version: '0.2.1'

intent:
  name: single-gate-project
  goals:
    - Test single gate execution
  non_goals:
    - Multiple gates

gates:
  - id: review_limits
    with:
      max_changed_files: 30
      max_total_diff_kb: 100`,

  gateConsistency2Gates: `schema_version: '0.2.1'

intent:
  name: two-gate-project
  goals:
    - Test two gates execution
  non_goals:
    - Complete gate coverage

gates:
  - id: review_limits
    with:
      max_changed_files: 30
      max_total_diff_kb: 100
  - id: goal_declaration`,

  gateConsistency3Gates: `schema_version: '0.2.1'

intent:
  name: all-gates-project
  goals:
    - Test all three gates execution
  non_goals:
    - Partial gate coverage

gates:
  - id: review_limits
    with:
      max_changed_files: 30
      max_total_diff_kb: 100
  - id: goal_declaration
  - id: forbidden_scopes`,

  gateConsistency2GatesNoLimits: `schema_version: '0.2.1'

intent:
  name: no-limits-project
  goals:
    - Test gates without review_limits
  non_goals:
    - File or size limits

gates:
  - id: goal_declaration
  - id: forbidden_scopes`,

  // Legacy spec format (from main branch) - v0.2.1 with object-style gates
  // This should result in 0 gates running because dynamic registry can't discover gates
  legacy: `schema_version: '0.2.1'

intent:
  name: cogni-git-review
  goals:
    - Automated PR hygiene checks with essential file restrictions
    - Single required check aggregating multiple validation signals
  non_goals:
    - Heavy in-process scanning or AI analysis
    - Secrets retention or external tool integration

gates:
  review_limits:
    max_changed_files: 40
    max_total_diff_kb: 1500`,

  // AI Rules integration test spec
  aiRulesIntegration: `schema_version: '0.2.1'

intent:
  name: ai-rules-test-project
  goals:
    - Build secure authentication system
    - Maintain good documentation
  non_goals:
    - Complex legacy integration
    - Unsecured endpoints

gates:
  - id: ai_rules
    with:
      rules_dir: .cogni/rules
      enable: [goal-alignment.yaml]
      model: gpt-4o-mini
      timeout_ms: 90000
      neutral_on_error: true
      blocking_default: true
      snippet_window: 20`,

  // AI Rules with non-existent rule (for testing zero valid rules)
  aiRulesNoValidRules: `schema_version: '0.2.1'

intent:
  name: ai-rules-no-rules-project
  goals:
    - Test zero valid rules handling
  non_goals:
    - Any rules that actually exist

gates:
  - id: ai_rules
    with:
      rules_dir: .cogni/rules
      enable: [nonexistent-rule.yaml]
      model: gpt-4o-mini
      timeout_ms: 90000
      neutral_on_error: true
      blocking_default: true`,

  // AI Rules with invalid directory (for error handling)
  aiRulesInvalidDir: `schema_version: '0.2.1'

intent:
  name: ai-rules-invalid-dir-project  
  goals:
    - Test error handling
  non_goals:
    - Working directories

gates:
  - id: ai_rules
    with:
      rules_dir: /does/not/exist
      enable: [goal-alignment.yaml]
      model: gpt-4o-mini
      timeout_ms: 90000
      neutral_on_error: true
      blocking_default: true`,

  // MVP Rules Gate test spec (uses 'rules' gate id)
  rulesMvpIntegration: `schema_version: '0.2.1'

intent:
  name: rules-mvp-test-project
  goals:
    - Build secure authentication system
    - Maintain good documentation
  non_goals:
    - Complex legacy integration
    - Unsecured endpoints

gates:
  - id: rules
    with:
      engine: ai
      rules_dir: .cogni/rules
      enable: [goal-alignment.yaml]
      model: gpt-4o-mini
      timeout_ms: 60000
      neutral_on_error: true
      blocking_default: true`,

  // MVP Rules Gate with no valid rules
  rulesMvpNoValidRules: `schema_version: '0.2.1'

intent:
  name: rules-mvp-no-rules-project
  goals:
    - Test zero valid rules handling
  non_goals:
    - Any rules that actually exist

gates:
  - id: rules
    with:
      engine: ai
      rules_dir: .cogni/rules
      enable: [nonexistent-rule.yaml]
      model: gpt-4o-mini
      timeout_ms: 60000
      neutral_on_error: true
      blocking_default: true`,

  // MVP Rules Gate with invalid directory (for error handling)
  rulesMvpInvalidDir: `schema_version: '0.2.1'

intent:
  name: rules-mvp-invalid-dir-project
  goals:
    - Test error handling
  non_goals:
    - Working directories

gates:
  - id: rules
    with:
      rules_dir: /does/not/exist
      enable: [goal-alignment.yaml]`
};

// Helper for accessing specs by key  
export const MINIMAL_VALID_SPEC = SPEC_FIXTURES;

// Expected parsed results for valid specs
export const EXPECTED_SPECS = {
  minimal: {
    schema_version: '0.2.1',
    intent: {
      name: 'minimal-project',
      goals: ['Basic project functionality'],
      non_goals: ['Complex features']
    },
    gates: [
      {
        id: 'review_limits',
        with: { max_changed_files: 100, max_total_diff_kb: 500 }
      }
    ]
  },

  full: {
    schema_version: '0.2.1',
    intent: {
      name: 'full-project',
      goals: ['Primary goal of the project', 'Secondary goal'],
      non_goals: ['What this project does not do']
    },
    gates: [
      {
        id: 'review_limits',
        with: { max_changed_files: 50, max_total_diff_kb: 200 }
      },
      { id: 'goal_declaration' },
      { id: 'forbidden_scopes' }
    ]
  }
};

// Mock context factory
export function createMockContext(owner = "test-org", repo = "test-repo", mockBehavior = "success") {
  const context = {
    repo: () => ({ owner, repo }),
    octokit: {
      repos: {
        getContent: null // Will be set by mockBehavior
      }
    }
  };

  switch (mockBehavior) {
    case "success":
      context.octokit.repos.getContent = async () => ({
        data: {
          type: "file",
          content: Buffer.from(SPEC_FIXTURES.minimal).toString('base64'),
          encoding: "base64"
        }
      });
      break;
      
    case "not_found":
      context.octokit.repos.getContent = async () => {
        const error = new Error("Not Found");
        error.status = 404;
        throw error;
      };
      break;
      
    case "invalid_yaml":
      context.octokit.repos.getContent = async () => ({
        data: {
          type: "file", 
          content: Buffer.from(SPEC_FIXTURES.invalidYaml).toString('base64'),
          encoding: "base64"
        }
      });
      break;
      
    case "directory":
      context.octokit.repos.getContent = async () => ({
        data: {
          type: "dir",
          name: "repo-spec.yaml"
        }
      });
      break;
      
    default:
      throw new Error(`Unknown mock behavior: ${mockBehavior}`);
  }

  return context;
}

// Factory for creating contexts with custom spec content
export function createMockContextWithSpec(specContent, owner = "test-org", repo = "test-repo") {
  return {
    repo: () => ({ owner, repo }),
    octokit: {
      repos: {
        getContent: async () => ({
          data: {
            type: "file",
            content: Buffer.from(specContent).toString('base64'),
            encoding: "base64"
          }
        })
      }
    }
  };
}

// PR Context fixtures for AI Rules testing
export const PR_FIXTURES = {
  // Realistic authentication feature PR
  authFeaturePR: {
    title: 'Add new feature for user authentication',
    body: 'Implements OAuth login flow with proper error handling',
    changed_files: [
      {
        filename: 'src/auth/oauth.js',
        status: 'added',
        additions: 45,
        deletions: 0
      },
      {
        filename: 'src/auth/utils.js', 
        status: 'modified',
        additions: 12,
        deletions: 3
      },
      {
        filename: 'docs/auth.md',
        status: 'added',
        additions: 25,
        deletions: 0
      }
    ],
    hunks_by_file: {
      'src/auth/oauth.js': [
        { start_line: 1, line_count: 45, lines: ['// OAuth implementation', '// ...'] }
      ],
      'src/auth/utils.js': [
        { start_line: 10, line_count: 15, lines: ['function validateUser() {', '// ...'] }
      ]
    }
  },

  // Config-only changes (should not match src/** selectors)
  configOnlyPR: {
    title: 'Update package dependencies',
    body: 'Bump lodash version for security',
    changed_files: [
      {
        filename: 'package.json',
        status: 'modified',
        additions: 2,
        deletions: 1
      }
    ],
    hunks_by_file: {
      'package.json': [
        { start_line: 10, line_count: 3, lines: ['"version": "1.0.1"'] }
      ]
    }
  },

  // Documentation-only changes
  docsOnlyPR: {
    title: 'Update README with new installation steps',
    body: 'Clarifies setup process for new contributors',
    changed_files: [
      {
        filename: 'README.md',
        status: 'modified',
        additions: 15,
        deletions: 5
      },
      {
        filename: 'docs/setup.md',
        status: 'added',
        additions: 30,
        deletions: 0
      }
    ],
    hunks_by_file: {
      'README.md': [
        { start_line: 20, line_count: 20, lines: ['## Installation', '...'] }
      ],
      'docs/setup.md': [
        { start_line: 1, line_count: 30, lines: ['# Setup Guide', '...'] }
      ]
    }
  }
};

// Factory for creating full AI Rules gate contexts
export function createAIRulesContext(prFixtureKey = 'authFeaturePR') {
  return {
    pr: PR_FIXTURES[prFixtureKey]
  };
}