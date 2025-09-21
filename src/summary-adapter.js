// src/summary-adapter.js
// Summary formatting functions extracted from index.js

/**
 * Debug function: Format run result as JSON
 */
function formatRunSummaryJSON(runResult) {
  const gates = Array.isArray(runResult?.gates) ? runResult.gates : [];
  const failed = gates.filter(g => g.status === 'fail');
  const neutral = gates.filter(g => g.status === 'neutral'); 
  const passed = gates.filter(g => g.status === 'pass');
  
  const title = gates.length === 0 
    ? 'No gates configured'
    : failed.length 
      ? `Gate failures: ${failed.length}`
      : neutral.length 
        ? `All gates passed | Neutral: ${neutral.length}`
        : 'All gates passed';
  
  const text = '```json\n' + JSON.stringify(runResult, null, 2) + '\n```';
  
  return { summary: title, text };
}

/**
 * Format gate results into summary and text for GitHub check
 * (Original logic moved from index.js)
 */
function formatGateResults(runResult) {
  const { gates, early_exit, duration_ms } = runResult;
  
  const failedGates = gates.filter(g => g.status === 'fail');
  const neutralGates = gates.filter(g => g.status === 'neutral');
  const passedGates = gates.filter(g => g.status === 'pass');
  
  // Summary
  let summary;
  if (gates.length === 0) {
    summary = 'No gates configured';
  } else if (failedGates.length > 0) {
    summary = `Gate failures: ${failedGates.length}`;
  } else if (neutralGates.length > 0) {
    const reasons = [...new Set(neutralGates.map(g => g.neutral_reason).filter(Boolean))];
    summary = `Gates neutral: ${reasons.join(', ')}`;
  } else {
    summary = 'All gates passed';
  }
  
  if (early_exit) {
    summary += ' (early exit)';
  }
  
  // Text - detailed breakdown
  let text = `Gates: ${gates.length} total | Duration: ${duration_ms}ms\n\n`;
  
  // Show gate status breakdown
  text += `✅ Passed: ${passedGates.length} | ❌ Failed: ${failedGates.length} | ⚠️ Neutral: ${neutralGates.length}\n\n`;
  
  // Show failed gates first
  if (failedGates.length > 0) {
    text += '**Failures:**\n';
    failedGates.forEach(gate => {
      text += `• **${gate.id}**: ${gate.violations.length} violation(s)\n`;
      gate.violations.slice(0, 3).forEach(v => { // Limit violations shown
        text += `  - ${v.code}: ${v.message}\n`;
      });
      if (gate.violations.length > 3) {
        text += `  - ...and ${gate.violations.length - 3} more\n`;
      }
    });
    text += '\n';
  }
  
  // Show neutral gates
  if (neutralGates.length > 0) {
    text += '**Neutral:**\n';
    neutralGates.forEach(gate => {
      text += `• **${gate.id}**: ${gate.neutral_reason || 'reason unknown'}\n`;
    });
    text += '\n';
  }
  
  // Show passed gates summary
  if (passedGates.length > 0) {
    text += `**Passed:** ${passedGates.map(g => g.id).join(', ')}\n\n`;
  }
  
  // Add stats from review limits if available
  const reviewGate = gates.find(g => g.id === 'review_limits');
  if (reviewGate?.stats) {
    text += `**Stats:** files=${reviewGate.stats.changed_files || 0} | diff_kb=${reviewGate.stats.total_diff_kb || 0}`;
  }
  
  // Add AI score if available. Temporary, only functional when only 1 AI rule. gate output needs refactoring. 
  const rulesGate = gates.find(g => g.id === 'rules');
  if (rulesGate?.stats?.score !== undefined) {
    text += reviewGate?.stats ? ` | AI score=${rulesGate.stats.score}` : `**Stats:** AI score=${rulesGate.stats.score}`;
  }
  
  return { summary, text };
}

// Use the working formatter by default, keep JSON for debugging
const renderCheckSummary = formatGateResults;

export { renderCheckSummary, formatGateResults, formatRunSummaryJSON };