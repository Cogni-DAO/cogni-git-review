/**
 * VCS DTOs - Host-agnostic data transfer objects
 * These neutral DTOs abstract away host-specific response formats
 */

// Core VCS entities
export interface Reviewable {
  id: number;
  number: number;
  state: string;
  title: string;
  body?: string;
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
  user?: {
    login: string;
  };
}

export interface ChangedFile {
  filename: string;
  status: string; // "added" | "modified" | "removed" | "renamed"
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}

export interface RepoContent {
  type: string; // "file" | "dir"
  name: string;
  path: string;
  sha: string;
  size: number;
  content?: string; // base64 encoded for files
  encoding?: string; // "base64" | "utf-8"
  download_url?: string;
}

export interface CompareResult {
  ahead_by: number;
  behind_by: number;
  status: string; // "ahead" | "behind" | "identical" | "diverged"
  total_commits: number;
  commits: Array<{
    sha: string;
    commit: {
      message: string;
      author: {
        name: string;
        email: string;
        date: string;
      };
    };
  }>;
  files: ChangedFile[];
}

// Configuration and content DTOs
export interface Config {
  [key: string]: any;
}

// CI/CD integration DTOs
export interface CheckResult {
  id: number;
  head_sha: string;
  status: string; // "queued" | "in_progress" | "completed"
  conclusion?: string; // "success" | "failure" | "neutral" | "cancelled" | "timed_out" | "action_required"
  name: string;
  html_url: string;
  details_url?: string;
  started_at?: string;
  completed_at?: string;
  output?: {
    title: string;
    summary: string;
    text?: string;
  };
}

export interface Comment {
  id: number;
  body: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  user: {
    login: string;
  };
}

// Repository metadata
export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description?: string;
  default_branch: string;
  private: boolean;
}

// Git references
export interface GitRef {
  ref: string;
  sha: string;
  object: {
    type: string;
    sha: string;
  };
}

// Standard VCS response wrapper
export interface VcsResponse<T> {
  data: T;
  status: number;
  headers?: Record<string, string>;
}