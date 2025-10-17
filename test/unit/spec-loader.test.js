import yaml from 'js-yaml';
import { loadRepoSpec, clearSpecCache, getSpecCacheStats } from "../../src/spec-loader.js";
import { SPEC_FIXTURES } from "../fixtures/repo-specs.js";
import { describe, beforeEach, test } from "node:test";
import assert from "node:assert";

// Mock context factory using VCS interface
const createMockContext = (configResponse) => ({
  repo: () => ({ owner: 'test-owner', repo: 'test-repo' }),
  vcs: {
    config: {
      get: async ({ owner, repo, path }) => {
        if (path === '.cogni/repo-spec.yaml') {
          if (typeof configResponse === 'function') {
            return { config: configResponse() };
          }
          return { config: configResponse };
        }
        return { config: null };
      }
    }
  }
});

describe("Spec Loader Unit Tests", () => {
  beforeEach(() => {
    clearSpecCache(); // Start each test with clean cache
  });

  test("loads valid spec file successfully", async () => {
    const expectedSpec = yaml.load(SPEC_FIXTURES.full);
    const context = createMockContext(expectedSpec);

    const result = await loadRepoSpec(context);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.spec.schema_version, "0.2.1");
    assert.strictEqual(result.spec.intent.name, "full-project");
    assert.deepStrictEqual(result.spec.intent.goals, ["Primary goal of the project", "Secondary goal"]);
    // New list-of-gates format
    const reviewLimitsGate = result.spec.gates.find(g => g.id === 'review_limits');
    assert.deepStrictEqual(reviewLimitsGate.with, { max_changed_files: 50, max_total_diff_kb: 200 });
  });

  test("loads minimal valid spec without merging defaults", async () => {
    const expectedSpec = yaml.load(SPEC_FIXTURES.minimal);
    const context = createMockContext(expectedSpec);

    const result = await loadRepoSpec(context);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.spec.intent.name, "minimal-project");
    assert.deepStrictEqual(result.spec.intent.goals, ["Basic project functionality"]);
  });

  test("handles missing spec file by returning error", async () => {
    const context = createMockContext(null); // Probot returns null for missing files

    const result = await loadRepoSpec(context);
    
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'SPEC_MISSING');
  });

  test("handles invalid YAML by throwing exception", async () => {
    // Simulate what happens when Probot encounters invalid YAML
    const context = createMockContext(() => {
      throw new yaml.YAMLException("Invalid YAML syntax");
    });

    await assert.rejects(
      () => loadRepoSpec(context),
      /Invalid YAML syntax/
    );
  });

  test("handles spec with missing required sections by returning error", async () => {
    const invalidSpec = { name: "project-without-required-sections" };
    const context = createMockContext(invalidSpec);

    const result = await loadRepoSpec(context);
    
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'SPEC_INVALID');
  });

  test("handles missing intent section", async () => {
    const specWithoutIntent = { gates: [] };
    const context = createMockContext(specWithoutIntent);

    const result = await loadRepoSpec(context);
    
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'SPEC_INVALID');
  });

  test("handles missing gates section", async () => {
    const specWithoutGates = { intent: { name: "test", goals: [], non_goals: [] } };
    const context = createMockContext(specWithoutGates);

    const result = await loadRepoSpec(context);
    
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.error.code, 'SPEC_INVALID');
  });

  test("caching is managed by Probot", async () => {
    // Probot handles caching internally, we just verify our API works
    const expectedSpec = yaml.load(SPEC_FIXTURES.bootstrap);
    const context = createMockContext(expectedSpec);

    // Multiple calls should work (Probot handles caching)
    const result1 = await loadRepoSpec(context);
    const result2 = await loadRepoSpec(context);

    assert.strictEqual(result1.ok, true);
    assert.strictEqual(result2.ok, true);
    assert.strictEqual(result1.spec.intent.name, "bootstrap-project");
    assert.strictEqual(result2.spec.intent.name, "bootstrap-project");

    // Verify cache stats show Probot management
    const cacheStats = getSpecCacheStats();
    assert.strictEqual(cacheStats.size, "managed_by_probot");
  });

  test("clearSpecCache is a no-op with Probot", async () => {
    // clearSpecCache doesn't do anything with Probot, but shouldn't error
    clearSpecCache();
    
    const cacheStats = getSpecCacheStats();
    assert.strictEqual(cacheStats.size, "managed_by_probot");
  });

  test("handles config loader errors gracefully", async () => {
    const context = createMockContext(() => {
      throw new Error("Network error");
    });

    await assert.rejects(
      () => loadRepoSpec(context),
      /Network error/
    );
  });
});