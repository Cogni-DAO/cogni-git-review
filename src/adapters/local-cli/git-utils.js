/**
 * Git CLI utility functions for parsing git command output
 * Provides standardized parsing for git operations used by LocalContext
 */

import { execSync } from 'child_process';

/**
 * Parse git diff --shortstat output into structured data
 * @param {string} statsOutput - Output from git diff --shortstat
 * @returns {[number, number, number]} [files, additions, deletions]
 */
export function parseGitStats(statsOutput) {
  if (!statsOutput || statsOutput.trim() === '') {
    return [0, 0, 0];
  }
  
  // Parse "3 files changed, 25 insertions(+), 7 deletions(-)"
  const match = statsOutput.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
  
  if (!match) {
    return [0, 0, 0];
  }
  
  return [
    parseInt(match[1]) || 0, // files changed
    parseInt(match[2]) || 0, // additions
    parseInt(match[3]) || 0  // deletions
  ];
}

/**
 * Parse git diff --name-status output into file change objects
 * @param {string} nameStatusOutput - Output from git diff --name-status
 * @returns {Array<Object>} Array of file change objects
 */
export function parseGitNameStatus(nameStatusOutput) {
  if (!nameStatusOutput || nameStatusOutput.trim() === '') {
    return [];
  }
  
  return nameStatusOutput.trim().split('\n').map(line => {
    const [status, ...filenameParts] = line.split('\t');
    const filename = filenameParts.join('\t'); // Handle filenames with tabs
    
    // Map git status codes to GitHub API format
    let statusName;
    switch (status.charAt(0)) {
      case 'A': statusName = 'added'; break;
      case 'M': statusName = 'modified'; break;
      case 'D': statusName = 'removed'; break;
      case 'R': statusName = 'renamed'; break;
      case 'C': statusName = 'copied'; break;
      default: statusName = 'modified';
    }
    
    return {
      filename,
      status: statusName,
      additions: 0,    // Would need --numstat for accurate line counts
      deletions: 0,    // Would need --numstat for accurate line counts
      changes: 0       // Would need --numstat for accurate line counts
    };
  }).filter(file => file.filename); // Filter out any malformed entries
}

/**
 * Execute git command safely with error handling
 * @param {string} command - Git command to execute
 * @param {string} cwd - Working directory for the command
 * @returns {string} Command output
 * @throws {Error} If git command fails
 */
export function execGitCommand(command, cwd) {
  try {
    return execSync(command, { 
      cwd, 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'] // Suppress stderr unless there's an error
    }).trim();
  } catch (error) {
    throw new Error(`Git command failed: ${command}\\n${error.message}`);
  }
}

/**
 * Check if a directory is a git repository
 * @param {string} repoPath - Path to check
 * @returns {boolean} True if it's a git repository
 */
export function isGitRepository(repoPath) {
  try {
    execGitCommand('git rev-parse --git-dir', repoPath);
    return true;
  } catch {
    return false;
  }
}

