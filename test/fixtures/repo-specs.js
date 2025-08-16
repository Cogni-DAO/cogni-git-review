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
  - id: forbidden_scopes`
};

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