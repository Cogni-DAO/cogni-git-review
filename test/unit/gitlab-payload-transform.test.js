import { describe, test } from "node:test";
import assert from "node:assert";
import { transformGitLabPayload } from "../../src/adapters/gitlab/payload-transform.js";

/**
 * Create base GitLab merge request payload with optional overrides
 * @param {object} overrides - Object to override default values
 * @returns {object} GitLab webhook payload
 */
function createBaseMRPayload(overrides = {}) {
  const base = {
    object_kind: "merge_request",
    object_attributes: {
      id: 1234567890,
      iid: 42,
      state: "opened",
      title: "Add new feature",
      description: "This adds a new feature",
      source_branch: "feature-branch",
      target_branch: "main",
      action: "open",
      last_commit: {
        id: "abc123def456789012345678901234567890abcd"
      }
    },
    project: {
      id: 987654321,
      name: "test-repo",
      path_with_namespace: "cogni-dao/test-repo",
      namespace: "cogni-dao"
    }
  };

  return {
    ...base,
    ...overrides,
    object_attributes: {
      ...base.object_attributes,
      ...overrides.object_attributes
    },
    project: {
      ...base.project,
      ...overrides.project
    }
  };
}

/**
 * Pre-built payload scenarios for common test cases
 */
const MRPayloads = {
  opened: () => createBaseMRPayload({ object_attributes: { action: "open" } }),
  updated: () => createBaseMRPayload({ 
    object_attributes: { 
      action: "update",
      last_commit: { id: "def456abc789012345678901234567890abcdef" }
    }
  }),
  reopened: () => createBaseMRPayload({ object_attributes: { action: "reopen" } }),
  merged: () => createBaseMRPayload({ 
    object_attributes: { action: "merge", state: "merged" }
  }),
  withoutCommit: () => {
    const payload = createBaseMRPayload({ object_attributes: { action: "open" } });
    delete payload.object_attributes.last_commit;
    return payload;
  },
  unknownAction: () => createBaseMRPayload({ 
    object_attributes: { action: "unknown_action" }
  })
};

describe("GitLab Payload Transformation", () => {
  test("transforms merge_request.open to pull_request.opened", () => {
    const result = transformGitLabPayload(MRPayloads.opened());

    assert.strictEqual(result.action, "opened");
    assert.strictEqual(result.pull_request.id, 1234567890);
    assert.strictEqual(result.pull_request.number, 42);
    assert.strictEqual(result.pull_request.state, "open");
    assert.strictEqual(result.pull_request.title, "Add new feature");
    assert.strictEqual(result.pull_request.body, "This adds a new feature");
    assert.strictEqual(result.pull_request.head.sha, "abc123def456789012345678901234567890abcd");
    assert.strictEqual(result.pull_request.head.ref, "feature-branch");
    assert.strictEqual(result.pull_request.base.ref, "main");
    assert.strictEqual(result.repository.id, 987654321);
    assert.strictEqual(result.repository.name, "test-repo");
    assert.strictEqual(result.repository.full_name, "cogni-dao/test-repo");
    assert.strictEqual(result.repository.owner.login, "cogni-dao");
  });

  test("transforms merge_request.update to pull_request.synchronize", () => {
    const result = transformGitLabPayload(MRPayloads.updated());

    assert.strictEqual(result.action, "synchronize");
    assert.strictEqual(result.pull_request.head.sha, "def456abc789012345678901234567890abcdef");
  });

  test("transforms merge_request.reopen to pull_request.reopened", () => {
    const result = transformGitLabPayload(MRPayloads.reopened());

    assert.strictEqual(result.action, "reopened");
  });

  test("handles merged state correctly", () => {
    const result = transformGitLabPayload(MRPayloads.merged());

    assert.strictEqual(result.pull_request.state, "merged");
  });

  test("handles missing last_commit gracefully", () => {
    const result = transformGitLabPayload(MRPayloads.withoutCommit());

    assert.strictEqual(result.pull_request.head.sha, undefined);
  });

  test("returns unchanged payload for non-merge_request events", () => {
    const nonMRPayload = {
      object_kind: "push",
      some_other_data: "value"
    };

    const result = transformGitLabPayload(nonMRPayload);

    assert.deepStrictEqual(result, nonMRPayload);
  });

  test("handles unknown MR actions", () => {
    const result = transformGitLabPayload(MRPayloads.unknownAction());

    assert.strictEqual(result.action, "unknown_action");
  });
});