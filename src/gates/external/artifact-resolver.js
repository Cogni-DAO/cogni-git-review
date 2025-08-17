/**
 * Artifact Resolver - Centralized artifact resolution for external gates
 * Handles direct run_id lookup with head_sha fallback and minimal retry logic
 */

import { unzipSync } from 'fflate';

/**
 * Resolve artifact by direct run_id (primary method)
 * @param {object} octokit - GitHub API client
 * @param {object} repo - Repository context {owner, repo}
 * @param {number} runId - Workflow run ID from workflow_run event
 * @param {string} artifactName - Exact artifact name to find (e.g., 'eslint-report')
 * @returns {Promise<Buffer|null>} Artifact contents or null if not found
 */
export async function resolveByRunId(octokit, repo, runId, artifactName) {
  try {
    // List artifacts for the specific run
    const { data: artifacts } = await octokit.actions.listWorkflowRunArtifacts({
      ...repo,
      run_id: runId
    });

    // Find artifact by exact name match
    const artifact = artifacts.artifacts.find(a => a.name === artifactName);
    if (!artifact) {
      return null;
    }

    // Download and return artifact contents
    return await downloadArtifact(octokit, repo, artifact.id);

  } catch (error) {
    // Log but don't throw - caller will handle null return
    console.error(`Failed to resolve artifact by run_id ${runId}:`, error.message);
    return null;
  }
}

/**
 * Resolve artifact by head_sha (fallback method)
 * @param {object} octokit - GitHub API client  
 * @param {object} repo - Repository context {owner, repo}
 * @param {string} headSha - Git commit SHA
 * @param {string} artifactName - Exact artifact name to find
 * @returns {Promise<Buffer|null>} Artifact contents or null if not found
 */
export async function resolveByHeadSha(octokit, repo, headSha, artifactName) {
  try {
    // List workflow runs for the head SHA, get most recent completed
    const { data: runs } = await octokit.actions.listWorkflowRunsForRepo({
      ...repo,
      head_sha: headSha,
      status: 'completed',
      per_page: 5 // Only check recent runs
    });

    if (runs.workflow_runs.length === 0) {
      return null;
    }

    // Try the most recent completed run first
    const latestRun = runs.workflow_runs[0];
    return await resolveByRunId(octokit, repo, latestRun.id, artifactName);

  } catch (error) {
    console.error(`Failed to resolve artifact by head_sha ${headSha}:`, error.message);
    return null;
  }
}

/**
 * Download artifact with size limits and minimal retry
 * @param {object} octokit - GitHub API client
 * @param {object} repo - Repository context  
 * @param {number} artifactId - Artifact ID to download
 * @returns {Promise<Buffer|null>} Artifact contents or null if failed
 */
async function downloadArtifact(octokit, repo, artifactId) {
  const maxSizeMB = 25;
  const maxRetries = 2;
  const retryDelayMs = 5000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Download artifact as zip
      const { data: zipData } = await octokit.actions.downloadArtifact({
        ...repo,
        artifact_id: artifactId,
        archive_format: 'zip'
      });

      // Check size limit (zipData is a Buffer)
      const sizeMB = zipData.length / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        console.error(`Artifact ${artifactId} too large: ${sizeMB.toFixed(1)}MB > ${maxSizeMB}MB`);
        return null;
      }

      // Extract JSON file from zip (simple approach for MVP)
      const jsonContent = extractJsonFromZip(zipData);
      return jsonContent;

    } catch (error) {
      console.error(`Attempt ${attempt}/${maxRetries} failed for artifact ${artifactId}:`, error.message);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  return null;
}

/**
 * Extract JSON file from zip buffer (MVP implementation)
 * @param {Buffer} zipBuffer - Zip file contents
 * @returns {Promise<Buffer|null>} JSON file contents or null
 */

function extractJsonFromZip(zipBuffer) {
  try {
    // Convert to Uint8Array for fflate (single conversion at edge)
    const u8 = zipBuffer instanceof Uint8Array ? zipBuffer : new Uint8Array(zipBuffer);
    
    // ZIP signature validation
    if (u8.length < 4 || u8[0] !== 0x50 || u8[1] !== 0x4b || u8[2] !== 0x03 || u8[3] !== 0x04) {
      throw new Error('invalid zip data (bad signature)');
    }
    
    // Use sync unzip - no callback complexity
    const files = unzipSync(u8);
    
    // Find first .json file
    const jsonFilename = Object.keys(files).find(name => name.endsWith('.json'));
    if (!jsonFilename) {
      return null;
    }
    
    // Return as Buffer for consistency with existing code
    return Buffer.from(files[jsonFilename]);
    
  } catch (error) {
    console.error('Failed to extract JSON from zip:', error.message);
    return null;
  }
}

/**
 * Main artifact resolution function with primary + fallback
 * @param {object} octokit - GitHub API client
 * @param {object} repo - Repository context
 * @param {number} runId - Workflow run ID (primary)
 * @param {string} headSha - Git commit SHA (fallback)  
 * @param {string} artifactName - Artifact name to find
 * @returns {Promise<Buffer|null>} Artifact JSON contents or null
 */
export async function resolveArtifact(octokit, repo, runId, headSha, artifactName) {
  // Try direct run_id first
  let artifact = await resolveByRunId(octokit, repo, runId, artifactName);
  
  if (!artifact) {
    // Fallback to head_sha filtering
    artifact = await resolveByHeadSha(octokit, repo, headSha, artifactName);
  }

  return artifact;
}