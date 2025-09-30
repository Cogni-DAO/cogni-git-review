// src/summary-adapter.js
// Summary formatting functions extracted from index.js

/**
 * Debug function: Format run result as JSON
 * Future: add git gist url link with JSON output for Agents
 */
function formatRunSummaryJSON(runResult) {
  const gates = Array.isArray(runResult?.gates) ? runResult.gates : [];
  const failed = gates.filter(g => g.status === 'fail');
  const neutral = gates.filter(g => g.status === 'neutral'); 
  // const passed = gates.filter(g => g.status === 'pass');L
  
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
 * Format gate results into detailed per-gate markdown report
 */
function formatGateResults(runResult) {
  const gates = Array.isArray(runResult?.gates) ? runResult.gates : [];
  
  // Group gates by status and sort alphabetically within groups
  const groups = { fail: [], pass: [], neutral: [] };
  for (const g of gates) {
    groups[g.status]?.push(g);
  }
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => getLabel(a).localeCompare(getLabel(b)));
  }
  
  // Calculate counts
  const counts = {
    fail: groups.fail.length,
    pass: groups.pass.length, 
    neutral: groups.neutral.length
  };
  
  // Generate summary line
  let summary;
  if (gates.length === 0) {
    summary = 'No gates configured';
  } else if (counts.fail > 0) {
    summary = `Gate failures: ${counts.fail}`;
  } else if (counts.neutral > 0) {
    summary = `Gates neutral: ${counts.neutral}`;
  } else {
    summary = 'All gates passed';
  }
  
  // Generate detailed text
  let text = '';
  
  // Header with verdict, counts, duration
  const verdict = runResult.overall_status === 'fail' ? '❌ FAIL' : 
                  runResult.overall_status === 'pass' ? '✅ PASS' : '⚠️ NEUTRAL';
  text += `**${verdict}**\n\n`;
  text += `✅ ${counts.pass} passed | ❌ ${counts.fail} failed | ⚠️ ${counts.neutral} neutral`;
  if (runResult.duration_ms) {
    text += ` | ${runResult.duration_ms}ms`;
  }
  text += '\n\n';
  
  // Render gates in order: fail, pass, neutral
  for (const status of ['fail', 'pass', 'neutral']) {
    for (const gate of groups[status]) {
      text += renderGate(gate, status);
    }
  }
  
  return { summary, text };
}

/**
 * Get display label for a gate
 */
function getLabel(gate) {
  if (gate.id) return gate.id;
  if (gate.with?.rule_file) {
    return gate.with.rule_file.replace(/\.[^/.]+$/, ''); // Remove extension
  }
  return 'unknown_gate';
}

/**
 * Render a single gate section
 */
function renderGate(gate, status) {
  // Title with big status emoji
  const emoji = status === 'fail' ? '❌' : 
                status === 'pass' ? '✅' : '⚠️';
  let section = `### ${emoji} ${getLabel(gate)}\n\n`;
  
  // DEBUG: Log entire gate object to see actual structure
  console.log('🔍 Summary-Adapter DEBUG - Full gate object:', JSON.stringify(gate, null, 2));
  
  // AI rule metrics from new structured format
  const criteria = gate.rule?.success_criteria?.require || [];
  for (const criterion of criteria) {
    const metricName = criterion.metric;
    const actualValue = gate.providerResult?.metrics?.[metricName];
    if (actualValue !== undefined) {
      const operator = Object.keys(criterion).find(key => key !== 'metric');
      const threshold = criterion[operator];
      section += `- **${metricName}:** ${actualValue} / ${operator} / ${threshold}\n`;
    }
  }
  
  if (gate.rule?.['evaluation-statement']) {
    section += `- **Statement:** ${gate.rule['evaluation-statement']}\n`;
  }
  
  // Violations
  const violations = gate.violations || [];
  if (violations.length > 0) {
    section += `- **Violations (${violations.length}):**\n`;
    for (const v of violations.slice(0, 20)) {
      section += `  - ${v.code || 'ERROR'} — ${v.message || 'No message'}\n`;
      if (v.path) section += `    - Path: ${v.path}\n`;
      if (v.meta && Object.keys(v.meta).length > 0) {
        section += `    - Meta: ${JSON.stringify(v.meta)}\n`;
      }
    }
    if (violations.length > 20) {
      section += `  - ...and ${violations.length - 20} more\n`;
    }
  }
  
  // Observations
  const observations = gate.observations || gate.annotations || [];
  if (observations.length > 0) {
    section += `- **Observations:**\n`;
    for (const obs of observations.slice(0, 20)) {
      const obsText = typeof obs === 'string' ? obs : (obs.message || obs.code || String(obs));
      const truncated = obsText.length > 1000 ? obsText.slice(0, 1000) + '...' : obsText;
      section += `  - ${truncated}\n`;
    }
    if (observations.length > 20) {
      section += `  - ...and ${observations.length - 20} more\n`;
    }
  }
  
  // Stats (exclude score/threshold already shown)
  const stats = gate.stats || {};
  const statsToShow = Object.entries(stats).filter(([key, value]) => {
    return key !== 'score' && key !== 'threshold' && key !== 'rule_id' && key !== 'statement' &&
           (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean');
  });
  
  if (statsToShow.length > 0) {
    section += `- **Stats:**\n`;
    for (const [key, value] of statsToShow) {
      section += `  - ${key}: ${value}\n`;
    }
  }
  
  // Duration
  if (gate.duration_ms != null) {
    section += `- **Duration:** ${gate.duration_ms}ms\n`;
  }
  
  // Model info from provenance
  if (gate.provenance?.modelConfig?.provider && gate.provenance?.modelConfig?.model) {
    section += `- **Model:** ${gate.provenance.modelConfig.provider} / ${gate.provenance.modelConfig.model}\n`;
  }
  
  // Neutral reason
  if (status === 'neutral' && gate.neutral_reason) {
    section += `- **Reason:** ${gate.neutral_reason}\n`;
  }
  
  section += '\n';
  return section;
}

// Use the working formatter by default, keep JSON for debugging
const renderCheckSummary = formatGateResults;

export { renderCheckSummary, formatGateResults, formatRunSummaryJSON };