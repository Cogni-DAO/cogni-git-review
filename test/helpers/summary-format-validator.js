/**
 * Test helper for validating the new summary format
 * 
 * This provides DRY assertions for the updated formatGateResults output
 * that replaced the old "Gates: X total" format with detailed per-gate sections.
 */

/**
 * Assert that text contains the new gate count format
 * Old format: "Gates: 3 total"
 * New format: "✅ 2 passed | ❌ 1 failed | ⚠️ 0 neutral"
 */
export function assertGateCountsFormat(text, expectedTotal) {
  // Look for the gate counts line with emojis
  const gateCountsRegex = /✅\s*(\d+)\s+passed\s*\|\s*❌\s*(\d+)\s+failed\s*\|\s*⚠️\s*(\d+)\s+neutral/;
  const match = text.match(gateCountsRegex);
  
  if (!match) {
    throw new Error(`Expected new gate counts format "✅ X passed | ❌ Y failed | ⚠️ Z neutral" in text: ${text}`);
  }
  
  const [, passed, failed, neutral] = match;
  const actualTotal = parseInt(passed) + parseInt(failed) + parseInt(neutral);
  
  if (actualTotal !== expectedTotal) {
    throw new Error(`Expected ${expectedTotal} total gates, got ${actualTotal} (✅${passed} ❌${failed} ⚠️${neutral})`);
  }
  
  return { passed: parseInt(passed), failed: parseInt(failed), neutral: parseInt(neutral) };
}

/**
 * Assert that text contains the new verdict format
 * Old format: Variable summary text
 * New format: "**❌ FAIL**" or "**✅ PASS**" or "**⚠️ NEUTRAL**"
 */
export function assertVerdictFormat(text, expectedVerdict) {
  const expectedEmoji = expectedVerdict === 'fail' ? '❌' : 
                        expectedVerdict === 'pass' ? '✅' : '⚠️';
  const expectedText = expectedVerdict.toUpperCase();
  
  const verdictRegex = new RegExp(`\\*\\*${expectedEmoji}\\s+${expectedText}\\*\\*`);
  
  if (!text.match(verdictRegex)) {
    throw new Error(`Expected verdict format "**${expectedEmoji} ${expectedText}**" in text: ${text}`);
  }
}

/**
 * Assert that text contains gate sections with emoji titles
 * New format: "### ❌ gate_name" or "### ✅ gate_name"
 */
export function assertGateSections(text, expectedGates) {
  for (const gate of expectedGates) {
    const emoji = gate.status === 'fail' ? '❌' : 
                  gate.status === 'pass' ? '✅' : '⚠️';
    const sectionRegex = new RegExp(`###\\s+${emoji}\\s+${gate.id}`);
    
    if (!text.match(sectionRegex)) {
      throw new Error(`Expected gate section "### ${emoji} ${gate.id}" in text: ${text}`);
    }
  }
}

/**
 * Comprehensive assertion for the new summary format
 * Replaces old "Gates: X total" checks
 */
export function assertNewSummaryFormat(text, options = {}) {
  const { 
    expectedTotal, 
    expectedVerdict,
    expectedGates = [],
    requiresDuration = false 
  } = options;
  
  // Check verdict format
  if (expectedVerdict) {
    assertVerdictFormat(text, expectedVerdict);
  }
  
  // Check gate counts
  if (expectedTotal !== undefined) {
    assertGateCountsFormat(text, expectedTotal);
  }
  
  // Check gate sections
  if (expectedGates.length > 0) {
    assertGateSections(text, expectedGates);
  }
  
  // Check duration is present if required
  if (requiresDuration) {
    if (!/\d+ms/.test(text)) {
      throw new Error(`Expected duration in milliseconds in text: ${text}`);
    }
  }
}

/**
 * Legacy compatibility: matches the old "Gates: X total" pattern
 * Use this for quick migration of existing tests
 */
export function createGatesTotalRegex(expectedCount) {
  // Return a regex that matches the new format's total count
  return new RegExp(`✅\\s*\\d+\\s+passed\\s*\\|\\s*❌\\s*\\d+\\s+failed\\s*\\|\\s*⚠️\\s*\\d+\\s+neutral`);
}