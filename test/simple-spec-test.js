import { getDefaultSpec, clearSpecCache, getSpecCacheStats, loadRepoSpec } from "../src/spec-loader.js";
import { SPEC_FIXTURES, EXPECTED_SPECS, createMockContext, createMockContextWithSpec } from "./fixtures/repo-specs.js";
import { describe, test } from "node:test";
import assert from "node:assert";
import nock from "nock";

describe("Simple Spec Loader Tests", () => {
  test("getDefaultSpec returns a clean copy", () => {
    const default1 = getDefaultSpec();
    const default2 = getDefaultSpec();
    
    // Should be equal but not the same object
    assert.deepStrictEqual(default1, default2);
    assert.notStrictEqual(default1, default2);
    
    // Should have expected structure
    assert.strictEqual(typeof default1.intent, "object");
    assert.strictEqual(typeof default1.gates, "object");
    assert.strictEqual(default1.intent.name, "unknown-repository");
    assert.strictEqual(default1.gates.spec_mode, "bootstrap");
    
    // Modifying one shouldn't affect the other
    default1.intent.name = "modified";
    assert.notStrictEqual(default1.intent.name, default2.intent.name);
    assert.strictEqual(default2.intent.name, "unknown-repository");
  });

  test("clearSpecCache works", () => {
    // This should work without any mocking
    clearSpecCache();
    const stats = getSpecCacheStats();
    assert.strictEqual(stats.size, 0);
    assert.deepStrictEqual(stats.keys, []);
  });

  test("getSpecCacheStats returns proper structure", () => {
    clearSpecCache();
    const stats = getSpecCacheStats();
    
    assert.strictEqual(typeof stats, "object");
    assert.strictEqual(typeof stats.size, "number");
    assert(Array.isArray(stats.keys));
    assert.strictEqual(stats.size, 0);
  });

  test("loadRepoSpec handles missing file gracefully", async () => {
    const mockContext = createMockContext("test-org", "test-repo", "not_found");
    
    clearSpecCache();
    const result = await loadRepoSpec(mockContext, "test-sha");
    
    assert.strictEqual(result.source, "default");
    assert.strictEqual(result.spec.intent.name, "unknown-repository");
    assert.strictEqual(result.spec.gates.spec_mode, "bootstrap");
    assert(result.error && result.error.includes("Not Found"));
  });

  test("loadRepoSpec parses valid minimal spec", async () => {
    const mockContext = createMockContextWithSpec(SPEC_FIXTURES.minimal);
    
    clearSpecCache();
    const result = await loadRepoSpec(mockContext, "valid-sha");
    
    assert.strictEqual(result.source, "file");
    assert.strictEqual(result.spec.intent.name, "minimal-project");
    assert.strictEqual(result.spec.gates.spec_mode, "enforced");
    assert.strictEqual(result.spec.gates.check_presentation.name, "Cogni Git PR Review");
    assert.strictEqual(result.error, undefined);
  });

  test("loadRepoSpec parses custom check name spec", async () => {
    const mockContext = createMockContextWithSpec(SPEC_FIXTURES.customName);
    
    clearSpecCache();
    const result = await loadRepoSpec(mockContext, "custom-sha");
    
    assert.strictEqual(result.source, "file");
    assert.strictEqual(result.spec.intent.name, "custom-check-project");
    assert.strictEqual(result.spec.gates.check_presentation.name, "Custom Repository Check");
    assert.strictEqual(result.error, undefined);
  });

  test("loadRepoSpec handles invalid YAML", async () => {
    const mockContext = createMockContext("test-org", "test-repo", "invalid_yaml");
    
    clearSpecCache();
    const result = await loadRepoSpec(mockContext, "invalid-sha");
    
    assert.strictEqual(result.source, "default");
    assert.strictEqual(result.spec.intent.name, "unknown-repository");
    assert(result.error && result.error.length > 0);
  });

  test("loadRepoSpec handles directory instead of file", async () => {
    const mockContext = createMockContext("test-org", "test-repo", "directory");
    
    clearSpecCache();
    const result = await loadRepoSpec(mockContext, "dir-sha");
    
    assert.strictEqual(result.source, "default");
    assert.strictEqual(result.spec.intent.name, "unknown-repository");
    assert.strictEqual(result.error, "Spec path is not a file");
  });
});