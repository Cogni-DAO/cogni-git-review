/**
 * Evidence Building System
 * 
 * Extracts code context and PR metadata for AI evaluation.
 * Handles snippet windows, overlap merging, and binary file detection.
 */

import fs from 'fs';
import path from 'path';

/**
 * Build evidence bundle for AI rule evaluation
 * 
 * @param {Object} prContext - PR data and changes
 * @param {Object} prContext.pr - PR metadata (title, body, etc.)
 * @param {Array} prContext.changed_files - Changed files with hunks
 * @param {Object} prContext.hunks_by_file - Grouped change hunks
 * @param {number} defaultSnippetWindow - Default lines of context
 * @param {number} perRuleSnippetWindow - Rule-specific override
 * @returns {Promise<Object>} { diff_summary, snippets }
 */
export async function buildEvidence(prContext, defaultSnippetWindow = 20, perRuleSnippetWindow = null) {
  const snippetWindow = perRuleSnippetWindow || defaultSnippetWindow;
  
  const { pr, changed_files = [], hunks_by_file = {} } = prContext;
  
  // Build diff summary (always included)
  const diffSummary = buildDiffSummary(pr, changed_files);
  
  // Build file snippets (context around changes)
  const snippets = await buildFileSnippets(changed_files, hunks_by_file, snippetWindow);
  
  return {
    diff_summary: diffSummary,
    file_snippets: snippets
  };
}

/**
 * Generate concise diff summary for AI context
 * 
 * @param {Object} pr - PR metadata
 * @param {Array} changed_files - List of changed files
 * @returns {string} Human-readable diff summary
 */
