# cogni-git-review

> cogni-git-review is a [GitHub App](https://docs.github.com/en/apps) that performs AI-powered code reviews on Pull Requests in your repo. The app is based off of the foundation of [Probot](https://github.com/probot/probot), and models after Palantir's [policy-bot](https://github.com/palantir/policy-bot) for in-repo rule configuration files accruing to 1 single "pass/fail/neutral" Github Check.

## Why Cogni?

🧠 **AI-first Design.** Cogni is being designed for fully AI-run organizations, to enable people to collaborate together with less friction. In the early stages, cogni-git-review is ideal for small teams and individuals. 

🔒 **Required Best Practices** Cogni is designed to put training wheels on repositories, out of the box, to allow the speed of AI-powered coding while protecting against all of the pitfalls that come with it. Enable repos to get quickly set up with best practices for ongoing CI/CD and documentation. Quickly set up your repo with stanard protections like linters, test suite executions, and security scanners.

🎯 **Customizable Code Reviews.** Cogni reviews every PR against your repository's declared gates (from `.cogni/repo-spec.yaml`). You can configure as many or as few gates as you want.

🪢 **DAO-ready governance.** Designed to lead community-run repositories. Cogni provides auditable AI reviews, with the future-option to layer in DAO voting and override mechanisms for collective decision-making.

## Installation

### Current Manual Process (4 Steps)

1. **Install GitHub App**
   - Navigate to: https://github.com/apps/cogni-git-review
   - Install on your target repository

2. **Add Repository Configuration**
   - Create `.cogni/repo-spec.yaml` (copy from `repo-spec-template.yaml`)
   - Customize: repository name, goals, non-goals, desired gates

3. **Commit + Merge the repo-spec.yaml into Main branch**
   - ⚠️ First Cogni-Git-Review check will fail on this pr (because no repo-spec.yaml exists in main yet) 

4. **Configure Branch Protection**
   - Go to repository Settings → Branches
   - Add rule for main branch requiring "Cogni Git PR Review" status check
   - Add rule for main branch: no direct pushes. Require a PR into main for all changes.

5. **Configure First AI Rule**
   - Create a .cogni/rules/ai-rule-file.yaml
   - Add a reference to the ai-rule-file.yaml in your repo-spec.yaml.
   - PR to main. Future PRs will use this AI rule.

### Known Issues & Planned Improvements
- **First PR Design Flaw**: Review reports failure on repos without repo-spec
- **No Automation**: Branch protection requires manual GitHub settings
- **Missing Templates**: AI rule templates must be copied from other repos

**Target**: One-click installation with automatic repo-spec generation and branch protection setup.

## Development Setup

By default, cogni-git-review app installations send events to our hosted server which performs the reviews. Work is needed to allow for configurable hosting (and developement hosting)

```sh
npm install
npm start
```

## Contributing

We welcome contributions! Please see the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2025 CogniDAO