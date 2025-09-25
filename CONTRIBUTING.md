## Contributing

[fork]: /fork
[pr]: /compare
[code-of-conduct]: CODE_OF_CONDUCT.md

Hi there! We're thrilled that you'd like to contribute to this project. Your help is essential for keeping it great.

Please note that this project is released with a [Contributor Code of Conduct][code-of-conduct]. By participating in this project you agree to abide by its terms.

## Issues and PRs

If you have suggestions for how this project could be improved, or want to report a bug, open an issue! We'd love all and any contributions. If you have questions, too, we'd love to hear them.

We'd also love PRs. If you're thinking of a large PR, we advise opening up an issue first to talk about it, though! Look at the links below if you're not sure how to open a PR.

## Submitting a pull request

1. [Fork][fork] and clone the repository.
1. Configure and install the dependencies: `npm install`.
1. Make sure the tests pass on your machine: `npm test`, note: these tests also apply the linter, so there's no need to lint separately.

## Local Development Setup

To test the GitHub App locally, you need your own dev GitHub App:

### 1. Create GitHub App
Go to https://github.com/settings/apps/new and enter:

- **App name**: `cogni-git-review-dev-<yourname>`
- **Homepage URL**: `https://github.com/<your-username>/cogni-git-review`
- **Webhook URL**:  Go to https://smee.io/new → copy the URL
- **Webhook secret**: Generate a password: `openssl rand -hex 20` (or use `development` for testing)
- **Repository permissions**:
  - Checks: Read & write
  - Contents: Read & write
  - Metadata: Read
  - Pull requests: Read & write
  - Workflows: Read & write
- **Subscribe to events**: `pull_request`, `check_run`, `check_suite`, `installation_repositories`

Click "Create GitHub App" → "Generate a private key" (downloads .pem file)

### 2. Install App
Install your app on a test repository (use https://github.com/Cogni-DAO/test-repo or your own fork/sandbox repo)

### 3. Install Smee Client
```bash
npm install -g smee-client
```

### 4. Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```bash
APP_ID=123456  # from your app page
WEBHOOK_SECRET=your-password-from-step-1
WEBHOOK_PROXY_URL=https://smee.io/your-channel
LOG_LEVEL=debug
PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----
...paste entire .pem file contents here...
-----END RSA PRIVATE KEY-----
```

### 5. Run
Start the smee forwarder (replace with your smee URL):
```bash
smee --url https://smee.io/your-channel --target http://localhost:3000/api/github/webhooks
```

In another terminal, start the app:
```bash
npm start
```

Test by opening/updating a PR in your test repo. You should see webhook events in both terminals and checks appear on the PR.

**Note**: Each developer needs their own GitHub App + Smee URL to avoid conflicts.

1. Create a new branch: `git checkout -b my-branch-name`.
1. Make your change, add tests, and make sure the tests still pass.
1. Push to your fork and [submit a pull request][pr].
1. Pat your self on the back and wait for your pull request to be reviewed and merged.

Here are a few things you can do that will increase the likelihood of your pull request being accepted:

- Write and update tests.
- Keep your changes as focused as possible. If there are multiple changes you would like to make that are not dependent upon each other, consider submitting them as separate pull requests.
- Write a [good commit message](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html).

Work in Progress pull requests are also welcome to get feedback early on, or if there is something blocked you.

## Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Using Pull Requests](https://help.github.com/articles/about-pull-requests/)
- [GitHub Help](https://help.github.com)
