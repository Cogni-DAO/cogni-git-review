import nock from "nock";
import { loadRepoSpec, clearSpecCache, getSpecCacheStats } from "../../src/spec-loader.js";
import { SPEC_FIXTURES } from "../fixtures/repo-specs.js";
import { describe, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert";

// Mock context object using same pattern as integration tests
const createMockContext = (owner = "test-owner", repo = "test-repo", defaultBranch = "main") => ({
  repo: (params = {}) => ({ owner, repo, ...params }),
  payload: {
    repository: {
      default_branch: defaultBranch
    }
  },
  octokit: {
    repos: {
      getContent: async (params) => {
        // Make actual HTTP call that nock can intercept
        const url = `https://api.github.com/repos/${params.owner}/${params.repo}/contents/${encodeURIComponent(params.path)}?ref=${params.ref}`;
        const response = await fetch(url);
        if (!response.ok) {
          const error = new Error(response.statusText);
          error.status = response.status;
          throw error;
        }
        return { data: await response.json() };
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
    const context = createMockContext("test-org", "test-repo", "main");

    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(SPEC_FIXTURES.full).toString('base64'),
        encoding: "base64"
      });

    const result = await loadRepoSpec(context);

    assert.strictEqual(result.source, "file");
    assert.strictEqual(result.spec.schema_version, "0.2.1");
    assert.strictEqual(result.spec.intent.name, "full-project");
    assert.deepStrictEqual(result.spec.intent.goals, ["Primary goal of the project", "Secondary goal"]);
    // New list-of-gates format
    const reviewLimitsGate = result.spec.gates.find(g => g.id === 'review_limits');
    assert.deepStrictEqual(reviewLimitsGate.with, { max_changed_files: 50, max_total_diff_kb: 200 });
    assert.strictEqual(result.error, undefined);
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("loads minimal valid spec without merging defaults", async () => {
    const context = createMockContext("test-org", "test-repo", "main");

    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(SPEC_FIXTURES.minimal).toString('base64'),
        encoding: "base64"
      });

    const result = await loadRepoSpec(context);

    assert.strictEqual(result.source, "file");
    assert.strictEqual(result.spec.intent.name, "minimal-project");
    assert.deepStrictEqual(result.spec.intent.goals, ["Basic project functionality"]);
    assert.strictEqual(result.error, undefined);
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("handles missing spec file by throwing exception", async () => {
    const context = createMockContext("test-org", "test-repo", "main");
    
    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(404, { message: "Not Found" });

    // Should throw exception instead of returning error object
    await assert.rejects(
      () => loadRepoSpec(context),
      /Failed to load repository spec/
    );
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("handles invalid YAML by throwing exception", async () => {
    const context = createMockContext("test-org", "test-repo", "main");

    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(SPEC_FIXTURES.invalidYaml).toString('base64'),
        encoding: "base64"
      });

    // Should throw exception for invalid YAML
    await assert.rejects(
      () => loadRepoSpec(context),
      /Failed to load repository spec/
    );
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("handles spec with missing required sections by throwing exception", async () => {
    const context = createMockContext("test-org", "test-repo", "main");

    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(SPEC_FIXTURES.invalidStructure).toString('base64'),
        encoding: "base64"
      });

    // Should throw exception for missing required sections
    await assert.rejects(
      () => loadRepoSpec(context),
      /Failed to load repository spec.*Invalid spec structure/
    );
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("handles directory instead of file by throwing exception", async () => {
    const context = createMockContext("test-org", "test-repo", "main");
    
    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "dir",
        name: "repo-spec.yaml"
      });

    // Should throw exception when path is directory
    await assert.rejects(
      () => loadRepoSpec(context),
      /Failed to load repository spec.*Spec path is not a file/
    );
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("caches specs by default branch to prevent duplicate API calls", async () => {
    const context = createMockContext("test-org", "test-repo", "main");

    // Mock should only be called once
    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(SPEC_FIXTURES.bootstrap).toString('base64'),
        encoding: "base64"
      });

    // First call - hits API
    const result1 = await loadRepoSpec(context);
    assert.strictEqual(result1.source, "file");
    assert.strictEqual(result1.spec.intent.name, "bootstrap-project");

    // Second call - should use cache (no additional API call)
    const result2 = await loadRepoSpec(context);
    assert.strictEqual(result2.source, "file");
    assert.strictEqual(result2.spec.intent.name, "bootstrap-project");

    // Verify cache stats
    const cacheStats = getSpecCacheStats();
    assert.strictEqual(cacheStats.size, 1);
    assert.strictEqual(cacheStats.keys[0], "test-org:test-repo:main");
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("different repos have separate cache entries", async () => {
    const context1 = createMockContext("org1", "repo1", "main");
    const context2 = createMockContext("org2", "repo2", "master");

    const mock1 = nock("https://api.github.com")
      .get("/repos/org1/repo1/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(SPEC_FIXTURES.full).toString('base64'),
        encoding: "base64"
      });

    const mock2 = nock("https://api.github.com")
      .get("/repos/org2/repo2/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "master" })
      .reply(200, {
        type: "file",
        content: Buffer.from(SPEC_FIXTURES.advisory).toString('base64'),
        encoding: "base64"
      });

    const result1 = await loadRepoSpec(context1);
    const result2 = await loadRepoSpec(context2);

    assert.strictEqual(result1.spec.intent.name, "full-project");
    
    assert.strictEqual(result2.spec.intent.name, "advisory-project");

    // Verify both are cached
    const cacheStats = getSpecCacheStats();
    assert.strictEqual(cacheStats.size, 2);
    
    assert.deepStrictEqual(mock1.pendingMocks(), []);
    assert.deepStrictEqual(mock2.pendingMocks(), []);
  });

  test("clearSpecCache removes all cached entries", async () => {
    const context = createMockContext("test-org", "test-repo", "main");
    
    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })
      .reply(200, {
        type: "file",
        content: Buffer.from(SPEC_FIXTURES.minimal).toString('base64'),
        encoding: "base64"
      });

    // Load something to populate cache
    await loadRepoSpec(context);
    assert.strictEqual(getSpecCacheStats().size, 1);
    
    // Clear cache
    clearSpecCache();
    assert.strictEqual(getSpecCacheStats().size, 0);
    
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  // ============ SECURITY TESTS ============
  
  test("SECURITY: always loads from default branch, ignoring any SHA concept", async () => {
    const context = createMockContext("test-org", "test-repo", "main");
    
    // Mock spec on main branch  
    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "main" })  // Should use "main", not any PR branch
      .reply(200, { 
        type: "file", 
        content: Buffer.from(SPEC_FIXTURES.minimal).toString('base64'),
        encoding: "base64"
      });
    
    const result = await loadRepoSpec(context);  // No SHA parameter
    
    assert.strictEqual(result.spec.intent.name, "minimal-project");
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("SECURITY: cache key uses default branch only", async () => {
    const context = createMockContext("test-org", "test-repo", "develop");
    
    const mock = nock("https://api.github.com")
      .get("/repos/test-org/test-repo/contents/.cogni%2Frepo-spec.yaml")
      .query({ ref: "develop" })
      .reply(200, { 
        type: "file", 
        content: Buffer.from(SPEC_FIXTURES.minimal).toString('base64'),
        encoding: "base64"
      });
    
    // Should create cache key with develop branch
    await loadRepoSpec(context);
    
    const stats = getSpecCacheStats();
    const expectedKey = "test-org:test-repo:develop";
    assert(stats.keys.includes(expectedKey), `Cache should use key: ${expectedKey}`);
    assert.deepStrictEqual(mock.pendingMocks(), []);
  });

  test("SECURITY: throws error when default branch is missing from payload", async () => {
    const context = createMockContext("test-org", "test-repo", null);
    context.payload.repository.default_branch = null;  // Simulate missing default branch
    
    // Should throw error without making any API calls
    await assert.rejects(
      () => loadRepoSpec(context),
      /Repository default branch not available in webhook payload/
    );
  });
});