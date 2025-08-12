import nock from "nock";
import { loadRepoSpec, getDefaultSpec, clearSpecCache, getSpecCacheStats } from "../../src/spec-loader.js";
import { describe, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert";

// Mock context object for testing  
const createMockContext = (owner = "test-owner", repo = "test-repo") => ({
  repo: () => ({ owner, repo }),
  octokit: {
    repos: {
      getContent: async (params) => {
        // This will be intercepted by nock, but we need the function to exist
        throw new Error("Should be mocked by nock");
      }
    }
  }
});

describe("Spec Loader Unit Tests", () => {
  beforeEach(() => {
    nock.disableNetConnect();
    clearSpecCache(); // Start each test with clean cache
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
    clearSpecCache();
  });

  test("loads valid spec file successfully", async () => {
    const context = createMockContext("test-org", "test-repo");
    const sha = "abc123";
    
    const validSpec = `intent:
  name: test-project
  mission: Test project for spec loading
  ownership:
    maintainers: ['@test-org/maintainers']
    maturity: beta

gates:
  spec_mode: enforced
  deny_paths: ['**/*.exe', 'secrets/**']
  review_limits:
    max_changed_files: 50
    max_total_diff_kb: 200
  check_presentation:
    name: 'Custom Check Name'`;

    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: sha })
      .reply(200, {
        type: "file",
        content: Buffer.from(validSpec).toString('base64'),
        encoding: "base64"
      });

    const result = await loadRepoSpec(context, sha);

    assert.strictEqual(result.source, "file");
    assert.strictEqual(result.spec.intent.name, "test-project");
    assert.strictEqual(result.spec.intent.maturity, "beta");
    assert.strictEqual(result.spec.gates.spec_mode, "enforced");
    assert.strictEqual(result.spec.gates.check_presentation.name, "Custom Check Name");
    assert.deepStrictEqual(result.spec.gates.deny_paths, ['**/*.exe', 'secrets/**']);
    assert.strictEqual(result.error, undefined);
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("merges spec with defaults for missing fields", async () => {
    const context = createMockContext("test-org", "test-repo");
    const sha = "def456";
    
    // Minimal spec missing many fields
    const minimalSpec = `intent:
  name: minimal-project
  
gates:
  spec_mode: advisory`;

    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: sha })
      .reply(200, {
        type: "file",
        content: Buffer.from(minimalSpec).toString('base64'),
        encoding: "base64"
      });

    const result = await loadRepoSpec(context, sha);
    const defaultSpec = getDefaultSpec();

    assert.strictEqual(result.source, "file");
    assert.strictEqual(result.spec.intent.name, "minimal-project");
    assert.strictEqual(result.spec.gates.spec_mode, "advisory");
    
    // Should have defaults merged in
    assert.strictEqual(result.spec.intent.mission, defaultSpec.intent.mission);
    assert.deepStrictEqual(result.spec.gates.deny_paths, defaultSpec.gates.deny_paths);
    assert.deepStrictEqual(result.spec.gates.review_limits, defaultSpec.gates.review_limits);
    assert.strictEqual(result.spec.gates.on_missing_spec, defaultSpec.gates.on_missing_spec);
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("handles missing spec file with default fallback", async () => {
    const context = createMockContext("test-org", "test-repo");
    const sha = "missing123";
    
    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: sha })
      .reply(404, { message: "Not Found" });

    const result = await loadRepoSpec(context, sha);
    const defaultSpec = getDefaultSpec();

    assert.strictEqual(result.source, "default");
    assert.deepStrictEqual(result.spec, defaultSpec);
    assert(result.error.includes("404"));
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("handles invalid YAML with default fallback", async () => {
    const context = createMockContext("test-org", "test-repo");
    const sha = "invalid123";
    
    const invalidYaml = `intent:
  name: test
  invalid: [unclosed array
gates:
  mode: invalid`;

    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: sha })
      .reply(200, {
        type: "file",
        content: Buffer.from(invalidYaml).toString('base64'),
        encoding: "base64"
      });

    const result = await loadRepoSpec(context, sha);
    const defaultSpec = getDefaultSpec();

    assert.strictEqual(result.source, "default");
    assert.deepStrictEqual(result.spec, defaultSpec);
    assert(result.error && result.error.length > 0);
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("handles spec with missing required sections", async () => {
    const context = createMockContext("test-org", "test-repo");
    const sha = "incomplete123";
    
    const incompleteSpec = `name: test-project
description: Missing required sections`;

    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: sha })
      .reply(200, {
        type: "file",
        content: Buffer.from(incompleteSpec).toString('base64'),
        encoding: "base64"
      });

    const result = await loadRepoSpec(context, sha);
    const defaultSpec = getDefaultSpec();

    assert.strictEqual(result.source, "default");
    assert.deepStrictEqual(result.spec, defaultSpec);
    assert.strictEqual(result.error, "Invalid spec structure: missing intent or gates sections");
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("handles directory instead of file", async () => {
    const context = createMockContext("test-org", "test-repo");
    const sha = "directory123";
    
    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: sha })
      .reply(200, {
        type: "dir",
        name: "repo-spec.yaml"
      });

    const result = await loadRepoSpec(context, sha);
    const defaultSpec = getDefaultSpec();

    assert.strictEqual(result.source, "default");
    assert.deepStrictEqual(result.spec, defaultSpec);
    assert.strictEqual(result.error, "Spec path is not a file");
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("caches specs by SHA to prevent duplicate API calls", async () => {
    const context = createMockContext("test-org", "test-repo");
    const sha = "cached123";
    
    const validSpec = `intent:
  name: cached-test
gates:
  spec_mode: bootstrap`;

    // Mock should only be called once
    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: sha })
      .reply(200, {
        type: "file",
        content: Buffer.from(validSpec).toString('base64'),
        encoding: "base64"
      });

    // First call - hits API
    const result1 = await loadRepoSpec(context, sha);
    assert.strictEqual(result1.source, "file");
    assert.strictEqual(result1.spec.intent.name, "cached-test");

    // Second call - should use cache
    const result2 = await loadRepoSpec(context, sha);
    assert.strictEqual(result2.source, "file");
    assert.strictEqual(result2.spec.intent.name, "cached-test");

    // Verify cache stats
    const cacheStats = getSpecCacheStats();
    assert.strictEqual(cacheStats.size, 1);
    assert.strictEqual(cacheStats.keys[0], "test-org:test-repo:cached123");
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("different repos/SHAs have separate cache entries", async () => {
    const context1 = createMockContext("org1", "repo1");
    const context2 = createMockContext("org2", "repo2");
    const sha1 = "sha1";
    const sha2 = "sha2";
    
    const spec1 = `intent:\n  name: project1\ngates:\n  spec_mode: enforced`;
    const spec2 = `intent:\n  name: project2\ngates:\n  spec_mode: advisory`;

    const mock1 = nock("https://api.github.com")
      .get("/repos/org1/repo1/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: sha1 })
      .reply(200, {
        type: "file",
        content: Buffer.from(spec1).toString('base64'),
        encoding: "base64"
      });

    const mock2 = nock("https://api.github.com")
      .get("/repos/org2/repo2/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: sha2 })
      .reply(200, {
        type: "file",
        content: Buffer.from(spec2).toString('base64'),
        encoding: "base64"
      });

    const result1 = await loadRepoSpec(context1, sha1);
    const result2 = await loadRepoSpec(context2, sha2);

    assert.strictEqual(result1.spec.intent.name, "project1");
    assert.strictEqual(result1.spec.gates.spec_mode, "enforced");
    
    assert.strictEqual(result2.spec.intent.name, "project2");
    assert.strictEqual(result2.spec.gates.spec_mode, "advisory");

    // Verify both are cached
    const cacheStats = getSpecCacheStats();
    assert.strictEqual(cacheStats.size, 2);
    
    assert.deepStrictEqual(mock1.pendingMocks(), []);
    assert.deepStrictEqual(mock2.pendingMocks(), []);
  });

  test("getDefaultSpec returns a clean copy", () => {
    const default1 = getDefaultSpec();
    const default2 = getDefaultSpec();
    
    // Should be equal but not the same object
    assert.deepStrictEqual(default1, default2);
    assert.notStrictEqual(default1, default2);
    
    // Modifying one shouldn't affect the other
    default1.intent.name = "modified";
    assert.notStrictEqual(default1.intent.name, default2.intent.name);
  });

  test("clearSpecCache removes all cached entries", async () => {
    const context = createMockContext("test-org", "test-repo");
    const sha = "cache-clear-test";
    
    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: sha })
      .reply(404);

    // Load something to populate cache
    await loadRepoSpec(context, sha);
    assert.strictEqual(getSpecCacheStats().size, 1);
    
    // Clear cache
    clearSpecCache();
    assert.strictEqual(getSpecCacheStats().size, 0);
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });
});