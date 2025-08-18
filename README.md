# cogni-git-review

> A GitHub App built with [Probot](https://github.com/probot/probot). CogniDAO's primary code management bot and AI reviewer.

## Why Cogni?

🎯 **Goal-aligned development.** Cogni reviews every PR against your repository's declared *goals* and *non-goals* (from `.cogni/repo-spec.yaml`), ensuring contributions move the project in the right direction.

🧠 **AI-powered review.** Cogni provides deeper analysis of code changes, connecting them back to project intent and highlighting risks, inconsistencies, or misalignment.

🔒 **Standard protection configurations with Existing CI tools.** On install, Cogni helps you enforce branch protection, required status checks, and organization policies through [Allstar](https://github.com/ossf/allstar) and GitHub Actions. Quickly set up your repo with stanard protections like linters, test suite executions, and security scanners.

🪢 **DAO-ready governance.** Designed to lead community-run repositories. Cogni provides auditable AI reviews, with the future-option to layer in DAO voting and override mechanisms for collective decision-making.

## Installation

TODO. Incomplete, sorry.

1. **Install the GitHub App** on your repository
2. **Install Allstar** at your organization level (Soon: Cogni will guide you if missing)
3. **Enable branch protection** See `make setup-branch-protection`
4. **Add a repo spec**: Create `.cogni/repo-spec.yaml` defining your repository goals
5. **Test**: Open a PR and confirm both `cogni-git-review` check appears

## Development Setup

```sh
npm install
npm start
```

## Contributing

We welcome contributions! Please see the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2025 CogniDAO