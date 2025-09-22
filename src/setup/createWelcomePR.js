import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PR_REVIEW_NAME } from '../constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_PATH = "templates/repo-spec-template.yaml";
const WELCOME_BRANCH_PREFIX = "cogni/welcome-setup-";
const WELCOME_PR_TITLE = "chore(cogni): add minimal .cogni/repo-spec.yaml";
const WELCOME_LABEL = "cogni-setup";

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
    const { data: existingPRs } = await context.octokit.pulls.list({
      owner,
      repo,
      state: 'open',
      head: `${owner}:${WELCOME_BRANCH_PREFIX}`
    });
    
    const welcomePR = existingPRs.find(pr => 
      pr.labels?.some(l => l.name === WELCOME_LABEL)
    );
    
    if (welcomePR) {
      console.log(`📦 Welcome PR already exists in ${owner}/${repo}: #${welcomePR.number}`);
      return;
    }

    // Get default branch
    const { data: repoData } = await context.octokit.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    // Read template file
    const templatePath = path.join(__dirname, '..', '..', TEMPLATE_PATH);
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    
    // Create branch
    const branchName = `${WELCOME_BRANCH_PREFIX}${Date.now()}`;
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
      content: Buffer.from(templateContent).toString('base64'),
      branch: branchName
    });

    // Create PR body
    const prBody = createPRBody(owner, repo, PR_REVIEW_NAME);

    // Create PR
    const { data: pr } = await context.octokit.pulls.create({
      owner,
      repo,
      title: WELCOME_PR_TITLE,
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
  return `# Welcome to Cogni Review

This PR adds a minimal \`.cogni/repo-spec.yaml\` so Cogni can evaluate PRs deterministically.

## Final step (required): Make Cogni the single required status check

Paste the following in your terminal (requires \`gh\` CLI and repo admin):

\`\`\`bash
OWNER="${owner}"
REPO="${repo}"
DEFAULT_BRANCH=$(gh repo view "$OWNER/$REPO" --json defaultBranchRef -q .defaultBranchRef.name)
cat > /tmp/cogni-branch-protection.json <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "checks": [ { "context": "${checkContextName}" } ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true
}
JSON
gh api -X PUT repos/$OWNER/$REPO/branches/$DEFAULT_BRANCH/protection --input /tmp/cogni-branch-protection.json
\`\`\`

After merging this PR, new PRs will be gated by **${checkContextName}**.

If you see a **neutral** check on this PR, that's expected — it's the first-run bootstrap.`;
}