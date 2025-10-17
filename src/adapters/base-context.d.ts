/**
 * TypeScript definitions for Context interface used by Cogni gates
 * This matches the Probot Context interface structure that gates expect
 */

export interface BaseContext {
  // Core webhook payload (GitHub-like structure)
  payload: {
    repository: {
      name: string;
      full_name: string;
    };
    installation: {
      id: string | number;
    };
    pull_request?: {
      id: number;
      number: number;
      state: string;
      title: string;
      head: {
        sha: string;
        repo: {
          name: string;
          full_name: string;
        };
      };
      base: {
        sha: string;
        repo: {
          name: string; 
          full_name: string;
        };
      };
      changed_files?: number;
      additions?: number;
      deletions?: number;
    };
    action?: string;
    [key: string]: any;
  };

  // Repository metadata function
  repo(options?: Record<string, any>): {
    owner: string;
    repo: string;
    [key: string]: any;
  };

  // Host-agnostic VCS interface (what gates actually use)
  vcs: {
    config: {
      get(params: { owner: string; repo: string; path: string }): Promise<{ config: any }>;
    };
    pulls: {
      get(params: { owner: string; repo: string; pull_number: number }): Promise<{ data: any }>;
      listFiles(params: { owner: string; repo: string; pull_number: number }): Promise<{ data: any[] }>;
    };
    repos: {
      compareCommits(params: { owner: string; repo: string; base: string; head: string }): Promise<{ data: any }>;
      getContent(params: { owner: string; repo: string; path: string; ref?: string }): Promise<{ data: any }>;
      listPullRequestsAssociatedWithCommit?(params: { commit_sha: string }): Promise<{ data: any[] }>;
    };
    checks?: {
      create(params: any): Promise<{ data: any }>;
    };
    issues?: {
      createComment(params: { owner: string; repo: string; issue_number: number; body: string }): Promise<{ data: any }>;
      addLabels?(params: any): Promise<{ data: any }>;
    };
    git?: {
      getRef?(params: any): Promise<{ data: any }>;
      createRef?(params: any): Promise<{ data: any }>;
    };
    // Support both direct and rest namespaced access patterns
    rest?: {
      pulls: {
        listFiles(params: { owner: string; repo: string; pull_number: number }): Promise<{ data: any[] }>;
      };
    };
    // Allow other VCS operations for extensibility
    [key: string]: any;
  };

  // Host-specific interfaces (adapter-internal only)
  octokit?: any; // GitHub adapter uses this internally
  [hostSpecific: string]: any;

  // Runtime properties added by gate orchestrator
  pr?: {
    number: number;
    title: string;
    body?: string;
    head: {
      sha: string;
      repo: { name: string };
    };
    base?: {
      sha: string;
    };
    changed_files?: number;
    additions?: number;
    deletions?: number;
  };

  spec?: {
    gates?: Array<{
      type: string;
      id?: string;
      with?: Record<string, any>;
    }>;
    [key: string]: any;
  };

  annotation_budget?: number;
  idempotency_key?: string;
  reviewLimitsConfig?: Record<string, any>;

  // Logging interface (minimal Pino-like interface)
  log?: {
    info(msg: string | object, ...args: any[]): void;
    error(msg: string | object, ...args: any[]): void;
    warn(msg: string | object, ...args: any[]): void;
    debug(msg: string | object, ...args: any[]): void;
    child(bindings: Record<string, any>): any;
  };

  // Allow additional properties for extensibility
  [key: string]: any;
}

/**
 * Abstract base class for host adapters
 * Implements the BaseContext interface
 */
export abstract class HostAdapter implements BaseContext {
  abstract payload: BaseContext['payload'];
  abstract repo(options?: Record<string, any>): ReturnType<BaseContext['repo']>;
  abstract vcs: BaseContext['vcs'];

  // Optional properties that may be set by orchestrator
  pr?: BaseContext['pr'];
  spec?: BaseContext['spec'];
  annotation_budget?: number;
  idempotency_key?: string;
  reviewLimitsConfig?: Record<string, any>;
  log?: BaseContext['log'];

  // Allow additional properties
  [key: string]: any;
}

// Type helper for JSDoc annotations
export type ContextLike = BaseContext;