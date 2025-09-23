import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PR_REVIEW_NAME } from '../constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_PATH = "cogni-rails-templates-v0.1/.cogni/repo-spec-template.yaml";
const AI_RULE_TEMPLATE_PATH = "cogni-rails-templates-v0.1/.cogni/rules/ai-rule-template.yaml";
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
    
    try {
      await context.octokit.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branchName}`,
        sha: defaultRef.object.sha
      });
    } catch (error) {
      if (error.status !== 422) throw error;
      // 422 means branch already exists - that's fine for idempotency
    }

    // Add repo-spec.yaml file (only if it doesn't exist)
    try {
      await context.octokit.repos.getContent({
        owner,
        repo,
        path: '.cogni/repo-spec.yaml',
        ref: branchName
      });
      // File exists, skip creation
    } catch (error) {
      if (error.status !== 404) throw error;
      // File doesn't exist, create it
      await context.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: '.cogni/repo-spec.yaml',
        message: 'feat(cogni): add initial repo-spec configuration',
        content: Buffer.from(customizedContent).toString('base64'),
        branch: branchName
      });
    }

    // Add AI rule template file (only if it doesn't exist)
    const aiRuleTemplatePath = path.join(__dirname, '..', '..', AI_RULE_TEMPLATE_PATH);
    const aiRuleContent = fs.readFileSync(aiRuleTemplatePath, 'utf8');
    
    try {
      await context.octokit.repos.getContent({
        owner,
        repo,
        path: '.cogni/rules/ai-rule-template.yaml',
        ref: branchName
      });
      // File exists, skip creation
    } catch (error) {
      if (error.status !== 404) throw error;
      // File doesn't exist, create it
      await context.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: '.cogni/rules/ai-rule-template.yaml',
        message: 'feat(cogni): add AI rule template',
        content: Buffer.from(aiRuleContent).toString('base64'),
        branch: branchName
      });
    }

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
  const bash = String.raw`# For repos WITHOUT existing branch protection only
gh api -X PUT "repos/${owner}/${repo}/branches/main/protection" --input - <<'JSON'
{
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "required_status_checks": { "strict": true, "contexts": ["${checkContextName}"] },
  "enforce_admins": false,
  "restrictions": null
}
JSON`;

  return `# Welcome to Cogni Git Review!

  This PR adds:
  - a minimal \`.cogni/repo-spec.yaml\`. This is the defining policy for Cogni Git Review
  - a minimal \`.cogni/rules/ai-rule-template.yaml\`. This is the template for a new AI powered gate.

Note: Cogni Git Review will only load these files from the default branch.

## Do you want to require Cogni reviews pass? 
Enable branch protections!

## **For repos with existing branch protection:**

Go to: https://github.com/${owner}/${repo}/settings/branches
1. Require a pull request to default branch before merging ✅
2. Require status checks to pass ✅ 
3. Add **${checkContextName}** to required status checks


##**For fresh repos (no existing branch protection):**
This bash script is the fastest way. 
Copy this script, and paste it into your terminal. 

Note: This assumes you have github cli installed and authenticated.

\`\`\`bash
${bash}
\`\`\`

After merging this PR, new PRs will be gated by **${checkContextName}**.

If you see a **neutral** check on this PR, that's expected — the policy files don't exist on the default branch yet.`;
}