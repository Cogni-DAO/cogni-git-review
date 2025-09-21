/**
 * PR Comment Publisher - MVP Implementation
 * Posts developer-friendly summary comments on PRs
 */

/**
 * Post PR comment with gate results summary
 * @param {Object} context - Probot context
 * @param {Object} runResult - Gate execution results
 * @param {string} checkUrl - URL to GitHub check details
 * @param {string} headSha - PR head SHA for staleness guard
 * @param {number} prNumber - PR number
 */
export async function postPRComment(context, runResult, checkUrl, headSha, prNumber) {
  const { gates } = runResult;
  const failed = gates.filter(g => g.status === 'fail');
  const neutral = gates.filter(g => g.status === 'neutral');
  const passed = gates.filter(g => g.status === 'pass');

  const verdict = failed.length > 0 ? '❌ FAIL' 
                : neutral.length > 0 ? '⚠️ WARN' 
                : '✅ PASS';

  let body = `## Cogni Review — ${verdict}\n\n`;
  body += `**Gates:** ✅ ${passed.length} | ❌ ${failed.length} | ⚠️ ${neutral.length}\n\n`;

  if (failed.length > 0) {
    body += `**Blockers:**\n`;
    failed.slice(0, 3).forEach(gate => {
      const label = gate.id || (gate.with && gate.with.rule_file) || 'unknown_gate';
      body += `- **${label}**:\n`;
      
      // Show all violations for this gate (limit to 5 to avoid spam)
      const violations = gate.violations || [];
      if (violations.length === 0) {
        // Check if this is an AI gate with score/threshold data
        if (gate.stats?.score != null && gate.stats?.threshold != null) {
          body += `  - Score: ${gate.stats.score}/${gate.stats.threshold}\n`;
        } else {
          body += `  - Failed\n`;
        }
      } else {
        violations.slice(0, 5).forEach(violation => {
          body += `  - ${violation.code || 'ERROR'}: ${violation.message || 'No details'}\n`;
        });
        if (violations.length > 5) {
          body += `  - ...and ${violations.length - 5} more\n`;
        }
      }
    });
    body += '\n';
  }

  body += `[View Details](${checkUrl})\n\n`;
  body += `<!-- cogni:summary v0 sha=${headSha.slice(0, 7)} ts=${Date.now()} -->`;

  return context.octokit.issues.createComment(context.repo({
    issue_number: prNumber,
    body
  }));
}

/**
 * Post PR comment with staleness and PR validation guards
 * @param {Object} context - Probot context
 * @param {Object} runResult - Gate execution results
 * @param {string} checkUrl - URL to GitHub check details
 * @param {string} headShaStart - Original PR head SHA for staleness check
 * @param {number} prNumber - PR number
 */
export async function postPRCommentWithGuards(context, runResult, checkUrl, headShaStart, prNumber) {
  try {
    // PR validation guard - ensure we're commenting on the right PR
    const { data: pr } = await context.octokit.pulls.get(context.repo({ pull_number: prNumber }));
    
    // Validate that the PR head SHA matches what we evaluated
    if (pr.head.sha !== headShaStart) {
      console.log(`📝 Skipping PR comment - PR #${prNumber} head SHA mismatch (expected: ${headShaStart.slice(0, 7)}, actual: ${pr.head.sha.slice(0, 7)})`);
      return;
    }

    // Post the comment since validation passed
    await postPRComment(context, runResult, checkUrl, headShaStart, prNumber);
    console.log(`📝 Posted PR comment for PR #${prNumber}, SHA ${headShaStart.slice(0, 7)}`);
    
  } catch (error) {
    console.error('📝 Failed to post PR comment:', error);
  }
}