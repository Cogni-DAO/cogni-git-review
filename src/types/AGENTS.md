# VCS Type Definitions

## Overview
TypeScript type definitions for the host-agnostic VCS (Version Control System) interface. These DTOs (Data Transfer Objects) abstract away host-specific response formats, enabling Cogni to work with GitHub, GitLab, or local git repositories through a unified interface.

## Core Types

### vcs.ts
Host-agnostic VCS data transfer objects defining the common interface for all VCS operations.

#### Key Interfaces

**Reviewable**: Core PR/MR entity
- Common fields across all VCS hosts (id, number, state, title, body)
- Head/base references with SHA and repository information
- Metrics (changed_files, additions, deletions)
- User information

**ChangedFile**: File change information
- Filename and status (added, modified, removed, renamed)
- Change metrics (additions, deletions, changes)
- Optional patch content and previous filename for renames

**RepoContent**: Repository file/directory content
- Type distinction (file vs directory)
- Content delivery (base64 encoded or UTF-8)
- SHA for content verification

**CompareResult**: Commit comparison between references
- Commit ahead/behind metrics
- Status indicator (ahead, behind, identical, diverged)
- List of commits and changed files

**CheckResult**: CI/CD check run representation
- Status tracking (queued, in_progress, completed)
- Conclusion values matching GitHub's model
- Output with title, summary, and optional detailed text

**Comment**: PR/Issue comment representation
- Basic comment fields (id, body, user, timestamps)
- Reactions support

## Usage
These types define the contract between:
- Host adapters (GitHub, local-cli) that produce these DTOs
- Core Cogni logic that consumes these DTOs
- Gates and AI workflows that operate on normalized data

## Design Principles
1. **Host Agnostic**: No GitHub-specific fields in core interfaces
2. **Minimal Surface**: Only fields actually used by Cogni logic
3. **Future Proof**: Extensible for GitLab, Bitbucket, or other VCS hosts
4. **Type Safety**: Full TypeScript definitions for compile-time checking

## Integration
Adapters (src/adapters/) implement mappings:
- GitHub adapter: Maps Octokit responses to these DTOs
- Local CLI adapter: Generates these DTOs from git CLI output
- Future adapters: Will map their native APIs to these same DTOs