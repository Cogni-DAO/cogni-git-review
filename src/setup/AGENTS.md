# Setup Module

Installation workflow automation for new repository onboarding.

## Files
- `installation-handler.js` - Handles `installation_repositories.added` webhook events
- `createWelcomePR.js` - Creates welcome PR with configuration templates

## Flow
```
installation_repositories.added webhook
└── installation-handler.js → handleInstallationAdded()
    └── createWelcomePR.js → createWelcomePR()
        ├── Check if repo-spec exists (skip if present)
        ├── Check for existing welcome PR (skip if present) 
        ├── Create cogni/welcome-setup branch
        ├── Add .cogni/repo-spec.yaml (customized from template)
        ├── Add .cogni/rules/ai-rule-template.yaml
        └── Create labeled welcome PR
```

## Templates Used
- `templates/repo-spec-template.yaml` - Repository specification template
- `templates/rules/ai-rule-template.yaml` - AI rule template

## Integration
Called from `index.js` webhook handler for installation events.