function buildDiffSummary(pr, changed_files) {
  const fileCount = changed_files.length;
  const totalAdditions = changed_files.reduce((sum, f) => sum + (f.additions || 0), 0);
  const totalDeletions = changed_files.reduce((sum, f) => sum + (f.deletions || 0), 0);
  
  // Categorize file changes
  const byStatus = changed_files.reduce((acc, file) => {
    const status = file.status || 'modified';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  
  // Build summary components
  let summary = `PR "${pr.title || 'Untitled'}" modifies ${fileCount} file${fileCount === 1 ? '' : 's'}`;
  
  if (totalAdditions > 0 || totalDeletions > 0) {
    summary += ` (+${totalAdditions} -${totalDeletions} lines)`;
  }
  
  // Add change type breakdown if diverse
  const statusEntries = Object.entries(byStatus);
  if (statusEntries.length > 1) {
    const statusSummary = statusEntries
      .map(([status, count]) => `${count} ${status}`)
      .join(', ');
    summary += `. Changes: ${statusSummary}`;
  }
  
  // Include high-level file types
  const extensions = [...new Set(
    changed_files
      .map(f => path.extname(f.filename || f.path))
      .filter(ext => ext.length > 0)
  )];
  
  if (extensions.length > 0 && extensions.length <= 5) {
    summary += `. File types: ${extensions.join(', ')}`;
  }
  
  return summary;
}

/**
 * Extract code snippets around change hunks
 * 
 * @param {Array} changed_files - Files with changes
 * @param {Object} hunks_by_file - Change hunks grouped by file
 * @param {number} snippetWindow - Lines of context around changes
 * @returns {Promise<Array>} Array of code snippets with metadata
 */
async function buildFileSnippets(changed_files, hunks_by_file, snippetWindow) {
  const snippets = [];
  
  for (const file of changed_files) {
    const filePath = file.filename || file.path;
    const hunks = hunks_by_file[filePath] || [];
    
    // Skip binary or very large files
    if (await isBinaryOrLargeFile(filePath, file)) {
      snippets.push({
        path: filePath,
        type: 'skipped',
        reason: 'binary_or_large',
        summary: `${file.status} file (${file.additions || 0}+/${file.deletions || 0}- lines)`
      });
      continue;
    }
    
    // Extract snippets for each hunk
    const fileSnippets = await extractFileSnippets(filePath, hunks, snippetWindow);
    snippets.push(...fileSnippets);
  }
  
  return snippets;
}

/**
 * Extract snippets for a specific file's hunks
 * 
 * @param {string} filePath - Path to the file
 * @param {Array} hunks - Change hunks for this file
 * @param {number} snippetWindow - Context window size
 * @returns {Promise<Array>} Snippets for this file
 */
async function extractFileSnippets(filePath, hunks, snippetWindow) {
  if (hunks.length === 0) {
    return [];
  }
  
  try {
    // Read file content (from working directory, not git)
    const fullPath = path.resolve(filePath);
    let fileContent;
    
    if (fs.existsSync(fullPath)) {
      fileContent = fs.readFileSync(fullPath, 'utf-8');
    } else {
      // File might be deleted or not yet committed
      return [{
        path: filePath,
        type: 'unavailable',
        reason: 'file_not_accessible',
        summary: `File not accessible for snippet extraction`
      }];
    }
    
    const lines = fileContent.split('\n');
    
    // Convert hunks to line ranges and merge overlaps
    const ranges = mergeOverlappingRanges(
      hunks.map(hunk => createSnippetRange(hunk, lines.length, snippetWindow))
    );
    
    // Extract snippets for each merged range
    return ranges.map((range, index) => ({
      path: filePath,
      type: 'code',
      start_line: range.start,
      end_line: range.end,
      total_lines: lines.length,
      code: lines.slice(range.start - 1, range.end).join('\n'),
      context_window: snippetWindow,
      snippet_index: index
    }));
    
  } catch (error) {
    return [{
      path: filePath,
      type: 'error',
      reason: 'extraction_failed',
      error: error.message,
      summary: `Failed to extract snippets: ${error.message}`
    }];
  }
}

/**
 * Create snippet range around a hunk with context window
 * 
 * @param {Object} hunk - Git hunk data
 * @param {number} totalLines - Total lines in file
 * @param {number} window - Context window size
 * @returns {Object} { start, end } line numbers (1-indexed)
 */
function createSnippetRange(hunk, totalLines, window) {
  // Extract line numbers from hunk (this is simplified - real implementation would parse diff)
  // For now, assume hunk has start_line and line_count properties
  const hunkStart = hunk.start_line || 1;
  const hunkLines = hunk.line_count || 1;
  const hunkEnd = hunkStart + hunkLines - 1;
  
  // Add context window
  const start = Math.max(1, hunkStart - window);
  const end = Math.min(totalLines, hunkEnd + window);
  
  return { start, end };
}

/**
 * Merge overlapping snippet ranges to avoid duplication
 * 
 * @param {Array} ranges - Array of {start, end} ranges
 * @returns {Array} Merged ranges
 */
function mergeOverlappingRanges(ranges) {
  if (ranges.length === 0) return [];
  
  // Sort by start line
  const sorted = ranges.sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    
    // If ranges overlap or are adjacent, merge them
    if (current.start <= last.end + 1) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }
  
  return merged;
}

/**
 * Check if file should be skipped for snippet extraction
 * 
 * @param {string} filePath - Path to check
 * @param {Object} fileInfo - File metadata from GitHub
 * @returns {Promise<boolean>} True if file should be skipped
 */
async function isBinaryOrLargeFile(filePath, fileInfo) {
  // Skip if file is too large (based on changes)
  const totalChanges = (fileInfo.additions || 0) + (fileInfo.deletions || 0);
  if (totalChanges > 1000) {
    return true;
  }
  
  // Check common binary extensions
  const binaryExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp',
    '.pdf', '.zip', '.tar', '.gz', '.bz2',
    '.exe', '.dll', '.so', '.dylib',
    '.woff', '.woff2', '.ttf', '.otf',
    '.mp4', '.avi', '.mkv', '.mp3', '.wav'
  ];
  
  const ext = path.extname(filePath).toLowerCase();
  if (binaryExtensions.includes(ext)) {
    return true;
  }
  
  // Try to detect binary content by reading first few bytes
  try {
    const fullPath = path.resolve(filePath);
    if (fs.existsSync(fullPath)) {
      const buffer = fs.readFileSync(fullPath, { encoding: null, flag: 'r' });
      const sample = buffer.slice(0, 1024);
      
      // Check for null bytes (common in binary files)
      for (let i = 0; i < sample.length; i++) {
        if (sample[i] === 0) {
          return true;
        }
      }
    }
  } catch {
    // If we can't read the file, assume it's safe to process
    return false;
  }
  
  return false;
}

/**
 * Get evidence summary for logging/debugging
 * 
 * @param {Object} evidence - Built evidence bundle
 * @returns {string} Human-readable summary
 */
export function getEvidenceSummary(evidence) {
  const { diff_summary, file_snippets: snippets } = evidence;
  
  const codeSnippets = snippets.filter(s => s.type === 'code');
  const skippedFiles = snippets.filter(s => s.type === 'skipped');
  const errorFiles = snippets.filter(s => s.type === 'error');
  
  let summary = `Evidence: ${diff_summary}`;
  
  if (codeSnippets.length > 0) {
    const totalLines = codeSnippets.reduce((sum, s) => sum + (s.end_line - s.start_line + 1), 0);
    summary += `. Code snippets: ${codeSnippets.length} from ${new Set(codeSnippets.map(s => s.path)).size} files (${totalLines} lines total)`;
  }
  
  if (skippedFiles.length > 0) {
    summary += `. Skipped ${skippedFiles.length} binary/large files`;
  }
  
  if (errorFiles.length > 0) {
    summary += `. ${errorFiles.length} extraction errors`;
  }
  
  return summary;
}