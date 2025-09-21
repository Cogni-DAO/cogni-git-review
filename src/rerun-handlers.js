/**
 * Check Rerun Handlers - Deterministic PR Resolution
 * Handles check_suite.rerequested and check_run.rerequested events
 */

/**
 * Deterministically resolve PR for check reruns with fail-safe neutral
 * @param {Object} context - Probot context
 * @param {string} headSha - Head commit SHA
 * @param {string|null} headBranch - Head branch name (can be null for forks)
 * @returns {Object|null} PR reference or null if ambiguous
 */
export async function resolvePrRef(context, { headSha, headBranch }) {
  const { owner, repo } = context.repo();

  // 1) Payload-provided PRs (single)
  const prFromPayload = context.payload.check_suite?.pull_requests?.[0]
    || context.payload.check_run?.pull_requests?.[0];
  if (prFromPayload) {
    console.log(`🔄 RERUN: Using payload PR #${prFromPayload.number}`);
    return prFromPayload;
  }

  // 2) Commit association (preferred exact head match)
  try {
    const { data: assoc } = await context.octokit.repos.listPullRequestsAssociatedWithCommit({
      owner, repo, commit_sha: headSha
    });
    
    // Prefer PR with exact head SHA match
    let prRef = assoc.find(p => p.head?.sha === headSha);
    if (prRef) {
      console.log(`🔄 RERUN: Found exact SHA match PR #${prRef.number}`);
      return prRef;
    }

    // 3) Same list – match by branch name if available
    if (headBranch) {
      prRef = assoc.find(p => p.head?.ref === headBranch);
      if (prRef) {
        console.log(`🔄 RERUN: Found branch match PR #${prRef.number} (${headBranch})`);
        return prRef;
      }
    }

    // 4) Same-repo branch listing (won't help forks)
    if (headBranch) {
      const { data: prs } = await context.octokit.pulls.list({ 
        owner, repo, state: 'all', head: `${owner}:${headBranch}` 
      });
      prRef = prs.find(p => p.head?.sha === headSha);
      if (prRef) {
        console.log(`🔄 RERUN: Found same-repo branch PR #${prRef.number}`);
        return prRef;
      }
    }

    console.log(`🔄 RERUN: Could not deterministically resolve PR for SHA ${headSha}`);
    return null;
    
  } catch (error) {
    console.error(`🔄 RERUN: Error resolving PR:`, error);
    return null;
  }
}

/**
 * Create neutral check on SHA when PR resolution fails
 */
export async function createNeutralCheckOnSha(context, headSha) {
  const started_at = new Date();
  return context.octokit.checks.create(context.repo({
    name: "Cogni Git PR Review",
    head_sha: headSha,
    status: "completed",
    started_at,
    conclusion: 'neutral',
    completed_at: new Date(),
    output: { 
      title: "Cogni Git PR Review", 
      summary: 'Ambiguous PR for rerun',
      text: `Could not unambiguously resolve PR for this rerun (SHA: ${headSha.slice(0, 7)}); no PR comment posted. This is a fail-safe to prevent comments on wrong PRs.`
    }
  }));
}

/**
 * Handle check_run.rerequested event
 */
export async function handleCheckRunRerun(context, handlePullRequest) {
  const checkRun = context.payload.check_run;
  const { head_sha: headSha } = checkRun;
  // Note: check_run doesn't have head_branch, so we pass null
  const headBranch = null;

  console.log(`🔄 RERUN: Received check_run.rerequested for check: "${checkRun.name}", SHA: ${headSha}`);

  // Use deterministic PR resolution
  const prRef = await resolvePrRef(context, { headSha, headBranch });

  if (!prRef) {
    console.log(`🔄 RERUN: Ambiguous PR resolution for SHA ${headSha} - marking neutral`);
    return createNeutralCheckOnSha(context, headSha);
  }

  console.log(`🔄 RERUN: Found PR #${prRef.number} in check_run, fetching full PR data`);
  
  try {
    // Fetch full PR data with file/diff statistics
    const { data: fullPR } = await context.octokit.pulls.get(
      context.repo({ pull_number: prRef.number })
    );
    
    console.log(`🔄 RERUN: Got full PR data - files=${fullPR.changed_files}, additions=${fullPR.additions}, deletions=${fullPR.deletions}`);
    
    // Enhance context to look like a PR event
    context.payload.pull_request = fullPR;
    context.payload.action = 'rerequested';
    
    // Delegate to existing PR handler
    return handlePullRequest(context);
    
  } catch (error) {
    console.error(`🔄 Failed to fetch full PR data for PR #${prRef.number}:`, error);
    return createNeutralCheckOnSha(context, headSha);
  }
}