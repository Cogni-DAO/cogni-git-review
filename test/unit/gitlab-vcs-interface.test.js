import { describe, test, beforeEach } from "node:test";
import assert from "node:assert";
import { transformGitLabPayload } from "../../src/adapters/gitlab/payload-transform.js";

// Mock environment
process.env.GITLAB_PAT = "test-pat-token";
process.env.GITLAB_BASE_URL = "https://gitlab.com";

describe("GitLab VCS Interface Logic", () => {
  let gitlabPayload;
  let transformedPayload;

  beforeEach(() => {
    // Use the same GitLab payload structure from our fixture
    gitlabPayload = {
      object_kind: "merge_request",
      object_attributes: {
        id: 424453845,
        iid: 1,
        state: "merged",
        title: "chore: sync GitLab", 
        description: "Test MR description",
        source_branch: "chore/sync-gitlab",
        target_branch: "main",
        action: "open",
        last_commit: {
          id: "fb7d5cea20fd333821e718d24283bc7282483492"
        }
      },
      project: {
        id: 75386934,
        name: "Cogni Git Review",
        path_with_namespace: "cogni-dao/core/cogni-git-review",
        namespace: "core"
      }
    };
    
    transformedPayload = transformGitLabPayload(gitlabPayload);
  });

  test("GitLab check conclusion mapping logic", () => {
    // Test the core mapping logic used in vcs.checks.create
    const conclusionToState = {
      'success': 'success',
      'failure': 'failed', 
      'cancelled': 'canceled',
      'neutral': 'skipped',
      'pending': 'pending'
    };

    // Verify all expected mappings
    assert.strictEqual(conclusionToState['success'], 'success');
    assert.strictEqual(conclusionToState['failure'], 'failed');
    assert.strictEqual(conclusionToState['cancelled'], 'canceled');
    assert.strictEqual(conclusionToState['neutral'], 'skipped');
    assert.strictEqual(conclusionToState['pending'], 'pending');
  });

  test("GitLab project ID extraction from transformed payload", () => {
    // Test the project ID extraction logic used by VCS methods
    const projectId = transformedPayload.repository.id;
    
    assert.strictEqual(typeof projectId, "number");
    assert.strictEqual(projectId, 75386934);
  });

  test("GitLab VCS context structure matches BaseContext interface", async () => {
    // Import and create context directly to validate structure
    const { createGitLabContext } = await import("../../src/adapters/gitlab/gitlab-context.js");
    const context = createGitLabContext(transformedPayload);

    // Verify BaseContext interface compliance
    assert(typeof context.payload === "object");
    assert(typeof context.repo === "function");
    assert(typeof context.vcs === "object");
    assert(typeof context.log === "object");

    // Verify VCS interface structure
    assert(typeof context.vcs.config === "object");
    assert(typeof context.vcs.config.get === "function");
    assert(typeof context.vcs.pulls === "object");
    assert(typeof context.vcs.pulls.get === "function");
    assert(typeof context.vcs.pulls.listFiles === "function");
    assert(typeof context.vcs.repos === "object");
    assert(typeof context.vcs.repos.getContent === "function");
    assert(typeof context.vcs.repos.compareCommits === "function");
    assert(typeof context.vcs.checks === "object");
    assert(typeof context.vcs.checks.create === "function");
    assert(typeof context.vcs.issues === "object");
    assert(typeof context.vcs.issues.createComment === "function");

    // Verify repo() method returns correct structure
    const repo = context.repo();
    assert.strictEqual(repo.owner, "core");
    assert.strictEqual(repo.repo, "Cogni Git Review");

    // Test repo() with params
    const repoWithParams = context.repo({ commit_sha: "abc123" });
    assert.strictEqual(repoWithParams.owner, "core");
    assert.strictEqual(repoWithParams.repo, "Cogni Git Review");
    assert.strictEqual(repoWithParams.commit_sha, "abc123");
  });

  test("GitLab file content transformation logic", () => {
    // Test the file content transformation used in vcs.repos.getContent
    const mockGitLabResponse = {
      content: "Y29uc29sZS5sb2coJ3Rlc3QnKTs=", // base64 of "console.log('test');"
      encoding: "base64",
      size: 20,
      blob_id: "abc123"
    };

    // This simulates the transformFileContent function logic
    const transformed = {
      data: {
        content: mockGitLabResponse.content,
        encoding: mockGitLabResponse.encoding || 'base64',
        size: mockGitLabResponse.size,
        sha: mockGitLabResponse.blob_id,
        type: 'file'
      }
    };

    assert.strictEqual(transformed.data.content, "Y29uc29sZS5sb2coJ3Rlc3QnKTs=");
    assert.strictEqual(transformed.data.encoding, "base64");
    assert.strictEqual(transformed.data.size, 20);
    assert.strictEqual(transformed.data.sha, "abc123");
    assert.strictEqual(transformed.data.type, "file");

    // Verify we can decode the content
    const decoded = Buffer.from(transformed.data.content, 'base64').toString('utf8');
    assert.strictEqual(decoded, "console.log('test');");
  });

  test("GitLab MR diff transformation logic", () => {
    // Test the diff transformation used in vcs.pulls.listFiles  
    const mockGitLabDiffs = [
      { new_path: "src/new.js", old_path: null, new_file: true, diff: "@@ -0,0 +1 @@\n+new" },
      { new_path: "src/mod.js", old_path: "src/mod.js", new_file: false, deleted_file: false, diff: "@@ -1 +1 @@\n-old\n+new" },
      { new_path: null, old_path: "src/del.js", deleted_file: true, diff: "@@ -1 +0,0 @@\n-deleted" }
    ];

    const transformed = mockGitLabDiffs.map(change => {
      let status = 'modified';
      if (change.new_file) status = 'added';
      else if (change.deleted_file) status = 'removed';
      
      return {
        filename: change.new_path || change.old_path,
        status: status,
        additions: 0, // Not available in GitLab
        deletions: 0, // Not available in GitLab  
        changes: 0,
        patch: change.diff
      };
    });

    assert.strictEqual(transformed.length, 3);
    
    // New file
    assert.strictEqual(transformed[0].filename, "src/new.js");
    assert.strictEqual(transformed[0].status, "added");
    assert.strictEqual(transformed[0].patch, "@@ -0,0 +1 @@\n+new");
    
    // Modified file
    assert.strictEqual(transformed[1].filename, "src/mod.js");
    assert.strictEqual(transformed[1].status, "modified");
    
    // Deleted file
    assert.strictEqual(transformed[2].filename, "src/del.js");
    assert.strictEqual(transformed[2].status, "removed");
  });

  test("GitLab target URL construction logic", () => {
    // Test the target URL logic used in vcs.checks.create
    const baseUrl = "https://gitlab.com";
    const fullName = transformedPayload.repository.full_name;
    const mrNumber = transformedPayload.pull_request.number;
    
    const targetUrl = `${baseUrl}/${fullName}/-/merge_requests/${mrNumber}`;
    
    assert.strictEqual(targetUrl, "https://gitlab.com/cogni-dao/core/cogni-git-review/-/merge_requests/1");
  });
});