# Octokit Interface Analysis for LocalContext Implementation

## Complete Octokit Usage Survey

Based on codebase scan, here are **all** octokit methods used across the entire project:

### ✅ Core Gate Operations (MUST implement in LocalContext)

These are used by gates and core logic - **required for LocalContext**:

```javascript
// Configuration
context.octokit.config.get({ owner, repo, path })        // src/spec-loader.js:33

// Pull Request Data  
context.octokit.pulls.get(context.repo({ pull_number })) // src/pr-comment.js:93, review-limits.js:20, index.js:173
context.octokit.pulls.listFiles({ owner, repo, pull_number }) // agents-md-sync.js:26, goal-evaluations.js:27

// Repository Data
context.octokit.repos.compareCommits(context.repo({ base, head })) // (implied usage)
context.octokit.repos.getContent({ owner, repo, path })  // governance-policy.js:51, createWelcomePR.js:24,78,138,160
context.octokit.repos.listPullRequestsAssociatedWithCommit({ commit_sha }) // index.js:154
```

### 🚫 GitHub-Specific Operations (LocalContext should NO-OP or throw)

These are GitHub-only features that don't have local equivalents:

```javascript
// GitHub Checks API - No local equivalent
context.octokit.checks.create({...})                     // index.js:42,57,132

// GitHub Issues/PR Comments - No local equivalent  
context.octokit.issues.createComment({...})              // src/pr-comment.js:73
context.octokit.issues.addLabels({...})                  // createWelcomePR.js:256

// Setup/Installation Operations - GitHub-only
context.octokit.repos.createOrUpdateFileContents({...})  // createWelcomePR.js:35,148,174
context.octokit.git.getRef({...})                        // createWelcomePR.js:118  
context.octokit.git.createRef({...})                     // createWelcomePR.js:125
context.octokit.pulls.create({...})                      // createWelcomePR.js:246
context.octokit.pulls.list({...})                        // createWelcomePR.js:91
context.octokit.repos.get({ owner, repo })               // createWelcomePR.js:108
```

## LocalContext Implementation Strategy

### Required Methods → Git CLI Mapping

```javascript
// LocalContext must implement these with git equivalents:
class LocalContext {
  octokit = {
    config: {
      get: async ({ path }) => {
        // fs.readFileSync(join(this.repoPath, path))
        // return { config: YAML.parse(content) }
      }
    },
    pulls: {
      get: async ({ pull_number }) => {
        // git diff --numstat base...head  
        // return { data: { changed_files, additions, deletions } }
      },
      listFiles: async ({ pull_number }) => {
        // git diff --name-status base...head
        // return { data: [{filename, status, additions, deletions}] }
      }
    },
    repos: {
      compareCommits: async ({ base, head }) => {
        // git diff base...head (unified format)
        // return { data: { files: [...] } }
      },
      getContent: async ({ path }) => {
        // fs.readFileSync(join(this.repoPath, path))
        // return { data: { content: Buffer.from(content).toString('base64') } }
      },
      listPullRequestsAssociatedWithCommit: async ({ commit_sha }) => {
        // Return synthetic PR data based on current context
        // return { data: [this.getCurrentPR()] }
      }
    }
  }
}
```

### GitHub-Only Methods → Graceful Degradation

```javascript
// LocalContext should handle these gracefully:
class LocalContext {
  octokit = {
    checks: {
      create: async () => {
        // Local: Write to JSON file, add git note
        // return synthetic success response
      }
    },
    issues: {
      createComment: async ({ body }) => {
        // Local: Log to console or ignore
        // return synthetic success response  
      },
      addLabels: async () => {
        // Local: No-op (labels don't exist locally)
        // return synthetic success response
      }
    },
    // ... other GitHub-only methods throw clear errors
  }
}
```

## TypeScript Interface Definition

Based on this analysis, the BaseContext interface should be:

```typescript
interface BaseContext {
  octokit: {
    // REQUIRED - Core operations
    config: {
      get(params: { owner: string; repo: string; path: string }): Promise<{ config: any }>;
    };
    pulls: {
      get(params: { owner: string; repo: string; pull_number: number }): Promise<{ data: any }>;
      listFiles(params: { owner: string; repo: string; pull_number: number }): Promise<{ data: any[] }>;
    };
    repos: {
      compareCommits(params: { owner: string; repo: string; base: string; head: string }): Promise<{ data: any }>;
      getContent(params: { owner: string; repo: string; path: string }): Promise<{ data: any }>;
      listPullRequestsAssociatedWithCommit(params: { commit_sha: string }): Promise<{ data: any[] }>;
    };
    
    // OPTIONAL - GitHub-specific (LocalContext can no-op)
    checks?: {
      create(params: any): Promise<{ data: any }>;
    };
    issues?: {
      createComment(params: any): Promise<{ data: any }>;
      addLabels(params: any): Promise<{ data: any }>;
    };
    git?: {
      getRef(params: any): Promise<{ data: any }>;
      createRef(params: any): Promise<{ data: any }>;
    };
    
    // Extensibility
    [key: string]: any;
  };
}
```

## Runtime Validator

```javascript
// Scan codebase for unsupported octokit usage
export function validateOctokitUsage(context) {
  const handler = {
    get(target, prop) {
      if (!SUPPORTED_METHODS.has(prop)) {
        console.warn(`Unsupported octokit method: ${prop}`);
      }
      return target[prop];
    }
  };
  return new Proxy(context.octokit, handler);
}
```

## Key Insights

1. **13+ octokit methods used** - Much more than initial 5 method estimate
2. **Core vs GitHub-specific split** - Some methods are essential, others are GitHub-only features
3. **Setup operations are GitHub-only** - createWelcomePR.js won't work locally (that's OK)
4. **Graceful degradation needed** - LocalContext should handle GitHub-specific methods gracefully

## Next Steps

1. Update BaseContext TypeScript interface with complete octokit definition
2. Plan LocalContext git CLI mappings for required methods  
3. Design graceful degradation for GitHub-specific operations
4. Add runtime validator to catch unsupported method usage