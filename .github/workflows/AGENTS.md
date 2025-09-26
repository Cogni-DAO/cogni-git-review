{
  "doc_type": "Best_Practices",
  "topic": "Building and Testing GitHub Actions CI/CD with Protected Branches",
  "summary": "Avoid noisy validation by merging into protected branches. Instead, structure workflows so that testing, gates, and deployments happen in a controlled, predictable, and secure way.",
  "best_practices": [
    {
      "id": "reusable_workflows",
      "title": "Use Reusable Workflows for CI Logic",
      "description": "Put actual CI/CD steps in reusable workflows (`on: workflow_call`) stored on the default branch. PR workflows simply call these, ensuring checks run only from vetted workflow code.",
      "reference_urls": [
        "https://docs.github.com/en/actions/using-workflows/reusing-workflows"
      ]
    },
    {
      "id": "required_gates",
      "title": "Gate Required Checks via workflow_run",
      "description": "Create a lightweight workflow on the default branch triggered by `workflow_run` after PR CI completes. Mark this workflow’s status as the required branch protection check. PRs cannot tamper with it.",
      "reference_urls": [
        "https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_run",
        "https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches"
      ]
    },
    {
      "id": "testing_changes",
      "title": "Test Workflow Changes Without Merging",
      "description": "Workflows must exist on the default branch once to activate. After that, test changes safely on feature branches. Use `workflow_dispatch` with `gh workflow run --ref <branch>` for targeted test runs.",
      "reference_urls": [
        "https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch",
        "https://cli.github.com/manual/gh_workflow_run"
      ]
    },
    {
      "id": "security_lockdown",
      "title": "Lock Down Permissions and Actions",
      "description": "Set explicit `permissions:` (default read-only). Pin third-party actions to commit SHAs. Avoid `pull_request_target` unless strictly necessary, and never expose secrets to untrusted code.",
      "reference_urls": [
        "https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs",
        "https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions"
      ]
    },
    {
      "id": "linting_ci",
      "title": "Lint Workflow Definitions on PRs",
      "description": "Add a dedicated job to lint workflow YAML files whenever `.github/workflows/**` changes. Use `rhysd/actionlint` to catch syntax errors early, without merging into protected branches.",
      "reference_urls": [
        "https://github.com/rhysd/actionlint"
      ]
    },
    {
      "id": "separation_ci_cd",
      "title": "Separate CI (untrusted) from CD (trusted)",
      "description": "PR CI jobs should avoid secrets and elevated permissions. Post-merge CD jobs should use Environments with reviewers and OIDC to cloud providers.",
      "reference_urls": [
        "https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment",
        "https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect"
      ]
    },
    {
      "id": "branch_protection_pattern",
      "title": "Protect Default Branch with Required Gates",
      "description": "Branch protections should require only the default-branch gate job, not PR-defined jobs. This ensures checks can’t be bypassed by editing workflows in a PR.",
      "reference_urls": [
        "https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/enabling-branch-restrictions"
      ]
    },
    {
      "id": "developer_qol",
      "title": "Developer Quality-of-Life Tools",
      "description": "Use `concurrency:` to avoid duplicate runs, pin language/runtime versions, and use tools like `nektos/act` for quick local testing.",
      "reference_urls": [
        "https://docs.github.com/en/actions/using-jobs/using-concurrency",
        "https://github.com/nektos/act"
      ]
    }
  ],
  "overall_recommendation": "Stop validating workflows by merging to protected branches. Instead, rely on reusable workflows, workflow_run gates, and linting to iterate quickly and securely."
}
