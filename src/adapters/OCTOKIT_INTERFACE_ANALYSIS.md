# VCS Interface Analysis for LocalContext Implementation

**Architecture Change**: Gates now use `context.vcs` (host-agnostic) instead of `context.octokit` (GitHub-specific). The GitHub adapter maps `context.vcs` → `context.octokit` internally.

## Complete Octokit Usage Survey

Based on comprehensive codebase scan, here are **all** octokit methods used across the entire project:

### 📋 VCS Interface Mapping (16 unique patterns found)

**Old Pattern** (GitHub-specific):
```javascript
context.octokit.* 
```

**New Pattern** (Host-agnostic):
```javascript
context.vcs.*
```

**Complete VCS Interface Methods**:
```javascript
// Core Configuration & Data Access (5)
context.vcs.config.get({ owner, repo, path })
context.vcs.pulls.get(context.repo({ pull_number }))
context.vcs.pulls.listFiles({ owner, repo, pull_number })
context.vcs.rest.pulls.listFiles({ owner, repo, pull_number })
context.vcs.repos.getContent({ owner, repo, path })

// Repository Operations (2)
context.vcs.repos.compareCommits(context.repo({ base, head }))
context.vcs.repos.listPullRequestsAssociatedWithCommit({ commit_sha })

// Review Platform Features (1)
context.vcs.checks.create({...})

// Issue/Comment Platform Features (2)
context.vcs.issues.createComment({...})
context.vcs.issues.addLabels({...})

// Repository Management (6)
context.vcs.pulls.create({...})
context.vcs.pulls.list({...})
context.vcs.repos.get({ owner, repo })
context.vcs.repos.createOrUpdateFileContents({...})
context.vcs.git.getRef({...})
context.vcs.git.createRef({...})
```

### ✅ Core Gate Operations (MUST implement in LocalContext)

These are used by gates and core logic - **required for LocalContext**:

```javascript
// Configuration
context.vcs.config.get({ owner, repo, path })        // src/spec-loader.js:33

// Pull Request Data  
context.vcs.pulls.get(context.repo({ pull_number })) // src/pr-comment.js:93, review-limits.js:20, index.js:173
context.vcs.pulls.listFiles({ owner, repo, pull_number }) // agents-md-sync.js:26
context.vcs.rest.pulls.listFiles({ owner, repo, pull_number }) // goal-evaluations.js:27

// Repository Data
context.vcs.repos.compareCommits(context.repo({ base, head })) // (implied usage)
context.vcs.repos.getContent({ owner, repo, path })  // governance-policy.js:51, createWelcomePR.js:24,78,138,160
context.vcs.repos.listPullRequestsAssociatedWithCommit({ commit_sha }) // index.js:154
```

### 🔄 Platform-Specific Operations (LocalContext graceful degradation)

These have host-specific implementations:

```javascript
// Review Platform Features - Different per platform
context.vcs.checks.create({...})                     // index.js:42,57,132

// Issue/Comment Platform Features - Different per platform  
context.vcs.issues.createComment({...})              // src/pr-comment.js:73
context.vcs.issues.addLabels({...})                  // createWelcomePR.js:256

// Repository Management Operations - Host-specific
context.vcs.repos.createOrUpdateFileContents({...})  // createWelcomePR.js:35,148,174
context.vcs.git.getRef({...})                        // createWelcomePR.js:118  
context.vcs.git.createRef({...})                     // createWelcomePR.js:125
context.vcs.pulls.create({...})                      // createWelcomePR.js:246
context.vcs.pulls.list({...})                        // createWelcomePR.js:91
context.vcs.repos.get({ owner, repo })               // createWelcomePR.js:108
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
    rest: {
      pulls: {
        listFiles(params: { owner: string; repo: string; pull_number: number }): Promise<{ data: any[] }>;
      };
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

1. **15 octokit methods found** - Complete survey shows exact scope (was 13+ estimate)
2. **Core vs GitHub-specific split** - Some methods are essential, others are GitHub-only features
3. **Setup operations are GitHub-only** - createWelcomePR.js won't work locally (that's OK)
4. **Graceful degradation needed** - LocalContext should handle GitHub-specific methods gracefully

## Final Clean List: All VCS Interface Usage (One Line Per Call Type)

**Gates should use** (host-agnostic):
```
context.vcs.config.get
context.vcs.pulls.get
context.vcs.pulls.listFiles
context.vcs.rest.pulls.listFiles
context.vcs.repos.getContent
context.vcs.repos.compareCommits
context.vcs.repos.listPullRequestsAssociatedWithCommit
context.vcs.checks.create
context.vcs.issues.createComment
context.vcs.issues.addLabels
context.vcs.pulls.create
context.vcs.pulls.list
context.vcs.repos.get
context.vcs.repos.createOrUpdateFileContents
context.vcs.git.getRef
context.vcs.git.createRef
```

**GitHub adapter maps internally**:
```
context.vcs.* → context.octokit.*
```

**Total**: 16 unique VCS interface methods across entire codebase

## Next Steps

1. ✅ Update BaseContext TypeScript interface with complete VCS definition (DONE)
2. Update all gate code: `context.octokit.*` → `context.vcs.*` 
3. Create GitHub adapter: `context.vcs.*` → `context.octokit.*` mapping
4. Plan LocalContext git CLI implementation for `context.vcs.*` methods
5. Add runtime validator to catch unsupported VCS method usage

## Migration Strategy

1. **Gates Migration**: Update all gate code to use `context.vcs.*` instead of `context.octokit.*`
2. **GitHub Adapter**: Create mapping layer that converts VCS calls to Octokit calls
3. **LocalContext**: Implement `context.vcs.*` with git CLI operations
4. **Validation**: Add interface compliance testing for all adapters