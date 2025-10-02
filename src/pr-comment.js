/**
 * PR Comment Publisher - MVP Implementation
 * Posts developer-friendly summary comments on PRs
 */

import { getRequestLogger } from './logging/index.js';

/**
 * Post PR comment with gate results summary
 * @param {Object} context - Probot context
 * @param {Object} runResult - Gate execution results
 * @param {string} checkUrl - URL to GitHub check details
 * @param {string} headSha - PR head SHA for staleness guard
 * @param {number} prNumber - PR number
 */
export async function postPRComment(context, runResult, checkUrl, headSha, prNumber) {
  const { gates, overall_status } = runResult;
  const failed = gates.filter(g => g.status === 'fail');
  const neutral = gates.filter(g => g.status === 'neutral');
  const passed = gates.filter(g => g.status === 'pass');

  const verdict = overall_status === 'fail' ? '❌ FAIL' 
                : overall_status === 'pass' ? '✅ PASS' 
                : '⚠️ WARN';

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
        // Check if this is an AI gate with structured data
        const requireCriteria = gate.rule?.success_criteria?.require || [];
        const anyOfCriteria = gate.rule?.success_criteria?.any_of || [];
        const allCriteria = [...requireCriteria, ...anyOfCriteria];
        
        if (gate.providerResult?.metrics && allCriteria.length > 0) {
          // Display structured metrics vs criteria
          for (const criterion of allCriteria) {
            const metricName = criterion.metric;
            const metricData = gate.providerResult.metrics[metricName];
            if (metricData) {
              const operator = Object.keys(criterion).find(key => key !== 'metric');
              const threshold = criterion[operator];
              body += `  - ${metricName}: ${metricData.value} / ${operator} / ${threshold}\n`;
            }
          }
        } else if (gate.stats?.score != null && gate.stats?.threshold != null) {
          // Legacy format fallback for traditional gates
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
 * Post PR comment with staleness guard
 * @param {Object} context - Probot context
 * @param {Object} runResult - Gate execution results
 * @param {string} checkUrl - URL to GitHub check details
 * @param {string} headShaStart - Original PR head SHA
 * @param {number} prNumber - PR number
 */
export async function postPRCommentWithGuards(context, runResult, checkUrl, headShaStart, prNumber) {
  const log = getRequestLogger(context, { module: "pr-comment", pr: prNumber });
  
  try {
    // Staleness guard - check if head SHA changed during run
    const { data: latest } = await context.octokit.pulls.get(context.repo({ pull_number: prNumber }));
    if (latest.head.sha === headShaStart) {
      await postPRComment(context, runResult, checkUrl, headShaStart, prNumber);
      log.info({ sha: headShaStart?.slice(0, 7) }, "posted PR comment");
    } else {
      log.info({ old_sha: headShaStart?.slice(0, 7), new_sha: latest.head.sha?.slice(0, 7) }, "skipping PR comment: head SHA changed");
    }
  } catch (error) {
    log.error({ err: error }, "failed to post PR comment");
  }
}