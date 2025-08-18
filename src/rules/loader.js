/**
 * Rule Loading and Validation System
 * 
 * Loads declarative AI rules from .cogni/rules/*.yaml files with robust error handling.
 * Implements canonical rule key generation and zero-valid-rules diagnostics.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import Ajv from 'ajv';

// Load rule schema for validation (keep existing for now)
const SCHEMA_PATH = path.join(process.cwd(), 'src/ai/schemas/rule-spec.schema.json');
const ruleSchema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'));

const ajv = new Ajv({ allErrors: true, verbose: true });
const validateRule = ajv.compile(ruleSchema);

/**
 * Load and validate rules from directory with explicit enablement
 * 
 * @param {Object} config - Loading configuration
 * @param {string} config.rules_dir - Directory containing rule files
 * @param {Array<string>} config.enabled - Explicitly enabled rule files
 * @param {boolean} config.blocking_default - Default blocking behavior
 * @returns {Promise<Object>} { rules: Array<Rule>, diagnostics: Array<Diagnostic> }
 */
export async function loadRules(config) {
  const { rules_dir, enabled = [], blocking_default = true } = config;
  const rules = [];
  const diagnostics = [];
  const usedRuleKeys = new Set();

  // Check if rules directory exists
  if (!fs.existsSync(rules_dir)) {
    return {
      rules: [],
      diagnostics: [{
        type: 'directory_missing',
        message: `Rules directory not found: ${rules_dir}`,
        file: null,
        severity: 'info'
      }]
    };
  }

  // Process each enabled rule file
  for (const enabledFile of enabled) {
    const filePath = path.join(rules_dir, enabledFile);
    
    try {
      const result = await loadSingleRule(filePath, blocking_default);
      
      if (result.success) {
        // Check for duplicate rule keys
        const ruleKey = result.rule.rule_key;
        if (usedRuleKeys.has(ruleKey)) {
          diagnostics.push({
            type: 'duplicate_rule_key',
            message: `Duplicate rule key '${ruleKey}' found in ${enabledFile}`,
            file: enabledFile,
            severity: 'error'
          });
          continue; // Skip this rule
        }
        
        usedRuleKeys.add(ruleKey);
        rules.push(result.rule);
      } else {
        diagnostics.push({
          type: 'rule_load_failed',
          message: result.error,
          file: enabledFile,
          severity: 'error'
        });
      }
    } catch (error) {
      diagnostics.push({
        type: 'unexpected_error',
        message: `Unexpected error loading ${enabledFile}: ${error.message}`,
        file: enabledFile,
        severity: 'error'
      });
    }
  }

  // If zero valid rules after processing, add diagnostic
  if (enabled.length > 0 && rules.length === 0) {
    diagnostics.push({
      type: 'no_valid_rules',
      message: `No valid rules loaded from ${enabled.length} enabled files`,
      file: null,
      severity: 'warning',
      details: `Enabled files: ${enabled.join(', ')}`
    });
  }

  return { rules, diagnostics };
}

/**
 * Load and validate a single rule file
 * 
 * @param {string} filePath - Path to rule YAML file
 * @param {boolean} blockingDefault - Default blocking behavior
 * @returns {Promise<Object>} { success: boolean, rule?: Rule, error?: string }
 */
async function loadSingleRule(filePath, blockingDefault) {
  // Check file exists
  if (!fs.existsSync(filePath)) {
    return {
      success: false,
      error: `Rule file not found: ${path.basename(filePath)}`
    };
  }

  // Read and parse YAML
  let ruleData;
  try {
    const yamlContent = fs.readFileSync(filePath, 'utf-8');
    ruleData = yaml.load(yamlContent);
  } catch (yamlError) {
    return {
      success: false,
      error: `YAML parse error: ${yamlError.message}`
    };
  }

  // Validate against JSON Schema
  const isValid = validateRule(ruleData);
  if (!isValid) {
    const errors = validateRule.errors
      .map(err => `${err.instancePath || 'root'}: ${err.message}`)
      .join('; ');
    return {
      success: false,
      error: `Schema validation failed: ${errors}`
    };
  }

  // Generate canonical rule key
  const ruleKey = generateRuleKey(ruleData, filePath);

  // Apply defaults and enrich rule
  const enrichedRule = {
    ...ruleData,
    rule_key: ruleKey,
    // Apply blocking default if not explicitly set
    blocking: ruleData.blocking !== undefined ? ruleData.blocking : blockingDefault,
    // Add metadata
    _metadata: {
      filePath,
      fileName: path.basename(filePath),
      loadedAt: new Date().toISOString(),
      schemaVersion: ruleData.schema_version
    }
  };

  return {
    success: true,
    rule: enrichedRule
  };
}

