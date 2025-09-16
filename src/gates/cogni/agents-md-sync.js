/**
 * AGENTS.md Synchronization Gate - Ensures documentation updates with code changes
 * Part of Cogni Gate Evaluation system
 */

import path from 'node:path';
import micromatch from 'micromatch';

// Gate registry contract exports
export const type = 'agents-md-sync';

/**
 * Registry-compatible run function for agents-sync gate
 * @param {object} ctx - Run context with octokit, pr, etc.
 * @param {object} gate - Gate configuration from spec
 * @returns {Promise<object>} Normalized gate result
 */
export async function run(ctx, gate) {
  try {
    // Get configuration with defaults
    const config = gate.with || {};
    const codePatterns = config.code_patterns || ['**/*.*'];
    const docPattern = config.doc_pattern || 'AGENTS.md';

    // Get changed files from GitHub API
    const { data: changedFiles } = await ctx.octokit.pulls.listFiles(
      ctx.repo({ pull_number: ctx.pr.number })
    );

    // Filter for code changes (exclude documentation files and removed files)
    const codeChanges = changedFiles.filter(file => {
      // Skip removed files
      if (file.status === 'removed') return false;
      
      // Skip documentation files
      if (file.filename.endsWith(docPattern)) return false;
      if (file.filename.includes('README') || file.filename.includes('CHANGELOG')) return false;
      if (file.filename.endsWith('.md')) return false;
      
      // Check if file matches any code pattern using proper glob matching
      return codePatterns.some(pattern => micromatch.isMatch(file.filename, pattern));
    });

    // For each code change, check if corresponding AGENTS.md was updated
    const violations = [];
    const checkedDirs = new Set(); // Avoid duplicate checks for same directory

    for (const file of codeChanges) {
      const fileDir = path.dirname(file.filename);
      
      // Skip if we already checked this directory
      if (checkedDirs.has(fileDir)) continue;
      checkedDirs.add(fileDir);

      const expectedDocPath = path.join(fileDir, docPattern);
      
      // Check if the expected documentation file was updated
      const docUpdated = changedFiles.some(f => f.filename === expectedDocPath);
      
      if (!docUpdated) {
        violations.push({
          code: 'MISSING_AGENTS_UPDATE',
          message: `Code changes in ${fileDir}/ but ${expectedDocPath} not updated`,
          path: file.filename,
          meta: { 
            expected_doc_path: expectedDocPath,
            changed_file: file.filename,
            directory: fileDir
          }
        });
      }
    }

    // Return gate result
    return {
      status: violations.length > 0 ? 'fail' : 'pass',
      violations,
      stats: {
        total_changed_files: changedFiles.length,
        code_changes_found: codeChanges.length,
        directories_checked: checkedDirs.size,
        violations_found: violations.length
      }
    };

  } catch (error) {
    // If GitHub API fails, return neutral so PR isn't blocked
    return {
      status: 'neutral',
      neutral_reason: 'api_error',
      violations: [],
      stats: { error: error.message }
    };
  }
}