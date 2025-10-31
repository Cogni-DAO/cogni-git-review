// src/summary-adapter.js
// Summary formatting functions extracted from index.js

/**
 * Generate CogniDAO merge-change URL for failed reviews
 * @param {Object} context - Base context with PR and spec data
 * @param {Object} runResult - Gate execution results
 * @returns {string|null} Merge-change URL or null if not configured or not a failure
 */
function generateMergeChangeURL(context, runResult) {
  // Only show for failed reviews
  if (runResult.overall_status !== 'fail') return null;
  
  const pr = context.payload.pull_request;
  if (!pr) return null;
  
  // Read CogniDAO configuration from repo-spec
  const cogniDAO = context.spec?.cogni_dao;
  if (!cogniDAO?.dao_contract || !cogniDAO?.plugin_contract || !cogniDAO?.signal_contract || !cogniDAO?.chain_id) {
    // DAO configuration incomplete - this should be reported as neutral in the calling gate
    return null;
  }
  
  const params = new URLSearchParams({
    dao: cogniDAO.dao_contract,
    plugin: cogniDAO.plugin_contract,
    signal: cogniDAO.signal_contract,
    chainId: cogniDAO.chain_id,
    repoUrl: encodeURIComponent(pr.head.repo.html_url),
    pr: pr.number.toString(),
    action: "merge",
    target: "change"
  });
  
  let baseUrl = cogniDAO.base_url || "http://localhost:3001";
  
  // Ensure baseUrl has protocol scheme to prevent relative URL issues
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  
  return `${baseUrl}/merge-change?${params.toString()}`;
}

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
 * @param {Object} runResult - Gate execution results
 * @param {Object} context - Base context with PR and spec data (optional)
 */
function formatGateResults(runResult, context = null) {
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
  
  // Generate summary line based on overall status
  let summary;
  if (gates.length === 0) {
    summary = 'No gates configured';
  } else if (runResult.overall_status === 'fail') {
    summary = `Gate failures: ${counts.fail}`;
  } else if (runResult.overall_status === 'neutral') {
    summary = `Gates neutral: ${counts.neutral}`;
  } else {
    summary = 'All gates passed';
  }
  
  // Generate detailed text
  let text = '';
  
  // Add merge-change URL at top for failed reviews
  const mergeChangeURL = context ? generateMergeChangeURL(context, runResult) : null;
  if (mergeChangeURL) {
    text += `🗳️ **<a href="${mergeChangeURL}" target="_blank">Propose Vote to Merge</a>**\n\n`;
  }
  
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
 * Map comparison operators to mathematical symbols
 */
function getOperatorSymbol(operator) {
  const operatorMap = {
    'gte': '>=',
    'lte': '<=', 
    'gt': '>',
    'lt': '<',
    'eq': '='
  };
  return operatorMap[operator] || operator;
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
  // console.log('🔍 Summary-Adapter DEBUG - Full gate object:', JSON.stringify(gate, null, 2));
  
  // AI rule metrics from new structured format
  const requireCriteria = gate.rule?.success_criteria?.require || [];
  const anyOfCriteria = gate.rule?.success_criteria?.any_of || [];
  const allCriteria = [...requireCriteria, ...anyOfCriteria];
  
  for (const criterion of allCriteria) {
    const metricName = criterion.metric;
    const metricData = gate.providerResult?.metrics?.[metricName];
    if (metricData) {
      const operator = Object.keys(criterion).find(key => key !== 'metric');
      const threshold = criterion[operator];
      section += `- **${metricName}:** ${metricData.value} ${getOperatorSymbol(operator)} ${threshold}\n`;
      
      // Show metric-specific observations
      if (metricData.observations && metricData.observations.length > 0) {
        section += `  - **Observations:**\n`;
        for (const obs of metricData.observations.slice(0, 10)) {
          section += `    - ${obs}\n`;
        }
        if (metricData.observations.length > 10) {
          section += `    - ...and ${metricData.observations.length - 10} more\n`;
        }
      }
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
  
  // Legacy observations (for non-AI gates only)
  const observations = gate.observations || gate.annotations || [];
  if (observations.length > 0 && !gate.providerResult) {
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