/**
 * Generate canonical rule key with collision prevention
 * 
 * @param {Object} ruleData - Parsed rule data
 * @param {string} filePath - Source file path
 * @returns {string} Canonical rule key
 */
function generateRuleKey(ruleData, filePath) {
  // Prefer rule.id if valid
  if (ruleData.id && typeof ruleData.id === 'string' && ruleData.id.trim().length > 0) {
    return ruleData.id;
  }

  // Fallback to filename stem (without extension)
  const fileName = path.basename(filePath);
  const stem = fileName.replace(/\.(yaml|yml)$/i, '');
  
  // Ensure valid identifier format
  return stem.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

/**
 * Validate rule consistency across loaded set
 * 
 * @param {Array<Rule>} rules - Array of loaded rules
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export function validateRuleConsistency(rules) {
  const errors = [];
  const checkedPrompts = new Set();
  const supportedVariables = new Set(['goals', 'non_goals', 'pr_title', 'pr_body', 'diff_summary']);

  for (const rule of rules) {
    // Validate prompt template exists (check once per template)
    if (!checkedPrompts.has(rule.prompt.template)) {
      const promptPath = path.join(process.cwd(), rule.prompt.template);
      if (!fs.existsSync(promptPath)) {
        errors.push(`Prompt template not found: ${rule.prompt.template} (rule: ${rule.rule_key})`);
      }
      checkedPrompts.add(rule.prompt.template);
    }

    // Validate prompt variables are supported by evidence system
    for (const variable of rule.prompt.variables) {
      if (!supportedVariables.has(variable)) {
        errors.push(`Unsupported prompt variable '${variable}' in rule ${rule.rule_key} (supported: ${Array.from(supportedVariables).join(', ')})`);
      }
    }

    // Validate success criteria consistency  
    if (rule.success_criteria.metric === 'score' && 
        (rule.success_criteria.threshold === undefined || rule.success_criteria.threshold === null)) {
      errors.push(`Score metric requires threshold in rule ${rule.rule_key}`);
    }

    // Validate schema version compatibility
    if (rule.schema_version !== '0.1') {
      errors.push(`Unsupported schema version '${rule.schema_version}' in rule ${rule.rule_key} (supported: 0.1)`);
    }

    // Apply default severity if not specified
    if (!rule.severity) {
      rule.severity = 'error';
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get human-readable summary of rule loading results
 * 
 * @param {Array<Rule>} rules - Loaded rules
 * @param {Array<Diagnostic>} diagnostics - Loading diagnostics
 * @returns {string} Summary string for logging/debugging
 */
export function getRulesSummary(rules, diagnostics) {
  if (rules.length === 0) {
    const errorCount = diagnostics.filter(d => d.severity === 'error').length;
    if (errorCount > 0) {
      return `No valid rules loaded (${errorCount} errors)`;
    }
    return 'No rules configured';
  }

  const blocking = rules.filter(r => r.blocking).length;
  const nonBlocking = rules.length - blocking;
  const byType = rules.reduce((acc, rule) => {
    acc[rule.severity] = (acc[rule.severity] || 0) + 1;
    return acc;
  }, {});

  let summary = `${rules.length} rules loaded: ${blocking} blocking, ${nonBlocking} non-blocking. `;
  summary += `Severity: ${byType.error || 0} error, ${byType.warning || 0} warning, ${byType.info || 0} info.`;

  if (diagnostics.length > 0) {
    const warnings = diagnostics.filter(d => d.severity === 'warning').length;
    const errors = diagnostics.filter(d => d.severity === 'error').length;
    summary += ` (${errors} load errors, ${warnings} warnings)`;
  }

  return summary;
}