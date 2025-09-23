import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PR_REVIEW_NAME } from '../constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_PATH = "templates/repo-spec-template.yaml";
const WELCOME_BRANCH_PREFIX = "cogni/welcome-setup";
const WELCOME_PR_TITLE = (repo) => `chore(cogni): bootstrap repo-spec for ${repo}`;
const WELCOME_LABEL = "cogni-setup";

/**
 * Customize repo-spec template for the specific repository
 */
function customizeRepoSpec(templateContent, repoName) {
  let content = templateContent;
  
  // Replace intent.name placeholder with actual repo name
  content = content.replace(
    /(^intent:\s*[\r\n]+)((?:\s+.+[\r\n]+)*?)(\s*name:\s*).+$/m, 
    (match, p1, p2, p3) => `${p1}${p2}${p3}${repoName}`
  );
  
  return content;
}

/**
 * Create a welcome PR that adds .cogni/repo-spec.yaml from template
 */
export async function createWelcomePR(context, repoInfo) {
  const { owner, repo } = repoInfo;
  
  try {
    // Check if repo-spec already exists
    try {
      await context.octokit.repos.getContent({
        owner,
        repo,
        path: '.cogni/repo-spec.yaml'
      });
      console.log(`📦 Repo-spec already exists in ${owner}/${repo}, skipping welcome PR`);
      return;
    } catch (error) {
      if (error.status !== 404) throw error;
      // 404 is expected - repo-spec doesn't exist yet
    }

    // Check if welcome PR already exists
    const { data: openPRs } = await context.octokit.pulls.list({
      owner,
      repo,
      state: 'open'
    });
    
    const welcomePR = openPRs.find(pr =>
      (pr.head?.ref || '').startsWith(WELCOME_BRANCH_PREFIX) ||
      (pr.labels || []).some(l => l.name === WELCOME_LABEL)
    );
    
    if (welcomePR) {
      console.log(`📦 Welcome PR already exists in ${owner}/${repo}: #${welcomePR.number}`);
      return;
    }

    // Get default branch
    const { data: repoData } = await context.octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    // Read and customize template file
    const templatePath = path.join(__dirname, '..', '..', TEMPLATE_PATH);
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const customizedContent = customizeRepoSpec(templateContent, repo);
    
    // Create branch
    const branchName = WELCOME_BRANCH_PREFIX;
    const { data: defaultRef } = await context.octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`
    });
    
    await context.octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: defaultRef.object.sha
    });

    // Add repo-spec.yaml file
    await context.octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: '.cogni/repo-spec.yaml',
      message: 'feat(cogni): add initial repo-spec configuration',
      content: Buffer.from(customizedContent).toString('base64'),
      branch: branchName
    });

    // Create PR body
    const prBody = createPRBody(owner, repo, PR_REVIEW_NAME);

    // Create PR
    const { data: pr } = await context.octokit.pulls.create({
      owner,
      repo,
      title: WELCOME_PR_TITLE(repo),
      head: branchName,
      base: defaultBranch,
      body: prBody
    });

    // Add label
    await context.octokit.issues.addLabels({
      owner,
      repo,
      issue_number: pr.number,
      labels: [WELCOME_LABEL]
    });

    console.log(`📦 Welcome PR created for ${owner}/${repo}: #${pr.number}`);
    
  } catch (error) {
    console.error(`📦 Failed to create welcome PR for ${owner}/${repo}:`, error);
    throw error;
  }
}

function createPRBody(owner, repo, checkContextName) {
  const bash = String.raw`set -eo pipefail

OWNER="${owner}"
REPO="${repo}"
CHECK_NAME="${checkContextName}"

DEFAULT_BRANCH=$(gh repo view "$OWNER/$REPO" --json defaultBranchRef --jq .defaultBranchRef.name)

echo "Setting up branch protection for $OWNER/$REPO on $DEFAULT_BRANCH…"

if gh api "repos/$OWNER/$REPO/branches/$DEFAULT_BRANCH/protection" >/dev/null 2>&1; then
  echo "Updating existing branch protection…"
  gh api -X PATCH "repos/$OWNER/$REPO/branches/$DEFAULT_BRANCH/protection/required_pull_request_reviews" --input - <<'JSON'
{}
JSON
  gh api -X PATCH "repos/$OWNER/$REPO/branches/$DEFAULT_BRANCH/protection/required_status_checks" --input - <<JSON
{
  "strict": true,
  "contexts": ["$CHECK_NAME"]
}
JSON
  echo "✅ Branch protection updated."
else
  echo "Creating minimal branch protection…"
  gh api -X PUT "repos/$OWNER/$REPO/branches/$DEFAULT_BRANCH/protection" --input - <<JSON
{
  "required_pull_request_reviews": {},
  "required_status_checks": { "strict": true, "contexts": ["$CHECK_NAME"] },
  "enforce_admins": false,
  "restrictions": null
}
JSON
  echo "✅ Branch protection created."
fi

echo "✅ '$CHECK_NAME' is now required; PRs are required on $DEFAULT_BRANCH."`;

  return `# Welcome to Cogni Review

This PR adds a minimal \`.cogni/repo-spec.yaml\` so Cogni can evaluate PRs deterministically.

## Final step: Enable branch protection

\`\`\`bash
${bash}
\`\`\`

After merging this PR, new PRs will be gated by **${checkContextName}**.

If you see a **neutral** check on this PR, that's expected — merge this PR to enable Cogni on future PRs.`;
}