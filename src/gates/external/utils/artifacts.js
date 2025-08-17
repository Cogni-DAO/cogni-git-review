/**
 * Artifact Download and Extraction Utilities
 * Handles GitHub Actions artifact download with ZIP extraction and safety limits
 */

import { unzipSync } from 'fflate';

/**
 * Download and extract JSON/SARIF from GitHub Actions artifact
 * @param {object} options - Download options
 * @param {object} options.octokit - GitHub API client
 * @param {Function} options.repo - Repository context function
 * @param {object} options.pr - Pull request object
 * @param {string} options.artifactName - Name of artifact to download
 * @param {string} [options.artifactPath] - Specific file path in ZIP (optional)
 * @param {AbortSignal} [options.signal] - Abort signal for timeout handling
 * @param {number} [options.maxSizeBytes] - Maximum artifact size in bytes
 * @returns {Promise<object>} Parsed JSON content
 * @throws {Error} When artifact not found, too large, or invalid
 */
export async function downloadAndExtractJson({
  octokit,
  repo,
  pr,
  artifactName,
  artifactPath,
  signal,
  maxSizeBytes = 25 * 1024 * 1024 // 25MB default
}) {
  // Find the appropriate workflow run
  const workflowRun = await findWorkflowRun({ octokit, repo, pr, signal });
  
  // List artifacts for the run
  const { data: { artifacts } } = await octokit.actions.listWorkflowRunArtifacts(
    repo({ 
      run_id: workflowRun.id,
      request: { signal }
    })
  );

  // Find the specific artifact
  const artifact = artifacts.find(a => a.name === artifactName);
  if (!artifact) {
    throw new Error(`Artifact '${artifactName}' not found in workflow run ${workflowRun.id}. Ensure your workflow uploads an artifact with this name.`);
  }

  // Check size limit before download
  if (artifact.size_in_bytes && artifact.size_in_bytes > maxSizeBytes) {
    throw new Error(`Artifact '${artifactName}' is ${Math.round(artifact.size_in_bytes / 1024 / 1024)}MB, exceeds limit of ${Math.round(maxSizeBytes / 1024 / 1024)}MB`);
  }

  // Download the artifact ZIP
  const zipResponse = await octokit.actions.downloadArtifact(
    repo({
      artifact_id: artifact.id,
      archive_format: 'zip',
      request: { signal }
    })
  );

  // Double-check downloaded size
  const zipBuffer = Buffer.from(zipResponse.data);
  if (zipBuffer.byteLength > maxSizeBytes) {
    throw new Error(`Downloaded artifact exceeds size limit: ${Math.round(zipBuffer.byteLength / 1024 / 1024)}MB`);
  }

  // Extract the ZIP using fflate
  const zipData = new Uint8Array(zipBuffer);
  const unzipped = unzipSync(zipData);
  
  // Get available filenames
  const filenames = Object.keys(unzipped);

  // Determine which file to extract
  let targetFilename;
  if (artifactPath) {
    // Use specific path if provided
    if (!unzipped[artifactPath]) {
      throw new Error(`File '${artifactPath}' not found in artifact ZIP. Available files: ${filenames.join(', ')}`);
    }
    targetFilename = artifactPath;
  } else {
    // Auto-detect JSON or SARIF file
    targetFilename = filenames.find(name => /\.(json|sarif)$/i.test(name));
    if (!targetFilename) {
      throw new Error(`No JSON or SARIF file found in artifact ZIP. Set 'artifact_path' in gate config or ensure your workflow uploads a .json/.sarif file. Available files: ${filenames.join(', ')}`);
    }
  }

  // Extract and parse the content
  try {
    const fileData = unzipped[targetFilename];
    const content = new TextDecoder().decode(fileData);
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse JSON from '${targetFilename}': ${error.message}`);
  }
}

/**
 * Find the appropriate workflow run for artifact ingestion
 * @param {object} options - Search options
 * @param {object} options.octokit - GitHub API client
 * @param {Function} options.repo - Repository context function
 * @param {object} options.pr - Pull request object
 * @param {AbortSignal} [options.signal] - Abort signal
 * @returns {Promise<object>} Workflow run object
 * @throws {Error} When no suitable run found
 */
async function findWorkflowRun({ octokit, repo, pr, signal }) {
  // Get recent workflow runs for the PR head SHA
  const { data: { workflow_runs } } = await octokit.actions.listWorkflowRunsForRepo(
    repo({
      head_sha: pr.head.sha,
      status: 'completed',
      per_page: 20, // Look at more runs to find successful ones
      request: { signal }
    })
  );

  // Filter to pull_request events matching our HEAD SHA
  const candidateRuns = workflow_runs
    .filter(run => 
      run.head_sha === pr.head.sha && 
      run.event === 'pull_request'
    )
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  // Prefer successful runs, but accept others if no success found
  let targetRun = candidateRuns.find(run => run.conclusion === 'success');
  
  if (!targetRun) {
    // If no successful run, try the most recent completed run
    targetRun = candidateRuns.find(run => run.status === 'completed');
  }

  if (!targetRun) {
    const availableRuns = candidateRuns.length;
    const totalRuns = workflow_runs.length;
    throw new Error(
      `No suitable workflow run found for PR head SHA ${pr.head.sha.substring(0, 8)}. ` +
      `Found ${availableRuns} pull_request runs out of ${totalRuns} total runs. ` +
      `Ensure your workflow runs on pull_request events and uploads the expected artifact.`
    );
  }

  return targetRun;
}

/**
 * Extract workflow run and artifact metadata for stats
 * @param {object} workflowRun - Workflow run object
 * @param {object} artifact - Artifact object
 * @returns {object} Metadata for gate stats
 */
export function extractArtifactMetadata(workflowRun, artifact) {
  return {
    workflow_run_id: workflowRun.id,
    workflow_run_number: workflowRun.run_number,
    workflow_name: workflowRun.name,
    artifact_id: artifact.id,
    artifact_size_bytes: artifact.size_in_bytes,
    run_conclusion: workflowRun.conclusion,
    run_updated_at: workflowRun.updated_at
  };
}