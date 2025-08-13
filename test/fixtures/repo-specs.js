// Test fixtures for repository specifications

export const SPEC_FIXTURES = {
  // Valid minimal spec - super-MVP format
  minimal: `schema_version: '0.2.1'

intent:
  name: minimal-project
  goals:
    - Basic project functionality
  non_goals:
    - Complex features

gates:
  spec_mode: enforced
  on_missing_spec: neutral_with_annotation
  review_limits:
    max_changed_files: 100
    max_total_diff_kb: 500
  check_presentation:
    name: 'Cogni Git PR Review'`,

  // Valid full spec - super-MVP format with all optional fields
  full: `schema_version: '0.2.1'

intent:
  name: full-project
  goals:
    - Primary goal of the project
    - Secondary goal
  non_goals:
    - What this project does not do

gates:
  spec_mode: enforced
  on_missing_spec: neutral_with_annotation
  review_limits:
    max_changed_files: 50
    max_total_diff_kb: 200
  check_presentation:
    name: 'Full Project Check'`,

  // Bootstrap mode spec - for gradual rollout
  bootstrap: `schema_version: '0.2.1'

intent:
  name: bootstrap-project
  goals:
    - Project in bootstrap mode for safe rollout
  non_goals:
    - Heavy validation during initial rollout

gates:
  spec_mode: bootstrap
  on_missing_spec: neutral_with_annotation
  review_limits:
    max_changed_files: 100
    max_total_diff_kb: 500
  check_presentation:
    name: 'Bootstrap Check'`,

  // Advisory mode spec - for testing
  advisory: `schema_version: '0.2.1'

intent:
  name: advisory-project
  goals:
    - Project in advisory mode for evaluation
  non_goals:
    - Blocking enforcement during testing

gates:
  spec_mode: advisory
  on_missing_spec: neutral_with_annotation
  review_limits:
    max_changed_files: 100
    max_total_diff_kb: 500
  check_presentation:
    name: 'Advisory Check'`,

  // Custom check name spec
  customName: `schema_version: '0.2.1'

intent:
  name: custom-check-project
  goals:
    - Project with custom check name
  non_goals:
    - Default naming conventions

gates:
  spec_mode: enforced
  on_missing_spec: neutral_with_annotation
  review_limits:
    max_changed_files: 100
    max_total_diff_kb: 500
  check_presentation:
    name: 'Custom Repository Check'`,

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
  spec_mode: enforced
  on_missing_spec: neutral_with_annotation
  review_limits:
    max_changed_files: 100
    max_total_diff_kb: 500
  check_presentation:
    name: 'Check Name'`
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
    gates: {
      spec_mode: 'enforced',
      on_missing_spec: 'neutral_with_annotation',
      review_limits: { max_changed_files: 100, max_total_diff_kb: 500 },
      check_presentation: {
        name: 'Cogni Git PR Review'
      }
    }
  },

  customName: {
    schema_version: '0.2.1',
    intent: {
      name: 'custom-check-project',
      goals: ['Project with custom check name'],
      non_goals: ['Default naming conventions']
    },
    gates: {
      spec_mode: 'enforced',
      on_missing_spec: 'neutral_with_annotation',
      review_limits: { max_changed_files: 100, max_total_diff_kb: 500 },
      check_presentation: {
        name: 'Custom Repository Check'
      }
    }
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