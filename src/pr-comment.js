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
      const msg = (gate.violations && gate.violations[0] && gate.violations[0].message) || 'Failed';
      const label = gate.id || (gate.with && gate.with.rule_file) || 'unknown_gate';
      body += `- **${label}**: ${msg}\n`;
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
 * Post PR comment with staleness guard
 * @param {Object} context - Probot context
 * @param {Object} runResult - Gate execution results
 * @param {string} checkUrl - URL to GitHub check details
 * @param {string} headShaStart - Original PR head SHA
 * @param {number} prNumber - PR number
 */
export async function postPRCommentWithGuards(context, runResult, checkUrl, headShaStart, prNumber) {
  try {
    // Staleness guard - check if head SHA changed during run
    const { data: latest } = await context.octokit.pulls.get(context.repo({ pull_number: prNumber }));
    if (latest.head.sha === headShaStart) {
      await postPRComment(context, runResult, checkUrl, headShaStart, prNumber);
      console.log(`📝 Posted PR comment for PR #${prNumber}, SHA ${headShaStart.slice(0, 7)}`);
    } else {
      console.log(`📝 Skipping PR comment - head SHA changed during run (${headShaStart.slice(0, 7)} -> ${latest.head.sha.slice(0, 7)})`);
    }
  } catch (error) {
    console.error('📝 Failed to post PR comment:', error);
  }
}