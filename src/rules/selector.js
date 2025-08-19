/**
 * Rule Selection System
 * 
 * Filters loaded rules based on PR changes using path globs and normalized diff kinds.
 * Handles GitHub event mapping and ensures consistent rule application.
 */

import minimatch from 'minimatch';

/**
 * Select rules applicable to PR changes based on selectors
 * 
 * @param {Array<Rule>} rules - Loaded and validated rules
 * @param {Object} prContext - PR change context
 * @param {Array<Object>} prContext.changed_files - Files changed in PR
 * @param {Object} prContext.hunks_by_file - Change hunks grouped by file
 * @returns {Array<Rule>} Rules whose selectors match the PR changes
 */
export function selectApplicableRules(rules, prContext) {
  if (!rules || rules.length === 0) {
    return [];
  }

  const { changed_files = [] } = prContext;
  
  // Normalize file changes to our standard format
  const normalizedChanges = changed_files.map(file => ({
    path: file.filename || file.path,
    kinds: normalizeDiffKinds(file)
  }));

  return rules.filter(rule => {
    return ruleMatchesChanges(rule, normalizedChanges);
  });
}

/**
 * Check if a rule's selectors match the PR changes
 * 
 * @param {Rule} rule - Rule with selectors to evaluate
 * @param {Array<Object>} changes - Normalized file changes
 * @returns {boolean} True if rule applies to these changes
 */
function ruleMatchesChanges(rule, changes) {
  const { selectors } = rule;
  
  // If no selectors defined or malformed, rule matches nothing (fail safe)
  if (!selectors || (Object.keys(selectors).length === 0)) {
    return false;
  }
  
  // Validate selectors structure
  const { paths, diff_kinds } = selectors;
  if (!Array.isArray(paths) || paths.length === 0) {
    return false; // Invalid or empty paths
  }
  if (diff_kinds !== undefined && (!Array.isArray(diff_kinds) || diff_kinds.length === 0)) {
    return false; // Invalid or empty diff_kinds
  }

  // Check if any changed file matches the rule's criteria
  return changes.some(change => {
    // Check path selectors
    if (selectors.paths && selectors.paths.length > 0) {
      const pathMatches = selectors.paths.some(pattern => 
        minimatch(change.path, pattern, { dot: true })
      );
      if (!pathMatches) {
        return false; // Path doesn't match, rule doesn't apply
      }
    }

    // Check diff_kinds selectors
    if (selectors.diff_kinds && selectors.diff_kinds.length > 0) {
      const kindMatches = selectors.diff_kinds.some(requiredKind =>
        change.kinds.includes(requiredKind)
      );
      if (!kindMatches) {
        return false; // Diff kind doesn't match, rule doesn't apply
      }
    }

    return true; // All selectors match
  });
}

/**
 * Normalize GitHub file status to standard diff kinds
 * 
 * Handles the complexity of GitHub's file status mapping to our canonical set:
 * {add, modify, delete, rename}
 * 
 * @param {Object} file - GitHub file change object
 * @returns {Array<string>} Array of normalized diff kinds
 */
function normalizeDiffKinds(file) {
  const status = file.status?.toLowerCase();
  const hasChanges = (file.changes || 0) > 0 || (file.additions || 0) > 0 || (file.deletions || 0) > 0;
  
  switch (status) {
    case 'added':
      return ['add'];
      
    case 'removed':
    case 'deleted':
      return ['delete'];
      
    case 'modified':
      return ['modify'];
      
    case 'renamed':
      // Handle GitHub's complex rename cases
      if (hasChanges) {
        // File was renamed AND content changed
        return ['rename', 'modify'];
      } else {
        // File was only renamed (no content changes)
        return ['rename'];
      }
      
    case 'copied':
      // Treat copy as add (new file created)
      return ['add'];
      
    default:
      // Unknown status - default to modify as safest assumption
      console.warn(`Unknown file status '${status}' for ${file.filename || file.path}, defaulting to 'modify'`);
      return ['modify'];
  }
}

/**
 * Get summary of rule selection results for debugging
 * 
 * @param {Array<Rule>} allRules - All loaded rules
 * @param {Array<Rule>} selectedRules - Rules selected for execution
 * @param {Array<Object>} changes - PR changes that drove selection
 * @returns {string} Human-readable selection summary
 */
