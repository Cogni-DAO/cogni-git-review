# Setup Module

Installation workflow automation for new repository onboarding with complete governance stack.

## Files
- `installation-handler.js` - Handles `installation_repositories.added` webhook events
- `createWelcomePR.js` - Creates welcome PR with complete governance template bundle

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

### Templates Used (from cogni-rails-templates-v0.1/)
- `.cogni/repo-spec-template.yaml` - Repository specification
- `.cogni/rules/ai-rule-template.yaml` - AI rule template
- `.allstar/*.yaml` - Allstar configuration bundle
- `.github/workflows/*.yaml` - CI/security/release workflow templates
- `.github/CODEOWNERS` - Code ownership template
- `repolinter.json` - Repository policy rules

## Welcome PR Content
Creates dual setup paths:
1. **Primary**: Allstar automated branch protection (preferred but currently not working)
2. **Fallback**: Manual gh CLI script + GitHub settings instructions. Protect main, produciton branches.

## Integration
Called from `index.js` webhook handler for installation events. Creates complete governance automation stack in a single welcome PR.