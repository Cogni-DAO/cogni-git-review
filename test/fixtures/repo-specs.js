// Test fixtures for repository specifications

export const SPEC_FIXTURES = {
  // Valid minimal spec - just the essentials
  minimal: `intent:
  name: minimal-project
  mission: Basic project configuration
  ownership:
    maintainers: ['@test-org/maintainers']

gates:
  spec_mode: enforced
  check_presentation:
    name: 'Cogni Git PR Review'`,

  // Valid full spec - all fields populated
  full: `intent:
  name: full-project
  mission: Comprehensive project with all configuration options
  goals:
    - Primary goal of the project
    - Secondary goal
  non_goals:
    - What this project does not do
  ownership:
    maintainers: ['@test-org/maintainers', '@test-org/admins']
    maturity: beta

gates:
  spec_mode: enforced
  on_missing_spec: neutral_with_annotation
  deny_paths: 
    - '**/*.exe'
    - '**/*.dll'
    - 'secrets/**'
    - '.env'
  review_limits:
    max_changed_files: 50
    max_total_diff_kb: 200
  required_files:
    - 'README.md'
    - 'LICENSE'
  commit_policy:
    conventional_commits: true
    signed_off_by: false
  check_presentation:
    name: 'Full Project Check'`,

  // Bootstrap mode spec - for gradual rollout
  bootstrap: `intent:
  name: bootstrap-project
  mission: Project in bootstrap mode for safe rollout
  ownership:
    maintainers: ['@test-org/maintainers']

gates:
  spec_mode: bootstrap
  on_missing_spec: neutral_with_annotation
  deny_paths: ['**/*.exe', 'secrets/**']
  check_presentation:
    name: 'Bootstrap Check'`,

  // Advisory mode spec - for testing
  advisory: `intent:
  name: advisory-project
  mission: Project in advisory mode for evaluation
  ownership:
    maintainers: ['@test-org/maintainers']

gates:
  spec_mode: advisory
  deny_paths: ['**/*.exe']
  check_presentation:
    name: 'Advisory Check'`,

  // Custom check name spec
  customName: `intent:
  name: custom-check-project
  mission: Project with custom check name
  ownership:
    maintainers: ['@test-org/maintainers']

gates:
  spec_mode: enforced
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
  missingGates: `intent:
  name: incomplete-project
  mission: Missing gates section`,

  // Only gates, missing intent
  missingIntent: `gates:
  spec_mode: enforced
  check_presentation:
    name: 'Check Name'`
};

// Expected parsed results for valid specs
export const EXPECTED_SPECS = {
  minimal: {
    intent: {
      name: 'minimal-project',
      mission: 'Basic project configuration',
      ownership: {
        maintainers: ['@test-org/maintainers'],
        maturity: 'alpha' // Should be merged from defaults
      }
    },
    gates: {
      spec_mode: 'enforced',
      on_missing_spec: 'neutral_with_annotation', // From defaults
      deny_paths: ['**/*.exe', '**/*.dll', '**/.env', '.env', 'secrets/**'], // From defaults
      review_limits: { max_changed_files: 100, max_total_diff_kb: 500 }, // From defaults
      check_presentation: {
        name: 'Cogni Git PR Review'
      }
    }
  },

  customName: {
    intent: {
      name: 'custom-check-project',
      mission: 'Project with custom check name'
    },
    gates: {
      spec_mode: 'enforced',
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