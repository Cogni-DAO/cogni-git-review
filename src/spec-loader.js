/**
 * Load and parse repository spec using Probot's built-in config loader
 * @param {import('probot').Context} context - Probot context with repository info
 * @returns {Promise<{ok: boolean, spec?: object, error?: object}>}
 */
export async function loadRepoSpec(context) {
  const { owner, repo } = context.repo();
  const { config } = await context.octokit.config.get({ owner, repo, path: '.cogni/repo-spec.yaml' });
  
  // Handle both null and empty object {} as missing spec
  if (!config || Object.keys(config).length === 0) return { ok: false, error: { code: 'SPEC_MISSING' } };
  if (!config.intent || !config.gates) return { ok: false, error: { code: 'SPEC_INVALID' } };
  
  return { ok: true, spec: config };
}

/**
 * Clear the spec cache (Probot handles caching internally)
 */
export function clearSpecCache() {
  // Probot config plugin handles caching internally
  // This is a no-op for backward compatibility
}

/**
 * Get cache stats (Probot handles caching internally)
 */
export function getSpecCacheStats() {
  return {
    size: 'managed_by_probot',
    keys: []
  };
}