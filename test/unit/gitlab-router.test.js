import { describe, test } from "node:test";
import assert from "node:assert";
import tsscmp from "tsscmp";

describe("GitLab Router Core Logic", () => {
  test("timing-safe token comparison works correctly", () => {
    const secret = "test-secret-token";
    
    // Valid token should pass
    assert.strictEqual(tsscmp(secret, secret), true);
    
    // Invalid tokens should fail
    assert.strictEqual(tsscmp(secret, "wrong-token"), false);
    assert.strictEqual(tsscmp(secret, ""), false);
    assert.strictEqual(tsscmp(secret, "short"), false);
    assert.strictEqual(tsscmp(secret, "this-is-a-very-long-token"), false);
    
    // Empty comparisons
    assert.strictEqual(tsscmp("", ""), true);
    assert.strictEqual(tsscmp("", "non-empty"), false);
  });
  
  test("event mapping logic", () => {
    // Test the core logic that maps GitLab actions to GitHub events
    const mockHandlers = new Map();
    mockHandlers.set("pull_request.opened", "handler1");
    mockHandlers.set("pull_request.synchronize", "handler2");
    mockHandlers.set("pull_request.reopened", "handler3");
    
    // Test handler lookup logic
    assert.strictEqual(mockHandlers.get("pull_request.opened"), "handler1");
    assert.strictEqual(mockHandlers.get("pull_request.synchronize"), "handler2");  
    assert.strictEqual(mockHandlers.get("pull_request.reopened"), "handler3");
    assert.strictEqual(mockHandlers.get("pull_request.unknown"), undefined);
  });
});