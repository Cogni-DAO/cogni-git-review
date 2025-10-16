# Setup Module

Installation workflow automation for new repository onboarding with complete governance stack.

## Files
- `installation-handler.js` - Handles `installation_repositories.added` webhook events
- `createWelcomePR.js` - Creates welcome PR with complete governance template bundle
  - Uses VCS interface (`context.vcs.*`) for all GitHub API operations
  - Host-agnostic implementation compatible with BaseContext interface

## Flow
```
installation_repositories.added webhook
└── installation-handler.js → handleInstallationAdded()
    └── createWelcomePR.js → createWelcomePR()
        ├── Check if repo-spec exists (skip if present)
        ├── Check for existing welcome PR (skip if present) 
        ├── Create cogni/welcome-setup branch
        ├── Add .cogni/repo-spec.yaml (customized with repo name)
        ├── Add .github/CODEOWNERS (customized with repo owner)
        ├── Copy template files from cogni-rails-templates-v0.1/:
        │   ├── .cogni/rules/ai-rule-template.yaml
        │   ├── .cogni/rules/avoid-duplication.yaml
        │   ├── .cogni/rules/pr-syntropy-coherence.yaml
        │   ├── .cogni/rules/patterns-and-docs.yaml
        │   ├── .cogni/rules/repo-goal-alignment.yaml (from YOUR-repo-goal-alignment.yaml)
        │   ├── .allstar/*.yaml (allstar config)
        │   ├── .github/workflows/*.yaml (CI pipelines)  
        │   └── repolinter.json (policy enforcement)
        └── Create labeled welcome PR with dual setup paths
```

## Template System
### Core Functions
- `customizeRepoSpec()` - Replaces `intent.name` with actual repo name
- `customizeCodeowners()` - Replaces `{{REPO_OWNER}}` with repo owner handle  
- `copyTemplateFile()` - Generic template file copying with existence checks
  - Uses `context.vcs.repos.getContent()` to check file existence
  - Uses `context.vcs.repos.createOrUpdateFileContents()` to create files
  - All operations through VCS interface for host independence

### Templates Used (from cogni-rails-templates-v0.1/)
- `.cogni/repo-spec-template.yaml` - Repository specification
- `.cogni/rules/ai-rule-template.yaml` - AI rule template
- `.cogni/rules/avoid-duplication.yaml` - Anti-duplication rule
- `.cogni/rules/pr-syntropy-coherence.yaml` - PR coherence rule
- `.cogni/rules/patterns-and-docs.yaml` - Pattern adherence rule
- `.cogni/rules/YOUR-repo-goal-alignment.yaml` - Repo-specific goal alignment template
- `.allstar/*.yaml` - Allstar configuration bundle
- `.github/workflows/*.yaml` - CI/security/e2e/deployment workflow templates
- `.github/CODEOWNERS` - Code ownership template
- `repolinter.json` - Repository policy rules

## Welcome PR Content
Creates dual setup paths:
1. **Primary**: Allstar automated branch protection (preferred but currently not working)
2. **Fallback**: Manual gh CLI script + GitHub settings instructions. Protect main, produciton branches.

## Integration
Called from `index.js` webhook handler for installation events. Creates complete governance automation stack in a single welcome PR.