import yaml from 'js-yaml';

// Spec file constants
const SPEC_PATH = '.cogni/repo-spec.yaml';

// Simple cache for specs by SHA (prevent repeated API calls)
const specCache = new Map();

/**
 * Load and parse repository spec with graceful fallback
 * @param {import('probot').Context} context - Probot context
 * @param {string} sha - Git SHA to load spec from
 * @returns {Promise<{spec: object, source: string, error?: string}>}
 */
export async function loadRepoSpec(context, sha) {
  const cacheKey = `${context.repo().owner}:${context.repo().repo}:${sha}`;
  console.log(`🔍 Cache key: ${cacheKey}, Cache has: ${specCache.has(cacheKey)}, Cache size: ${specCache.size}`);
  
  // Check cache first
  if (specCache.has(cacheKey)) {
    console.log(`✅ Cache hit for ${cacheKey}`);
    return specCache.get(cacheKey);
  }
  
  try {
    // Try to fetch the spec file
    const response = await context.octokit.repos.getContent(
      context.repo({
        path: SPEC_PATH,
        ref: sha
      })
    );
    
    if (response.data.type !== 'file') {
      const err = new Error('Spec path is not a file');
      err.code = 'SPEC_INVALID';
      throw err;
    }
    
    // Decode and parse YAML
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    const spec = yaml.load(content);
    
    // Basic validation - ensure required structure exists
    if (!spec || !spec.intent || !spec.gates) {
      const err = new Error('Invalid spec structure: missing intent or gates sections');
      err.code = 'SPEC_INVALID';
      throw err;
    }
    
    // Return the spec as-is (no defaults merging) - fail fast
    const result = { spec, source: 'file' };
    specCache.set(cacheKey, result);
    return result;
    
  } catch (error) {
    console.log(`📄 Spec loading failed for ${cacheKey}: ${error.message}`);
    
    // Add typed error codes for better error classification
    const wrappedError = new Error(`Failed to load repository spec: ${error.message}`);
    
    // Preserve original error properties
    if (error.status === 404) {
      wrappedError.code = 'SPEC_MISSING';
      wrappedError.status = 404;
    } else if (error.code === 'SPEC_INVALID') {
      wrappedError.code = 'SPEC_INVALID';
    } else if (error.name === 'YAMLException' || /yaml/i.test(error.message)) {
      wrappedError.code = 'SPEC_INVALID';
    } else {
      // Network errors, API errors, etc - these are transient
      wrappedError.code = 'SPEC_TRANSIENT';
      if (error.status) wrappedError.status = error.status;
    }
    
    throw wrappedError;
  }
}

/**
 * Clear the spec cache (useful for testing)
 */
export function clearSpecCache() {
  console.log(`🧹 Clearing cache (was size: ${specCache.size})`);
  specCache.clear();
  console.log(`🧹 Cache cleared (now size: ${specCache.size})`);
}

/**
 * Get cache stats (useful for debugging)
 */
export function getSpecCacheStats() {
  return {
    size: specCache.size,
    keys: Array.from(specCache.keys())
  };
}