export function getSelectionSummary(allRules, selectedRules, changes) {
  if (allRules.length === 0) {
    return 'No rules loaded';
  }

  const changesSummary = changes.map(c => `${c.path}:${c.kinds.join(',')}`).join('; ');
  
  if (selectedRules.length === 0) {
    return `No rules selected from ${allRules.length} total (changes: ${changesSummary})`;
  }

  const selectedIds = selectedRules.map(r => r.rule_key).join(', ');
  return `${selectedRules.length}/${allRules.length} rules selected: ${selectedIds} (changes: ${changesSummary})`;
}

/**
 * Analyze why specific rules were not selected (debugging utility)
 * 
 * @param {Array<Rule>} unselectedRules - Rules that didn't match
 * @param {Array<Object>} changes - PR changes
 * @returns {Array<Object>} Analysis of why each rule was skipped
 */
export function analyzeUnselectedRules(unselectedRules, changes) {
  return unselectedRules.map(rule => {
    const reasons = [];
    
    if (!rule.selectors) {
      reasons.push('No selectors defined (should have matched - this is unexpected)');
      return { rule_key: rule.rule_key, reasons };
    }

    // Check path selector mismatches
    if (rule.selectors.paths && rule.selectors.paths.length > 0) {
      const changedPaths = changes.map(c => c.path);
      const pathMatches = changedPaths.some(path =>
        rule.selectors.paths.some(pattern => minimatch(path, pattern, { dot: true }))
      );
      if (!pathMatches) {
        reasons.push(`Path patterns [${rule.selectors.paths.join(', ')}] don't match changed files [${changedPaths.join(', ')}]`);
      }
    }

    // Check diff_kinds selector mismatches  
    if (rule.selectors.diff_kinds && rule.selectors.diff_kinds.length > 0) {
      const allKinds = [...new Set(changes.flatMap(c => c.kinds))];
      const kindMatches = rule.selectors.diff_kinds.some(requiredKind =>
        allKinds.includes(requiredKind)
      );
      if (!kindMatches) {
        reasons.push(`Diff kinds [${rule.selectors.diff_kinds.join(', ')}] don't match PR changes [${allKinds.join(', ')}]`);
      }
    }

    if (reasons.length === 0) {
      reasons.push('Unknown reason (selector logic may have changed)');
    }

    return { rule_key: rule.rule_key, reasons };
  });
}

/**
 * Validate selector syntax and warn about common mistakes
 * 
 * @param {Array<Rule>} rules - Rules to validate
 * @returns {Array<Object>} Validation warnings
 */
export function validateSelectors(rules) {
  const warnings = [];

  for (const rule of rules) {
    if (!rule.selectors) {
      warnings.push({
        rule_key: rule.rule_key,
        type: 'missing_selectors',
        message: 'Rule has no selectors - will match ALL changes (may be unintended)'
      });
      continue;
    }

    // Validate path patterns
    if (rule.selectors.paths) {
      for (const pattern of rule.selectors.paths) {
        if (typeof pattern !== 'string' || pattern.length === 0) {
          warnings.push({
            rule_key: rule.rule_key,
            type: 'invalid_path_pattern',
            message: `Empty or non-string path pattern: ${pattern}`
          });
        }
        
        // Warn about overly broad patterns
        if (pattern === '**' || pattern === '**/*') {
          warnings.push({
            rule_key: rule.rule_key,
            type: 'overly_broad_pattern',
            message: `Pattern '${pattern}' matches all files - consider being more specific`
          });
        }
      }
    }

    // Validate diff_kinds
    if (rule.selectors.diff_kinds) {
      const validKinds = ['add', 'modify', 'delete', 'rename'];
      for (const kind of rule.selectors.diff_kinds) {
        if (!validKinds.includes(kind)) {
          warnings.push({
            rule_key: rule.rule_key,
            type: 'invalid_diff_kind',
            message: `Invalid diff_kind '${kind}' - valid options: ${validKinds.join(', ')}`
          });
        }
      }
    }
  }

  return warnings;
}