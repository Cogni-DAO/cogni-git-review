/**
 * Runtime Guards for Standard AI Rule Evaluation Format
 * 
 * Validates rule schemas and provider results to ensure conformance
 * with the standardized evaluation design.
 */

/**
 * Validates AI rule has proper matrix success_criteria format
 * @param {Object} rule - Rule object loaded from YAML
 * @throws {Error} If rule format is invalid with descriptive message
 */
export function assertRuleSchema(rule) {
  if (!rule) {
    throw new Error('Rule is null or undefined');
  }

  if (!rule.success_criteria) {
    throw new Error(`Rule "${rule.id || 'unknown'}" missing success_criteria section`);
  }

  const sc = rule.success_criteria;

  // Check for matrix format (not legacy threshold format)
  if (sc.threshold !== undefined || sc.metric !== undefined) {
    throw new Error(
      `Rule "${rule.id}" uses legacy format (threshold/metric). ` +
      `Use matrix format: { require: [{ metric: "score", gte: 0.8 }] }`
    );
  }

  // Validate require array if present
  if (sc.require) {
    if (!Array.isArray(sc.require)) {
      throw new Error(`Rule "${rule.id}" success_criteria.require must be an array`);
    }

    for (const [i, req] of sc.require.entries()) {
      validateMetricComparison(req, `Rule "${rule.id}" success_criteria.require[${i}]`);
    }
  }

  // Validate any_of array if present
  if (sc.any_of) {
    if (!Array.isArray(sc.any_of)) {
      throw new Error(`Rule "${rule.id}" success_criteria.any_of must be an array`);
    }

    for (const [i, req] of sc.any_of.entries()) {
      validateMetricComparison(req, `Rule "${rule.id}" success_criteria.any_of[${i}]`);
    }
  }

  // Validate neutral_on_missing_metrics if present
  if (sc.neutral_on_missing_metrics !== undefined && typeof sc.neutral_on_missing_metrics !== 'boolean') {
    throw new Error(`Rule "${rule.id}" success_criteria.neutral_on_missing_metrics must be boolean`);
  }

  // Must have at least require or any_of
  if (!sc.require && !sc.any_of) {
    throw new Error(
      `Rule "${rule.id}" success_criteria must have either "require" or "any_of" array`
    );
  }
}

/**
 * Validates a single metric comparison object
 * @param {Object} comp - Comparison object like { metric: "score", gte: 0.8 }
 * @param {string} context - Context for error messages
 */
function validateMetricComparison(comp, context) {
  if (!comp || typeof comp !== 'object') {
    throw new Error(`${context}: must be an object`);
  }

  if (!comp.metric || typeof comp.metric !== 'string') {
    throw new Error(`${context}: must have "metric" string field`);
  }

  // Check for valid comparison operators
  const validOps = ['gte', 'gt', 'lte', 'lt', 'eq'];
  const foundOps = validOps.filter(op => comp[op] !== undefined);

  if (foundOps.length === 0) {
    throw new Error(
      `${context}: must have one comparison operator: ${validOps.join(', ')}`
    );
  }

  if (foundOps.length > 1) {
    throw new Error(
      `${context}: can only have one comparison operator, found: ${foundOps.join(', ')}`
    );
  }

  // Validate operator values are numbers
  for (const op of foundOps) {
    if (typeof comp[op] !== 'number') {
      throw new Error(`${context}: ${op} value must be a number, got ${typeof comp[op]}`);
    }
  }
}

/**
 * Validates provider result follows standard_ai_rule_eval format
 * @param {Object} result - Provider result object from evaluateWithWorkflow()
 * @throws {Error} If result format is invalid with descriptive message
 */
export function assertProviderResultShape(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('Provider result must be an object');
  }

  // Required: metrics (object with number values)
  if (!result.metrics || typeof result.metrics !== 'object') {
    throw new Error('Provider result missing required "metrics" object');
  }

  if (Array.isArray(result.metrics)) {
    throw new Error('Provider result "metrics" must be object, not array');
  }

  // Validate metrics values are numbers
  for (const [key, value] of Object.entries(result.metrics)) {
    if (typeof value !== 'number') {
      throw new Error(
        `Provider result metrics["${key}"] must be number, got ${typeof value}`
      );
    }
  }

  // Required: observations (array of strings)
  if (!Array.isArray(result.observations)) {
    throw new Error('Provider result missing required "observations" array');
  }

  for (const [i, obs] of result.observations.entries()) {
    if (typeof obs !== 'string') {
      throw new Error(
        `Provider result observations[${i}] must be string, got ${typeof obs}`
      );
    }
  }

  // Optional: summary (string if present)
  if (result.summary !== undefined && typeof result.summary !== 'string') {
    throw new Error('Provider result "summary" must be string if present');
  }

  // Optional: provenance (object if present)
  if (result.provenance !== undefined && (typeof result.provenance !== 'object' || Array.isArray(result.provenance))) {
    throw new Error('Provider result "provenance" must be object if present');
  }
}