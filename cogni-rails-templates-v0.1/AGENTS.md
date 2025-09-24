# Cogni Rails Templates v0.1

**MVP template bundle** for repository governance automation and welcome PR setup. 

> **Note**: This template directory is temporary MVP implementation. Eventually this should move into its own full repository for cogni-rails templates.

## Purpose
Provides standardized governance files that get copied to new repositories during welcome PR creation, establishing consistent policy enforcement and developer workflows.

## Structure
```
cogni-rails-templates-v0.1/
├── .allstar/                    # Allstar configuration for branch protection
│   ├── allstar.yaml            # Main Allstar config
│   ├── branch_protection.yaml  # Branch protection policy
│   ├── binary_artifacts.yaml   # Binary artifact rules
│   └── outside.yaml            # Outside collaborator rules
├── .cogni/                     # Cogni-specific configuration
│   ├── repo-spec-template.yaml # Repository specification template
│   └── rules/                  # AI rule templates
│       └── ai-rule-template.yaml
├── .github/                    # GitHub-specific files
│   ├── CODEOWNERS              # Code ownership template ({{REPO_OWNER}} placeholder)
│   └── workflows/              # GitHub Actions workflow templates
│       ├── ci.yaml             # CI pipeline with repolinter + npm
│       ├── security.yaml       # Security scanning workflow  
│       └── release-please.yaml # Automated release workflow
└── repolinter.json            # Repository policy enforcement rules
```

## Template Customization
- **repo-spec-template.yaml**: `intent.name` gets replaced with actual repo name
- **CODEOWNERS**: `{{REPO_OWNER}}` gets replaced with repository owner handle
- All other files copied as-is without modification

## Integration
Used by `src/setup/createWelcomePR.js` via the `copyTemplateFile()` function and custom template processors for dynamic content.

## Governance Stack
Creates complete governance automation:
- **Repolinter**: Repository policy compliance (LICENSE, README, CODEOWNERS, repo-spec)
- **Allstar**: Automated branch protection enforcement (pending integration)
- **CODEOWNERS**: Review assignment automation  
- **GitHub Actions**: CI/CD pipeline standardization