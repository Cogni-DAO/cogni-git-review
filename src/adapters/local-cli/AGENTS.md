# Local CLI Adapter Design

## Overview
Minimal VCS interface implementation for CLI-based PR review using local git operations. This adapter enables running Cogni gates locally without GitHub API dependencies.

## Architecture
The CLI adapter implements the same `BaseContext` interface as the GitHub adapter, allowing gates to run unchanged. Core operations are backed by git CLI commands and file system access.

## Essential VCS Methods (4 Required)

### 1. Configuration Loading
```javascript
context.vcs.config.get({ owner, repo, path })
// Implementation: fs.readFileSync() + YAML.parse()
// Used by: src/spec-loader.js:33
```

### 2. PR Statistics  
```javascript
context.vcs.pulls.get({ pull_number })
// Implementation: git diff --numstat base...head + git diff --shortstat base...head
// Returns: { data: { changed_files, additions, deletions } }
// Used by: src/gates/cogni/review-limits.js:20, src/pr-comment.js:93
```

### 3. File Content Access
```javascript
context.vcs.repos.getContent({ owner, repo, path })
// Implementation: fs.readFileSync() + base64 encoding
// Used by: src/gates/cogni/governance-policy.js:51
```

### 4. Changed Files List
```javascript
context.vcs.pulls.listFiles({ pull_number })
// Implementation: git diff --name-status base...head
// Returns: { data: [{ filename, status, additions, deletions, changes }] }
// Used by: src/gates/cogni/agents-md-sync.js:26

// Also support .rest. variant for AI workflows:
context.vcs.rest.pulls.listFiles({ pull_number })
// Used by: src/ai/workflows/goal-evaluations.js:27
```

## Optional Methods (Graceful Degradation)

### Platform Feedback
```javascript
context.vcs.checks.create({...})         // � console.log + JSON report
context.vcs.issues.createComment({...})  // � console.log (no-op)
```

## Implementation Status

✅ **COMPLETE**: All components implemented and ready for use

### File Structure
```
src/adapters/local-cli/
├── AGENTS.md           # This file - implementation overview
├── local-context.js    # LocalContext class implementing BaseContext
├── local-app.js        # LocalCogniApp class implementing CogniBaseApp  
└── git-utils.js        # Git CLI parsing utilities
```

### Components

**local-context.js**: 
- Extends HostAdapter, implements BaseContext interface
- Creates GitHub-like payload from git state
- VCS interface backed by git CLI commands and filesystem
- Graceful error handling and console output formatting

**local-app.js**:
- Implements CogniBaseApp interface for event registration
- Stores event handlers for later execution
- Simulates PR events to trigger gate evaluation

**git-utils.js**:
- Parse git diff --shortstat output
- Parse git diff --name-status output  
- Safe git command execution with error handling
- Git repository validation utilities

## Original Design Strategy

```javascript
class LocalContext {
  constructor(baseRef, headRef, repoPath) {
    this.baseRef = baseRef;
    this.headRef = headRef;
    this.repoPath = repoPath;
  }

  vcs = {
    config: {
      get: async ({ path }) => {
        const content = fs.readFileSync(join(this.repoPath, path), 'utf8');
        return { config: YAML.parse(content) };
      }
    },
    
    pulls: {
      get: async () => {
        const stats = execSync(`git diff --shortstat ${this.baseRef}...${this.headRef}`);
        const [files, additions, deletions] = parseGitStats(stats);
        return { data: { changed_files: files, additions, deletions } };
      },
      
      listFiles: async () => {
        const output = execSync(`git diff --name-status ${this.baseRef}...${this.headRef}`);
        return { data: parseGitNameStatus(output) };
      }
    },
    
    rest: {
      pulls: {
        listFiles: async (...args) => this.vcs.pulls.listFiles(...args)
      }
    },
    
    repos: {
      getContent: async ({ path }) => {
        const content = fs.readFileSync(join(this.repoPath, path), 'utf8');
        return { data: { content: Buffer.from(content).toString('base64') } };
      }
    },
    
    checks: {
      create: async (params) => {
        console.log(` Check: ${params.conclusion} - ${params.output.summary}`);
        return { data: { id: 'local-check', html_url: 'local://check' } };
      }
    },
    
    issues: {
      createComment: async ({ body }) => {
        console.log('=� PR Comment:', body);
        return { data: { id: 'local-comment' } };
      }
    }
  }
}
```

## Git CLI Mappings

| VCS Method | Git Command | Output Format |
|------------|-------------|---------------|
| `pulls.get()` | `git diff --shortstat base...head` | `3 files changed, 25 insertions(+), 7 deletions(-)` |
| `pulls.listFiles()` | `git diff --name-status base...head` | `M src/file.js\nA new-file.js\nD old-file.js` |
| `config.get()` | `fs.readFileSync(.cogni/repo-spec.yaml)` | YAML file content |
| `repos.getContent()` | `fs.readFileSync(path)` | Raw file content � base64 |

## Data Available Locally

 **Available:**
- PR statistics (changed files count, additions, deletions)  
- File change lists (paths, status, line counts)
- File content access (any file in repository)
- Configuration files (.cogni/repo-spec.yaml)

L **Not Available (graceful degradation):**
- GitHub check runs (output to console/JSON)
- PR comments (output to console)
- Repository management operations
- GitHub-specific metadata

## Methods Not Needed

Based on gate analysis, these VCS methods are **not used** by core gates:
- `context.vcs.repos.compareCommits()` - No active usage found
- `context.vcs.repos.listPullRequestsAssociatedWithCommit()` - Only for GitHub rerun events
- `context.vcs.pulls.create()` - Only in setup flows
- `context.vcs.git.*` - Only in setup flows

## Success Criteria

 All built-in gates run successfully:
- review-limits (uses `pulls.get`)
- agents-md-sync (uses `pulls.listFiles`)  
- governance-policy (uses `repos.getContent`)
- goal-declaration (uses `config.get`)
- AI rules (use `rest.pulls.listFiles`)

 Gate results output to console with proper formatting
 No GitHub API dependencies for core functionality
 Identical gate behavior compared to GitHub adapter

## Usage

### CLI Execution
```bash
# Run from repository root
node src/adapters/local-cli.js [baseRef] [headRef] [repoPath]

# Examples
node src/adapters/local-cli.js                    # Compare HEAD~1...HEAD
node src/adapters/local-cli.js main feature-branch  # Compare main...feature-branch  
node src/adapters/local-cli.js HEAD~3 HEAD /path/to/repo  # Custom repo path
```

### Integration
```javascript
import runLocalCLI from './src/adapters/local-cli.js';

const result = await runLocalCLI('main', 'feature-branch', '/path/to/repo');
```