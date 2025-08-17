# cogni-git-review

> A GitHub App built with [Probot](https://github.com/probot/probot) that CogniDAO&#x27;s primary code management bot, built as a github app. 

## Why External Gates?

- **One required check, many signals.** Cogni aggregates Linting, security scans, and other tools into a single status: **Cogni Git PR Review**.
- **Rich, scalable feedback.** Uses the Checks API to post inline annotations in batches, handling reports with hundreds of violations.
- **Secure artifact ingestion.** No code execution - just reads JSON/SARIF artifacts from your existing workflows.
- **Universal compatibility.** Works with any linting/scanning tool that outputs structured data.
- **Org-wide consistency.** `.cogni/repo-spec.yaml` defines which gates run and their pass/fail criteria.
- **Not bypassable.** Runs on every PR, including web edits, with deterministic results.

_See [docs/EXTERNAL_GATES.md](docs/EXTERNAL_GATES.md) for the complete adoption guide and security model._

## Installation

1. **Install the GitHub App** on your repository
2. **Set up branch protection**:
   ```bash
   # Copy the Makefile from this repo, then:
   make setup-branch-protection OWNER=yourorg REPO=yourrepo
   ```
   
   Or manually: Settings → Branches → Add rule requiring `Cogni Git PR Review` check

3. **Test the setup** by opening a PR to verify the required check appears

See [BRANCH_PROTECTION.md](BRANCH_PROTECTION.md) for detailed setup options and troubleshooting.

## Development Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Docker

```sh
# 1. Build container
docker build -t cogni-git-review .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> cogni-git-review
```

## Contributing

If you have suggestions for how cogni-git-review could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2025 derekg1729
