import yaml from 'js-yaml';

// Spec file constants
const SPEC_PATH = '.cogni/repo-spec.yaml';

// Default spec used when file is missing or invalid
const DEFAULT_SPEC = {
  intent: {
    name: 'unknown-repository',
    mission: 'Repository without cogni spec configuration',
    ownership: { maintainers: [], maturity: 'alpha' }
  },
  gates: {
    spec_mode: 'bootstrap',
    on_missing_spec: 'neutral_with_annotation',
    deny_paths: ['**/*.exe', '**/*.dll', '**/.env', '.env', 'secrets/**'],
    review_limits: { max_changed_files: 100, max_total_diff_kb: 500 },
    check_presentation: { name: 'Cogni Git PR Review' }
  }
};

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
  
  // Check cache first
  if (specCache.has(cacheKey)) {
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
      throw new Error('Spec path is not a file');
    }
    
    // Decode and parse YAML
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    const spec = yaml.load(content);
    
    // Basic validation - ensure required structure exists
    if (!spec || !spec.intent || !spec.gates) {
      throw new Error('Invalid spec structure: missing intent or gates sections');
    }
    
    // Merge with defaults to ensure all required fields exist
    const mergedSpec = {
      intent: { ...DEFAULT_SPEC.intent, ...spec.intent },
      gates: { ...DEFAULT_SPEC.gates, ...spec.gates }
    };
    
    const result = { spec: mergedSpec, source: 'file' };
    specCache.set(cacheKey, result);
    return result;
    
  } catch (error) {
    console.log(`📄 Spec loading failed for ${cacheKey}: ${error.message}`);
    
    // Return default spec with error info
    const result = {
      spec: DEFAULT_SPEC,
      source: 'default',
      error: error.message
    };
    
    specCache.set(cacheKey, result);
    return result;
  }
}

/**
 * Get the default spec (useful for testing)
 * @returns {object} The default specification
 */
export function getDefaultSpec() {
  return structuredClone(DEFAULT_SPEC);
}

/**
 * Clear the spec cache (useful for testing)
 */
export function clearSpecCache() {
  specCache.clear();
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